// Statuslogik rund um die VM, rein und ohne React: die Kopfzeile des Terminals (V86Terminal) und
// die Episodenzeile daneben (StaffelApp). Beide dürfen nie widersprüchlich melden: Steht das
// Terminal im Fehler, gibt es genau diese eine Meldung und keine „wird vorbereitet“-Zeile mehr.

export type TerminalPhase =
  | { kind: 'laden'; percent: number | null }
  | { kind: 'start' }
  | { kind: 'bereit' }
  | { kind: 'fehler'; message: string };

export type TerminalPhaseKind = TerminalPhase['kind'];

/** Kopfzeile des Terminals. Im Fehlerfall steht die Ursache und die Wiederholungsaktion darin. */
export function terminalStatusText(phase: TerminalPhase): string {
  switch (phase.kind) {
    case 'laden':
      return `Linux wird geladen${phase.percent === null ? ' …' : ` … ${phase.percent} %`}`;
    case 'start':
      return 'Linux startet …';
    case 'bereit':
      return 'echtes Linux · Alpine · ohne Netzwerk';
    case 'fehler':
      return `Fehler: ${phase.message.replace(/\.$/, '')}. Mit „Neu starten“ noch einmal versuchen.`;
  }
}

/** Solange die VM lädt oder startet, steht die Überlagerung und „Neu starten“ ist gesperrt. */
export function terminalBeschaeftigt(phase: TerminalPhase): boolean {
  return phase.kind === 'laden' || phase.kind === 'start';
}

export interface EpisodenStatusEingabe {
  /** Die Engine konnte die Episode nicht aufsetzen (setup fehlgeschlagen). */
  startFehler: string | null;
  /** Das Terminal steht im Fehler (VM bootet nicht, Agent antwortet nicht). */
  terminalFehler: boolean;
  /** Nummer der gewählten Episode; `null`, solange keine gewählt ist. */
  vorfallNr: number | null;
  /** Stand der Engine; `null`, bis die Episode aufgesetzt ist. */
  snapshot: {
    stepIndex: number;
    stepCount: number;
    finishedAt: number | null;
    withSolution: boolean;
  } | null;
  schrittTitel: string | null;
}

/** Zeile neben „Alex fragen“. `null` = nichts anzeigen. */
export function episodenStatusText(e: EpisodenStatusEingabe): string | null {
  if (e.startFehler) return `Episode ließ sich nicht starten: ${e.startFehler}`;
  // Die Ursache steht am Terminal. Weiter „wird vorbereitet“ zu melden wäre falsch: Es tut sich nichts.
  if (e.terminalFehler) return null;
  if (e.vorfallNr !== null && !e.snapshot) return 'Episode wird vorbereitet …';
  if (e.snapshot?.finishedAt != null) {
    return `Episode ${e.vorfallNr} gelöst${e.snapshot.withSolution ? ' · mit Lösung' : ''}`;
  }
  if (e.snapshot && e.schrittTitel !== null) {
    return `Schritt ${e.snapshot.stepIndex + 1}/${e.snapshot.stepCount}: ${e.schrittTitel}`;
  }
  return null;
}
