// Stößt die Prüfung einer Ermittlung an, ohne den Aufrufer warten zu lassen (KONZEPT §4):
// höchstens ein Bündel gleichzeitig in der VM, beliebig viele Anstöße währenddessen ergeben
// genau einen Nachlauf. Das Ergebnis gilt für den Zustand zum Zeitpunkt der Antwort.
import type { AgentResult } from './agentClient';
import { buendelSkript, leseBuendelAusgabe, offenePruefungen, wendePruefungAn } from './ermittlung';
import type { Ermittlung, ErmittlungsEreignis, ErmittlungsZustand } from './ermittlungTypes';

/** Wartezeit auf ein Bündel; der Gast bricht laut AgentClient.run eine Sekunde früher ab. */
export const PRUEF_TIMEOUT_MS = 20_000;

export type PruefFehler =
  /** Agent-Timeout, ERR vom Agenten oder abgelehntes `run`. Zustand bleibt unverändert. */
  | { type: 'agent'; meldung: string }
  /** buendelSkript hat geworfen (ungültige Prüf-ID): Datenfehler, kein Lauf gesendet. */
  | { type: 'skript'; meldung: string };

export interface PruefLaufOptionen {
  ermittlung: Ermittlung;
  run: (skript: string, timeoutMs: number) => Promise<AgentResult>;
  leseZustand: () => ErmittlungsZustand;
  /** Wird nur aufgerufen, wenn der Lauf nicht gestoppt wurde. `ereignisse` darf leer sein. */
  schreibeZustand: (zustand: ErmittlungsZustand, ereignisse: ErmittlungsEreignis[]) => void;
  meldeFehler?: (fehler: PruefFehler) => void;
  timeoutMs?: number;
}

export interface PruefLauf {
  /** Kehrt sofort zurück. Startet einen Lauf oder merkt einen Nachlauf vor. */
  anstossen(): void;
  /** Danach wird kein Ergebnis mehr angewendet und kein neuer Lauf gestartet. Idempotent. */
  stoppe(): void;
  /** true, solange ein Bündel unterwegs ist (auch während des Nachlaufs). */
  laeuft(): boolean;
  /** Erfüllt sich, sobald kein Lauf mehr unterwegs und kein Nachlauf vorgemerkt ist. Wirft nie. */
  leerlauf(): Promise<void>;
}

const fehlerText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function erzeugePruefLauf(optionen: PruefLaufOptionen): PruefLauf {
  const { ermittlung, run, leseZustand, schreibeZustand, meldeFehler } = optionen;
  const timeoutMs = optionen.timeoutMs ?? PRUEF_TIMEOUT_MS;
  let gestoppt = false;
  let laufend = false;
  let nachlauf = false;
  let aufloesen: (() => void) | null = null;
  let leerlaufVersprechen: Promise<void> | null = null;

  const melden = (fehler: PruefFehler): void => {
    if (!meldeFehler) return;
    try {
      meldeFehler(fehler);
    } catch {
      // Ein werfender Rückruf darf den Lauf nicht aus dem Tritt bringen.
    }
  };

  const lauf = async (): Promise<void> => {
    laufend = true;
    try {
      for (;;) {
        if (gestoppt) break;

        const pruefungen = offenePruefungen(ermittlung, leseZustand());
        if (pruefungen.length === 0) break;

        let skript: string;
        try {
          skript = buendelSkript(pruefungen);
        } catch (error) {
          melden({ type: 'skript', meldung: fehlerText(error) });
          break;
        }

        let ergebnis: AgentResult;
        try {
          ergebnis = await run(skript, timeoutMs);
        } catch (error) {
          melden({ type: 'agent', meldung: fehlerText(error) });
          break;
        }

        // Nach stoppe() gilt nichts mehr, auch keine bereits eingetroffene Antwort.
        if (gestoppt) break;

        const ausgabe = leseBuendelAusgabe(ergebnis.output);
        const { zustand, ereignisse } = wendePruefungAn(ermittlung, leseZustand(), ausgabe);
        try {
          schreibeZustand(zustand, ereignisse);
        } catch {
          // Auch ein werfender Rückruf beendet den Lauf regulär.
        }

        if (gestoppt) break;
        if (!nachlauf) break;
        nachlauf = false;
      }
    } catch (error) {
      melden({ type: 'agent', meldung: fehlerText(error) });
    } finally {
      laufend = false;
      nachlauf = false;
      const fertig = aufloesen;
      aufloesen = null;
      leerlaufVersprechen = null;
      fertig?.();
    }
  };

  return {
    anstossen(): void {
      if (gestoppt) return;
      if (laufend) {
        nachlauf = true;
        return;
      }
      void lauf();
    },
    stoppe(): void {
      gestoppt = true;
      nachlauf = false;
    },
    laeuft(): boolean {
      return laufend;
    },
    leerlauf(): Promise<void> {
      if (!laufend && !nachlauf) return Promise.resolve();
      if (!leerlaufVersprechen) {
        leerlaufVersprechen = new Promise<void>((resolve) => {
          aufloesen = resolve;
        });
      }
      return leerlaufVersprechen;
    },
  };
}
