#!/usr/bin/env node
// Pager-Figur (#422): Vorlagen aus scripts/figur-vorlagen/NN-<pose>.svg mit Chromium als PNG
// rendern (628 × 720, transparent). Danach: python3 scripts/figur-aufbereiten.py <ausgabe>.
// Die Vorlagen sind je bis zu 500 KB groß und werden nie ausgeliefert, nur die WebPs.
// Nutzung (auf gns3): node scripts/figur-rendern.mjs <ausgabeordner>
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const vorlagen = join(dirname(fileURLToPath(import.meta.url)), 'figur-vorlagen');
const ziel = resolve(process.argv[2] ?? 'figur-png');
mkdirSync(ziel, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 628, height: 720 } });
for (const datei of readdirSync(vorlagen).filter((f) => f.endsWith('.svg'))) {
  const pose = datei.replace(/^\d+-/, '').replace(/\.svg$/, '');
  await page.goto(pathToFileURL(join(vorlagen, datei)).href);
  await page.evaluate(() => {
    document.documentElement.setAttribute('width', '628');
    document.documentElement.setAttribute('height', '720');
  });
  await page.screenshot({ path: join(ziel, `${pose}.png`), omitBackground: true });
  console.log(`${pose}.png`);
}
await browser.close();
