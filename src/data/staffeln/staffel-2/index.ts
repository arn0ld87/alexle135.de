import type { Ermittlung } from '../../../lib/missions/ermittlungTypes';
import type { MissionTool } from '../../../lib/missions/missionTypes';
import { episode0, episode0Werkzeuge } from './episode-0';
import { episode1, episode1Werkzeuge } from './episode-1';
import { episode3, episode3Werkzeuge } from './episode-3';

export const STAFFEL2_PFAD = '/projekte/terminal-missionen/app/staffel-2';

/** Eine spielbare Episode samt Werkzeugkasten der Hilfe. */
export interface EpisodeEintrag {
  ermittlung: Ermittlung;
  werkzeuge: readonly MissionTool[];
}

/**
 * Alle spielbaren Episoden in Spielreihenfolge; `?episode=<nr>` wählt eine, die Verkettung „weiter“
 * folgt der Liste. Eine neue Episode wird hier eingetragen, sonst nirgends.
 */
export const staffel2Episoden: readonly EpisodeEintrag[] = [
  { ermittlung: episode0, werkzeuge: episode0Werkzeuge },
  { ermittlung: episode1, werkzeuge: episode1Werkzeuge },
  { ermittlung: episode3, werkzeuge: episode3Werkzeuge },
];

/** Die Episode zum Wert von `?episode=`; fehlt er oder ist er unbekannt, gilt die erste. */
export function waehleEpisode(wert: string | null): EpisodeEintrag {
  const treffer = /^(?:0|[1-9]\d{0,2})$/.test(wert ?? '')
    ? staffel2Episoden.find((eintrag) => eintrag.ermittlung.nr === Number(wert))
    : undefined;
  return treffer ?? staffel2Episoden[0];
}

/** Eine Zeile der Episodenübersicht: nur Nummer, Titel und Link, ohne die Episodendaten. */
export interface EpisodeKarte {
  nr: number;
  /** Schlüssel der Episode in der Akte. */
  id: string;
  titel: string;
  href: string;
}

export const staffel2Uebersicht: readonly EpisodeKarte[] = staffel2Episoden.map(
  ({ ermittlung }) => ({
    nr: ermittlung.nr,
    id: ermittlung.id,
    titel: ermittlung.titel,
    href: `${STAFFEL2_PFAD}?episode=${ermittlung.nr}`,
  })
);

/** Link im Abschluss zur nächsten Episode der Liste; bei der letzten fehlt er. */
export function weiterZurNaechsten(
  aktuell: Ermittlung
): { href: string; text: string } | undefined {
  const index = staffel2Episoden.findIndex((eintrag) => eintrag.ermittlung.nr === aktuell.nr);
  const naechste = index >= 0 ? staffel2Episoden[index + 1] : undefined;
  if (!naechste) return undefined;
  const { nr } = naechste.ermittlung;
  return { href: `${STAFFEL2_PFAD}?episode=${nr}`, text: `Weiter zu Episode ${nr}` };
}
