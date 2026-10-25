// Regeln einer Staffel ohne DOM und Speicher: Vorfall → Mission für die Engine, Finale-Sperre,
// Glossar der gelernten Befehle, Abzeichen. Der Stand (Akte) kommt aus staffelStore.ts.
import type { MissionTool, V86Mission } from './missionTypes';
import type { Staffel, Vorfall } from './staffelTypes';

/** Ein gelöster Vorfall in der Ermittlungsakte. */
export interface AkteEintrag {
  durationMs: number;
  /** Tippstufe 3 oder `mission solve` genutzt. */
  withSolution: boolean;
  /** Abgerufene Tipps über alle Schritte. */
  hintsUsed: number;
  finishedAt: number;
  /** Nur Staffel 2: Vorwürfe, die der gelöste Lauf bis zum richtigen brauchte. */
  vorwurfVersuche?: number;
}

export type Akte = Record<string, AkteEintrag>;

export interface StaffelStand {
  akte: Akte;
  /** IDs der verdienten Abzeichen, in der Reihenfolge des Verdienens. */
  abzeichen: string[];
  rotePrompts: number;
  /** Zeitpunkt des letzten Löschens der Staffel; ältere Einträge anderer Tabs gelten nicht mehr. */
  zurueckgesetztAm?: number;
}

export const leererStand = (): StaffelStand => ({ akte: {}, abzeichen: [], rotePrompts: 0 });

export const vorfallFlag = (vorfall: Vorfall) => `FLAG{${vorfall.beweisstueck.code}}`;

/**
 * Vorfall als Mission für die MissionEngine: Pager-Text wird zur Beschreibung (`mission status`),
 * Tippstufen 1–2 zu Tipps, Stufe 3 zur Lösung (`mission solve`, „mit Lösung“). Die Flagge ist der
 * Code des Beweisstücks und entsteht nur, wenn alle Prüfungen zugleich bestehen.
 */
export function vorfallAlsMission(vorfall: Vorfall): V86Mission {
  const git = vorfall.werkzeuge.some((w) => w.befehl.startsWith('git'));
  return {
    nr: String(vorfall.nr),
    id: vorfall.id,
    track: git ? 'git' : 'linux',
    title: vorfall.titel,
    difficulty: vorfall.nr < 3 ? 'einstieg' : vorfall.nr < 6 ? 'fortgeschritten' : 'profi',
    durationMin: 10,
    setup: vorfall.setup,
    steps: vorfall.schritte.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.pager.join('\n'),
      verify: s.verify,
      hints: [s.tipps[0], s.tipps[1]],
      solution: s.tipps[2],
      failMessage: s.failMessage,
      target: s.target,
      diagnose: s.diagnose,
    })),
    // Vor der Flagge alle Prüfungen erneut: Ein späterer Schritt darf einen früheren nicht
    // rückgängig gemacht haben.
    flag: [
      ...vorfall.schritte.map((s) => `( ${s.verify}\n) >/dev/null 2>&1 || exit 1`),
      `printf '%s\\n' '${vorfallFlag(vorfall)}'`,
    ].join('\n'),
  };
}

/** Jeder Vorfall ist frei wählbar; das Finale erst, wenn alle anderen in der Akte stehen. */
export function istFreigegeben(staffel: Staffel, akte: Akte, vorfallId: string): boolean {
  const vorfall = staffel.vorfaelle.find((v) => v.id === vorfallId);
  if (!vorfall) return false;
  if (!vorfall.finale) return true;
  return staffel.vorfaelle.every((v) => v.finale || v.id in akte);
}

/** Werkzeuge aller gelösten Vorfälle, je Befehl einmal, in Staffel-Reihenfolge. */
export function gelernteBefehle(staffel: Staffel, akte: Akte): MissionTool[] {
  const seen = new Map<string, MissionTool>();
  for (const v of staffel.vorfaelle) {
    if (!(v.id in akte)) continue;
    for (const w of v.werkzeuge) if (!seen.has(w.befehl)) seen.set(w.befehl, w);
  }
  return [...seen.values()];
}

/**
 * Abzeichen, die der Stand erfüllt und die noch nicht vergeben sind. `lauf` ist der gerade
 * beendete Lauf: Er zählt für „ohne Tipp“ und „schnell“, auch wenn die Akte den besseren behält.
 */
export function neueAbzeichen(staffel: Staffel, stand: StaffelStand, lauf?: AkteEintrag): string[] {
  const eintraege = [...Object.values(stand.akte), ...(lauf ? [lauf] : [])];
  return staffel.abzeichen
    .filter((a) => !stand.abzeichen.includes(a.id))
    .filter(({ regel }) => {
      switch (regel.art) {
        case 'ohne-tipp':
          return eintraege.some((e) => e.hintsUsed === 0 && !e.withSolution);
        case 'schnell':
          return eintraege.some((e) => e.durationMs < regel.ms);
        case 'nie-loesung':
          return (
            staffel.vorfaelle.every((v) => v.id in stand.akte) &&
            Object.values(stand.akte).every((e) => !e.withSolution)
          );
        case 'rote-prompts':
          return stand.rotePrompts >= regel.anzahl;
      }
    })
    .map((a) => a.id);
}
