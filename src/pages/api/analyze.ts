export const prerender = false;

// Detect MIME type from magic bytes to prevent client-supplied type spoofing
function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    return 'application/pdf';
  return null;
}

import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'astro/zod';
import { enforceLimit } from '../../lib/rateLimit';
import { withRequestLogging } from '../../lib/api/logger';

const ROUTE = '/api/analyze';

const ALLOWED_ORIGINS = new Set([
  'https://alexle135.de',
  'https://alex-schneider.dev',
  'https://www.alexle135.de',
  'https://www.alex-schneider.dev',
  'http://localhost:4321',
]);

// Gemini liefert Termine als freien Text mit eingebettetem JSON. Rohantworten
// werden NIE ungeprüft an den Client durchgereicht: JSON.parse + Zod-Validierung,
// bevor irgendetwas die Route verlässt (#259).
const MAX_EVENTS = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isPlausibleCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

// Optionale Textfelder: Gemini liefert für fehlende Angaben oft "" oder null
// statt das Feld wegzulassen. Beides wird wie "nicht vorhanden" behandelt.
const emptyToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);

const optionalText = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().max(maxLength).optional());

const eventSchema = z
  .object({
    title: z.string().min(1).max(300),
    date: z
      .string()
      .regex(DATE_PATTERN, 'date must match YYYY-MM-DD')
      .refine(isPlausibleCalendarDate, 'date is not a valid calendar date'),
    time: z.preprocess(
      emptyToUndefined,
      z.string().regex(TIME_PATTERN, 'time must match HH:MM').optional()
    ),
    location: optionalText(300),
    description: optionalText(2000),
  })
  .strict();

const eventsResponseSchema = z.array(eventSchema).max(MAX_EVENTS);

// Extrahiert einen möglichen JSON-Array-Kandidaten aus der Modellantwort.
// Toleriert Markdown-Codefences (```json ... ```) und Fließtext um das Array
// herum, wie Gemini sie häufig liefert. Bei mehreren Fences gewinnt der erste,
// der ein JSON-Array enthält; ohne Fence-Treffer wird der Gesamttext geprüft.
// Ersetzt keine Validierung, nur die JSON.parse-Vorbereitung.
function extractJsonArrayCandidate(rawText: string): string | null {
  for (const fenceMatch of rawText.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const arrayMatch = fenceMatch[1].match(/\[[\s\S]*\]/);
    if (arrayMatch) return arrayMatch[0];
  }
  const arrayMatch = rawText.match(/\[[\s\S]*\]/);
  return arrayMatch ? arrayMatch[0] : null;
}

function invalidAiResponse(rawText: string, error?: z.ZodError | SyntaxError): Response {
  // Rohantwort NUR gekürzt loggen: keine vollen Dokument-/Modellinhalte in Logs.
  // Der Validierungsfehler wird strukturiert, aber ebenfalls gekürzt mitgeloggt
  // (Zod v4: error.issues; .format() ist deprecated).
  const details =
    error instanceof z.ZodError
      ? JSON.stringify(error.issues).slice(0, 500)
      : (error?.message ?? 'no JSON array candidate found');
  console.error(
    'Invalid Gemini response (truncated):',
    rawText.slice(0, 200),
    '| details:',
    details
  );
  return new Response(JSON.stringify({ error: 'Invalid AI response' }), {
    status: 422,
    headers: { 'Content-Type': 'application/json' },
  });
}

const handlePost: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Strict origin check: Origin header is mandatory.
    const origin = request.headers.get('origin');
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const limited = await enforceLimit(request, 'analyze', clientAddress);
    if (limited) return limited;

    const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('GEMINI_API_KEY is missing in server environment');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const modelId = (formData.get('modelId') as string) || 'gemini-1.5-flash';
    const additionalPrompt = (formData.get('additionalPrompt') as string) || '';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate file size (max 10 MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large (max 10 MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate MIME type server-side (do not trust client-supplied file.type alone)
    const ALLOWED_MIME_TYPES = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer.slice(0, 12));
    // No fallback to client-supplied file.type: unrecognized magic bytes are rejected (#210)
    const detectedMime = detectMimeType(bytes);
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Limit additionalPrompt length
    const sanitizedAdditionalPrompt = additionalPrompt.slice(0, 500);

    // Validate modelId against whitelist
    const allowedModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
    const safeModelId = allowedModels.includes(modelId) ? modelId : 'gemini-1.5-flash';

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const filePart = {
      inlineData: {
        data: base64,
        mimeType: detectedMime,
      },
    };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: safeModelId });

    const prompt = `Analysiere dieses Bild/Dokument und extrahiere ALLE Termine, Veranstaltungen oder zeitbezogene Informationen.
    
    ${sanitizedAdditionalPrompt}

    Für jeden gefundenen Termin gib zurück:
    - title: Titel der Veranstaltung
    - date: Datum im Format YYYY-MM-DD
    - time: Uhrzeit im Format HH:MM (falls vorhanden)
    - location: Ort (falls vorhanden)
    - description: Zusätzliche Details (falls vorhanden)

    Antworte NUR mit einem JSON-Array im folgenden Format:
    [
      {
        "title": "Beispiel-Event",
        "date": "2024-12-25",
        "time": "14:30",
        "location": "Beispielort",
        "description": "Details"
      }
    ]

    Falls keine Termine gefunden wurden, antworte mit: []`;

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const text = response.text();

    const candidate = extractJsonArrayCandidate(text);
    if (!candidate) {
      return invalidAiResponse(text);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(candidate);
    } catch (parseError) {
      return invalidAiResponse(text, parseError as SyntaxError);
    }

    const validation = eventsResponseSchema.safeParse(parsedJson);
    if (!validation.success) {
      return invalidAiResponse(text, validation.error);
    }

    return new Response(JSON.stringify(validation.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST = withRequestLogging(ROUTE, handlePost);
