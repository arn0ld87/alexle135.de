// Abfrage-Lebenszyklus einer ausgewählten Ansicht (Ticket 5): liest nur, hält höchstens
// einen laufenden und einen vorgemerkten Wunsch und verwirft Antworten alter Generationen.
import { abfrageSkript, leseAbfrage } from './abfrage';
import type { AgentResult } from './agentClient';
import type { AbfrageAusgabe, Ansicht } from './ermittlungTypes';

export const ABFRAGE_TIMEOUT_MS = 20_000;

export type AbfrageStatus = 'bereit' | 'laedt' | 'geladen' | 'fehler';

export interface AbfrageZustand {
  status: AbfrageStatus;
  ansichtId: string | null;
  ausgabe: AbfrageAusgabe | null;
}

export interface AbfragenOptionen {
  run: (skript: string, timeoutMs: number) => Promise<AgentResult>;
  istAktuell: () => boolean;
  schreibeZustand: (zustand: AbfrageZustand) => void;
}

export interface ErmittlungsAbfragen {
  oeffne(ansicht: Ansicht): void;
  aktualisiere(): void;
  stoppe(): void;
}

export function erzeugeAbfragen(optionen: AbfragenOptionen): ErmittlungsAbfragen {
  const { run, istAktuell, schreibeZustand } = optionen;
  let gestoppt = false;
  let generation = 0;
  let ansicht: Ansicht | null = null;
  let wunsch: { ansicht: Ansicht; generation: number } | null = null;
  let laeuft = false;

  const melde = (zustand: AbfrageZustand): void => {
    if (gestoppt) return;
    try {
      schreibeZustand(zustand);
    } catch {
      // Ein werfender Anzeige-Rückruf darf den Abfrage-Lauf nicht aus dem Tritt bringen.
    }
  };

  const aktuell = (stand: number): boolean => {
    if (gestoppt || stand !== generation) return false;
    try {
      return istAktuell();
    } catch {
      return false;
    }
  };

  // Eigener Leser, damit TypeScript den im Lauf geleerten Wunsch nicht auf `null` verengt.
  const naechsterWunsch = (): { ansicht: Ansicht; generation: number } | null => wunsch;

  const starte = async (): Promise<void> => {
    if (gestoppt || laeuft || !wunsch) return;
    const auftrag = wunsch;
    wunsch = null;
    laeuft = true;
    const stand = auftrag.generation;
    try {
      if (!aktuell(stand)) return;
      const skript = abfrageSkript(auftrag.ansicht.abfrage);
      const ergebnis = await run(skript, ABFRAGE_TIMEOUT_MS);
      if (!aktuell(stand)) return;

      const ausgabe = leseAbfrage(ergebnis.output);
      const erfolgreich =
        ergebnis.exitCode === 0 && ausgabe.vollstaendig && ausgabe.fehlerCode === null;
      if (erfolgreich) {
        melde({ status: 'geladen', ansichtId: auftrag.ansicht.id, ausgabe });
      } else {
        melde({ status: 'fehler', ansichtId: auftrag.ansicht.id, ausgabe: null });
      }
    } catch {
      if (aktuell(stand)) {
        melde({ status: 'fehler', ansichtId: auftrag.ansicht.id, ausgabe: null });
      }
    } finally {
      laeuft = false;
      const folge = naechsterWunsch();
      if (!gestoppt && folge && aktuell(folge.generation)) void starte();
    }
  };

  const oeffne = (neu: Ansicht): void => {
    if (gestoppt) return;
    ansicht = neu;
    generation += 1;
    wunsch = { ansicht: neu, generation };
    melde({ status: 'laedt', ansichtId: neu.id, ausgabe: null });
    if (!laeuft) void starte();
  };

  const aktualisiere = (): void => {
    if (gestoppt || !ansicht) return;
    generation += 1;
    wunsch = { ansicht, generation };
    melde({ status: 'laedt', ansichtId: ansicht.id, ausgabe: null });
    if (!laeuft) void starte();
  };

  const stoppe = (): void => {
    gestoppt = true;
    generation += 1;
    wunsch = null;
    laeuft = false;
  };

  return { oeffne, aktualisiere, stoppe };
}
