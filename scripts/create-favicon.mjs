import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

async function createFavicon() {
  const inputPath = path.join(rootDir, 'LOGO-4K.svg'); // Use high-res SVG as source
  const outputPath = path.join(rootDir, 'public', 'favicon.ico');
  const outputPngPath = path.join(rootDir, 'public', 'favicon.png');
  const outputSvgPath = path.join(rootDir, 'public', 'favicon.svg');

  console.log('📂 Input:', inputPath);
  console.log('📂 Output:', outputPath);

  // 1. Copy SVG directly to public/favicon.svg (optimized)
  // We assume the source SVG is already good quality.
  // If it's huge, we might want to optimize it, but a direct copy represents the vector best.
  fs.copyFileSync(inputPath, outputSvgPath);
  console.log('✅ Erstellt: public/favicon.svg (SVG Copy)');

  // 2. Erstelle 48x48 PNG (Standard-Favicon-Größe) für .ico
  // Sharp can import SVG directly
  const faviconBuffer = await sharp(inputPath)
    .resize(48, 48, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Speichere als PNG (Browser akzeptieren auch PNG als favicon.ico)
  fs.writeFileSync(outputPath, faviconBuffer);

  // 3. Erstelle public/favicon.png (z.B. 192x192) - High Quality from SVG
  await sharp(inputPath)
    .resize(192, 192, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPngPath);
  console.log('✅ Erstellt: public/favicon.png');

  // 4. Erstelle auch verschiedene Größen für public/
  // Added 96 and 144 for Android density
  const sizes = [16, 32, 48, 96, 144, 180, 192, 512];

  for (const s of sizes) {
    const outPath = path.join(rootDir, 'public', `favicon-${s}.png`);
    await sharp(inputPath)
      .resize(s, s, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outPath);
    console.log(`✅ Erstellt: favicon-${s}.png`);
  }

  // 5. Update mama/hundepage if it exists
  const hundepageFavicon = path.join(
    rootDir,
    'mama',
    'hundepage',
    'public',
    'icons',
    'favicon.svg'
  );
  if (fs.existsSync(path.dirname(hundepageFavicon))) {
    fs.copyFileSync(inputPath, hundepageFavicon);
    console.log('✅ Updated: mama/hundepage/public/icons/favicon.svg');
  }

  console.log('✅ Favicons erstellt:', outputPath);
}

createFavicon().catch(console.error);
