#!/usr/bin/env node
/**
 * CI-Gate: Client-Bundle-Größe (gzip) und Bild-Budget
 *
 * Summiert alle JS-Assets unter dist/client (gzip, Level 9) und vergleicht
 * gegen die Budgets aus bundlesize.config.json:
 *   - totalJsGzipKb:        Budget für die Summe aller Client-JS-Assets
 *   - largestChunkGzipKb:   Budget für den größten Einzelchunk
 *   - missionRoute:         Chunks, die nur die Missionsroute bei Bedarf nachlädt
 *                           (v86, xterm). Sie zählen nicht zum Gesamt-JS, sondern
 *                           gegen ein eigenes Budget; der Einzelchunk-Deckel gilt weiter.
 *
 * Danach prüft es zusätzlich das Bild-Budget (D-27, Plan 02-18) gegen
 * `budgets.images`:
 *   - maxRasterFileKb:      Budget für die größte Rasterdatei unter dist/client
 *   - astroRasterTotalKb:   Budget für die Summe der Rasterdateien unter _astro/
 *   - homeRasterKb:         Budget für das Bildgewicht der Startseite
 * Für die Startseite startet das Skript den gebauten Server auf 127.0.0.1 an einem
 * freien Port, ruft `/` ab und beendet ihn in jedem Fall wieder.
 *
 * Exit-Code 1 bei Überschreitung — gedacht als CI-Step nach `pnpm build`.
 * Keine externen Dependencies (nur Node-Builtins). Kein Schalter und keine
 * Umgebungsvariable ändert ein Budget; maßgeblich ist allein die Konfigurationsdatei.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import {
  IMAGE_BUDGET_KEYS,
  collectRasterFiles,
  evaluateImageBudget,
  extractImageUrls,
} from './lib/image-budget.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distClient = join(projectRoot, 'dist', 'client');
const distServerEntry = join(projectRoot, 'dist', 'server', 'entry.mjs');
const configPath = join(projectRoot, 'bundlesize.config.json');

if (!existsSync(distClient)) {
  console.error(`dist/client nicht gefunden (${distClient}). Erst \`pnpm build\` ausführen.`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error(
    `bundlesize.config.json fehlt oder ist kein gültiges JSON (${configPath}): ${err.message}`
  );
  process.exit(1);
}
const totalKb = config?.budgets?.totalJsGzipKb;
const chunkKb = config?.budgets?.largestChunkGzipKb;
if (typeof totalKb !== 'number' || typeof chunkKb !== 'number') {
  console.error(
    'bundlesize.config.json: budgets.totalJsGzipKb und budgets.largestChunkGzipKb müssen Zahlen sein.'
  );
  process.exit(1);
}
const imageBudgets = config?.budgets?.images;
const missingImageBudget = IMAGE_BUDGET_KEYS.find((key) => {
  const value = imageBudgets?.[key];
  return typeof value !== 'number' || !Number.isFinite(value) || value <= 0;
});
if (missingImageBudget) {
  console.error(
    `bundlesize.config.json: budgets.images.${missingImageBudget} fehlt oder ist keine positive Zahl.`
  );
  process.exit(1);
}
const missionRoute = config?.budgets?.missionRoute;
if (
  !Array.isArray(missionRoute?.chunkPrefixes) ||
  missionRoute.chunkPrefixes.length === 0 ||
  typeof missionRoute?.totalJsGzipKb !== 'number'
) {
  console.error(
    'bundlesize.config.json: budgets.missionRoute braucht chunkPrefixes (Liste) und totalJsGzipKb (Zahl).'
  );
  process.exit(1);
}
const totalBudget = totalKb * 1024;
const missionBudget = missionRoute.totalJsGzipKb * 1024;
const chunkBudget = chunkKb * 1024;

function collectJsFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, files);
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const assets = collectJsFiles(distClient)
  .map((file) => {
    const buf = readFileSync(file);
    return {
      path: relative(distClient, file),
      raw: buf.length,
      gzip: gzipSync(buf, { level: 9 }).length,
    };
  })
  .sort((a, b) => b.gzip - a.gzip);

if (assets.length === 0) {
  console.error('Keine JS-Assets unter dist/client gefunden — unerwarteter Build-Output.');
  process.exit(1);
}

// Basisname ohne Hash: `_astro/libv86.BcYlRnWs.js` → `libv86`.
const chunkName = (path) => path.split('/').pop().split('.')[0];
const isMissionChunk = (a) => missionRoute.chunkPrefixes.includes(chunkName(a.path));
const missionAssets = assets.filter(isMissionChunk);
const totalGzip = assets.filter((a) => !isMissionChunk(a)).reduce((sum, a) => sum + a.gzip, 0);
const missionGzip = missionAssets.reduce((sum, a) => sum + a.gzip, 0);
const largest = assets[0];

console.log('Bundle-Size-Gate (gzip)\n');
console.log(`JS-Assets: ${assets.length}`);
console.log('Top 5 Chunks:');
for (const asset of assets.slice(0, 5)) {
  console.log(
    `  ${kb(asset.gzip).padStart(9)} gz  (${kb(asset.raw).padStart(9)} raw)  ${asset.path}`
  );
}
console.log('');

const failures = [];

const totalPct = ((totalGzip / totalBudget) * 100).toFixed(0);
console.log(`Gesamt-JS (gzip):   ${kb(totalGzip)} / Budget ${kb(totalBudget)} (${totalPct}%)`);
if (totalGzip > totalBudget) {
  failures.push(`Gesamt-JS ${kb(totalGzip)} überschreitet Budget ${kb(totalBudget)}`);
}

const missionPct = ((missionGzip / missionBudget) * 100).toFixed(0);
console.log(
  `Missionsroute-JS:   ${kb(missionGzip)} / Budget ${kb(missionBudget)} (${missionPct}%)  [${missionAssets
    .map((a) => chunkName(a.path))
    .join(', ')}]`
);
if (missionGzip > missionBudget) {
  failures.push(`Missionsroute-JS ${kb(missionGzip)} überschreitet Budget ${kb(missionBudget)}`);
}
// Veraltete Einträge fallen auf, statt still nichts mehr auszunehmen.
for (const prefix of missionRoute.chunkPrefixes) {
  if (!missionAssets.some((a) => chunkName(a.path) === prefix)) {
    failures.push(`budgets.missionRoute: kein Chunk "${prefix}" im Build gefunden`);
  }
}

const chunkPct = ((largest.gzip / chunkBudget) * 100).toFixed(0);
console.log(
  `Größter Chunk:      ${kb(largest.gzip)} / Budget ${kb(chunkBudget)} (${chunkPct}%)  [${largest.path}]`
);
if (largest.gzip > chunkBudget) {
  failures.push(
    `Größter Chunk ${largest.path} (${kb(largest.gzip)}) überschreitet Budget ${kb(chunkBudget)}`
  );
}

console.log('');

// ---- Bild-Budget (D-27, Plan 02-18) ----

console.log('Bild-Budget\n');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server beendet sich vorzeitig (Code ${child.exitCode})`);
    }
    try {
      await fetch(url, { redirect: 'manual' });
      return;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Server antwortet nicht innerhalb von 30 Sekunden');
}

let homeStatus = 0;
let homeUrls = { own: [], foreign: [] };

if (!existsSync(distServerEntry)) {
  failures.push(`Startseite nicht prüfbar: ${relative(projectRoot, distServerEntry)} fehlt`);
} else {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [distServerEntry], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  try {
    await waitForServer(`${origin}/`, child);
    const response = await fetch(`${origin}/`, { redirect: 'manual' });
    homeStatus = response.status;
    if (homeStatus === 200) homeUrls = extractImageUrls(await response.text(), { origin });
  } catch (err) {
    failures.push(`Startseite nicht erreichbar: ${String(err.message ?? err)}`);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

if (homeStatus !== 200 && !failures.some((f) => f.startsWith('Startseite nicht'))) {
  failures.push(`Startseite antwortet mit Status ${homeStatus} statt 200`);
}

const imageResult = evaluateImageBudget({
  files: collectRasterFiles(distClient),
  astroPrefix: '_astro/',
  homeUrls,
  budgets: imageBudgets,
});
for (const line of imageResult.lines) console.log(line);
console.log('');
for (const violation of imageResult.violations) failures.push(violation);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FEHLER: ${failure}`);
  }
  console.error(
    '\nBundle-Budget überschritten. Entweder Bundle optimieren (Code-Splitting, Imports prüfen)'
  );
  console.error('oder Budget in bundlesize.config.json bewusst anheben und im PR begründen.');
  process.exit(1);
}

console.log('OK: Alle Bundle-Budgets eingehalten.');
