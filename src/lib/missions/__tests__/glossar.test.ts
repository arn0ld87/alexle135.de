// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v86Missions } from '../../../data/missions';
import { staffeln } from '../../../data/staffeln';
import { vorfallAlsMission } from '../staffel';
import { glossar, parseGlossar, tools } from '../glossar';

// Programme in der VM, die eine Mission nennen kann (Dateinamen und Wörter in Backticks fallen raus).
const COMMAND_NAMES = new Set(
  'base64 cat cd chmod cmp cp cut date du echo erklaer file find grep head hostname id less ls mission mkdir mv nano pwd realpath rm sed sort stat sudo tail touch tr tree uniq usermod wc whoami'.split(
    ' '
  )
);

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const overlay = join(root, 'scripts/mission-image/rootfs-overlay');
const erklaer = (...args: string[]) =>
  spawnSync('bash', [join(overlay, 'usr/local/bin/erklaer'), ...args], {
    env: {
      MISSION_GLOSSAR: join(overlay, 'usr/local/share/mission/glossar.tsv'),
      PATH: process.env.PATH,
    },
    encoding: 'utf8',
  }).stdout;

describe('Glossar', () => {
  it('liest Zeilen als Befehl, Erklärung, Beispiel und überspringt Kommentare', () => {
    const parsed = parseGlossar('# Kommentar\nls\tZeigt Dateien.\tls -l\n\n');
    expect(parsed.get('ls')).toEqual({
      befehl: 'ls',
      erklaerung: 'Zeigt Dateien.',
      beispiel: 'ls -l',
    });
    expect(parsed.size).toBe(1);
  });

  it('erklärt rund 30 Befehle, jeder mit einem Satz und einem Beispiel', () => {
    expect(glossar.size).toBeGreaterThanOrEqual(30);
    for (const entry of glossar.values()) {
      expect(entry.erklaerung, entry.befehl).toMatch(/[.!?]$/);
      expect(entry.beispiel.trim(), entry.befehl).not.toBe('');
    }
  });

  it('baut den Werkzeugkasten aus dem Glossar und kennt jeden verwendeten Befehl', () => {
    expect(tools('whoami')[0].befehl).toBe('whoami');
    expect(() => tools('gibtsnicht')).toThrow(/gibtsnicht/);
    for (const mission of v86Missions) {
      for (const step of mission.steps) {
        for (const tool of step.tools ?? [])
          expect(glossar.has(tool.befehl), tool.befehl).toBe(true);
        expect((step.tools ?? []).length, `${mission.id}/${step.id}`).toBeLessThanOrEqual(3);
      }
    }
  });

  // Jeder Befehl, den eine Mission in Aufgabe, Tipp oder Lösung nennt, muss `erklaer` kennen.
  it('kennt jeden Befehl, den die Missionen und Vorfälle nennen', () => {
    const missing = new Set<string>();
    const vorfaelle = staffeln.flatMap((s) => s.vorfaelle.map(vorfallAlsMission));
    for (const mission of [...v86Missions, ...vorfaelle]) {
      for (const step of mission.steps) {
        const spans = [step.description, ...step.hints]
          .flatMap((t) => [...t.matchAll(/`([^`]+)`/g)].map((m) => m[1]))
          .concat(step.solution.split(/\s*(?:&&|\||;)\s*/));
        for (const span of spans) {
          const words = span.trim().split(/\s+/);
          const sub = words[0] === 'git' && words[1] && !words[1].startsWith('-') ? words[1] : '';
          const name = sub ? `git ${sub}` : words[0];
          if (!/^[a-z][a-z0-9]*( [a-z-]+)?$/.test(name ?? '')) continue;
          if (!COMMAND_NAMES.has(words[0]) && words[0] !== 'git') continue;
          // `uniq` gilt als erklärt, wenn es `uniq -c` gibt.
          const known =
            glossar.has(name) || [...glossar.keys()].some((k) => k.startsWith(`${name} `));
          if (!known) missing.add(name);
        }
      }
    }
    expect([...missing].sort()).toEqual([]);
  });

  it('erklaer: bekannter Befehl, mehrteiliger Befehl, unbekannter Befehl', () => {
    expect(erklaer('ls')).toContain(glossar.get('ls')!.erklaerung);
    expect(erklaer('git', 'log')).toContain(glossar.get('git log')!.erklaerung);
    expect(erklaer('quatsch')).toBe('Kenne ich nicht. Versuch `quatsch --help`.\n');
    expect(erklaer()).toMatch(/erklaer <befehl>/);
  });

  it('kennt jedes Werkzeug der Vorfälle', () => {
    for (const s of staffeln)
      for (const v of s.vorfaelle)
        for (const w of v.werkzeuge)
          expect(glossar.has(w.befehl), `${v.id}: ${w.befehl}`).toBe(true);
  });
});
