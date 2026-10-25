import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BILDSCHIRM_ASSETS,
  FIXED_ASSETS,
  bildschirmAssetUrl,
  missionAssetUrl,
} from '../missionAssets';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

// #388: Feste Dateinamen (Index, Savestate, BIOS) bekommen die Build-Version als Query, damit
// Edge-Caches nie einen alten Index zu neuen, inhaltsadressierten Rootfs-Dateien liefern.
describe('missionAssetUrl', () => {
  it('hängt die Version an feste Dateinamen', () => {
    expect(missionAssetUrl('alpine-fs.json', '0123456789ab')).toBe(
      '/missions/linux/alpine-fs.json?v=0123456789ab'
    );
  });

  it('lässt die URL ohne Version unverändert (Dev ohne gebaute Assets)', () => {
    expect(missionAssetUrl('seabios.bin', undefined)).toBe('/missions/linux/seabios.bin');
    expect(missionAssetUrl('seabios.bin', '')).toBe('/missions/linux/seabios.bin');
  });

  it('kennt genau die Dateien mit festem Namen', () => {
    expect([...FIXED_ASSETS].sort()).toEqual(
      ['alpine-fs.json', 'alpine-state.bin.zst', 'seabios.bin', 'vgabios.bin'].sort()
    );
  });
});

describe('Asset-Version zwischen Image-Build, Docker-Build und Terminal', () => {
  it('build.sh schreibt VERSION aus allen festen Dateien', () => {
    const build = read('scripts/mission-image/build.sh');
    expect(build).toMatch(/> "\$OUT_DIR\/VERSION"/);
    for (const name of FIXED_ASSETS) expect(build).toContain(name);
  });

  it('der Docker-Build reicht VERSION als PUBLIC_MISSION_ASSETS_VERSION durch', () => {
    const dockerfile = read('Dockerfile');
    expect(dockerfile).toContain('test -s public/missions/linux/VERSION');
    expect(dockerfile).toContain('V="$(cat public/missions/linux/VERSION)"');
    expect(dockerfile).toContain('PUBLIC_MISSION_ASSETS_VERSION="$V"');
  });

  it('das Terminal lädt alle festen Dateien über missionAssetUrl', () => {
    const terminal = read('src/components/missions/V86Terminal.tsx');
    for (const name of FIXED_ASSETS) {
      expect(terminal, name).toContain(`missionAssetUrl('${name}', ASSET_VERSION)`);
    }
    expect(terminal).toContain('import.meta.env.PUBLIC_MISSION_ASSETS_VERSION');
  });
});

describe('Bildschirm-Assets (ADR 0008)', () => {
  it('liegen unter /missions/linux/bildschirm/ mit eigener Version', () => {
    expect(bildschirmAssetUrl('alpine-state.bin.zst', 'abcdef012345')).toBe(
      '/missions/linux/bildschirm/alpine-state.bin.zst?v=abcdef012345'
    );
    expect(bildschirmAssetUrl('alpine-fs.json', undefined)).toBe(
      '/missions/linux/bildschirm/alpine-fs.json'
    );
  });

  it('build.sh schreibt VERSION aus Index und Savestate', () => {
    const build = read('scripts/mission-image-gui/build.sh');
    expect(build).toMatch(/> "\$OUT_DIR\/VERSION"/);
    expect(build).toContain('OUT_DIR=$LINUX_DIR/bildschirm');
    for (const name of BILDSCHIRM_ASSETS) expect(build).toContain(name);
  });

  it('der Docker-Build verlangt das Bildschirm-Image und reicht seine Version durch', () => {
    const dockerfile = read('Dockerfile');
    expect(dockerfile).toContain('test -s public/missions/linux/bildschirm/VERSION');
    expect(dockerfile).toContain('B="$(cat public/missions/linux/bildschirm/VERSION)"');
    expect(dockerfile).toContain('PUBLIC_MISSION_BILDSCHIRM_VERSION="$B" pnpm run build');
  });

  it('CI und Deploy holen beide Images über die gecachte Action, GUI nach Missions-Image', () => {
    const action = read('.github/actions/mission-assets/action.yml');
    const s1 = action.indexOf('run: bash scripts/mission-image/build.sh');
    const gui = action.indexOf('run: bash scripts/mission-image-gui/build.sh');
    expect(s1).toBeGreaterThan(-1);
    expect(gui).toBeGreaterThan(s1);
    // Der Schlüssel des Bildschirm-Images hängt auch an den Eingaben des Missions-Images.
    expect(action).toContain(
      "hashFiles('scripts/mission-image/**', 'scripts/mission-image-gui/**')"
    );
    for (const workflow of ['.github/workflows/ci.yml', '.github/workflows/deploy.yml']) {
      const text = read(workflow);
      expect(text, workflow).toMatch(
        /uses: \.\/\.github\/actions\/mission-assets\n\s+with:\n\s+bildschirm: 'true'/
      );
      expect(text, workflow).not.toContain('run: bash scripts/mission-image');
    }
  });

  it('V86Bildschirm lädt Index und Savestate über bildschirmAssetUrl, BIOS vom Missions-Image', () => {
    const bildschirm = read('src/components/missions/V86Bildschirm.tsx');
    for (const name of BILDSCHIRM_ASSETS) {
      expect(bildschirm, name).toContain(`bildschirmAssetUrl('${name}', BILDSCHIRM_VERSION)`);
    }
    for (const name of ['seabios.bin', 'vgabios.bin']) {
      expect(bildschirm, name).toContain(`missionAssetUrl('${name}', ASSET_VERSION)`);
    }
    expect(bildschirm).toContain('import.meta.env.PUBLIC_MISSION_BILDSCHIRM_VERSION');
  });
});
