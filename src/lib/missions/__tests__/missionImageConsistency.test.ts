// Der Savestate des Missions-Images ist an v86-Version, Kernel-Cmdline und Speichergröße
// gebunden. Weichen Image-Build und Browser-Seite ab, bootet die VM in Produktion nicht;
// dieser Test fängt das vorher ab.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const constant = (source: string, name: string) =>
  new RegExp(`const ${name} =\\s*'([^']+)'`).exec(source)?.[1];

describe('Missions-Image und Browser-Seite', () => {
  const dockerfile = read('scripts/mission-image/Dockerfile');
  const buildState = read('scripts/mission-image/build-state.mjs');
  const terminal = read('src/components/missions/V86Terminal.tsx');

  it('nutzen dieselbe v86-Version', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(/^ARG V86_VERSION=(\S+)$/m.exec(dockerfile)?.[1]).toBe(pkg.dependencies.v86);
  });

  it('prüfen v86 im Image-Build gegen die Integrität aus pnpm-lock.yaml', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    const lock = read('pnpm-lock.yaml');
    const entry = new RegExp(
      `\\n  v86@${pkg.dependencies.v86.replace(/\\./g, '\\.')}:\\n    resolution: \\{integrity: (\\S+)\\}`
    ).exec(lock)?.[1];
    expect(entry).toBeDefined();
    expect(/^ARG V86_INTEGRITY=(\S+)$/m.exec(dockerfile)?.[1]).toBe(entry);
  });

  it('nutzen dieselbe Kernel-Cmdline', () => {
    expect(constant(terminal, 'CMDLINE')).toBeDefined();
    expect(constant(buildState, 'CMDLINE')).toBe(constant(terminal, 'CMDLINE'));
  });

  it('nutzen dieselbe Speichergröße', () => {
    const imageMb = /^ARG MEMORY_MB=(\d+)$/m.exec(dockerfile)?.[1];
    const terminalMb = /const MEMORY_MB = (\d+);/.exec(terminal)?.[1];
    expect(imageMb).toBe(terminalMb);
  });
});

// #374: Die VM ist Alex' Welt. Der alte Benutzer und der alte Host dürfen nirgends überleben,
// sonst passen Image, Missionsdaten und Tests nicht mehr zusammen.
describe('Identität azubi@alex-schneider', () => {
  const OLD_USER = ['lern', 'ende'].join('');
  const OLD_HOST = ['missi', 'onen'].join('');
  const SELF = fileURLToPath(import.meta.url);
  const SCOPES = [
    'scripts/mission-image',
    'src/data',
    'src/lib/missions',
    'src/components/missions',
    'e2e/05-terminal-mission.spec.ts',
  ];

  const files = (path: string): string[] => {
    const full = join(root, path);
    if (statSync(full).isFile()) return [full];
    return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(path, e.name)) : [join(full, e.name)]
    );
  };
  const all = SCOPES.flatMap(files).filter(
    (f) => f !== SELF && !/\.(bin|zst|png|webp|py)$|LICENSE/.test(f)
  );

  it(`kein Benutzer ${OLD_USER} mehr`, () => {
    const hits = all.filter((f) =>
      new RegExp(`\\b${OLD_USER}\\b`, 'i').test(readFileSync(f, 'utf8'))
    );
    expect(hits.map((f) => f.slice(root.length + 1))).toEqual([]);
  });

  it(`kein Host ${OLD_HOST} mehr`, () => {
    const host = new RegExp(`@${OLD_HOST}\\b|^${OLD_HOST}$|hostname="${OLD_HOST}"`, 'm');
    const hits = all.filter((f) => host.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.slice(root.length + 1))).toEqual([]);
  });

  it('Overlay setzt Host, FQDN und Prompt', () => {
    const overlay = 'scripts/mission-image/rootfs-overlay';
    expect(read(`${overlay}/etc/hostname`).trim()).toBe('alex-schneider');
    expect(read(`${overlay}/etc/hosts`)).toMatch(
      /^127\.0\.1\.1\s+alex-schneider\.dev\s+alex-schneider$/m
    );
    expect(read(`${overlay}/home/azubi/.bashrc`)).toContain("PS1='\\u@\\h:\\w\\$ '");
    expect(read('scripts/mission-image/build-state.mjs')).toContain(
      "const PROMPT = 'azubi@alex-schneider:~$ ';"
    );
  });
});
