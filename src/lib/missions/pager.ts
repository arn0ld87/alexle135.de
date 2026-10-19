// Pager über dem Terminal (#397): Lage und Auftrag kommen von der Seite, nicht aus der VM.
// Reine Logik ohne DOM und Uhr: welcher Teil einer Nachricht nach wie vielen Millisekunden
// sichtbar ist (Schreibmaschine, Zeile für Zeile) und wie der Verlauf wächst.

export type PagerArt = 'auftrag' | 'erledigt' | 'szene';

export interface PagerNachricht {
  id: number;
  art: PagerArt;
  zeilen: string[];
}

/** Millisekunden je Zeichen; eine Zeile mit 80 Zeichen steht nach knapp 1 s. */
export const MS_JE_ZEICHEN = 12;
/** Kurze Pause am Zeilenende, damit „Zeile für Zeile“ sichtbar wird. */
export const MS_JE_ZEILE = 200;

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
  zeilen: string[]
): PagerNachricht[] {
  const sauber = zeilen.map((z) => z.trimEnd()).filter((z) => z.trim() !== '');
  if (!sauber.length) return verlauf;
  const letzte = verlauf.at(-1);
  if (letzte && letzte.art === art && letzte.zeilen.join('\n') === sauber.join('\n')) {
    return verlauf;
  }
  return [...verlauf, { id: (letzte?.id ?? 0) + 1, art, zeilen: sauber }];
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

/** Satz mit Punkt am Ende, ohne doppelte Satzzeichen („Wer bin ich?“ bleibt so). */
export function satz(text: string): string {
  const t = text.trimEnd();
  return /[.!?…:]$/.test(t) ? t : `${t}.`;
}
