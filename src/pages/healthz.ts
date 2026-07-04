import type { APIRoute } from 'astro';
import { getDb } from '../lib/db/client';

export const prerender = false;

// Leichter Liveness+Readiness-Check: Prozess lebt UND DB antwortet innerhalb
// eines kurzen Timeouts. Kein zweiter Pool — nutzt den bestehenden getDb()-Pool.
const DB_CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DB health check timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const GET: APIRoute = async () => {
  try {
    // Gesamten Ablauf (Pool-Init + Query) unter den Timeout stellen — auch
    // ein hängendes getDb() darf den Healthcheck nicht blockieren.
    await withTimeout(
      (async () => {
        const db = await getDb();
        await db.query('SELECT 1');
      })(),
      DB_CHECK_TIMEOUT_MS
    );
    return jsonResponse(200, { status: 'ok' });
  } catch {
    // Keine Fehlerdetails/Verbindungsdaten loggen — nur knapper Hinweis.
    console.error('healthz: DB-Check fehlgeschlagen');
    return jsonResponse(503, { status: 'unhealthy' });
  }
};
