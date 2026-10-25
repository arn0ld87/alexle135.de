// @vitest-environment node
// ADR 0009 für ALLE registrierten Episoden von Staffel 2 sowie die Episodenwahl und -verkettung.
// Eine neu eingetragene Episode wird hier ohne Änderung am Test geprüft.
import { describe, expect, it } from 'vitest';
import { einsatzrahmenSetupSkript } from '../../lib/missions/einsatzrahmenSetup';
import { MINDEST_SCHRITTARTEN, pruefeDaten } from '../../lib/missions/ermittlung';
import { glossar } from '../../lib/missions/glossar';
import {
  STAFFEL2_PFAD,
  staffel2Episoden,
  waehleEpisode,
  weiterZurNaechsten,
} from '../staffeln/staffel-2';
import { LOESUNG } from '../staffeln/staffel-2/episode-1';

describe('Staffel 2: registrierte Episoden', () => {
  it('stehen in Spielreihenfolge ab 0 mit eindeutigen Nummern und IDs', () => {
    expect(staffel2Episoden.length).toBeGreaterThanOrEqual(2);
    expect(staffel2Episoden.map((e) => e.ermittlung.nr)).toEqual(
      staffel2Episoden.map((_, i) => i)
    );
    const ids = staffel2Episoden.map((e) => e.ermittlung.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(staffel2Episoden.map((e) => [`Episode ${e.ermittlung.nr}`, e] as const))(
    '%s',
    (_name, eintrag) => {
      const { ermittlung: e, werkzeuge } = eintrag;
      const schritte = e.spuren.flatMap((spur) => spur.schritte);

      it('ist ein gültiger Datensatz', () => {
        expect(pruefeDaten(e)).toEqual([]);
      });

      it(`nutzt mindestens ${MINDEST_SCHRITTARTEN} verschiedene Schrittarten (ADR 0009)`, () => {
        expect(new Set(schritte.map((s) => s.art)).size).toBeGreaterThanOrEqual(
          MINDEST_SCHRITTARTEN
        );
      });

      it('wiederholt in keiner Spur dieselbe Art direkt hintereinander', () => {
        for (const spur of e.spuren) {
          spur.schritte.slice(1).forEach((schritt, i) => {
            expect(schritt.art, `${spur.id}/${schritt.id}`).not.toBe(spur.schritte[i].art);
          });
        }
      });

      it('hat ein Antwortfeld genau bei ablesen', () => {
        for (const s of schritte) {
          if (s.art === 'ablesen') {
            expect(s.antwort?.frage.trim(), s.id).toBeTruthy();
            expect(s.antwort?.format.trim(), s.id).toBeTruthy();
            expect(s.antwort?.pruefung.trim(), s.id).toBeTruthy();
          } else {
            expect(s.antwort, s.id).toBeUndefined();
          }
        }
      });

      it('hat je Schritt drei Tipps (Richtung, Befehl, Lösung)', () => {
        for (const s of schritte) {
          expect(s.tipps, s.id).toHaveLength(3);
          expect(s.tipps[0].startsWith(LOESUNG), s.id).toBe(false);
          expect(s.tipps[1].startsWith(LOESUNG), s.id).toBe(false);
          expect(s.tipps[2].startsWith(LOESUNG), s.id).toBe(true);
        }
      });

      it('erlaubt nur gültige sudo-Befehle und hat Werkzeuge aus dem Glossar', () => {
        expect(() => einsatzrahmenSetupSkript(e.einsatzrahmen.sudoBefehle)).not.toThrow();
        expect(werkzeuge.length).toBeGreaterThanOrEqual(3);
        for (const werkzeug of werkzeuge) expect(glossar.get(werkzeug.befehl)).toEqual(werkzeug);
      });
    }
  );
});

describe('Staffel 2: Episodenwahl', () => {
  it.each([null, '', 'abc', '7', '-1', '01', '1.0', '1 ', ' 1', '1e0', '99999'])(
    'wählt bei %j die erste Episode',
    (wert) => {
      expect(waehleEpisode(wert).ermittlung.nr).toBe(0);
    }
  );

  it('wählt jede registrierte Episode über ihre Nummer', () => {
    for (const eintrag of staffel2Episoden) {
      expect(waehleEpisode(String(eintrag.ermittlung.nr))).toBe(eintrag);
    }
  });
});

describe('Staffel 2: Verkettung weiter', () => {
  it('verweist jede Episode außer der letzten auf die nächste der Liste', () => {
    staffel2Episoden.forEach((eintrag, i) => {
      const naechste = staffel2Episoden[i + 1];
      expect(weiterZurNaechsten(eintrag.ermittlung)).toEqual(
        naechste
          ? {
              href: `${STAFFEL2_PFAD}?episode=${naechste.ermittlung.nr}`,
              text: `Weiter zu Episode ${naechste.ermittlung.nr}`,
            }
          : undefined
      );
    });
  });

  it('führt der Link auf eine Episode, die waehleEpisode findet', () => {
    for (const eintrag of staffel2Episoden) {
      const weiter = weiterZurNaechsten(eintrag.ermittlung);
      if (!weiter) continue;
      const wert = new URL(weiter.href, 'https://example.test').searchParams.get('episode');
      expect(waehleEpisode(wert).ermittlung.nr).toBe(eintrag.ermittlung.nr + 1);
    }
  });
});
