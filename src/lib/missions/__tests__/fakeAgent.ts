import { execFileSync } from 'node:child_process';
import { AgentClient } from '../agentClient';
import { decodeBase64, encodeBase64 } from '../agentProtocol';

export type FakeAntwort =
  | { art: 'res'; exitCode: number; output: string }
  | { art: 'err'; grund: string }
  | { art: 'still' };

/**
 * Ein AgentClient, dessen Gegenseite im Test sitzt. `antwort` bekommt jedes dekodierte RUN-Skript.
 * Antworten werden in einem Microtask über `client.feed` zurückgespielt.
 */
export function fakeAgentClient(
  antwort: (skript: string, id: string) => FakeAntwort | Promise<FakeAntwort>
): { client: AgentClient; gesendet: string[] } {
  const gesendet: string[] = [];
  const client = new AgentClient((zeile) => {
    gesendet.push(zeile);
    const treffer = /^RUN (\S+) (\S+)(?: (\d+))?\n$/.exec(zeile);
    if (!treffer) return;
    const [, id, nutzlast] = treffer;
    const skript = decodeBase64(nutzlast);
    // Wirft `antwort` oder lehnt es ab, antwortet der Fake wie der Agent mit ERR, statt eine
    // unbehandelte Ablehnung zu hinterlassen.
    void Promise.resolve()
      .then(() => antwort(skript, id))
      .then(
        (a) => {
          if (a.art === 'res') {
            // Leere Ausgabe schreibt der Agent als `-` (agentProtocol.ts).
            const nutzlast = a.output === '' ? '-' : encodeBase64(a.output);
            client.feed(`RES ${id} ${a.exitCode} ${nutzlast}\n`);
          } else if (a.art === 'err') {
            client.feed(`ERR ${id} ${a.grund.replace(/[^A-Za-z0-9_-]/g, '-')}\n`);
          }
        },
        () => client.feed(`ERR ${id} fake-fehler\n`)
      );
  });
  return { client, gesendet };
}

/** Führt das Bündelskript wirklich mit Bash aus; das Ende-Skript liefert Exit 0. */
export function bashAntwort(skript: string): FakeAntwort {
  return {
    art: 'res',
    exitCode: 0,
    output: execFileSync('bash', ['-c', skript], { encoding: 'utf8' }),
  };
}
