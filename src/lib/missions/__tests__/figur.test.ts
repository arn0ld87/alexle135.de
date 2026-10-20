// @vitest-environment node
// Figur von Alex (#402, neu mit #422): je Pose ein WebP unter public/missions/figur/.
// Geladen wird nur die gezeigte Pose; jede einzeln bleibt klein.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { staffeln } from '../../../data/staffeln';
import { GANZ_POSEN, POSEN, figurGanzUrl, figurUrl } from '../pager';

const datei = (pose: string) => `public${figurUrl(pose as (typeof POSEN)[number])}`;

describe('Figur', () => {
  it.each(GANZ_POSEN)('Ganzkörper %s: transparentes WebP, 640 px hoch, höchstens 80 KB', (pose) => {
    const bild = readFileSync(`public${figurGanzUrl(pose)}`);
    expect(bild.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bild.subarray(8, 12).toString('latin1')).toBe('WEBP');
    expect(bild.length).toBeLessThanOrEqual(80 * 1024);
    // VP8X enthält das Alpha-Flag und die Bildmaße, jeweils um eins vermindert.
    expect(bild.subarray(12, 16).toString('latin1')).toBe('VP8X');
    expect(bild[20] & 0x10).toBe(0x10);
    expect(bild.readUIntLE(27, 3) + 1).toBe(640);
    expect(bild.readUIntLE(24, 3) + 1).toBeLessThan(640);
  });

  // #422: Rasterbilder statt vektorisierter SVGs; 288 px, also scharf auch bei 2× und 4×.
  it.each(POSEN)('Pose %s: WebP, höchstens 40 KB', (pose) => {
    const bild = readFileSync(datei(pose));
    expect(bild.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bild.subarray(8, 12).toString('latin1')).toBe('WEBP');
    expect(bild.length).toBeLessThanOrEqual(40 * 1024);
  });

  it('liegt keine alte SVG-Pose mehr herum', () => {
    expect(readdirSync('public/missions/figur').filter((f) => f.endsWith('.svg'))).toEqual([]);
  });

  it('kennt jede Pose, die eine Staffel verwendet', () => {
    for (const s of staffeln)
      for (const v of s.vorfaelle) {
        for (const schritt of v.schritte)
          if (schritt.pose) expect(POSEN, `${v.id}/${schritt.id}`).toContain(schritt.pose);
        if (v.szenePose) expect(POSEN, v.id).toContain(v.szenePose);
      }
  });
});
