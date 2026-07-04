// Einheitliche Fehlerstruktur für die Admin-API-Routen.
//
// Ziel: Der Client bekommt niemals interne Exception-Details (error.message,
// Stacktraces, DB-Fehlertexte) zu sehen. Unerwartete Fehler werden serverseitig
// mit einer Request-ID geloggt; diese Request-ID darf als Support-Referenz an
// den Client zurückgehen, aber keine weiteren Details.

import { createRequestId, writeStructuredLog } from './logger';

export const GENERIC_ERROR_MESSAGE = 'Interner Fehler. Bitte erneut versuchen.';
export const CONFLICT_ERROR_MESSAGE = 'Eintrag existiert bereits.';

// Postgres-Fehlercode für Unique-Constraint-Verletzungen.
const PG_UNIQUE_VIOLATION = '23505';

export type ApiErrorContext = {
  route: string;
  method: string;
};

export function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Bewusster Validierungsfehler (400) mit einer sicheren, für den Client
 * verständlichen Meldung. Für kontrollierte Fälle wie "id fehlt" oder
 * "ungültiger status" — niemals für unkontrollierte Exceptions.
 */
export function validationErrorResponse(message: string): Response {
  return jsonResponse(400, { error: message });
}

/**
 * Unerwarteter/unkontrollierter Fehler (z. B. eine DB-Exception). Loggt den
 * Originalfehler serverseitig zusammen mit einer Request-ID — inklusive
 * pg-spezifischer Eigenschaften wie code/detail/hint/constraint, die auf
 * Error-Instanzen als Own-Properties liegen und per Spread mitkommen — und
 * liefert dem Client nur eine generische Meldung plus Request-ID zurück.
 *
 * Unique-Constraint-Verletzungen (pg-Code 23505) werden als 409 Conflict mit
 * generischer Meldung beantwortet; welcher Constraint betroffen ist, bleibt
 * ausschließlich im Server-Log.
 */
export function handleUnexpectedError(error: unknown, context: ApiErrorContext): Response {
  const requestId = createRequestId();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  // Own-Properties (pg: code, detail, hint, constraint, table, …) mitloggen;
  // message/stack sind bei Error nicht enumerable und kommen separat.
  const extra = error instanceof Error ? { ...error } : {};

  // ...extra (pg: code/detail/hint/constraint …) zuerst spreaden, damit die
  // expliziten Felder (level, requestId, route, method, message, stack) NICHT
  // von gleichnamigen Fehler-Own-Properties überschrieben werden.
  writeStructuredLog({
    ...extra,
    level: 'error',
    requestId,
    route: context.route,
    method: context.method,
    message,
    stack,
  });

  const pgCode = (extra as { code?: unknown }).code;
  if (pgCode === PG_UNIQUE_VIOLATION) {
    return jsonResponse(409, { error: CONFLICT_ERROR_MESSAGE, requestId });
  }

  return jsonResponse(500, { error: GENERIC_ERROR_MESSAGE, requestId });
}
