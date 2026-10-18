// Der Savestate des Missions-Images ist an v86-Version, Kernel-Cmdline und Speichergröße
// gebunden. Weichen Image-Build und Browser-Seite ab, bootet die VM in Produktion nicht;
// dieser Test fängt das vorher ab.
import { readFileSync } from 'node:fs';
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
