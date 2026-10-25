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

  it('Agent-Timeout im Gast liegt knapp unter dem Setup-Timeout der Engine', () => {
    const agent = read('scripts/mission-image/rootfs-overlay/usr/local/bin/mission-agent');
    const engine = read('src/lib/missions/missionEngine.ts');
    const guestS = Number(/^readonly TIMEOUT_SECONDS=(\d+)$/m.exec(agent)?.[1]);
    const setupMs = Number(
      /const SETUP_TIMEOUT_MS = ([\d_]+);/.exec(engine)?.[1]?.replace(/_/g, '')
    );
    expect(guestS * 1000).toBeLessThan(setupMs);
    expect(guestS * 1000).toBeGreaterThanOrEqual(setupMs - 10_000);
  });

  it('nutzen dieselbe Speichergröße', () => {
    const imageMb = /^ARG MEMORY_MB=(\d+)$/m.exec(dockerfile)?.[1];
    const terminalMb = /const MEMORY_MB = (\d+);/.exec(terminal)?.[1];
    expect(imageMb).toBe(terminalMb);
  });
});

// Das Bildschirm-Image (ADR 0008) ist an dieselben Größen gebunden, mit eigenem Speicher.
describe('Bildschirm-Image und V86Bildschirm', () => {
  const dockerfile = read('scripts/mission-image/Dockerfile');
  const gui = read('scripts/mission-image-gui/Dockerfile');
  const guiBuild = read('scripts/mission-image-gui/build.sh');
  const guiState = read('scripts/mission-image-gui/build-state.mjs');
  const bildschirm = read('src/components/missions/V86Bildschirm.tsx');
  const terminal = read('src/components/missions/V86Terminal.tsx');
  const arg = (source: string, name: string) =>
    new RegExp(`^ARG ${name}=(\\S+)$`, 'm').exec(source)?.[1];

  it('nutzen v86, Integrität, BIOS-Commit und Basis-Image des Missions-Images', () => {
    for (const name of ['V86_VERSION', 'V86_INTEGRITY', 'V86_COMMIT', 'ALPINE_IMAGE']) {
      expect(arg(gui, name), name).toBeDefined();
      expect(arg(gui, name), name).toBe(arg(dockerfile, name));
    }
  });

  it('nutzen dieselbe Kernel-Cmdline wie das Terminal', () => {
    expect(constant(guiState, 'CMDLINE')).toBe(constant(terminal, 'CMDLINE'));
    expect(constant(bildschirm, 'CMDLINE')).toBe(constant(terminal, 'CMDLINE'));
  });

  it('nutzen dieselbe Speicher- und VGA-Größe', () => {
    const mb = /const MEMORY_MB = (\d+);/.exec(bildschirm)?.[1];
    const vga = /const VGA_MEMORY_MB = (\d+);/.exec(bildschirm)?.[1];
    expect(arg(gui, 'MEMORY_MB')).toBe(mb);
    expect(arg(gui, 'VGA_MEMORY_MB')).toBe(vga);
    expect(guiBuild).toContain(`MEMORY_MB=\${MEMORY_MB:-${mb}}`);
    expect(guiBuild).toContain(`VGA_MEMORY_MB=\${VGA_MEMORY_MB:-${vga}}`);
  });

  it('übernimmt Overlay und Prompt des Missions-Images', () => {
    expect(gui).toContain('COPY mission-image/rootfs-overlay/ /');
    expect(guiState).toContain("const PROMPT = 'azubi@alex-schneider:~$ ';");
  });

  it('prüft den Bildbeleg im Image-Build auf reine Pixel', () => {
    expect(gui).toContain('RUN python3 /tools/pruefe-bildbeleg.py /probe.png');
    expect(read('scripts/mission-image-gui/tools/pruefe-bildbeleg.py')).not.toMatch(/tEXt|eXIf/);
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
    'scripts/mission-image-gui',
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
    // Ohne die Farbsequenzen in \[…\] (#398) bleibt der klassische Prompt übrig.
    const ps1 = read(`${overlay}/home/azubi/.bashrc`).match(/^PS1='(.*)'$/m)?.[1] ?? '';
    expect(ps1.replace(/\\\[.*?\\\]/g, '')).toBe('\\u@\\h:\\w\\$ ');
    expect(read('scripts/mission-image/build-state.mjs')).toContain(
      "const PROMPT = 'azubi@alex-schneider:~$ ';"
    );
  });
});
