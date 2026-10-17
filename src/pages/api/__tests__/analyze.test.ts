/**
 * Tests für src/pages/api/analyze.ts
 *
 * Abgedeckte Szenarien:
 * - Origin-Check (fehlt / ungültig / alle drei erlaubten Origins)
 * - Rate-Limit (enforceLimit gibt 429 zurück, bucket 'analyze')
 * - Fehlende GEMINI_API_KEY → 500
 * - Validierung: kein File, File > 10 MB, ungültiger MIME-Typ
 * - MIME-Typ-Erkennung per Magic Bytes (JPEG, PNG akzeptiert; Text abgelehnt)
 * - Kein Fallback auf file.type: unbekannte Magic Bytes werden abgelehnt (#210)
 * - ModelId-Whitelist (ungültige ID → Fallback auf gemini-1.5-flash)
 * - Erfolgsfall: AI gibt JSON-Array zurück → 200 mit korrektem Shape
 * - Erfolgsfall: JSON in Markdown-Codefences (```json ... ```) wird toleriert
 * - AI-Antwort enthält kein JSON-Array → 422 (#259)
 * - AI-Antwort enthält kaputtes/unparsebares JSON → 422 (#259)
 * - Event-Objekt mit unbekanntem Feld → 422, strict object (#259)
 * - Event-Objekt mit ungültigem Datumsformat → 422 (#259)
 * - Mehr als 20 Terminobjekte → 422 (#259)
 * - generateContent wirft → 500
 * - result.response.text() wirft → 500
 *
 * Hinweis zur Infrastruktur: jsdom-File-Instanzen sind nicht kompatibel mit
 * undici's multipartFormDataParser (falsche webidl-Klasse). Daher wird
 * request.formData() per Mock-Request umgangen — kein echter Multipart-Parse.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks (vi.mock wird vor Imports ausgeführt) ---
const { enforceLimitMock, generateContentMock, getGenerativeModelMock, GoogleGenerativeAIMock } =
  vi.hoisted(() => {
    const generateContentMock = vi.fn();
    const getGenerativeModelMock = vi.fn(() => ({
      generateContent: generateContentMock,
    }));
    // Reguläre Funktion nötig: Arrow Functions können nicht mit `new` aufgerufen werden.

    const GoogleGenerativeAIMock = vi.fn(function () {
      return { getGenerativeModel: getGenerativeModelMock };
    });

    return {
      enforceLimitMock: vi.fn(() => null),
      generateContentMock,
      getGenerativeModelMock,
      GoogleGenerativeAIMock,
    };
  });

vi.mock('../../../lib/rateLimit', () => ({
  enforceLimit: enforceLimitMock,
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: GoogleGenerativeAIMock,
}));

import { POST } from '../analyze';

// --- Magic-Byte-Fixtures ---
// JPEG: FF D8 FF ...
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00]);
// PNG:  89 50 4E 47 ...
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// GIF:  47 49 46 ("GIF")
const GIF_MAGIC = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
// WEBP: "RIFF" + Größe + "WEBP"
const WEBP_MAGIC = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
// WAV: "RIFF" + Größe + "WAVE" — gleicher RIFF-Container, aber kein WEBP
const WAV_MAGIC = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
]);
// PDF: 25 50 44 46 ("%PDF")
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
// Unbekannte Bytes (kein gültiger MIME-Marker)
const UNKNOWN_BYTES = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x00, 0x00]);

// --- AI-Response-Fixtures ---
const VALID_AI_JSON =
  '[{"title":"Test-Event","date":"2024-12-25","time":"14:00","location":"Berlin","description":"Details"}]';

function makeAiResult(text: string) {
  return { response: { text: () => text } };
}

// --- Mock-File-Typ ---
// Die route nutzt: file.size, file.type, file.arrayBuffer()
interface MockFile {
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function makeMockFile(bytes: Uint8Array, type: string, overrideSize?: number): MockFile {
  // Eigener ArrayBuffer ohne shared-buffer-Offset, damit .slice(0,8) korrekt funktioniert
  const buf = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return {
    size: overrideSize ?? bytes.byteLength,
    type,
    arrayBuffer: async () => buf,
  };
}

// --- Mock-Context-Helfer ---
// Umgeht undici-FormData-Parsing (jsdom-File inkompatibel mit webidl.is.File).
// Die route liest ausschließlich: request.headers, request.formData()
function makeContext(
  file: MockFile | null,
  opts: {
    origin?: string | null;
    modelId?: string;
    additionalPrompt?: string;
  } = {}
) {
  const origin = opts.origin === undefined ? 'https://alex-schneider.dev' : opts.origin;
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);

  const mockFormData = {
    get: (key: string): MockFile | string | null => {
      if (key === 'file') return file;
      if (key === 'modelId') return opts.modelId ?? null;
      if (key === 'additionalPrompt') return opts.additionalPrompt ?? null;
      return null;
    },
  };

  return {
    request: {
      headers,
      formData: async () => mockFormData,
    } as unknown as Request,
  };
}

// --- Tests ---
describe('POST /api/analyze', () => {
  const defaultFile = makeMockFile(JPEG_MAGIC, 'image/jpeg');

  // console.error der Fehlerfall-Tests unterdrücken (Gemini #209, analog zu
  // search.json.test.ts) — sonst fluten erwartete Stacktraces die Konsole.
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    enforceLimitMock.mockReturnValue(null);
    generateContentMock.mockResolvedValue(makeAiResult(VALID_AI_JSON));
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  describe('Origin-Check', () => {
    it('lehnt fehlenden Origin-Header mit 403 ab', async () => {
      const ctx = makeContext(defaultFile, { origin: null });
      const res = await POST(ctx as never);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Forbidden');
    });

    it('lehnt unerlaubten Origin mit 403 ab', async () => {
      const ctx = makeContext(defaultFile, { origin: 'https://evil.com' });
      const res = await POST(ctx as never);
      expect(res.status).toBe(403);
    });

    it('akzeptiert https://alex-schneider.dev', async () => {
      const ctx = makeContext(defaultFile, { origin: 'https://alex-schneider.dev' });
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });

    it('akzeptiert https://alexle135.de (Übergangsphase bis 301)', async () => {
      const ctx = makeContext(defaultFile, { origin: 'https://alexle135.de' });
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });

    it('akzeptiert https://www.alex-schneider.dev', async () => {
      const ctx = makeContext(defaultFile, { origin: 'https://www.alex-schneider.dev' });
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });

    it('akzeptiert http://localhost:4321', async () => {
      const ctx = makeContext(defaultFile, { origin: 'http://localhost:4321' });
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  describe('Rate-Limit', () => {
    it('gibt 429 zurück wenn Rate-Limit überschritten', async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: 'Too many requests. Try again later.' }),
        { status: 429, headers: { 'Retry-After': '3600', 'Content-Type': 'application/json' } }
      );
      enforceLimitMock.mockReturnValue(rateLimitResponse);

      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(429);
      expect(enforceLimitMock).toHaveBeenCalledWith(expect.any(Object), 'analyze', undefined);
    });
  });

  // -------------------------------------------------------------------------
  describe('API-Key-Prüfung', () => {
    it('gibt 500 zurück wenn GEMINI_API_KEY nicht gesetzt ist', async () => {
      vi.stubEnv('GEMINI_API_KEY', '');
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Server configuration error');
    });
  });

  // -------------------------------------------------------------------------
  describe('Eingabe-Validierung', () => {
    it('gibt 400 zurück wenn kein File übermittelt wird', async () => {
      const ctx = makeContext(null);
      const res = await POST(ctx as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No file provided');
    });

    it('gibt 400 zurück bei File > 10 MB', async () => {
      // overrideSize simuliert eine große Datei ohne echte Bytes allozieren zu müssen
      const bigFile = makeMockFile(JPEG_MAGIC, 'image/jpeg', 10 * 1024 * 1024 + 1);
      const ctx = makeContext(bigFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('10 MB');
    });

    it('gibt 400 zurück bei nicht erlaubtem MIME-Typ (file.type text/plain, Magic Bytes unbekannt)', async () => {
      // UNKNOWN_BYTES → detectMimeType() → null → abgelehnt (kein file.type-Fallback, #210)
      const textFile = makeMockFile(UNKNOWN_BYTES, 'text/plain');
      const ctx = makeContext(textFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Unsupported file type');
    });
  });

  // -------------------------------------------------------------------------
  describe('MIME-Typ-Erkennung (Magic Bytes)', () => {
    it('erkennt JPEG-Datei per Magic Bytes und lässt sie durch', async () => {
      const ctx = makeContext(makeMockFile(JPEG_MAGIC, 'image/jpeg'));
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });

    it('erkennt PNG-Datei per Magic Bytes und lässt sie durch', async () => {
      const ctx = makeContext(makeMockFile(PNG_MAGIC, 'image/png'));
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });

    it('erkennt GIF-Datei per Magic Bytes und lässt sie durch', async () => {
      const ctx = makeContext(makeMockFile(GIF_MAGIC, 'image/gif'));
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });

    it('erkennt WEBP-Datei per vollständiger RIFF+WEBP-Signatur und lässt sie durch', async () => {
      const ctx = makeContext(makeMockFile(WEBP_MAGIC, 'image/webp'));
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });

    it('erkennt PDF-Datei per Magic Bytes und lässt sie durch', async () => {
      const ctx = makeContext(makeMockFile(PDF_MAGIC, 'application/pdf'));
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
    });

    it('lehnt RIFF-Container ohne WEBP-Kennung ab (z.B. WAV)', async () => {
      // "RIFF....WAVE" mit gespooftem file.type darf nicht als image/webp durchgehen
      const wavFile = makeMockFile(WAV_MAGIC, 'image/webp');
      const ctx = makeContext(wavFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(400);
    });

    it('lehnt Mini-Dateien unter 12 Bytes ohne Crash ab', async () => {
      // Kürzer als jede geprüfte Signatur — darf nicht durchgehen und nicht werfen
      const tinyFile = makeMockFile(new Uint8Array([0x52, 0x49]), 'image/webp');
      const ctx = makeContext(tinyFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(400);
    });

    it('lehnt unbekannte Magic Bytes ab, auch wenn file.type erlaubt wäre (#210)', async () => {
      // Angreifer-Szenario: beliebige Bytes mit type='image/jpeg'. Vor dem Fix griff der
      // || file.type-Fallback und die Allowlist-Prüfung wurde passiert.
      const spoofedFile = makeMockFile(UNKNOWN_BYTES, 'image/jpeg');
      const ctx = makeContext(spoofedFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Unsupported file type');
    });
  });

  // -------------------------------------------------------------------------
  describe('ModelId-Whitelist', () => {
    it('fällt bei ungültiger modelId auf gemini-1.5-flash zurück', async () => {
      const ctx = makeContext(defaultFile, { modelId: 'gpt-4o' });
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: 'gemini-1.5-flash' });
    });

    it('verwendet gemini-1.5-pro wenn angegeben', async () => {
      const ctx = makeContext(defaultFile, { modelId: 'gemini-1.5-pro' });
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: 'gemini-1.5-pro' });
    });

    it('verwendet gemini-2.0-flash wenn angegeben', async () => {
      const ctx = makeContext(defaultFile, { modelId: 'gemini-2.0-flash' });
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: 'gemini-2.0-flash' });
    });
  });

  // -------------------------------------------------------------------------
  describe('Erfolgsfall', () => {
    it('gibt 200 mit Content-Type application/json zurück', async () => {
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('gibt geparsten JSON-Array aus AI-Antwort zurück', async () => {
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json[0]).toMatchObject({
        title: 'Test-Event',
        date: '2024-12-25',
        time: '14:00',
        location: 'Berlin',
      });
    });

    it('extrahiert JSON-Array wenn AI-Antwort zusätzlichen Text enthält', async () => {
      generateContentMock.mockResolvedValue(
        makeAiResult('Hier sind die gefundenen Termine:\n' + VALID_AI_JSON + '\nBitte prüfen.')
      );
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(1);
    });

    it('gibt leeres Array zurück wenn AI [] antwortet', async () => {
      generateContentMock.mockResolvedValue(makeAiResult('[]'));
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual([]);
    });

    it('toleriert Markdown-Codefences (```json ... ```) um das JSON-Array', async () => {
      generateContentMock.mockResolvedValue(
        makeAiResult('Hier die Termine:\n```json\n' + VALID_AI_JSON + '\n```\n')
      );
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json[0]).toMatchObject({ title: 'Test-Event', date: '2024-12-25' });
    });

    it('ruft enforceLimit mit bucket "analyze" auf', async () => {
      const ctx = makeContext(defaultFile);
      await POST(ctx as never);
      expect(enforceLimitMock).toHaveBeenCalledWith(expect.any(Object), 'analyze', undefined);
    });
  });

  // -------------------------------------------------------------------------
  // Zod-Validierung der Gemini-Antwort (#259): strikte Prüfung statt
  // ungeprüftem Durchreichen von Regex-extrahiertem Text.
  describe('Zod-Validierung der AI-Antwort (#259)', () => {
    it('gibt 422 zurück wenn AI-Antwort kein JSON-Array enthält', async () => {
      generateContentMock.mockResolvedValue(
        makeAiResult('Ich habe leider keine Termine gefunden.')
      );
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toBe('Invalid AI response');
    });

    it('gibt 422 zurück wenn die Antwort kaputtes/unparsebares JSON enthält', async () => {
      generateContentMock.mockResolvedValue(
        makeAiResult('[{"title": "Kaputt", "date": "2024-12-25"') // kein schließendes ] und }
      );
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toBe('Invalid AI response');
    });

    it('gibt 422 zurück bei unbekanntem Feld im Event-Objekt (strict object)', async () => {
      generateContentMock.mockResolvedValue(
        makeAiResult(
          '[{"title":"Test","date":"2024-12-25","unexpectedField":"sollte abgelehnt werden"}]'
        )
      );
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toBe('Invalid AI response');
    });

    it('gibt 422 zurück bei ungültigem Datumsformat', async () => {
      generateContentMock.mockResolvedValue(makeAiResult('[{"title":"Test","date":"25.12.2024"}]'));
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(422);
    });

    it('gibt 422 zurück bei kalendarisch unmöglichem Datum (formal valide, aber ungültig)', async () => {
      generateContentMock.mockResolvedValue(makeAiResult('[{"title":"Test","date":"2024-02-30"}]'));
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(422);
    });

    it('gibt 422 zurück bei leerem Titel', async () => {
      generateContentMock.mockResolvedValue(makeAiResult('[{"title":"","date":"2024-12-25"}]'));
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(422);
    });

    it('gibt 422 zurück bei mehr als 20 Terminobjekten', async () => {
      const events = Array.from({ length: 21 }, (_, i) => ({
        title: `Event ${i}`,
        date: '2024-12-25',
      }));
      generateContentMock.mockResolvedValue(makeAiResult(JSON.stringify(events)));
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toBe('Invalid AI response');
    });

    it('akzeptiert genau 20 Terminobjekte', async () => {
      const events = Array.from({ length: 20 }, (_, i) => ({
        title: `Event ${i}`,
        date: '2024-12-25',
      }));
      generateContentMock.mockResolvedValue(makeAiResult(JSON.stringify(events)));
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveLength(20);
    });

    it('behandelt leere Strings bei optionalen Feldern wie "nicht vorhanden"', async () => {
      generateContentMock.mockResolvedValue(
        makeAiResult(
          '[{"title":"Test","date":"2024-12-25","time":"","location":"","description":""}]'
        )
      );
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json[0].time).toBeUndefined();
      expect(json[0].location).toBeUndefined();
      expect(json[0].description).toBeUndefined();
    });

    it('behandelt null bei optionalen Feldern wie "nicht vorhanden" (gemischt mit "")', async () => {
      // Gemini liefert für fehlende Angaben mal "", mal null — beides darf kein 422 auslösen.
      generateContentMock.mockResolvedValue(
        makeAiResult(
          '[{"title":"Test","date":"2024-12-25","time":null,"location":"","description":null}]'
        )
      );
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json[0].time).toBeUndefined();
      expect(json[0].location).toBeUndefined();
      expect(json[0].description).toBeUndefined();
    });

    it('nimmt bei mehreren Codefences den ersten Fence mit JSON-Array', async () => {
      // LLMs liefern gelegentlich mehrere Fences (z.B. erst eine Erklärung
      // ohne Array, dann das eigentliche Ergebnis-Array).
      generateContentMock.mockResolvedValue(
        makeAiResult(
          'Beispielformat:\n```\ntitle, date\n```\nErgebnis:\n```json\n' + VALID_AI_JSON + '\n```'
        )
      );
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveLength(1);
      expect(json[0]).toMatchObject({ title: 'Test-Event', date: '2024-12-25' });
    });
  });

  // -------------------------------------------------------------------------
  describe('Fehlerfall (AI-Provider)', () => {
    it('gibt 500 zurück wenn generateContent wirft', async () => {
      generateContentMock.mockRejectedValue(new Error('Quota exceeded'));
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal Server Error');
    });

    it('gibt 500 zurück wenn result.response.text() wirft', async () => {
      generateContentMock.mockResolvedValue({
        response: {
          text: () => {
            throw new Error('Blocked by safety filter');
          },
        },
      });
      const ctx = makeContext(defaultFile);
      const res = await POST(ctx as never);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal Server Error');
    });
  });
});
