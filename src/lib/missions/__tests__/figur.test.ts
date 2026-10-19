// @vitest-environment node
// Figur von Alex (#402): je Pose eine eigenständige SVG-Datei unter public/missions/figur/.
// Geladen wird nur die gezeigte Pose; jede einzeln bleibt klein und ohne aktive Inhalte.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { staffeln } from '../../../data/staffeln';
import { POSEN, figurUrl } from '../pager';

const datei = (pose: string) => `public${figurUrl(pose as (typeof POSEN)[number])}`;

describe('Figur', () => {
  it.each(POSEN)('Pose %s: eigenständiges SVG, höchstens 12 KB gzip', (pose) => {
    const svg = readFileSync(datei(pose), 'utf8');
    expect(svg).toContain('<svg');
    expect(gzipSync(svg).length).toBeLessThanOrEqual(12 * 1024);
    // Keine Skripte, keine Event-Handler, keine externen Verweise.
    expect(svg).not.toMatch(/<script|\son[a-z]+=|href="(?!#)|url\((?!#)/i);
    // Bewegung nur ohne reduzierte Bewegung.
    if (/animation:/.test(svg)) expect(svg).toContain('prefers-reduced-motion: no-preference');
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
