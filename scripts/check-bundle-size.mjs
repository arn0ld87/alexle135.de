#!/usr/bin/env node
/**
 * CI-Gate: Client-Bundle-Größe (gzip)
 *
 * Summiert alle JS-Assets unter dist/client (gzip, Level 9) und vergleicht
 * gegen die Budgets aus bundlesize.config.json:
 *   - totalJsGzipKb:        Budget für die Summe aller Client-JS-Assets
 *   - largestChunkGzipKb:   Budget für den größten Einzelchunk
 *
 * Exit-Code 1 bei Überschreitung — gedacht als CI-Step nach `pnpm build`.
 * Keine externen Dependencies (nur Node-Builtins).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distClient = join(projectRoot, 'dist', 'client');
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
const totalBudget = totalKb * 1024;
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

const totalGzip = assets.reduce((sum, a) => sum + a.gzip, 0);
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
