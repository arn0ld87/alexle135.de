// Zentraler, strukturierter Logging-Helper für API-Routen (#291).
//
// Ziel: Eine einzige Stelle, die JSON-Logzeilen mit konsistentem Feld-Set
// nach stdout/stderr schreibt (Docker/Node-Konvention — kein eigenes
// Logging-Framework). `handleUnexpectedError` (errors.ts) und die
// Request-Instrumentierung der Routen (via `withRequestLogging`) teilen sich
// dieselbe requestId-Erzeugung und dieselbe JSON-Serialisierung, damit es
// keine zwei leicht unterschiedlichen Logformate gibt.
//
// requestId-Korrelation: `withRequestLogging` legt die requestId in einen
// AsyncLocalStorage-Kontext. `createRequestId()` — und damit auch
// `handleUnexpectedError` — greift diese requestId auf, sodass die
// Fehler-Logzeile einer Route und die Abschluss-Logzeile des Wrappers
// dieselbe requestId tragen. `run()` isoliert den Kontext pro Request;
// parallele Requests teilen sich die requestId NICHT.
//
// STRIKT: Diese Datei kennt nur Metadaten (requestId, route, method, status,
// durationMs, errorCode, level und — im Fehlerfall über errors.ts —
// message/stack/pg-Fehlerfelder). Niemals Request-/Response-Bodies,
// Datei-Inhalte, Prompts oder personenbezogene Rohdaten hier durchreichen.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { APIContext, APIRoute } from 'astro';

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Per-Request-Kontext. Trägt die requestId, damit sie über den gesamten
 * Handler-Aufruf (inkl. `handleUnexpectedError`) hinweg dieselbe bleibt.
 */
export const requestStorage = new AsyncLocalStorage<{ requestId: string }>();

/**
 * Beliebige zusätzliche Felder sind erlaubt (z. B. message/stack/pg-Felder in
 * errors.ts), aber requestId/route/method sind für jede Logzeile Pflicht.
 */
export type StructuredLogFields = {
  requestId: string;
  route: string;
  method: string;
  level?: LogLevel;
  [key: string]: unknown;
};

export type RequestCompletionFields = {
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  errorCode?: string | number;
  level?: LogLevel;
};

/**
 * Zentrale requestId-Quelle. Innerhalb eines von `withRequestLogging`
 * aufgespannten Kontexts wird die dort erzeugte requestId zurückgegeben,
 * damit Fehler- und Abschluss-Logzeile korrelieren. Außerhalb (z. B. direkte
 * Aufrufe in Tests oder nicht instrumentierte Pfade) fällt es auf eine frisch
 * generierte UUID zurück.
 */
export function createRequestId(): string {
  return requestStorage.getStore()?.requestId ?? crypto.randomUUID();
}

/**
 * Schreibt eine einzelne strukturierte JSON-Logzeile. `level: 'error'` geht
 * nach stderr (`console.error`), alles andere nach stdout (`console.log`).
 */
export function writeStructuredLog(fields: StructuredLogFields): void {
  const level: LogLevel = fields.level ?? 'info';
  const line = JSON.stringify({ ...fields, level });

  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function defaultLevelForStatus(status: number): LogLevel {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

/**
 * Loggt den Abschluss eines Requests: route/method/status/durationMs, plus
 * optional errorCode. `level` wird aus `status` abgeleitet, sofern nicht
 * explizit übergeben (>=500 → error, >=400 → warn, sonst info).
 */
export function logRequestCompletion(fields: RequestCompletionFields): void {
  const level = fields.level ?? defaultLevelForStatus(fields.status);
  writeStructuredLog({
    requestId: fields.requestId,
    route: fields.route,
    method: fields.method,
    status: fields.status,
    durationMs: Math.round(fields.durationMs),
    ...(fields.errorCode !== undefined ? { errorCode: fields.errorCode } : {}),
    level,
  });
}

/**
 * Higher-Order-Wrapper für Astro-`APIRoute`-Handler: misst die Dauer,
 * erzeugt eine requestId, legt sie in den AsyncLocalStorage-Kontext und
 * schreibt am Ende eine strukturierte Logzeile mit
 * route/method/status/durationMs — minimal-invasiv, ohne die Routen selbst
 * umzubauen.
 *
 * Wirft der Handler (Fälle, die die Route nicht selbst abfängt — z. B.
 * login.ts/logout.ts ohne eigenes try/catch), werden die vollen
 * Fehlerdetails (message, stack, Own-Properties wie pg-code/detail) mit
 * status 500 strukturiert geloggt und der Fehler anschließend UNVERÄNDERT
 * weitergereicht. Die Response (und damit der Status-Code) wird weiterhin
 * ausschließlich vom bestehenden Fehlerpfad (Astro/Route) erzeugt — dieses
 * Verhalten wird nicht verändert, es wird nur zusätzlich geloggt.
 */
export function withRequestLogging(route: string, handler: APIRoute): APIRoute {
  return async (context: APIContext) => {
    const start = performance.now();
    const requestId = createRequestId();
    const method = context.request.method;

    return requestStorage.run({ requestId }, async () => {
      try {
        const response = await handler(context);
        logRequestCompletion({
          requestId,
          route,
          method,
          status: response.status,
          durationMs: performance.now() - start,
        });
        return response;
      } catch (error) {
        // Own-Properties (pg: code, detail, hint, constraint, …) mitloggen;
        // message/stack sind bei Error nicht enumerable und kommen separat.
        // ...extra zuerst spreaden, damit die expliziten Felder nicht von
        // gleichnamigen Fehler-Props überschrieben werden.
        const extra = error instanceof Error ? { ...error } : {};
        writeStructuredLog({
          ...extra,
          level: 'error',
          requestId,
          route,
          method,
          status: 500,
          durationMs: Math.round(performance.now() - start),
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    });
  };
}
