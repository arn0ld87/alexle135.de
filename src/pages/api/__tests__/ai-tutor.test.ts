/**
 * Unit-Tests für src/pages/api/ai-tutor.ts
 *
 * Abgedeckte Szenarien:
 * - Origin-Check (fehlt / ungültig / alle drei erlaubten Origins)
 * - Rate-Limit (Middleware gibt 429 zurück)
 * - Prompt-Validierung (fehlt, null, nicht-string, zu lang, Grenzwert 10000)
 * - Fehlende GEMINI_API_KEY → 500 Server-Config-Error
 * - Erfolgsfall: AI-Antwort wird zurückgegeben, prompt wird weitergeleitet
 * - AI-Provider-Fehler → 500 Internal Server Error
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks (vi.mock wird vor Imports ausgeführt) ---
const { enforceLimitMock, generateContentMock, textMock, MockGoogleGenerativeAI } = vi.hoisted(
  () => {
    const textMock = vi.fn().mockReturnValue('mocked AI response');
    const generateContentMock = vi.fn().mockResolvedValue({
      response: { text: textMock },
    });

    // Echte Klasse erforderlich: Vitest 4 erlaubt keine Arrow-Function als
    // Konstruktor (new GoogleGenerativeAI(...) schlägt sonst fehl).
    class MockGoogleGenerativeAI {
      getGenerativeModel(_opts: unknown) {
        return { generateContent: generateContentMock };
      }
    }

    return {
      enforceLimitMock: vi.fn().mockResolvedValue(null),
      generateContentMock,
      textMock,
      MockGoogleGenerativeAI,
    };
  }
);

vi.mock('../../../lib/rateLimit', () => ({
  enforceLimit: enforceLimitMock,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: MockGoogleGenerativeAI,
}));

import { POST } from '../ai-tutor';

// --- Hilfsfunktion ---
function makeRequest(
  body: Record<string, unknown>,
  opts: { origin?: string | null } = {}
): Request {
  const origin = opts.origin === undefined ? 'https://alexle135.de' : opts.origin;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (origin !== null) headers['origin'] = origin;

  return new Request('https://alexle135.de/api/ai-tutor', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// --- Tests ---
describe('POST /api/ai-tutor', () => {
  // console.error der Fehlerfall-Tests unterdrücken (Gemini #209, analog zu
  // search.json.test.ts) — sonst fluten erwartete Stacktraces die Konsole.
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key');
    enforceLimitMock.mockResolvedValue(null);
    textMock.mockReturnValue('mocked AI response');
    generateContentMock.mockResolvedValue({ response: { text: textMock } });
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    consoleSpy.mockRestore();
  });

  describe('Origin-Check', () => {
    it('lehnt fehlenden Origin-Header mit 403 ab', async () => {
      const req = makeRequest({ prompt: 'Hello' }, { origin: null });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Forbidden');
    });

    it('lehnt unerlaubten Origin mit 403 ab', async () => {
      const req = makeRequest({ prompt: 'Hello' }, { origin: 'https://evil.com' });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(403);
    });

    it('akzeptiert https://alexle135.de', async () => {
      const req = makeRequest({ prompt: 'Hello' }, { origin: 'https://alexle135.de' });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(200);
    });

    it('akzeptiert https://www.alexle135.de', async () => {
      const req = makeRequest({ prompt: 'Hello' }, { origin: 'https://www.alexle135.de' });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(200);
    });

    it('akzeptiert http://localhost:4321', async () => {
      const req = makeRequest({ prompt: 'Hello' }, { origin: 'http://localhost:4321' });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(200);
    });
  });

  describe('Rate-Limit', () => {
    it('gibt 429 zurück wenn Rate-Limit überschritten', async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: 'Too many requests. Try again later.' }),
        { status: 429, headers: { 'Retry-After': '3600', 'Content-Type': 'application/json' } }
      );
      enforceLimitMock.mockResolvedValue(rateLimitResponse);

      const req = makeRequest({ prompt: 'Hello' });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(429);
      expect(enforceLimitMock).toHaveBeenCalledWith(expect.any(Request), 'ai-tutor', undefined);
    });
  });

  describe('Prompt-Validierung', () => {
    it('lehnt fehlendes prompt mit 400 ab', async () => {
      const req = makeRequest({});
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No prompt provided');
    });

    it('lehnt prompt: null mit 400 ab', async () => {
      const req = makeRequest({ prompt: null });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No prompt provided');
    });

    it('lehnt nicht-string prompt (Zahl) mit 400 ab', async () => {
      const req = makeRequest({ prompt: 42 });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No prompt provided');
    });

    it('lehnt zu langes prompt (> 10000 Zeichen) mit 400 ab', async () => {
      const req = makeRequest({ prompt: 'a'.repeat(10001) });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('10000');
    });

    it('akzeptiert prompt mit genau 10000 Zeichen (Grenzwert)', async () => {
      const req = makeRequest({ prompt: 'a'.repeat(10000) });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(200);
    });
  });

  describe('Fehlende GEMINI_API_KEY', () => {
    it('gibt 500 zurück wenn kein API-Key konfiguriert', async () => {
      // Überschreibt den beforeEach-Stub mit leerem String (falsy) für beide
      // Env-Quellen: import.meta.env.GEMINI_API_KEY und process.env.GEMINI_API_KEY.
      vi.stubEnv('GEMINI_API_KEY', '');

      const req = makeRequest({ prompt: 'Hello' });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Server configuration error');
    });
  });

  describe('Erfolgsfall', () => {
    it('gibt 200 mit AI-Antwort-Text zurück', async () => {
      const req = makeRequest({ prompt: 'Was ist Linux?' });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.text).toBe('mocked AI response');
    });

    it('Content-Type der Antwort ist application/json', async () => {
      const req = makeRequest({ prompt: 'test' });
      const res = await POST({ request: req } as never);
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('leitet den prompt unverändert an Gemini weiter', async () => {
      const req = makeRequest({ prompt: 'Was ist sudo?' });
      await POST({ request: req } as never);
      expect(generateContentMock).toHaveBeenCalledWith('Was ist sudo?');
    });
  });

  describe('AI-Provider-Fehler', () => {
    it('gibt 500 zurück wenn Gemini-Aufruf eine Exception wirft', async () => {
      generateContentMock.mockRejectedValue(new Error('Gemini API Error'));

      const req = makeRequest({ prompt: 'Hello' });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal Server Error');
    });
  });
});
