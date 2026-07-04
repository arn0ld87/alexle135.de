#!/usr/bin/env node
import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { existsSync } from 'fs';

/**
 * Konvertiert rekursiv alle PNG/JPG Bilder zu WebP
 * Überspringt bereits konvertierte Bilder
 */

const QUALITY = 85; // WebP Qualität (85 = guter Kompromiss)
// Ziel: public/ Assets konvertieren (ohne Favicons/Touch-Icons)
const DIRS_TO_CONVERT = ['public/media', 'public/images', 'public'];
const EXTENSIONS = ['.png', '.jpg', '.jpeg'];

function shouldSkip(inputPath) {
  const normalized = inputPath.replace(/\\/g, '/');
  const file = basename(normalized).toLowerCase();
  const inPublicRoot = normalized.startsWith('public/');

  if (!inPublicRoot) return false;

  // Favicons/Touch icons bewusst nicht anfassen (Browser-Kompatibilität)
  if (file.startsWith('favicon')) return true;
  if (file === 'apple-touch-icon.png') return true;

  return false;
}

async function convertImage(inputPath) {
  if (shouldSkip(inputPath)) {
    console.log(`⏭️  Skip (icon): ${basename(inputPath)}`);
    return { skipped: true };
  }

  const ext = extname(inputPath).toLowerCase();
  const outputPath = inputPath.replace(new RegExp(`${ext}$`), '.webp');

  // Skip wenn WebP schon existiert
  if (existsSync(outputPath)) {
    console.log(`⏭️  Skip (exists): ${basename(outputPath)}`);
    return { skipped: true };
  }

  try {
    const startSize = (await stat(inputPath)).size;

    await sharp(inputPath).webp({ quality: QUALITY }).toFile(outputPath);

    const endSize = (await stat(outputPath)).size;
    const savings = ((1 - endSize / startSize) * 100).toFixed(1);

    console.log(
      `✅ ${basename(inputPath)} → ${basename(outputPath)} (${(startSize / 1024).toFixed(0)}KB → ${(endSize / 1024).toFixed(0)}KB, -${savings}%)`
    );

    return { converted: true, savings: startSize - endSize };
  } catch (error) {
    console.error(`❌ Fehler bei ${inputPath}:`, error.message);
    return { error: true };
  }
}

async function findImages(dir) {
  const images = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip node_modules, .git, dist etc.
      if (
        entry.isDirectory() &&
        !['node_modules', '.git', 'dist', 'api', 'projekte', 'admin', '.astro'].includes(entry.name)
      ) {
        // Rekursiv durchsuchen
        images.push(...(await findImages(fullPath)));
      } else if (entry.isFile() && EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
        images.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Fehler beim Lesen von ${dir}:`, error.message);
  }

  return images;
}

async function main() {
  console.log('🖼️  WebP Konvertierung gestartet...\n');

  let totalSavings = 0;
  let converted = 0;
  let skipped = 0;
  let errors = 0;

  for (const dir of DIRS_TO_CONVERT) {
    const images = await findImages(dir);

    console.log(`📁 ${dir}: ${images.length} Bilder gefunden\n`);

    for (const image of images) {
      const result = await convertImage(image);

      if (result.converted) {
        converted++;
        totalSavings += result.savings || 0;
      } else if (result.skipped) {
        skipped++;
      } else if (result.error) {
        errors++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Konvertierung abgeschlossen!\n`);
  console.log(`   Konvertiert: ${converted}`);
  console.log(`   Übersprungen: ${skipped} (existieren bereits)`);
  console.log(`   Fehler: ${errors}`);
  console.log(`   Gesamt gespart: ${(totalSavings / 1024 / 1024).toFixed(2)} MB`);
  console.log('='.repeat(60));
}

main().catch(console.error);
