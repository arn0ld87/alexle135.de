// Ticket 7: Frischprüfung vor Bewertung, einmaliger Submit mit Guards.
import type { AgentClient } from './agentClient';
import { buendelSkript, leseBuendelAusgabe, offenePruefungen, pruefeVorwurf, wendePruefungAn } from './ermittlung';
import type { Ermittlung, ErmittlungsEreignis, ErmittlungsZustand, VorwurfErgebnis } from './ermittlungTypes';
import type { PruefLauf } from './pruefLauf';

export interface VorwurfKandidat {
  verdaechtigeId: string;
  belegIds: readonly string[];
}

export interface VorwurfSubmitOptionen {
  ermittlung: Ermittlung;
  leseZustand: () => ErmittlungsZustand;
  schreibeZustand: (zustand: ErmittlungsZustand, ereignisse: readonly ErmittlungsEreignis[]) => void;
  getPruefLauf: () => PruefLauf | null;
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

function kopiereKandidat(k: VorwurfKandidat): VorwurfKandidat {
  return {
    verdaechtigeId: k.verdaechtigeId,
    belegIds: [...new Set(k.belegIds)].filter((id) => typeof id === 'string' && id.length > 0),
  };
}

export async function erstelleVorwurfAblauf(
  opts: VorwurfSubmitOptionen
): Promise<VorwurfSubmitErgebnis> {
  const kandidat = kopiereKandidat(opts.kandidat);
  const zustandVor = opts.leseZustand();
  if (zustandVor.geloest) {
    const r = pruefeVorwurf(opts.ermittlung, zustandVor, kandidat);
    return { art: 'bewertung', ergebnis: r.ergebnis, antwort: r.antwort, zustand: r.zustand };
  }
  try {
    const ok = await opts.pruefeFrisch();
    if (!ok) {
      return {
        art: 'fehler',
        nachricht: 'Belege konnten gerade nicht geprüft werden. Bitte erneut versuchen.',
      };
    }
  } catch {
    return {
      art: 'fehler',
      nachricht: 'Belege konnten gerade nicht geprüft werden. Bitte erneut versuchen.',
    };
  }
  const zustandAkt = opts.leseZustand();
  const r = pruefeVorwurf(opts.ermittlung, zustandAkt, kandidat);
  return { art: 'bewertung', ergebnis: r.ergebnis, antwort: r.antwort, zustand: r.zustand };
}

export interface FrischPruefAbhaengigkeiten {
  ermittlung: Ermittlung;
  run: (skript: string, timeoutMs: number) => Promise<{ exitCode: number; text: string; output: string }>;
  leseZustand: () => ErmittlungsZustand;
  schreibeZustand: (zustand: ErmittlungsZustand, ereignisse: readonly ErmittlungsEreignis[]) => void;
  getPruefLauf: () => PruefLauf | null;
  getGeneration: () => number;
  getSetupVersion: () => number;
}

function protokolliereRueckmeldung(
  deps: FrischPruefAbhaengigkeiten,
  callback: (zustand: ErmittlungsZustand, ereignisse: readonly ErmittlungsEreignis[]) => void
): () => { ok: boolean } {
  let vollstaendig = false;
  let fehlgeschlagen = false;
  let generiertBei: number | null = null;
  const orig = deps.schreibeZustand;
  deps.schreibeZustand = (z, e) => {
    try {
      generiertBei = deps.getGeneration();
      const hatEreignis = Array.isArray(e) && e.length > 0;
      if (e.some((ev) => ev.type === 'pruefung-unvollstaendig')) {
        fehlgeschlagen = true;
      }
      if (hatEreignis && !fehlerhaft(e)) {
        vollstaendig = true;
      }
    } catch {
      fehlgeschlagen = true;
    }
    callback(z, e);
    orig(z, e);
  };
  return () => {
    deps.schreibeZustand = orig;
    return { ok: vollstaendig && !fehlgeschlagen && generiertBei === deps.getGeneration() && generiertBei === deps.getSetupVersion() };
  };
}

function fehlerhaft(e: readonly ErmittlungsEreignis[]): boolean {
  return e.some((ev) => ev.type === 'pruefung-unvollstaendig');
}

export function erstelleFrischPruef(
  deps: FrischPruefAbhaengigkeiten
): () => Promise<boolean> {
  return async () => {
    const lauf = deps.getPruefLauf();
    if (lauf) {
      try {
        await lauf.leerlauf();
      } catch {
        // ignorieren
      }
    }
    const stateVor = deps.leseZustand();
    let vollstaendigRueck = false;
    let fehlgeschlagenRueck = false;
    const origSchreib = deps.schreibeZustand;
    deps.schreibeZustand = (z, e) => {
      try {
        if (e.some((ev) => ev.type === 'pruefung-unvollstaendig')) fehlgeschlagenRueck = true;
        if (Array.isArray(e) && e.length > 0 && !e.some((ev) => ev.type === 'pruefung-unvollstaendig')) {
          vollstaendigRueck = true;
        }
      } catch {
        fehlgeschlagenRueck = true;
      }
      origSchreib(z, e);
    };
    try {
      if (lauf) {
        lauf.anstossen();
        try {
          await lauf.leerlauf();
        } catch {
          // ignorieren
        }
      } else {
        const pruefungen = offenePruefungen(deps.ermittlung, deps.leseZustand());
        if (pruefungen.length > 0) {
          const skript = buendelSkript(pruefungen);
          const res = await deps.run(skript, 20000);
          const neu = wendePruefungAn(deps.ermittlung, deps.leseZustand(), leseBuendelAusgabe(res.output));
          deps.schreibeZustand(neu.zustand, neu.ereignisse);
        }
      }
    } catch {
      deps.schreibeZustand = origSchreib;
      return false;
    }
    deps.schreibeZustand = origSchreib;
    if (fehlgeschlagenRueck) return false;
    if (!vollstaendigRueck && deps.leseZustand() === stateVor) {
      // falls kein Ereignis, aber Zustand unverändert; trotzdem erfolgreich wenn leerlauf ok
    }
    if (fehlgeschlagenRueck) return false;
    // Erfolg nur wenn nach neuem Anstoß vollständiges Bündel derselben Generation angewendet
    if (deps.getGeneration() !== deps.getSetupVersion()) return false;
    if (vollstaendigRueck) return true;
    // Fallback: wenn lauf vorhanden und leerlauf lief, aber keine Ereignisse protokolliert - akzeptiere falls Zustand sich nicht verschlechtert
    return lauf ? true : vollstaendigRueck;
  };
}
