// Pager über dem Terminal (#397): Lage und Auftrag kommen von der Seite, nicht aus der VM.
// Reine Logik ohne DOM und Uhr: welcher Teil einer Nachricht nach wie vielen Millisekunden
// sichtbar ist (Schreibmaschine, Zeile für Zeile) und wie der Verlauf wächst.

export type PagerArt = 'auftrag' | 'erledigt' | 'szene';

/** Posen der Figur (#402); je Pose eine Datei public/missions/figur/alexander-<pose>.svg. */
export const POSEN = ['neutral', 'grinst', 'zeigt', 'haare', 'urlaub', 'entlarvt'] as const;
export type Pose = (typeof POSEN)[number];

/** Pose, wenn die Nachricht keine eigene hat. */
export const STANDARD_POSE: Record<PagerArt, Pose> = {
  auftrag: 'zeigt',
  erledigt: 'grinst',
  szene: 'urlaub',
};

export const figurUrl = (pose: Pose) => `/missions/figur/alexander-${pose}.svg`;

export interface PagerNachricht {
  id: number;
  art: PagerArt;
  zeilen: string[];
  pose?: Pose;
}

/** Millisekunden je Zeichen; eine Zeile mit 80 Zeichen steht nach knapp 1 s. */
export const MS_JE_ZEICHEN = 12;
/** Kurze Pause am Zeilenende, damit „Zeile für Zeile“ sichtbar wird. */
export const MS_JE_ZEILE = 200;

/** Pause nach dem Eintippen, bevor die nächste Nachricht aus der Warteschlange kommt (#410). */
export const MS_PAUSE = 1500;
/** Bei reduzierter Bewegung steht der Text sofort; die Lesepause bleibt, nur kürzer. */
export const MS_PAUSE_REDUZIERT = 800;

/** Dauer, bis eine Nachricht vollständig steht. */
export function tippDauer(zeilen: string[]): number {
  return zeilen.reduce((ms, z) => ms + z.length * MS_JE_ZEICHEN + MS_JE_ZEILE, 0);
}

/**
 * Sichtbarer Teil der Nachricht nach `ms`: fertige Zeilen ganz, die aktuelle angeschnitten,
 * spätere gar nicht. Nach `tippDauer` alles.
 */
export function sichtbareZeilen(zeilen: string[], ms: number): string[] {
  const sichtbar: string[] = [];
  let rest = Math.max(0, ms);
  for (const zeile of zeilen) {
    const dauer = zeile.length * MS_JE_ZEICHEN;
    if (rest < dauer) {
      sichtbar.push(zeile.slice(0, Math.floor(rest / MS_JE_ZEICHEN)));
      return sichtbar;
    }
    sichtbar.push(zeile);
    rest -= dauer + MS_JE_ZEILE;
    if (rest < 0) return sichtbar;
  }
  return sichtbar;
}

/** Verlauf: neue Nachricht hinten anhängen, leere Nachrichten und direkte Dubletten verwerfen. */
export function anhaengen(
  verlauf: PagerNachricht[],
  art: PagerArt,
  zeilen: string[],
  pose?: Pose
): PagerNachricht[] {
  const sauber = zeilen.map((z) => z.trimEnd()).filter((z) => z.trim() !== '');
  if (!sauber.length) return verlauf;
  const letzte = verlauf.at(-1);
  if (letzte && letzte.art === art && letzte.zeilen.join('\n') === sauber.join('\n')) {
    return verlauf;
  }
  return [
    ...verlauf,
    { id: (letzte?.id ?? 0) + 1, art, zeilen: sauber, ...(pose ? { pose } : {}) },
  ];
}

/**
 * Warteschlange (#410): Der Pager zeigt die Nachricht mit `zeigeId`. Fehlt sie (der Verlauf wurde
 * ersetzt), die erste danach, sonst die neueste. Ältere stehen im Verlauf, neuere warten.
 */
export function angezeigte(
  nachrichten: PagerNachricht[],
  zeigeId: number
): PagerNachricht | undefined {
  return (
    nachrichten.find((n) => n.id === zeigeId) ??
    nachrichten.find((n) => n.id > zeigeId) ??
    nachrichten.at(-1)
  );
}

/** Nächste wartende Nachricht nach `aktuell`, sonst undefined. */
export function naechsteWartende(
  nachrichten: PagerNachricht[],
  aktuell: PagerNachricht | undefined
): PagerNachricht | undefined {
  if (!aktuell) return nachrichten[0];
  return nachrichten.find((n) => n.id > aktuell.id);
}

/**
 * Sichtbare Millisekunden der aktuellen Nachricht. Der gespeicherte Fortschritt gilt nur für seine
 * Nachrichten-ID; eine neue Nachricht beginnt schon beim ersten Rendern bei 0, bei reduzierter
 * Bewegung gleich vollständig.
 */
export function fortschrittFuer(
  fortschritt: { id: number; ms: number },
  aktuell: PagerNachricht | undefined,
  reduziert: boolean
): number {
  if (!aktuell) return 0;
  if (fortschritt.id === aktuell.id) return fortschritt.ms;
  return reduziert ? tippDauer(aktuell.zeilen) : 0;
}

/** Höchstens so viele Anschläge je Zeichentakt hörbar (#412): sonst rattert es statt zu klackern. */
export const MAX_KLACKS_JE_TAKT = 2;

/**
 * Anschläge zwischen zwei Zeitpunkten des Tippens (#412): neu sichtbare Zeichen ohne Leerzeichen,
 * gedrosselt auf `MAX_KLACKS_JE_TAKT`, und ob die Nachricht in diesem Takt fertig wurde.
 */
export function anschlaege(
  zeilen: string[],
  vorherMs: number,
  jetztMs: number
): { klacks: number; fertig: boolean } {
  const zaehle = (ms: number) =>
    sichtbareZeilen(zeilen, ms).reduce((n, z) => n + z.replace(/\s/g, '').length, 0);
  const neu = Math.max(0, zaehle(jetztMs) - zaehle(vorherMs));
  const ende = tippDauer(zeilen);
  return {
    klacks: Math.min(neu, MAX_KLACKS_JE_TAKT),
    fertig: vorherMs < ende && jetztMs >= ende,
  };
}

/** Satz mit Punkt am Ende, ohne doppelte Satzzeichen („Wer bin ich?“ bleibt so). */
export function satz(text: string): string {
  const t = text.trimEnd();
  return /[.!?…:]$/.test(t) ? t : `${t}.`;
}
