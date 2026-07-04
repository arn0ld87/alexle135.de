#!/usr/bin/env node
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';

/**
 * Bundle Size Monitoring
 * Analysiert dist/ und reportet Dateigrößen
 */

const DIST_DIR = 'dist/client';
const SIZE_LIMITS = {
  js: 220 * 1024, // Basis-Budget für JS-Dateien
  css: 120 * 1024, // Basis-Budget für CSS
  html: 120 * 1024, // Basis-Budget für HTML
};

const WARN_THRESHOLD = 0.8; // Warnung bei 80% des Limits

// Route-/Feature-spezifische Budgets für erwartbar schwere Assets
const SIZE_LIMIT_OVERRIDES = [
  {
    ext: 'js',
    pattern: /_astro\/WebContainerTerminal\..+\.js$/,
    limit: 380 * 1024,
  },
  {
    ext: 'js',
    pattern: /_astro\/BaseMissionTerminal\..+\.js$/,
    limit: 120 * 1024,
  },
  {
    ext: 'css',
    pattern: /_astro\/V2Layout\..+\.css$/,
    limit: 220 * 1024,
  },
  {
    ext: 'html',
    pattern: /^blog\//,
    limit: 180 * 1024,
  },
];

async function getFileSize(path) {
  try {
    const stats = await stat(path);
    return stats.size;
  } catch {
    return 0;
  }
}

async function analyzeDirectory(dir, files = []) {
  if (!existsSync(dir)) {
    console.error(`❌ Directory ${dir} nicht gefunden. Build zuerst ausführen: npm run build`);
    process.exit(1);
  }

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await analyzeDirectory(fullPath, files);
    } else {
      const ext = extname(entry.name).slice(1);
      if (['js', 'css', 'html'].includes(ext)) {
        const size = await getFileSize(fullPath);
        files.push({ path: fullPath, ext, size });
      }
    }
  }

  return files;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getLimit(ext, relativePath) {
  const override = SIZE_LIMIT_OVERRIDES.find(
    (item) => item.ext === ext && item.pattern.test(relativePath)
  );
  return override ? override.limit : SIZE_LIMITS[ext];
}

function getStatus(size, ext, relativePath) {
  const limit = getLimit(ext, relativePath);
  if (!limit) return '✅';

  const ratio = size / limit;
  if (ratio >= 1) return '🔴';
  if (ratio >= WARN_THRESHOLD) return '⚠️ ';
  return '✅';
}

async function main() {
  console.log('📊 Bundle Size Report\n');
  console.log('='.repeat(80));

  const files = await analyzeDirectory(DIST_DIR);

  // Gruppiere nach Dateityp
  const byType = {
    js: files.filter((f) => f.ext === 'js'),
    css: files.filter((f) => f.ext === 'css'),
    html: files.filter((f) => f.ext === 'html'),
  };

  let hasWarnings = false;
  let hasErrors = false;

  for (const [type, typeFiles] of Object.entries(byType)) {
    if (typeFiles.length === 0) continue;

    const total = typeFiles.reduce((sum, f) => sum + f.size, 0);

    console.log(
      `\n📦 ${type.toUpperCase()} Dateien (${typeFiles.length}) - Total: ${formatSize(total)}`
    );
    console.log('-'.repeat(80));

    // Sortiere nach Größe (größte zuerst)
    typeFiles.sort((a, b) => b.size - a.size);

    for (const file of typeFiles.slice(0, 10)) {
      // Zeige Top 10
      const relativePath = file.path.replace(DIST_DIR + '/', '');
      const fileLimit = getLimit(type, relativePath);
      const status = getStatus(file.size, type, relativePath);
      const percentage = fileLimit ? ` (${((file.size / fileLimit) * 100).toFixed(0)}%)` : '';

      console.log(`${status} ${formatSize(file.size).padEnd(10)} ${relativePath}${percentage}`);

      if (status === '🔴') hasErrors = true;
      if (status === '⚠️ ') hasWarnings = true;
    }
  }

  // Gesamtgröße
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  console.log('\n' + '='.repeat(80));
  console.log(`📊 Gesamt Build-Größe: ${formatSize(totalSize)}`);
  console.log('='.repeat(80));

  // Limits-Übersicht
  console.log('\n📏 Size Limits:');
  console.log(`   JS:   max ${formatSize(SIZE_LIMITS.js)}`);
  console.log(`   CSS:  max ${formatSize(SIZE_LIMITS.css)}`);
  console.log(`   HTML: max ${formatSize(SIZE_LIMITS.html)}`);
  console.log('\n📐 Override-Limits:');
  console.log(`   JS (WebContainerTerminal): max ${formatSize(380 * 1024)}`);
  console.log(`   JS (BaseMissionTerminal): max ${formatSize(120 * 1024)}`);
  console.log(`   CSS (V2 layout stylesheet): max ${formatSize(220 * 1024)}`);
  console.log(`   HTML (Blogseiten): max ${formatSize(180 * 1024)}`);

  console.log('\n💡 Legende:');
  console.log('   ✅ OK - unter 80% des Limits');
  console.log('   ⚠️  Warnung - 80-100% des Limits');
  console.log('   🔴 Fehler - über 100% des Limits');
  console.log('');

  if (hasErrors) {
    console.error('❌ Bundle-Size Limits überschritten! Optimierung erforderlich.\n');
    process.exit(1);
  }

  if (hasWarnings) {
    console.warn('⚠️  Einige Dateien nähern sich dem Limit. Überwachung empfohlen.\n');
  } else {
    console.log('✅ Alle Dateien innerhalb der Limits.\n');
  }
}

main().catch(console.error);
