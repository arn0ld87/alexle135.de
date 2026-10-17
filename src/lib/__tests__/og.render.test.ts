// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderOgPng } from '../og';

// Ohne Mock von resvg: Diese Tests zeichnen wirklich. Sie belegen, dass der Renderer ein
// gültiges PNG in den Maßen 1200 x 630 liefert, dass der Text tatsächlich gezeichnet wird
// und dass gleichzeitige Aufrufe sich nicht stören. Schriftdateien liegen unter
// public/fonts/og (der Testlauf startet im Repo-Wurzelverzeichnis).

const PNG_SIGNATURE = '89504e470d0a1a0a';

function assertPng(buf: Buffer): void {
  expect(buf.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
  // IHDR: Länge (4) + "IHDR" (4) folgen der Signatur, danach Breite und Höhe je 4 Byte.
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  expect(buf.readUInt32BE(16)).toBe(1200);
  expect(buf.readUInt32BE(20)).toBe(630);
}

describe('renderOgPng (ohne Mock)', () => {
  it('liefert einen Puffer mit PNG-Signatur und den Maßen 1200 x 630', async () => {
    assertPng(await renderOgPng({ title: 'Systemwerk im OG-Bild', kicker: 'Blog' }));
  });

  it('zeichnet den Text tatsächlich: zwei Titel ergeben verschiedene Puffer', async () => {
    const a = await renderOgPng({ title: 'Erster Titel' });
    const b = await renderOgPng({ title: 'Zweiter Titel' });
    expect(a.equals(b)).toBe(false);
  });

  it('liefert für fünf gleichzeitige Aufrufe fünf gültige PNG-Puffer', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        renderOgPng({ title: `Titel ${i} mit Umlauten: Müller, Größe, „Zitat“`, meta: `${i} MIN.` })
      )
    );
    expect(results).toHaveLength(5);
    for (const buf of results) assertPng(buf);
  });
});
