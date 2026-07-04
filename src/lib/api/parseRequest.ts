import type { ZodType } from 'astro/zod';
import { validationErrorResponse } from './errors';

export type ParsedRequest<T> = { ok: true; data: T } | { ok: false; response: Response };

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Ungültige Anfrage.';
}

/**
 * Parst den JSON-Body einer Request und validiert ihn gegen ein Zod-Schema.
 * Bei Parse- oder Validierungsfehlern wird direkt eine einheitlich formatierte
 * 400-Antwort zurückgegeben, sodass Routen nicht mehr ad hoc mit
 * typeof/trim/slice validieren müssen.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<ParsedRequest<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    // Kaputtes oder fehlendes JSON explizit melden statt `null` durch das
    // Schema laufen zu lassen — die Schema-Meldung wäre hier irreführend.
    return { ok: false, response: validationErrorResponse('Ungültiges JSON-Format.') };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, response: validationErrorResponse(firstIssueMessage(result.error)) };
  }
  return { ok: true, data: result.data };
}

/**
 * Validiert einen einzelnen Wert (z. B. einen Query-Parameter wie `?id=`)
 * gegen ein Zod-Schema und liefert bei Fehlern eine einheitliche 400-Antwort.
 */
export function parseWithSchema<T>(value: unknown, schema: ZodType<T>): ParsedRequest<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { ok: false, response: validationErrorResponse(firstIssueMessage(result.error)) };
  }
  return { ok: true, data: result.data };
}
