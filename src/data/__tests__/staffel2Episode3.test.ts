// @vitest-environment node
// Episode 3 „Die Lücke im Log“ ohne VM: Struktur, ADR 0009, Belege, Skript-Syntax und Assets.
// Die echte Gastprobe steht in staffel2Episode3.vm.test.ts (nur mit MISSION_VM=1).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { abfrageSkript } from '../../lib/missions/abfrage';
import { AKTENWAND_ABFRAGE } from '../../lib/missions/aktenwand';
import { EINSATZRAHMEN_VERSTOSS } from '../../lib/missions/einsatzrahmenSetup';
import {
  buendelSkript,
  ID_MUSTER,
  offenePruefungen,
  pruefeVorwurf,
  pruefeDaten,
  startZustand,
} from '../../lib/missions/ermittlung';
import type { Ermittlung } from '../../lib/missions/ermittlungTypes';
import { glossar } from '../../lib/missions/glossar';
import { LOESUNG } from '../staffeln/staffel-2/episode-1';
import { staffel2Episoden, waehleEpisode, weiterZurNaechsten } from '../staffeln/staffel-2';
import { episode3, episode3Werkzeuge } from '../staffeln/staffel-2/episode-3';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Alle Gast-Skripte einer Episode mit einem sprechenden Namen. */
function skripte(e: Ermittlung): { name: string; text: string }[] {
  const liste = [{ name: 'setup', text: e.setup }];
  for (const ansicht of e.ansichten) {
    liste.push({ name: `Ansicht ${ansicht.id}`, text: ansicht.abfrage });
    liste.push({ name: `Ansicht ${ansicht.id} als Abfrage`, text: abfrageSkript(ansicht.abfrage) });
  }
  for (const spur of e.spuren) {
    for (const schritt of spur.schritte) {
      liste.push({ name: `Schritt ${spur.id}/${schritt.id}`, text: schritt.verify });
      if (schritt.diagnose) {
        liste.push({ name: `Diagnose ${spur.id}/${schritt.id}`, text: schritt.diagnose });
      }
      if (schritt.antwort) {
        liste.push({
          name: `Antwortprüfung ${spur.id}/${schritt.id}`,
          text: schritt.antwort.pruefung,
        });
      }
    }
  }
  for (const beleg of e.vorwurf.belege)
    liste.push({ name: `Beleg ${beleg.id}`, text: beleg.verify });
  liste.push({ name: 'Einsatzrahmen-Verstoß', text: e.einsatzrahmen.verstoss });
  return liste;
}

const bashN = (text: string) => {
  const ergebnis = spawnSync('bash', ['-n'], { input: text, encoding: 'utf8' });
  return { status: ergebnis.status, fehler: ergebnis.stderr };
};

const schritte = episode3.spuren.flatMap((spur) =>
  spur.schritte.map((schritt) => ({ spur, schritt }))
);

describe('Staffel 2, Episode 3 „Die Lücke im Log“: Struktur', () => {
  it('ist ein gültiger Datensatz mit den vereinbarten Kerndaten', () => {
    expect(pruefeDaten(episode3)).toEqual([]);
    expect(episode3.nr).toBe(3);
    expect(episode3.id).toBe('luecke-im-log');
    expect(episode3.titel).toBe('Die Lücke im Log');
    expect(episode3.hostname).toBe('rw-srv01');
    expect(episode3.vorwurf.taeterId).toBe('nadia');
    expect(episode3.vorwurf.verdaechtige.map((v) => v.id)).toEqual(['timo', 'nadia', 'margit']);
    expect(episode3.vorwurf.mindestBelege).toBe(2);
    expect(episode3.vorwurf.jedeSpur).toBe(true);
    expect(episode3.beweisstueck.code).toBe('S2-E3-LUECKE');
  });

  it('erfüllt ADR 0009: mindestens drei Schrittarten, keine gleiche Art direkt hintereinander', () => {
    const arten = new Set(schritte.map((s) => s.schritt.art));
    expect(arten.size).toBeGreaterThanOrEqual(3);
    expect([...arten].sort()).toEqual(['ablesen', 'ordnen', 'sichern']);
    for (const spur of episode3.spuren) {
      for (let i = 1; i < spur.schritte.length; i++) {
        expect(spur.schritte[i].art, `${spur.id}/${spur.schritte[i].id}`).not.toBe(
          spur.schritte[i - 1].art
        );
      }
    }
  });

  it('hat die Antwortfrage genau beim Ablesen und prüft sie gegen den Zustand', () => {
    for (const { schritt } of schritte) {
      expect(Boolean(schritt.antwort), schritt.id).toBe(schritt.art === 'ablesen');
    }
    const ablesen = schritte.filter((s) => s.schritt.art === 'ablesen');
    expect(ablesen.map((s) => s.schritt.id)).toEqual(['zeitraum']);
    const { antwort, verify } = ablesen[0].schritt;
    expect(verify).toBe('false');
    expect(antwort?.pruefung).toContain('ANTWORT');
    expect(antwort?.pruefung).toContain('rechenwerk-auth.log');
    // Der Zeitraum steht nirgends als Festwert in der Prüfung: kein Uhrzeit-Literal.
    expect(antwort?.pruefung).not.toMatch(/0[0-9]:[0-5][0-9]/);
    expect(antwort?.format).toMatch(/HH|\d\d:\d\d/);
  });

  it('hat keine leere Spur, gültige IDs und je drei Tipps mit markierter Lösung', () => {
    expect(episode3.spuren.map((s) => s.id)).toEqual(['luecke', 'zaehlung']);
    expect(schritte.map((s) => s.schritt.id)).toEqual([
      'zeitraum',
      'luecke-zeilen',
      'konten-zaehlung',
      'skript-quarantaene',
    ]);
    for (const { schritt } of schritte) {
      expect(ID_MUSTER.test(schritt.id)).toBe(true);
      expect(schritt.title.trim()).not.toBe('');
      expect(schritt.pager.length).toBeGreaterThan(0);
      expect(schritt.tipps).toHaveLength(3);
      expect(schritt.tipps.every((tipp) => tipp.trim() !== '')).toBe(true);
      expect(schritt.tipps[0].startsWith(LOESUNG)).toBe(false);
      expect(schritt.tipps[1].startsWith(LOESUNG)).toBe(false);
      expect(schritt.tipps[2].startsWith(LOESUNG)).toBe(true);
    }
  });

  it('verrät die Lösung nicht im Pager', () => {
    const pager = schritte.flatMap((s) => s.schritt.pager).join(' ');
    expect(pager).not.toMatch(/\d\d:\d\d/);
    expect(pager).not.toMatch(/uniq|grep -vxFf|diff /);
    expect(pager).toContain('Nachtschicht bei der Rechenwerk Ostwind GmbH');
  });

  it('ordnet jedem Beleg eine Datei <id>.txt, Spur und Täterin zu und prüft Schritt und Beleg gleich', () => {
    expect(Object.fromEntries(episode3.vorwurf.belege.map((b) => [b.id, b.spurId]))).toEqual({
      'konten-zaehlung': 'zaehlung',
      'luecke-zeilen': 'luecke',
    });
    const ids = episode3.vorwurf.belege.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const verifys = new Map(episode3.vorwurf.belege.map((b) => [b.id, b.verify]));
    for (const beleg of episode3.vorwurf.belege) {
      expect(beleg.stuetzt).toBe('nadia');
      expect(beleg.verify).toContain(`$d/${beleg.id}.txt`);
      expect(beleg.verify).not.toContain('history');
    }
    expect(schritte.find((s) => s.schritt.id === 'luecke-zeilen')?.schritt.verify).toBe(
      verifys.get('luecke-zeilen')
    );
    expect(schritte.find((s) => s.schritt.id === 'konten-zaehlung')?.schritt.verify).toBe(
      verifys.get('konten-zaehlung')
    );
    // Nur Belege und Schritte, die ein Beleg-File brauchen, nennen ~/belege/ im Pager.
    for (const beleg of episode3.vorwurf.belege) {
      const schritt = schritte.find((s) => s.schritt.id === beleg.id)?.schritt;
      expect(schritt?.pager.join(' ')).toContain(`~/belege/${beleg.id}.txt`);
    }
  });

  it('prüft den Ordnen-Schritt am Zustand und nicht am Befehl', () => {
    const ordnen = schritte.find((s) => s.schritt.art === 'ordnen')?.schritt;
    expect(ordnen?.verify).toContain('quarantaene');
    expect(ordnen?.verify).not.toMatch(/history|\.bash_history|HISTFILE/);
    expect(ordnen?.verify).not.toMatch(/\bmv\b/);
  });

  it('enthält vollständige Antworten, Szene und Beweisstück', () => {
    const { antworten } = episode3.vorwurf;
    for (const art of ['richtig', 'falschePerson', 'zuWenigBelege', 'gesperrt'] as const) {
      expect(antworten[art].length).toBeGreaterThan(0);
      expect(antworten[art].every((zeile) => zeile.trim() !== '')).toBe(true);
    }
    expect(episode3.szene.length).toBeGreaterThan(0);
    expect(episode3.beweisstueck.id).toBe('logluecke');
    // Margits Motiv bleibt offen (Finale).
    expect(episode3.szene.join(' ')).not.toMatch(/Motiv|Honorar|loswerden/);
  });

  it('übernimmt Aktenwand-Abfrage und Einsatzrahmen-Verstoß unverändert', () => {
    expect(episode3.ansichten.find((a) => a.art === 'aktenwand')?.abfrage).toBe(AKTENWAND_ABFRAGE);
    expect(episode3.einsatzrahmen.verstoss).toBe(EINSATZRAHMEN_VERSTOSS);
    expect(episode3.einsatzrahmen.text.join(' ')).toContain('/home/nadia/');
    expect(episode3.einsatzrahmen.text.join(' ')).toContain('kein sudo');
    expect(episode3.einsatzrahmen.folge.join(' ')).toContain('Margit');
  });

  it('bündelt die offenen Prüfungen des Starts zu einem gültigen Skript', () => {
    const pruefungen = offenePruefungen(episode3, startZustand());
    expect(pruefungen.map((p) => p.id)).toEqual([
      's.luecke.zeitraum',
      's.zaehlung.konten-zaehlung',
      'd.zaehlung.konten-zaehlung',
      'b.konten-zaehlung',
      'b.luecke-zeilen',
      'e.verstoss',
    ]);
    expect(bashN(buendelSkript(pruefungen)).status).toBe(0);
  });
});

describe('Staffel 2, Episode 3: Raumansicht, Porträts und Werkzeuge', () => {
  const raum = episode3.ansichten.find((a) => a.art === 'raum');

  it('hat gültige Hotspots, deren Schlüssel die Abfrage ausgibt, und liest nur', () => {
    const hotspots = raum?.hotspots ?? [];
    expect(hotspots.map((h) => h.id)).toEqual(['host', 'konten', 'logs', 'laufzeit']);
    for (const h of hotspots) {
      expect(ID_MUSTER.test(h.id)).toBe(true);
      expect(h.x + h.w).toBeLessThanOrEqual(1000);
      expect(h.y + h.h).toBeLessThanOrEqual(600);
      expect(raum?.abfrage).toContain(`${h.schluessel}\\t`);
    }
    expect(raum?.abfrage).not.toMatch(/>|\bsudo\b|\btee\b|\brm\b|\bchmod\b|\bchown\b|\bmv\b/);
  });

  it('verweist auf die drei vorhandenen Porträts', () => {
    for (const person of episode3.vorwurf.verdaechtige) {
      expect(person.portraet).toMatch(new RegExp(`${person.id}[^/]*\\.webp$`));
      expect(existsSync(join(root, 'src/assets/missions/staffel-2', `${person.id}.webp`))).toBe(
        true
      );
    }
  });

  it('nutzt Werkzeuge aus dem Glossar, die keinen Schritt direkt lösen', () => {
    expect(episode3Werkzeuge.map((w) => w.befehl)).toEqual([
      'diff',
      'awk',
      'cut',
      'sort',
      'uniq -c',
      'mv',
    ]);
    const loesungen = schritte.map((s) => s.schritt.tipps[2].slice(LOESUNG.length));
    for (const werkzeug of episode3Werkzeuge) {
      expect(glossar.get(werkzeug.befehl)).toEqual(werkzeug);
      expect(loesungen).not.toContain(werkzeug.beispiel);
      expect(werkzeug.beispiel).not.toMatch(/rechenwerk|belege|quarantaene/);
    }
  });
});

describe('Staffel 2, Episode 3: Skripte', () => {
  it.each(skripte(episode3).map((s) => [s.name, s.text]))(
    'ist syntaktisch gültiges Bash: %s',
    (name, text) => {
      expect({ name, ...bashN(text) }).toEqual({ name, status: 0, fehler: '' });
    }
  );

  it('setzt das Setup mit expliziter Fehlerfortpflanzung auf und fasst nur eigene Dateien an', () => {
    expect(episode3.setup.startsWith('set -eu')).toBe(true);
    expect(episode3.setup).not.toMatch(/rm -rf (?!"\$tmp")/);
    expect(episode3.setup).not.toContain('90-staffel2-rahmen');
    expect(episode3.setup).not.toContain('/var/log/staffel2-sudo.log');
    expect(episode3.setup).not.toContain('/home/nadia/vertraulich.txt');
    expect(episode3.setup).not.toContain('sudoers');
    expect(episode3.setup).not.toMatch(/azubi ALL|NOPASSWD/);
    expect(episode3.setup).not.toContain('@{');
  });

  it('liest in Diagnosen nur: keine Umleitung in Dateien, kein sudo, keine Änderung', () => {
    const diagnosen = schritte.filter((s) => s.schritt.diagnose);
    expect(diagnosen.map((s) => s.schritt.id)).toEqual([
      'luecke-zeilen',
      'konten-zaehlung',
      'skript-quarantaene',
    ]);
    for (const { schritt } of diagnosen) {
      expect(schritt.diagnose, schritt.id).not.toMatch(
        /\bsudo\b|\btee\b|\brm\b|\bchmod\b|\bchown\b|\bmv\b|\btouch\b/
      );
      expect(schritt.diagnose, schritt.id).not.toMatch(/>\s*["$/~]/);
    }
  });
});

describe('Staffel 2, Episode 3: Episodenliste und Abschlussregel', () => {
  it('steht in der Episodenliste; ?episode=3 wählt sie, auf Episode 1 folgt der Link', () => {
    const eintrag = staffel2Episoden.find((e) => e.ermittlung.nr === 3);
    expect(eintrag?.ermittlung).toBe(episode3);
    expect(eintrag?.werkzeuge).toBe(episode3Werkzeuge);
    expect(waehleEpisode('3').ermittlung).toBe(episode3);
    expect(weiterZurNaechsten(episode3)).toBeUndefined();
    const nr = staffel2Episoden.map((e) => e.ermittlung.nr);
    expect(nr).toEqual([...nr].sort((a, b) => a - b));
  });

  it('schließt erst mit richtigem Vorwurf und allen Spuren; sonst nennt der Pager, was fehlt', () => {
    const belege = episode3.vorwurf.belege.map((b) => b.id).sort();
    const vorwurf = { verdaechtigeId: 'nadia', belegIds: belege };
    const offen = pruefeVorwurf(
      episode3,
      { ...startZustand(), belegeErkannt: belege, erledigt: { luecke: 2, zaehlung: 1 } },
      vorwurf
    );
    expect(offen.ergebnis).toBe('richtig-offen');
    expect(offen.zustand.geloest).toBe(false);
    expect(offen.zustand.vorwurfRichtig).toBe(true);
    expect(offen.antwort.join(' ')).toContain('Verschiebe das Löschskript in die Quarantäne');
    expect(offen.antwort.join(' ')).not.toContain('Lies ab');

    const fertig = pruefeVorwurf(
      episode3,
      { ...startZustand(), belegeErkannt: belege, erledigt: { luecke: 2, zaehlung: 2 } },
      vorwurf
    );
    expect(fertig.ergebnis).toBe('richtig');
    expect(fertig.zustand.geloest).toBe(true);
    expect(fertig.antwort).toEqual(episode3.vorwurf.antworten.richtig);
  });

  it('erlaubt kein sudo über den gemeinsamen Verstoßbefehl hinaus', () => {
    expect(episode3.einsatzrahmen.sudoBefehle).toEqual([]);
  });
});
