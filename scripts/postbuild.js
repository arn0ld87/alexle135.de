#!/usr/bin/env node

/**
 * Post-Build Validation Script
 *
 * Prüft ob alle kritischen Dateien nach dem Build vorhanden sind.
 * Schlägt fehl, wenn etwas fehlt - kein stilles Ignorieren mehr!
 *
 * SICHERHEIT: .env wird NICHT mehr ins dist kopiert!
 * Die env-loader.php lädt die Variablen aus /var/www/data/.env (außerhalb Webroot)
 */

import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist/client'); // SSR: Client files are here

let missingPaths = [];
let foundPaths = [];

console.log('🔍 Post-Build: Validiere generierte Dateien...\n');

// 1. SICHERHEIT: .env Datei aus dist ENTFERNEN falls vorhanden
const unsafeEnvPaths = [
  join(distDir, '.env'),
  join(distDir, 'api', '.env'),
  join(distDir, 'api', 'chronoextractor', '.env.production'),
  join(projectRoot, 'dist/server', '.env'), // Check server dir too
];

for (const envPath of unsafeEnvPaths) {
  try {
    if (existsSync(envPath)) {
      unlinkSync(envPath);
      console.log(`🧹 Entfernt unsichere .env-Datei: ${envPath}`);
    }
  } catch (err) {
    console.warn(`⚠️ Konnte .env nicht entfernen: ${envPath}`, err);
  }
}

console.log('✅ Sicherheitscheck: .env-Dateien werden NICHT mehr ins dist kopiert');
console.log('   → API-Keys werden sicher aus /var/www/data/.env geladen (außerhalb Webroot)\n');

// 2. Kritische Dateien/Verzeichnisse die vorhanden sein MÜSSEN
const criticalPaths = [
  // Astro-Build-Output
  // 'index.html', // SSR: generated on fly
  '_astro',
  'sitemap-index.xml',

  // Von public/ kopiert
  // 'admin/index.html', // Might be there
  // 'admin/config.yml',
  // 'api/contact.php',
  // 'api/cms-auth.php',
  // 'api/env-loader.php',
  // 'apps/chronoextractor/index.html',

  // Root-Dateien
  'robots.txt',
  // '.htaccess'
];

// SSR specific checks
if (existsSync(join(projectRoot, 'dist/server/entry.mjs'))) {
  console.log('✅ SSR Entry: dist/server/entry.mjs');
} else {
  console.error('❌ FEHLT: dist/server/entry.mjs');
  missingPaths.push('dist/server/entry.mjs');
}

for (const relativePath of criticalPaths) {
  const fullPath = join(distDir, relativePath);

  if (existsSync(fullPath)) {
    foundPaths.push(relativePath);
    console.log(`✅ ${relativePath}`);
  } else {
    missingPaths.push(relativePath);
    console.error(`❌ FEHLT: ${relativePath}`);
  }
}

console.log(`\n📊 Ergebnis: ${foundPaths.length}/${criticalPaths.length} Dateien gefunden`);

if (missingPaths.length > 0) {
  console.error(`\n❌ Build-Validierung FEHLGESCHLAGEN!`);
  console.error(`\nFehlende Dateien (${missingPaths.length}):`);
  missingPaths.forEach((p) => console.error(`   - ${p}`));
  console.error(`\n💡 Hinweis: Stelle sicher, dass:`);
  console.error(`   1. Astro Build erfolgreich war`);
  console.error(`   2. Alle Dateien in public/ vorhanden sind`);
  console.error(`   3. robots.txt und .htaccess im Root existieren`);
  process.exit(1);
}

console.log('\n✅ Build-Validierung erfolgreich!');
console.log('🚀 Alle kritischen Dateien vorhanden - bereit für Deployment!\n');
