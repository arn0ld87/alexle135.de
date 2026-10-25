// @vitest-environment node
// Trailer „Linux-Krimi“ (E3.1): je Staffel zwei MP4-Größen und ein Poster unter public/missions/trailer/.
// Der Master bleibt außerhalb des Repos (ADR 0003); die Dateinamen tragen einen Inhalts-Hash.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ORDNER = 'public/missions/trailer';

// Hash-Präfixe der Dateien je Staffel; jede Staffel hat genau eine Datei je Art.
const STAFFELN = [
  { name: 'Staffel 1', v1080: '9a1831d9', v720: '8ce2ab02', karte: '8558534e', og: 'd5e9bbfa' },
  { name: 'Staffel 2', v1080: '0a602062', v720: '89a712a0', karte: '1d372779', og: '65a03034' },
];

const eindeutig = (muster: RegExp, hash: string) => {
  const treffer = readdirSync(ORDNER).filter((name) => muster.test(name));
  expect(treffer).toHaveLength(STAFFELN.length);
  const eigene = treffer.filter((name) => name.includes(`-${hash}.`));
  expect(eigene).toHaveLength(1);
  return `${ORDNER}/${eigene[0]}`;
};

describe.each(STAFFELN)('Trailer $name', ({ v1080, v720, karte, og }) => {
  it.each([
    ['1080p', /^trailer-1080-[0-9a-f]{8}\.mp4$/, v1080, 7],
    ['720p', /^trailer-720-[0-9a-f]{8}\.mp4$/, v720, 4],
  ])('%s: genau ein MP4 mit moov vor mdat, höchstens %i MB', (_name, muster, hash, maxMb) => {
    const video = readFileSync(eindeutig(muster, hash));
    expect(video.length).toBeLessThanOrEqual(maxMb * 1024 * 1024);
    expect(video.subarray(4, 8).toString('latin1')).toBe('ftyp');
    // Faststart: Index (moov) steht vorn, damit das Video ohne vollständigen Download startet.
    const anfang = video.subarray(0, 256 * 1024).toString('latin1');
    const moov = anfang.indexOf('moov');
    const mdat = anfang.indexOf('mdat');
    expect(moov).toBeGreaterThan(-1);
    expect(mdat === -1 || mdat > moov).toBe(true);
  });

  it('Titelkarte: genau ein JPEG, höchstens 300 KB', () => {
    const bild = readFileSync(eindeutig(/^titelkarte-[0-9a-f]{8}\.jpg$/, karte));
    expect(bild.length).toBeLessThanOrEqual(300 * 1024);
    expect(bild[0]).toBe(0xff);
    expect(bild[1]).toBe(0xd8);
  });

  // V2Layout zeichnet jedes og:image mit 1200 × 630 aus; das Vorschaubild muss genau so groß sein.
  it('Vorschaubild: genau ein JPEG mit 1200 × 630, höchstens 300 KB', () => {
    const bild = readFileSync(eindeutig(/^titelkarte-og-[0-9a-f]{8}\.jpg$/, og));
    expect(bild.length).toBeLessThanOrEqual(300 * 1024);
    expect(bild[0]).toBe(0xff);
    expect(bild[1]).toBe(0xd8);
    // Maße stehen im ersten SOF-Segment (FFC0–FFC2): Höhe ab Byte 5, Breite ab Byte 7.
    let i = 2;
    while (i < bild.length && !(bild[i] === 0xff && bild[i + 1] >= 0xc0 && bild[i + 1] <= 0xc2)) {
      i += 2 + bild.readUInt16BE(i + 2);
    }
    expect({ breite: bild.readUInt16BE(i + 7), hoehe: bild.readUInt16BE(i + 5) }).toEqual({
      breite: 1200,
      hoehe: 630,
    });
  });
});
