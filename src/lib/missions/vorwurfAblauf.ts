// Ein Vorwurf bewertet ausschließlich einen nach dem Submit frisch geprüften VM-Zustand.
import { pruefeVorwurf } from './ermittlung';
import type { Ermittlung, ErmittlungsZustand, VorwurfErgebnis } from './ermittlungTypes';
import type { PruefLauf } from './pruefLauf';

export interface VorwurfKandidat {
  verdaechtigeId: string;
  belegIds: readonly string[];
}

export interface VorwurfSubmitOptionen {
  ermittlung: Ermittlung;
  leseZustand: () => ErmittlungsZustand;
  istAktuell: () => boolean;
  pruefeFrisch: () => Promise<boolean>;
  kandidat: VorwurfKandidat;
}

export type VorwurfSubmitErgebnis =
  | { art: 'fehler'; nachricht: string }
  | {
      art: 'bewertung';
      ergebnis: VorwurfErgebnis;
      antwort: readonly string[];
      zustand: ErmittlungsZustand;
    };

const FRISCHE_FEHLER = 'Belege konnten gerade nicht geprüft werden. Bitte erneut versuchen.';

export async function erstelleVorwurfAblauf(
  opts: VorwurfSubmitOptionen
): Promise<VorwurfSubmitErgebnis> {
  const kandidat = {
    verdaechtigeId: opts.kandidat.verdaechtigeId,
    belegIds: [...new Set(opts.kandidat.belegIds)],
  };
  if (!opts.istAktuell()) return { art: 'fehler', nachricht: FRISCHE_FEHLER };
  if (!opts.ermittlung.vorwurf.verdaechtige.some((p) => p.id === kandidat.verdaechtigeId)) {
    return { art: 'fehler', nachricht: 'Bitte wähle eine bekannte Person aus.' };
  }
  if (!opts.leseZustand().geloest) {
    try {
      if (!(await opts.pruefeFrisch()) || !opts.istAktuell()) {
        return { art: 'fehler', nachricht: FRISCHE_FEHLER };
      }
    } catch {
      return { art: 'fehler', nachricht: FRISCHE_FEHLER };
    }
  }
  const r = pruefeVorwurf(opts.ermittlung, opts.leseZustand(), kandidat);
  return { art: 'bewertung', ergebnis: r.ergebnis, antwort: r.antwort, zustand: r.zustand };
}

export interface PruefRueckmeldung {
  sequenz: number;
  generation: number;
  vollstaendig: boolean;
}

export interface FrischPruefAbhaengigkeiten {
  getPruefLauf: () => PruefLauf | null;
  getGeneration: () => number;
  getSetupVersion: () => number;
  leseRueckmeldung: () => PruefRueckmeldung;
}

export function erstelleFrischPruef(deps: FrischPruefAbhaengigkeiten): () => Promise<boolean> {
  return async () => {
    const generation = deps.getGeneration();
    const lauf = deps.getPruefLauf();
    const aktuell = () =>
      generation > 0 &&
      generation === deps.getSetupVersion() &&
      lauf !== null &&
      lauf === deps.getPruefLauf();
    if (!lauf || !aktuell()) return false;
    try {
      await lauf.leerlauf();
      if (!aktuell()) return false;
      const vorher = deps.leseRueckmeldung().sequenz;
      lauf.anstossen();
      await lauf.leerlauf();
      if (!aktuell()) return false;
      const letzte = deps.leseRueckmeldung();
      return letzte.sequenz > vorher && letzte.generation === generation && letzte.vollstaendig;
    } catch {
      return false;
    }
  };
}
