// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v86Missions } from '../../../data/missions';
import { glossar, parseGlossar, tools } from '../glossar';

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

  it('erklaer: bekannter Befehl, mehrteiliger Befehl, unbekannter Befehl', () => {
    expect(erklaer('ls')).toContain(glossar.get('ls')!.erklaerung);
    expect(erklaer('git', 'log')).toContain(glossar.get('git log')!.erklaerung);
    expect(erklaer('quatsch')).toBe('Kenne ich nicht. Versuch `quatsch --help`.\n');
    expect(erklaer()).toMatch(/erklaer <befehl>/);
  });
});
