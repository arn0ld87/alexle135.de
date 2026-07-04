#!/usr/bin/env node
/**
 * Interactive CLI helper for creating new projects
 * Usage: npm run new:projekt
 */

import { createInterface } from 'readline';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

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

// Common tech stack tags
const TECH_STACK_OPTIONS = {
  Frontend: ['React', 'TypeScript', 'Astro', 'Vue', 'Tailwind CSS', 'JavaScript'],
  Backend: ['Node.js', 'Express', 'Python', 'Go', 'PHP', 'REST API', 'GraphQL'],
  Datenbank: ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis'],
  DevOps: ['Docker', 'Kubernetes', 'CI/CD', 'GitHub Actions', 'Linux', 'Nginx'],
  'KI/ML': ['Gemini AI', 'OpenAI', 'Machine Learning', 'NLP', 'Computer Vision'],
  Tools: ['Git', 'PM2', 'Vite', 'Webpack', 'ESLint'],
};

async function main() {
  console.log('\n🚀 Neues Projekt erstellen\n');

  // Show tech stack options
  console.log('Verfügbare Tech-Stacks:');
  Object.entries(TECH_STACK_OPTIONS).forEach(([category, items]) => {
    console.log(`  ${category}: ${items.slice(0, 4).join(', ')}...`);
  });
  console.log('');

  // Get title
  const title = await question('Projekt-Titel: ');
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

  // Get tech stack tags
  const tagsInput = await question('Tech-Stack/Tags (komma-separiert): ');
  const tags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // Hero image (optional)
  const heroImage = await question('Hero-Bild Pfad (optional, z.B. /media/uploads/projekt.png): ');

  // Live Demo URL (optional)
  const liveDemo = await question('Live-Demo URL (optional): ');

  // Repository URL (optional)
  const repoUrl = await question('Repository URL (optional): ');

  // Generate content
  const publishedAt = formatDate();
  const filePath = join(process.cwd(), 'src/content/projects', `${slug}.md`);

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
    frontmatter.push('  - Projekt');
  }

  if (heroImage.trim()) {
    frontmatter.push(`heroImage: ${heroImage.trim()}`);
  }

  frontmatter.push(`publishedAt: ${publishedAt}`);
  frontmatter.push('---');

  // Build template content
  let content = `${frontmatter.join('\n')}

## Die Idee

Was war die Motivation für dieses Projekt? Welches Problem löst es?

## Features

### 1. Feature Name
Beschreibung des Features...

### 2. Feature Name
Beschreibung des Features...

### 3. Feature Name
Beschreibung des Features...

## Technologie-Stack

**Frontend:**
- Technologie 1
- Technologie 2

**Backend:**
- Technologie 1
- Technologie 2

**Deployment:**
- Hosting-Plattform
- CI/CD Pipeline

## Architektur

Beschreibe die technische Architektur des Projekts.

## Herausforderungen

1. **Herausforderung 1**: Wie wurde sie gelöst?
2. **Herausforderung 2**: Wie wurde sie gelöst?

## Performance-Optimierung

Welche Optimierungen wurden durchgeführt?

`;

  // Add Live Demo section if URL provided
  if (liveDemo.trim()) {
    content += `## Live-Demo

**[${title} starten →](${liveDemo.trim()})**

Probiere das Projekt direkt aus!

`;
  }

  // Add Technical Details section
  content += `## Technische Details

`;

  if (repoUrl.trim()) {
    content += `- **Repository**: [GitHub](${repoUrl.trim()})
`;
  } else {
    content += `- **Repository**: Private Development
`;
  }

  content += `- **Status**: In Entwicklung
- **Letzte Aktualisierung**: ${publishedAt}
`;

  // Write file
  writeFileSync(filePath, content, 'utf-8');

  console.log('\n✅ Projekt erstellt!\n');
  console.log(`📄 Datei: src/content/projects/${slug}.md`);
  console.log(`🔗 URL: /projekte/${slug}/`);
  console.log('\nNächste Schritte:');
  console.log('1. Inhalt bearbeiten & Screenshots hinzufügen');
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
