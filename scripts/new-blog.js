#!/usr/bin/env node
/**
 * Interactive CLI helper for creating new blog posts
 * Usage: npm run new:blog
 */

import { createInterface } from 'readline';
import { writeFileSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

// Generate URL-friendly slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Escape string for YAML to prevent injection
function escapeYaml(str) {
  if (!str) return '""';
  // If string contains special YAML characters, wrap in quotes and escape
  if (/[:#'"[\]{}|>&*!%@`\n]/.test(str) || str.trim() !== str) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

// Format date as YYYY-MM-DD
function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// Common blog tags for suggestions
const SUGGESTED_TAGS = [
  'Docker',
  'Linux',
  'DevOps',
  'CI/CD',
  'KI',
  'Kubernetes',
  'Python',
  'JavaScript',
  'Netzwerk',
  'Security',
  'Cloud',
  'Automatisierung',
  'Git',
  'API',
  'Datenbank',
  'Server',
];

async function main() {
  console.log('\n📝 Neuen Blog-Post erstellen\n');
  console.log('Tipp: Tags vorschläge:', SUGGESTED_TAGS.slice(0, 8).join(', '), '...\n');

  // Get title
  const title = await question('Titel: ');
  if (!title.trim()) {
    console.error('❌ Titel ist erforderlich');
    process.exit(1);
  }

  // Generate and confirm slug
  const autoSlug = generateSlug(title);
  if (!autoSlug) {
    console.error('❌ Titel muss mindestens ein alphanumerisches Zeichen enthalten');
    process.exit(1);
  }
  const slugInput = await question(`Slug [${autoSlug}]: `);
  // Sanitize custom slug input
  const slug = slugInput.trim() ? generateSlug(slugInput) : autoSlug;
  if (!slug) {
    console.error('❌ Ungültiger Slug');
    process.exit(1);
  }

  // Get summary
  const summary = await question('Kurzbeschreibung (1-2 Sätze): ');
  if (!summary.trim()) {
    console.error('❌ Beschreibung ist erforderlich');
    process.exit(1);
  }

  // Get tags
  const tagsInput = await question('Tags (komma-separiert): ');
  const tags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // Hero image (optional)
  // Quelle liegt einmal unter src/assets/blog/ (D-25); das Schema prüft sie im Build.
  const heroInput = await question(
    'Hero-Bild (optional, Dateiname unter src/assets/blog/, z.B. bild.webp): '
  );
  const heroName = basename(heroInput.trim());
  let heroImage = '';
  if (heroName) {
    const heroPath = join(process.cwd(), 'src/assets/blog', heroName);
    if (existsSync(heroPath) && statSync(heroPath).isFile()) {
      heroImage = `../../assets/blog/${heroName}`;
    } else {
      console.warn(
        `Hinweis: src/assets/blog/${heroName} existiert nicht. heroImage wird nicht geschrieben, ein fehlendes Bild bräche den Build. Datei dorthin legen und die Zeile nachtragen.`
      );
    }
  }

  // Generate content
  const publishedAt = formatDate();
  const filePath = join(process.cwd(), 'src/content/blog', `${slug}.md`);

  // Check if file exists
  if (existsSync(filePath)) {
    const overwrite = await question(`⚠️  ${slug}.md existiert bereits. Überschreiben? (j/N): `);
    if (overwrite.toLowerCase() !== 'j') {
      console.log('Abgebrochen.');
      process.exit(0);
    }
  }

  // Build frontmatter
  const frontmatter = [
    '---',
    `title: ${escapeYaml(title)}`,
    `summary: ${escapeYaml(summary)}`,
    'tags:',
  ];

  if (tags.length > 0) {
    tags.forEach((tag) => frontmatter.push(`  - ${tag}`));
  } else {
    frontmatter.push('  - Allgemein');
  }

  if (heroImage) {
    frontmatter.push(`heroImage: ${escapeYaml(heroImage)}`);
  }

  frontmatter.push(`publishedAt: ${publishedAt}`);
  frontmatter.push('---');

  // Build template content
  const content = `${frontmatter.join('\n')}

## Einleitung

Kurze Einführung in das Thema. Warum ist es relevant?

## Hauptteil

### Abschnitt 1

Dein Content hier...

### Abschnitt 2

Weitere Details...

## Fazit

Zusammenfassung und nächste Schritte.

---

**Zeitaufwand:** X Minuten
**Schwierigkeitsgrad:** Anfänger/Fortgeschritten/Experte
**Lohnt sich?** Ja/Nein

Bei Fragen: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)
`;

  // Write file
  writeFileSync(filePath, content, 'utf-8');

  console.log('\n✅ Blog-Post erstellt!\n');
  console.log(`📄 Datei: src/content/blog/${slug}.md`);
  console.log(`🔗 URL: /blog/${slug}/`);
  console.log('\nNächste Schritte:');
  console.log('1. Inhalt bearbeiten');
  console.log('2. npm run dev - Preview lokal');
  console.log('3. git add && git commit && git push');
  console.log('4. Auf Server: git pull && npm run build\n');

  rl.close();
}

main().catch((err) => {
  console.error('Fehler:', err.message);
  rl.close();
  process.exit(1);
});
