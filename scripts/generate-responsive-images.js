#!/usr/bin/env node
import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { existsSync } from 'fs';

/**
 * Generiert responsive Bildgrößen für optimale Performance
 * Erstellt: 400w, 800w, 1200w Varianten
 */

const SIZES = [
  { width: 400, suffix: '-400w' },
  { width: 800, suffix: '-800w' },
  { width: 1200, suffix: '-1200w' },
];

const QUALITY = 85;
const SOURCE_DIR = 'media';

async function generateResponsiveVersions(imagePath) {
  const ext = extname(imagePath);
  const name = basename(imagePath, ext);
  const dir = dirname(imagePath);

  // Nur WebP-Bilder verarbeiten
  if (ext !== '.webp') {
    return { skipped: true };
  }

  // Skip bereits generierte responsive Versionen
  if (name.includes('-400w') || name.includes('-800w') || name.includes('-1200w')) {
    return { skipped: true };
  }

  let generated = 0;

  for (const { width, suffix } of SIZES) {
    const outputPath = join(dir, `${name}${suffix}.webp`);

    if (existsSync(outputPath)) {
      continue; // Skip wenn schon existiert
    }

    try {
      const metadata = await sharp(imagePath).metadata();

      // Skip wenn Original kleiner als Zielgröße
      if (metadata.width && metadata.width < width) {
        continue;
      }

      await sharp(imagePath)
        .resize(width, null, {
          withoutEnlargement: true,
          fit: 'inside',
        })
        .webp({ quality: QUALITY })
        .toFile(outputPath);

      const outputSize = (await stat(outputPath)).size;
      console.log(`  ✅ ${basename(outputPath)} (${(outputSize / 1024).toFixed(0)}KB)`);
      generated++;
    } catch (error) {
      console.error(`  ❌ Fehler bei ${width}w:`, error.message);
    }
  }

  return { generated };
}

async function findWebPImages(dir) {
  const images = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
        images.push(...(await findWebPImages(fullPath)));
      } else if (entry.isFile() && extname(entry.name) === '.webp') {
        images.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Fehler beim Lesen von ${dir}:`, error.message);
  }

  return images;
}

async function main() {
  console.log('📐 Responsive Image Generation gestartet...\n');

  const images = await findWebPImages(SOURCE_DIR);
  let totalGenerated = 0;
  let processed = 0;

  for (const image of images) {
    const result = await generateResponsiveVersions(image);

    if (result.generated && result.generated > 0) {
      console.log(`📸 ${basename(image)}`);
      totalGenerated += result.generated;
      processed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Generation abgeschlossen!\n`);
  console.log(`   Verarbeitete Bilder: ${processed}`);
  console.log(`   Generierte Varianten: ${totalGenerated}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
