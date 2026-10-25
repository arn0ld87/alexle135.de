// @vitest-environment node
// Episode 2 ohne VM: Struktur, Schrittarten (ADR 0009), Skript-Syntax und Bildbeleg-Hygiene.
// Die echte Gastprobe steht in staffel2Episode2.vm.test.ts (nur mit MISSION_VM=1).
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
  pruefeDaten,
  startZustand,
} from '../../lib/missions/ermittlung';
import { glossar } from '../../lib/missions/glossar';
import { episode2, episode2Werkzeuge, SUDO_BEFEHLE } from '../staffeln/staffel-2/episode-2';
import { LOESUNG } from '../staffeln/staffel-2/episode-1';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const bashN = (text: string) => spawnSync('bash', ['-n'], { input: text, encoding: 'utf8' });

const skripte = () => {
  const e = episode2;
  const liste = [{ name: 'setup', text: e.setup }];
  for (const ansicht of e.ansichten) {
    liste.push({ name: `Ansicht ${ansicht.id}`, text: ansicht.abfrage });
    liste.push({ name: `Abfrage ${ansicht.id}`, text: abfrageSkript(ansicht.abfrage) });
  }
  for (const spur of e.spuren) {
    for (const schritt of spur.schritte) {
      liste.push({ name: `Schritt ${spur.id}/${schritt.id}`, text: schritt.verify });
      if (schritt.diagnose) liste.push({ name: `Diagnose ${schritt.id}`, text: schritt.diagnose });
      if (schritt.antwort)
        liste.push({ name: `Antwort ${schritt.id}`, text: schritt.antwort.pruefung });
    }
  }
  for (const beleg of e.vorwurf.belege)
    liste.push({ name: `Beleg ${beleg.id}`, text: beleg.verify });
  liste.push({ name: 'Einsatzrahmen', text: e.einsatzrahmen.verstoss });
  return liste;
};

describe('Staffel 2, Episode 2: Struktur', () => {
  it('ist ein gültiger Datensatz mit Bildschirm und den vereinbarten Kerndaten', () => {
    expect(pruefeDaten(episode2)).toEqual([]);
    expect(episode2.nr).toBe(2);
    expect(episode2.id).toBe('prozess-der-nicht-stirbt');
    expect(episode2.hostname).toBe('rw-srv01');
    expect(episode2.bildschirm).toBe(true);
    expect(episode2.vorwurf.taeterId).toBe('nadia');
    expect(episode2.vorwurf.verdaechtige.map((v) => v.id)).toEqual(['timo', 'nadia', 'margit']);
    expect(episode2.vorwurf.mindestBelege).toBe(2);
    expect(episode2.vorwurf.jedeSpur).toBe(true);
    expect(episode2.beweisstueck.code).toBe('S2-E2-PROZESS');
  });

  it('nutzt mindestens drei Schrittarten und nie dieselbe zweimal direkt hintereinander', () => {
    const arten = new Set<string>();
    for (const spur of episode2.spuren) {
      spur.schritte.forEach((schritt, i) => {
        arten.add(schritt.art);
        if (i > 0)
          expect(schritt.art, `${spur.id}/${schritt.id}`).not.toBe(spur.schritte[i - 1].art);
      });
    }
    expect([...arten].sort()).toEqual(['ablesen', 'eingreifen', 'sichern']);
    expect(episode2.spuren.map((s) => s.schritte.map((x) => x.art))).toEqual([
      ['sichern', 'eingreifen'],
      ['ablesen', 'sichern'],
    ]);
  });

  it('hat gültige IDs und je drei Tipps mit markierter Lösung (Ablesen mit Wegweiser)', () => {
    for (const spur of episode2.spuren) {
      for (const schritt of spur.schritte) {
        expect(ID_MUSTER.test(schritt.id)).toBe(true);
        expect(schritt.tipps).toHaveLength(3);
        expect(schritt.tipps[0].startsWith(LOESUNG)).toBe(false);
        expect(schritt.tipps[1].startsWith(LOESUNG)).toBe(false);
        expect(schritt.tipps[2].startsWith(LOESUNG)).toBe(true);
      }
    }
  });

  it('prüft Schritt und Beleg mit demselben Skript und nennt die Abschlussregel im Pager', () => {
    const schritte = Object.fromEntries(
      episode2.spuren.flatMap((s) => s.schritte.map((x) => [x.id, x.verify]))
    );
    const belege = new Map(episode2.vorwurf.belege.map((b) => [b.id, b]));
    expect(schritte['prozess-zeile']).toBe(belege.get('prozess-zeile')?.verify);
    expect(schritte['wartung-zeile']).toBe(belege.get('wartung-zeile')?.verify);
    expect(belege.get('prozess-zeile')?.spurId).toBe('prozess');
    expect(belege.get('wartung-zeile')?.spurId).toBe('zettel');
    for (const beleg of belege.values()) {
      expect(beleg.stuetzt).toBe('nadia');
      expect(beleg.verify).toContain(`$d/${beleg.id}.txt`);
    }
    const start = episode2.spuren[0].schritte[0].pager.join(' ');
    expect(start).toContain('alle Spuren erledigt');
    expect(start).toContain('stimmt');
  });

  it('übernimmt Aktenwand-Abfrage und Einsatzrahmen-Verstoß und nennt den Ausschluss', () => {
    expect(episode2.ansichten.find((a) => a.art === 'aktenwand')?.abfrage).toBe(AKTENWAND_ABFRAGE);
    expect(episode2.einsatzrahmen.verstoss).toBe(EINSATZRAHMEN_VERSTOSS);
    expect(episode2.einsatzrahmen.text.join(' ')).toContain('/home/nadia/');
    expect(episode2.einsatzrahmen.folge.join(' ')).toContain('Margit');
  });

  it('bündelt die offenen Prüfungen des Starts zu einem gültigen Skript ohne Ablesen-Prüfung', () => {
    const ids = offenePruefungen(episode2, startZustand()).map((p) => p.id);
    expect(ids).toEqual([
      's.prozess.prozess-zeile',
      'd.prozess.prozess-zeile',
      's.zettel.kennung',
      'b.prozess-zeile',
      'b.wartung-zeile',
      'e.verstoss',
    ]);
    expect(bashN(buendelSkript(offenePruefungen(episode2, startZustand()))).status).toBe(0);
  });
});

describe('Staffel 2, Episode 2: Porträts, Werkzeuge, Hotspots', () => {
  it('verweist auf die drei vorhandenen Porträts', () => {
    for (const person of episode2.vorwurf.verdaechtige) {
      expect(person.portraet).toMatch(new RegExp(`${person.id}[^/]*\\.webp$`));
      expect(existsSync(join(root, 'src/assets/missions/staffel-2', `${person.id}.webp`))).toBe(
        true
      );
    }
  });

  it('nimmt Werkzeuge aus dem Glossar und löst nichts direkt', () => {
    expect(episode2Werkzeuge.map((w) => w.befehl)).toEqual(
      expect.arrayContaining(['ps', 'pkill', 'crontab'])
    );
    for (const werkzeug of episode2Werkzeuge) {
      expect(glossar.get(werkzeug.befehl)).toEqual(werkzeug);
      expect(werkzeug.beispiel).not.toMatch(/rw-abgleich|abgleich|belege/);
    }
  });

  it('hat Hotspots, deren Schlüssel die Abfrage ausgibt, und liest nur', () => {
    const raum = episode2.ansichten.find((a) => a.art === 'raum');
    for (const h of raum?.hotspots ?? []) expect(raum?.abfrage).toContain(`${h.schluessel}\\t`);
    expect(raum?.abfrage).not.toMatch(/>|\bsudo\b|\btee\b|\brm\b|\bchmod\b|\bchown\b|\bmv\b/);
  });
});

describe('Staffel 2, Episode 2: Skripte und Bildbeleg', () => {
  it.each(skripte().map((s) => [s.name, s.text]))(
    'ist syntaktisch gültiges Bash: %s',
    (_n, text) => {
      const r = bashN(text);
      expect({ status: r.status, fehler: r.stderr }).toEqual({ status: 0, fehler: '' });
    }
  );

  it('legt den Bildbeleg im Setup an und hält Zettel-Text und Dateinamen aus allem anderen heraus', () => {
    const setup = episode2.setup;
    expect(setup.startsWith('set -eu')).toBe(true);
    expect(setup).not.toMatch(/rm -rf (?!"\$tmp")/);
    expect(setup).toMatch(/LC_ALL=C.UTF-8 bildbeleg '\/home\/azubi\/fotos\/IMG_0417\.png' <<'EOF'/);
    expect(setup).toContain('chown azubi:azubi');
    // Der Zettel-Wortlaut steht nur im Setup (das ihn als Pixel rendert), nie in Pager, Tipps oder Prüfungen.
    const ohneSetup = JSON.stringify({ ...episode2, setup: '' });
    expect(setup).toContain('Wächter-Zeile');
    expect(ohneSetup).not.toContain('Wächter-Zeile');
    expect(ohneSetup).not.toContain('NICHT löschen');
    // Weder Dateiname noch Pager verraten den Inhalt: Der Name ist neutral.
    expect('IMG_0417.png').not.toMatch(/zettel|kennung|rw|wartung/i);
    // Die Kennung steht vor dem Ablesen nur im Journal, nicht in Pager-Texten der Ablesen-Spur.
    const kennung = episode2.spuren[1].schritte[0];
    expect(JSON.stringify([kennung.pager, kennung.tipps, kennung.title])).not.toContain('2122');
  });

  it('führt im Journal genau eine Zeile je Kennung und mehrere Cron-Änderungen verschiedener Personen', () => {
    const zeilen = [...episode2.setup.matchAll(/'(2026-04-20T[^']+)'/g)].map((m) => m[1]);
    expect(zeilen).toHaveLength(7);
    const kennungen = zeilen.flatMap((z) => z.match(/change=(RW-\d+)/)?.[1] ?? []);
    expect(new Set(kennungen).size).toBe(kennungen.length);
    const cron = zeilen.filter((z) => z.includes(' edit-cron '));
    expect(cron).toHaveLength(4);
    expect(new Set(cron.map((z) => z.split(' ')[1]))).toEqual(new Set(['timo', 'nadia', 'margit']));
  });

  it('erlaubt azubi nur feste sudo-Argumente für den Wiedergänger', () => {
    expect(episode2.einsatzrahmen.sudoBefehle).toEqual(SUDO_BEFEHLE);
    expect(SUDO_BEFEHLE).toEqual([
      '/usr/bin/crontab -u abgleich -l',
      '/usr/bin/crontab -u abgleich -r',
      '/usr/bin/pkill -x rw-abgleich',
      '/usr/bin/pkill -u abgleich',
    ]);
    expect(episode2.setup).not.toMatch(/sudoers|NOPASSWD/);
  });
});
