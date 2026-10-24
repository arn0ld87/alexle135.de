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
  | { type: 'skript'; meldung: string }
  /** Fehler im Browser beim Lesen oder Anwenden des Zustands; kein Agent-Problem. */
  | { type: 'intern'; meldung: string };

export interface PruefLaufOptionen {
  ermittlung: Ermittlung;
  run: (skript: string, timeoutMs: number) => Promise<AgentResult>;
  leseZustand: () => ErmittlungsZustand;
  /** Wird nur aufgerufen, wenn der Lauf nicht gestoppt wurde. `ereignisse` darf leer sein. */
  schreibeZustand: (zustand: ErmittlungsZustand, ereignisse: ErmittlungsEreignis[]) => void;
  /**
   * Nicht synchron `anstossen()` aufrufen: Bleibt der Fehler bestehen, folgt sonst ein Nachlauf
   * auf den anderen, ohne dass dazwischen der Browser zum Zug kommt.
   */
  meldeFehler?: (fehler: PruefFehler) => void;
  timeoutMs?: number;
}

export interface PruefLauf {
  /** Kehrt sofort zurück. Startet einen Lauf oder merkt einen Nachlauf vor. */
  anstossen(): void;
  /** Danach wird kein Ergebnis mehr angewendet und kein neuer Lauf gestartet. Idempotent. */
  stoppe(): void;
  /** true, solange ein Bündel unterwegs ist und nicht gestoppt wurde. */
  laeuft(): boolean;
  /**
   * Erfüllt sich, sobald kein Lauf mehr unterwegs und kein Nachlauf vorgemerkt ist, oder sofort
   * nach `stoppe()`. Wirft nie.
   */
  leerlauf(): Promise<void>;
}

const fehlerText = (error: unknown): string => {
  try {
    return error instanceof Error ? error.message : String(error);
  } catch {
    return 'unbekannter Fehler';
  }
};

export function erzeugePruefLauf(optionen: PruefLaufOptionen): PruefLauf {
  const { ermittlung, run, leseZustand, schreibeZustand, meldeFehler } = optionen;
  const timeoutMs = optionen.timeoutMs ?? PRUEF_TIMEOUT_MS;
  let gestoppt = false;
  let laufend = false;
  let nachlauf = false;
  let aufloesen: (() => void) | null = null;
  let leerlaufVersprechen: Promise<void> | null = null;

  const leerlaufErfuellen = (): void => {
    const fertig = aufloesen;
    aufloesen = null;
    leerlaufVersprechen = null;
    fertig?.();
  };

  // Nach stoppe() gibt es keine Meldung mehr: Die UI dahinter ist womöglich schon ausgehängt.
  const melden = (fehler: PruefFehler): void => {
    if (gestoppt || !meldeFehler) return;
    try {
      meldeFehler(fehler);
    } catch {
      // Ein werfender Rückruf darf den Lauf nicht aus dem Tritt bringen.
    }
  };

  // Ein Durchlauf (Schritte 1–6). Kehrt in jedem Fall normal zurück, damit danach immer die
  // Nachlauf-Prüfung kommt, auch nach einem Fehler.
  const durchlauf = async (): Promise<void> => {
    let pruefungen: ReturnType<typeof offenePruefungen>;
    try {
      pruefungen = offenePruefungen(ermittlung, leseZustand());
    } catch (error) {
      melden({ type: 'intern', meldung: fehlerText(error) });
      return;
    }
    if (pruefungen.length === 0) return;

    let skript: string;
    try {
      skript = buendelSkript(pruefungen);
    } catch (error) {
      melden({ type: 'skript', meldung: fehlerText(error) });
      return;
    }

    // Ein Rückruf kann selbst stoppe() aufgerufen haben.
    if (gestoppt) return;
    let ergebnis: AgentResult;
    try {
      ergebnis = await run(skript, timeoutMs);
    } catch (error) {
      melden({ type: 'agent', meldung: fehlerText(error) });
      return;
    }

    // Nach stoppe() gilt nichts mehr, auch keine bereits eingetroffene Antwort.
    if (gestoppt) return;

    let neu: { zustand: ErmittlungsZustand; ereignisse: ErmittlungsEreignis[] };
    try {
      neu = wendePruefungAn(ermittlung, leseZustand(), leseBuendelAusgabe(ergebnis.output));
    } catch (error) {
      melden({ type: 'intern', meldung: fehlerText(error) });
      return;
    }
    if (gestoppt) return;
    try {
      schreibeZustand(neu.zustand, neu.ereignisse);
    } catch {
      // Auch ein werfender Rückruf beendet den Durchlauf regulär.
    }
  };

  const lauf = async (): Promise<void> => {
    laufend = true;
    try {
      for (;;) {
        try {
          await durchlauf();
        } catch {
          // durchlauf fängt selbst alles ab; dies ist nur die letzte Absicherung.
        }
        if (gestoppt || !nachlauf) break;
        nachlauf = false;
      }
    } finally {
      // Nach stoppe() hat stoppe() schon aufgeräumt; ein später endender Lauf ändert nichts mehr.
      if (!gestoppt) {
        laufend = false;
        nachlauf = false;
        leerlaufErfuellen();
      }
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
      laufend = false;
      leerlaufErfuellen();
    },
    laeuft(): boolean {
      return laufend;
    },
    leerlauf(): Promise<void> {
      if (gestoppt || (!laufend && !nachlauf)) return Promise.resolve();
      if (!leerlaufVersprechen) {
        leerlaufVersprechen = new Promise<void>((resolve) => {
          aufloesen = resolve;
        });
      }
      return leerlaufVersprechen;
    },
  };
}
