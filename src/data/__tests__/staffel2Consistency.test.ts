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
import { EINSATZRAHMEN_VERSTOSS } from '../../lib/missions/einsatzrahmenSetup';
import {
  buendelSkript,
  ID_MUSTER,
  offenePruefungen,
  pruefeDaten,
  startZustand,
} from '../../lib/missions/ermittlung';
import type { Ermittlung } from '../../lib/missions/ermittlungTypes';
import { glossar } from '../../lib/missions/glossar';
import { episode1, episode1Werkzeuge, LOESUNG } from '../staffeln/staffel-2/episode-1';

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
      's.log.audit-zeile',
      'b.log-zeile',
      'b.rechte-metadaten',
      'b.rechte-zeile',
      'e.verstoss',
    ]);
    expect(bashN(buendelSkript(pruefungen)).status).toBe(0);
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
