// @vitest-environment node
// Konsistenz der Episoden von Staffel 2 ohne VM: Struktur, Skript-Syntax, Referenzen und Assets.
// Die echte Gastprobe steht in staffel2Episode1.vm.test.ts (nur mit MISSION_VM=1).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { abfrageSkript } from '../../lib/missions/abfrage';
import { AKTENWAND_ABFRAGE } from '../../lib/missions/aktenwand';
import {
  EINSATZRAHMEN_VERSTOSS,
  einsatzrahmenSetupSkript,
} from '../../lib/missions/einsatzrahmenSetup';
import {
  buendelSkript,
  ID_MUSTER,
  offenePruefungen,
  pruefeDaten,
  startZustand,
} from '../../lib/missions/ermittlung';
import type { Ermittlung } from '../../lib/missions/ermittlungTypes';
import { glossar } from '../../lib/missions/glossar';
import { episode0, episode0Werkzeuge } from '../staffeln/staffel-2/episode-0';
import {
  episode1,
  episode1Werkzeuge,
  LOESUNG,
  SUDO_BEFEHLE,
} from '../staffeln/staffel-2/episode-1';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const PORTRAET_MAX_BYTES = 40 * 1024;

/** Alle Gast-Skripte einer Episode mit einem sprechenden Namen. */
function skripte(e: Ermittlung): { name: string; text: string }[] {
  const liste = [{ name: `${e.id}: setup`, text: e.setup }];
  for (const ansicht of e.ansichten) {
    liste.push({ name: `${e.id}: Ansicht ${ansicht.id}`, text: ansicht.abfrage });
    liste.push({
      name: `${e.id}: Ansicht ${ansicht.id} als Abfrage`,
      text: abfrageSkript(ansicht.abfrage),
    });
  }
  for (const spur of e.spuren) {
    for (const schritt of spur.schritte) {
      liste.push({ name: `${e.id}: Schritt ${spur.id}/${schritt.id}`, text: schritt.verify });
      if (schritt.diagnose) {
        liste.push({ name: `${e.id}: Diagnose ${spur.id}/${schritt.id}`, text: schritt.diagnose });
      }
      if (schritt.antwort) {
        liste.push({
          name: `${e.id}: Antwortprüfung ${spur.id}/${schritt.id}`,
          text: schritt.antwort.pruefung,
        });
      }
    }
  }
  for (const beleg of e.vorwurf.belege) {
    liste.push({ name: `${e.id}: Beleg ${beleg.id}`, text: beleg.verify });
  }
  liste.push({ name: `${e.id}: Einsatzrahmen-Verstoß`, text: e.einsatzrahmen.verstoss });
  return liste;
}

function bashN(text: string): { status: number | null; fehler: string } {
  const ergebnis = spawnSync('bash', ['-n'], { input: text, encoding: 'utf8' });
  return { status: ergebnis.status, fehler: ergebnis.stderr };
}

describe('Staffel 2, Episode 1: Struktur (T9-1)', () => {
  it('ist ein gültiger Datensatz', () => {
    expect(pruefeDaten(episode1)).toEqual([]);
  });

  it('hat die vereinbarten Kerndaten', () => {
    expect(episode1.nr).toBe(1);
    expect(episode1.id).toBe('zu-viele-rechte');
    expect(episode1.titel).toBe('Zu viele Rechte');
    expect(episode1.hostname).toBe('rw-srv01');
    expect(episode1.vorwurf.taeterId).toBe('timo');
    expect(episode1.vorwurf.mindestBelege).toBe(2);
    expect(episode1.vorwurf.jedeSpur).toBe(true);
    expect(episode1.vorwurf.verdaechtige.map((v) => v.id)).toEqual(['timo', 'nadia', 'margit']);
  });

  it('hat keine leere Spur, gültige IDs und je drei Tipps mit markierter Lösung', () => {
    expect(episode1.spuren.map((s) => s.id)).toEqual(['rechte', 'log']);
    for (const spur of episode1.spuren) {
      expect(spur.schritte.length).toBeGreaterThan(0);
      for (const schritt of spur.schritte) {
        expect(ID_MUSTER.test(schritt.id)).toBe(true);
        expect(schritt.title.trim()).not.toBe('');
        expect(schritt.pager.length).toBeGreaterThan(0);
        expect(schritt.tipps).toHaveLength(3);
        expect(schritt.tipps.every((tipp) => tipp.trim() !== '')).toBe(true);
        expect(schritt.tipps[0].startsWith(LOESUNG)).toBe(false);
        expect(schritt.tipps[1].startsWith(LOESUNG)).toBe(false);
        expect(schritt.tipps[2].startsWith(LOESUNG)).toBe(true);
      }
    }
  });

  it('ordnet jedem Beleg eine Datei <id>.txt, Spur und Person zu', () => {
    const erwartet = {
      'rechte-zeile': 'rechte',
      'rechte-metadaten': 'rechte',
      'log-zeile': 'log',
    };
    expect(Object.fromEntries(episode1.vorwurf.belege.map((b) => [b.id, b.spurId]))).toEqual(
      erwartet
    );
    const personen = new Set(episode1.vorwurf.verdaechtige.map((v) => v.id));
    for (const beleg of episode1.vorwurf.belege) {
      expect(personen.has(beleg.stuetzt)).toBe(true);
      expect(beleg.stuetzt).toBe('timo');
      expect(beleg.verify).toContain(`$d/${beleg.id}.txt`);
      expect(beleg.verify).not.toContain('history');
    }
  });

  it('prüft Schritt und Beleg einer Datei mit demselben Skript', () => {
    const verifys = new Map(episode1.vorwurf.belege.map((b) => [b.id, b.verify]));
    const schritte = Object.fromEntries(
      episode1.spuren.flatMap((s) => s.schritte.map((x) => [`${s.id}/${x.id}`, x.verify]))
    );
    expect(schritte['rechte/sudo-zeile']).toBe(verifys.get('rechte-zeile'));
    expect(schritte['rechte/datei-metadaten']).toBe(verifys.get('rechte-metadaten'));
    expect(schritte['log/audit-zeile']).toBe(verifys.get('log-zeile'));
  });

  it('enthält vollständige Antworten und keinen Platzhalter-Text mehr', () => {
    const { antworten } = episode1.vorwurf;
    for (const art of ['richtig', 'falschePerson', 'zuWenigBelege', 'gesperrt'] as const) {
      expect(antworten[art].length).toBeGreaterThan(0);
      expect(antworten[art].every((zeile) => zeile.trim() !== '')).toBe(true);
    }
    expect(episode1.szene.length).toBeGreaterThan(0);
    expect(episode1.beweisstueck.code).toBe('S2-E1-RECHTE');
    const alles = JSON.stringify(episode1);
    expect(alles).not.toContain('notiz.txt');
    expect(alles).not.toContain('Person A');
    expect(alles).not.toContain('missions/figur');
  });

  it('übernimmt Aktenwand-Abfrage und Einsatzrahmen-Verstoß unverändert', () => {
    expect(episode1.ansichten.find((a) => a.art === 'aktenwand')?.abfrage).toBe(AKTENWAND_ABFRAGE);
    expect(episode1.einsatzrahmen.verstoss).toBe(EINSATZRAHMEN_VERSTOSS);
    expect(episode1.einsatzrahmen.text.join(' ')).toContain('/home/nadia/');
    expect(episode1.einsatzrahmen.folge.join(' ')).toContain('Margit');
  });

  it('bündelt die offenen Prüfungen des Starts zu einem gültigen Skript', () => {
    const pruefungen = offenePruefungen(episode1, startZustand());
    expect(pruefungen.map((p) => p.id)).toEqual([
      's.rechte.sudo-zeile',
      'd.rechte.sudo-zeile',
      's.log.audit-zeile',
      'd.log.audit-zeile',
      'b.log-zeile',
      'b.rechte-metadaten',
      'b.rechte-zeile',
      'e.verstoss',
    ]);
    expect(bashN(buendelSkript(pruefungen)).status).toBe(0);
  });
});

describe('Staffel 2, Episode 1: Schrittarten und sudo-Rahmen (ADR 0009)', () => {
  it('folgt der Spur Rechte von sichern über ablesen und reparieren bis ordnen', () => {
    expect(
      Object.fromEntries(
        episode1.spuren.map((s) => [s.id, s.schritte.map((x) => `${x.id}:${x.art}`)])
      )
    ).toEqual({
      rechte: [
        'sudo-zeile:sichern',
        'kennung:ablesen',
        'datei-metadaten:sichern',
        'regel-weg:reparieren',
        'status-weg:ordnen',
      ],
      log: ['audit-zeile:sichern'],
    });
  });

  it('erlaubt per sudo genau die Verschiebungen von Regel und Programm in die Quarantäne', () => {
    expect(episode1.einsatzrahmen.sudoBefehle).toBe(SUDO_BEFEHLE);
    expect(SUDO_BEFEHLE).toHaveLength(6);
    for (const befehl of SUDO_BEFEHLE) {
      expect(befehl).toMatch(
        /^\/bin\/mv \/(etc\/sudoers\.d\/rw-fernwartung|usr\/local\/bin\/rw-status) \/home\/azubi\/quarantaene(\/|\/rw-fernwartung|\/rw-status)?$/
      );
    }
    expect(() => einsatzrahmenSetupSkript(SUDO_BEFEHLE)).not.toThrow();
    const text = episode1.einsatzrahmen.text.join(' ');
    expect(text).toContain('~/quarantaene/');
    expect(text).toContain('rw-status');
    expect(text).toContain('rw-fernwartung');
  });

  it('legt die Quarantäne im Setup an und räumt nur genau ihre beiden Dateien auf', () => {
    expect(episode1.setup).toContain("install -d -o azubi -g azubi -m 0755 '/home/azubi/quarantaene'");
    expect(episode1.setup).toContain('for name in rw-fernwartung rw-status');
    expect(episode1.setup).not.toMatch(/rm -rf (?!"\$tmp")/);
  });
});

describe('Staffel 2, Episode 1: Raumansicht und Hotspots (T9-2)', () => {
  const raum = episode1.ansichten.find((a) => a.art === 'raum');

  it('hat gültige Geometrie und Schlüssel, die die Abfrage ausgibt', () => {
    expect(raum).toBeDefined();
    const hotspots = raum?.hotspots ?? [];
    expect(hotspots.length).toBeGreaterThanOrEqual(3);
    for (const h of hotspots) {
      expect(ID_MUSTER.test(h.id)).toBe(true);
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeGreaterThanOrEqual(0);
      expect(h.w).toBeGreaterThan(0);
      expect(h.h).toBeGreaterThan(0);
      expect(h.x + h.w).toBeLessThanOrEqual(1000);
      expect(h.y + h.h).toBeLessThanOrEqual(600);
      expect(raum?.abfrage).toContain(`${h.schluessel}\\t`);
    }
  });

  it('liest nur: keine Umleitung, kein sudo, keine Änderung', () => {
    expect(raum?.abfrage).not.toMatch(/>|\bsudo\b|\btee\b|\brm\b|\bchmod\b|\bchown\b|\bmv\b/);
  });
});

describe('Staffel 2, Episode 1: Porträts (T9-2)', () => {
  it('verweisen auf drei eigene WebP-Dateien unter src/assets ohne externe URL', async () => {
    const personen = episode1.vorwurf.verdaechtige;
    expect(new Set(personen.map((p) => p.portraet)).size).toBe(personen.length);
    for (const person of personen) {
      expect(person.portraet).not.toMatch(/^(https?:)?\/\//);
      expect(person.portraet).not.toMatch(/^data:/);
      expect(person.portraet).toMatch(new RegExp(`${person.id}[^/]*\\.webp$`));
      expect(person.portraet).not.toContain('/public/');
      const datei = join(root, 'src/assets/missions/staffel-2', `${person.id}.webp`);
      expect(existsSync(datei)).toBe(true);
      expect(statSync(datei).size).toBeLessThanOrEqual(PORTRAET_MAX_BYTES);
      const meta = await sharp(readFileSync(datei)).metadata();
      expect(meta.format).toBe('webp');
      expect([meta.width, meta.height]).toEqual([256, 256]);
      expect(existsSync(join(root, 'public/missions/staffel-2', `${person.id}.webp`))).toBe(false);
    }
  });
});

describe('Staffel 2, Episode 1: Skripte (T9-3)', () => {
  it.each(skripte(episode1).map((s) => [s.name, s.text]))(
    'ist syntaktisch gültiges Bash: %s',
    (name, text) => {
      const { status, fehler } = bashN(text);
      expect({ name, status, fehler }).toEqual({ name, status: 0, fehler: '' });
    }
  );

  it('meldet einen Syntaxfehler mit dem Namen des Skripts', () => {
    const kaputt: Ermittlung = {
      ...episode1,
      vorwurf: {
        ...episode1.vorwurf,
        belege: episode1.vorwurf.belege.map((b, i) =>
          i === 1 ? { ...b, verify: `${b.verify}\nif then` } : b
        ),
      },
    };
    const fehler = skripte(kaputt)
      .filter((s) => bashN(s.text).status !== 0)
      .map((s) => s.name);
    expect(fehler).toEqual(['zu-viele-rechte: Beleg rechte-metadaten']);
  });

  it('setzt das Setup mit expliziter Fehlerfortpflanzung auf und ändert den Einsatzrahmen nicht', () => {
    expect(episode1.setup.startsWith('set -eu')).toBe(true);
    expect(episode1.setup).not.toMatch(/rm -rf (?!"\$tmp")/);
    expect(episode1.setup).not.toContain('90-staffel2-rahmen');
    expect(episode1.setup).not.toContain('/var/log/staffel2-sudo.log');
    expect(episode1.setup).not.toContain('/home/nadia/vertraulich.txt');
    expect(episode1.setup).toContain('visudo -cf');
    // Kein allgemeines sudo-Recht für azubi; nur die fiktive Regel für nadia.
    expect(episode1.setup).not.toMatch(/azubi ALL/);
    expect(episode1.setup).not.toMatch(/NOPASSWD: ALL/);
  });
});

describe('Staffel 2, Episode 1: Werkzeuge (T9-10)', () => {
  it('stammen aus dem gemeinsamen Glossar', () => {
    expect(episode1Werkzeuge.length).toBeGreaterThanOrEqual(3);
    for (const werkzeug of episode1Werkzeuge) {
      expect(glossar.get(werkzeug.befehl)).toEqual(werkzeug);
    }
    expect(new Set(episode1Werkzeuge.map((w) => w.befehl)).size).toBe(episode1Werkzeuge.length);
  });

  it('lösen die Episode nicht direkt', () => {
    const loesungen = episode1.spuren.flatMap((s) =>
      s.schritte.map((x) => x.tipps[2].slice(LOESUNG.length))
    );
    for (const werkzeug of episode1Werkzeuge) {
      expect(loesungen).not.toContain(werkzeug.beispiel);
      expect(werkzeug.beispiel).not.toMatch(/rw-fernwartung|rechenwerk|belege/);
    }
  });
});

describe('Staffel 2, Episode 1: Diagnosen (T12)', () => {
  const diagnosen = episode1.spuren.flatMap((spur) =>
    spur.schritte
      .filter((schritt) => schritt.art !== 'ablesen')
      .map((schritt) => ({ name: `${spur.id}/${schritt.id}`, diagnose: schritt.diagnose }))
  );

  it('gibt allen Schritten außer dem Ablesen eine Diagnose, die als Bash gültig ist', () => {
    expect(diagnosen.map((d) => d.name)).toEqual([
      'rechte/sudo-zeile',
      'rechte/datei-metadaten',
      'rechte/regel-weg',
      'rechte/status-weg',
      'log/audit-zeile',
    ]);
    for (const d of diagnosen) {
      expect(d.diagnose?.trim(), d.name).toBeTruthy();
      expect(bashN(d.diagnose ?? '').status, d.name).toBe(0);
    }
  });

  it('liest nur: keine Umleitung in Dateien, kein sudo, keine Änderung', () => {
    for (const d of diagnosen) {
      expect(d.diagnose, d.name).not.toMatch(
        /\bsudo\b|\btee\b|\brm\b|\bchmod\b|\bchown\b|\bmv\b|\btouch\b/
      );
      expect(d.diagnose, d.name).not.toMatch(/>\s*["$/~]/);
    }
  });
});

describe('Staffel 2, Episode 0 „Probelauf“ (T12)', () => {
  it('ist ein gültiger Datensatz mit den vereinbarten Kerndaten', () => {
    expect(pruefeDaten(episode0)).toEqual([]);
    expect(episode0.nr).toBe(0);
    expect(episode0.id).toBe('probelauf');
    expect(episode0.titel).toBe('Probelauf');
    expect(episode0.vorwurf.taeterId).toBe('kaffee');
    expect(episode0.vorwurf.verdaechtige.map((v) => v.id)).toEqual(['timo', 'nadia', 'kaffee']);
    expect(episode0.vorwurf.mindestBelege).toBe(2);
    expect(episode0.vorwurf.jedeSpur).toBe(true);
    expect(episode0.beweisstueck.code).toBe('S2-E0-KASSE');
  });

  it('hat zwei Spuren mit sichern, ablesen und reparieren und nur die Aktenwand als Ansicht', () => {
    expect(
      Object.fromEntries(
        episode0.spuren.map((s) => [s.id, s.schritte.map((x) => `${x.id}:${x.art}`)])
      )
    ).toEqual({
      akte: ['kasse-meta:sichern', 'besitzer:ablesen'],
      inhalt: ['kasse-zeilen:sichern', 'kasse-zurueck:reparieren'],
    });
    expect(episode0.einsatzrahmen.sudoBefehle).toBeUndefined();
    expect(episode0.ansichten.map((a) => a.art)).toEqual(['aktenwand']);
    expect(episode0.ansichten[0].abfrage).toBe(AKTENWAND_ABFRAGE);
  });

  it('hat je drei Tipps mit markierter Lösung und einen kurzen Einstieg im Pager', () => {
    for (const spur of episode0.spuren) {
      for (const schritt of spur.schritte) {
        expect(schritt.tipps).toHaveLength(3);
        expect(schritt.tipps[0].startsWith(LOESUNG)).toBe(false);
        expect(schritt.tipps[1].startsWith(LOESUNG)).toBe(false);
        expect(schritt.tipps[2].startsWith(LOESUNG)).toBe(true);
      }
    }
    const einstieg = episode0.spuren[0].schritte[0].pager.join(' ');
    expect(einstieg).toContain('Erster Einsatztag bei der Rechenwerk Ostwind GmbH');
    expect(einstieg).toMatch(/Beleg/);
    expect(einstieg).toMatch(/nano/);
    expect(einstieg).toMatch(/Tipps/);
  });

  it('hat Diagnosen für Belege und Reparatur, aber keinen Verstoß im Einsatzrahmen', () => {
    const schritte = episode0.spuren.flatMap((s) => s.schritte);
    expect(schritte.filter((s) => s.diagnose).map((s) => s.id)).toEqual([
      'kasse-meta',
      'kasse-zeilen',
      'kasse-zurueck',
    ]);
    expect(episode0.einsatzrahmen.verstoss).toBe('false');
    expect(episode0.einsatzrahmen.text.join(' ')).toContain('/srv/rechenwerk/uebung/');
    expect(episode0.einsatzrahmen.text.join(' ')).not.toContain('nadia');
  });

  it('prüft das Antwortfeld über den Besitzer der Liste', () => {
    const ablesen = episode0.spuren[0].schritte[1];
    expect(ablesen.art).toBe('ablesen');
    expect(ablesen.antwort?.frage).toBe('Wem gehört die geänderte Liste? (Benutzername)');
    expect(ablesen.antwort?.pruefung).toBe(
      '[ "$ANTWORT" = "$(stat -c %U /srv/rechenwerk/uebung/kaffeekasse.csv)" ]'
    );
  });

  it('ordnet jedem Beleg eine Datei <id>.txt, Spur und Person zu', () => {
    expect(Object.fromEntries(episode0.vorwurf.belege.map((b) => [b.id, b.spurId]))).toEqual({
      'kasse-meta': 'akte',
      'kasse-zeilen': 'inhalt',
    });
    for (const beleg of episode0.vorwurf.belege) {
      expect(beleg.stuetzt).toBe('kaffee');
      expect(beleg.verify).toContain(`/${beleg.id}.txt`);
    }
  });

  it('bündelt die offenen Prüfungen des Starts mit Diagnosen zu einem gültigen Skript', () => {
    const pruefungen = offenePruefungen(episode0, startZustand());
    expect(pruefungen.map((p) => p.id)).toEqual([
      's.akte.kasse-meta',
      'd.akte.kasse-meta',
      's.inhalt.kasse-zeilen',
      'd.inhalt.kasse-zeilen',
      'b.kasse-meta',
      'b.kasse-zeilen',
      'e.verstoss',
    ]);
    expect(bashN(buendelSkript(pruefungen)).status).toBe(0);
  });

  it('hat einen eigenen Porträtdatensatz, ein Setup mit expliziter Fehlerfortpflanzung und Werkzeuge', () => {
    const personen = episode0.vorwurf.verdaechtige;
    expect(new Set(personen.map((p) => p.portraet)).size).toBe(personen.length);
    for (const person of personen) {
      expect(existsSync(join(root, 'src/assets/missions/staffel-2', `${person.id}.webp`))).toBe(
        true
      );
    }
    expect(episode0.setup.startsWith('set -eu')).toBe(true);
    expect(episode0.setup).not.toMatch(/rm -rf (?!"\$tmp")/);
    expect(episode0Werkzeuge.map((w) => w.befehl)).toEqual([
      'ls -l',
      'stat',
      'cat',
      'grep',
      '>',
      '>>',
      'cp',
    ]);
    for (const werkzeug of episode0Werkzeuge) {
      expect(glossar.get(werkzeug.befehl)).toEqual(werkzeug);
    }
  });

  it.each(skripte(episode0).map((s) => [s.name, s.text]))(
    'ist syntaktisch gültiges Bash: %s',
    (name, text) => {
      expect({ name, ...bashN(text) }).toEqual({ name, status: 0, fehler: '' });
    }
  );
});
