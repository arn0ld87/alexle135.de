import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Agora hat einen eigenen Projekteintrag (/projekte/agora/) und einen Blogbeitrag, aus dem die
 * Agora-Karte der Startseite Format, Datum und Link bezieht. Der Test hält fest:
 * (a) Der Eintrag existiert mit den Pflichtangaben und nennt die Herkunftskette.
 * (b) Der Blogbeitrag bleibt mit der Karte kompatibel (Slug, Format, Datum, Tags, Schritttexte).
 * (c) Die Bilder der alten Oberfläche sind weg, die neuen Bilder bleiben klein.
 * (d) Die Startseite führt Agora nicht zusätzlich in der Projektliste.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '..');
const ROOT = resolve(SRC, '..');

const PROJEKT_DATEI = join(SRC, 'content', 'projects', 'agora.md');
const BLOG_SLUG = 'agora-mirofish-fork-local-first';
const BLOG_DATEI = join(SRC, 'content', 'blog', `${BLOG_SLUG}.md`);
const MAX_BILD_BYTES = 300 * 1024;

function aufteilen(text: string): { kopf: string; rumpf: string } {
  const treffer = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!treffer) throw new Error('Frontmatter fehlt');
  return { kopf: treffer[1], rumpf: treffer[2] };
}

function feld(kopf: string, name: string): string | undefined {
  const treffer = kopf.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm'));
  if (!treffer) return undefined;
  return treffer[1].replace(/^(['"])(.*)\1$/, '$2');
}

const projekt = aufteilen(fs.readFileSync(PROJEKT_DATEI, 'utf-8'));
const blog = aufteilen(fs.readFileSync(BLOG_DATEI, 'utf-8'));

describe('Agora: Projekteintrag', () => {
  it('steht in der Collection projects mit den Pflichtangaben', () => {
    expect(feld(projekt.kopf, 'title')).toBeTruthy();
    expect(feld(projekt.kopf, 'summary')).toBeTruthy();
    expect(feld(projekt.kopf, 'category')).toBe('KI');
  });

  it('führt „Mein Teil“ als ein Satz von 20 bis 300 Zeichen im Frontmatter', () => {
    // Das Feld heißt schon so, wie es der PR „Mein Teil“ (#381) einführt; das heutige Schema
    // entfernt es still, das künftige verlangt es.
    const meinTeil = feld(projekt.kopf, 'meinTeil') ?? '';
    expect(meinTeil.length).toBeGreaterThanOrEqual(20);
    expect(meinTeil.length).toBeLessThanOrEqual(300);
    expect(meinTeil).not.toMatch(/proves|proof/i);
  });

  it('ist als Beta mit öffentlichem Repository ausgewiesen', () => {
    expect(feld(projekt.kopf, 'status')).toBe('in-progress');
    expect(feld(projekt.kopf, 'schemaType')).toBe('SoftwareSourceCode');
    expect(feld(projekt.kopf, 'repoUrl')).toBe('https://github.com/arn0ld87/agora');
  });

  it('nennt die Herkunftskette MiroFish-Offline (nikmcfly) und MiroFish', () => {
    expect(projekt.rumpf).toContain('https://github.com/nikmcfly/MiroFish-Offline');
    expect(projekt.rumpf).toContain('https://github.com/666ghj/MiroFish');
    expect(projekt.rumpf).toMatch(/nikmcfly/);
    expect(projekt.rumpf).toMatch(/Zep Cloud/);
  });

  it('hat die Abschnitte „Mein Teil“ und „Stand“', () => {
    expect(projekt.rumpf).toMatch(/^## Mein Teil$/m);
    expect(projekt.rumpf).toMatch(/^## Stand/m);
  });

  it('verlinkt den Blogbeitrag, dessen Datei existiert', () => {
    expect(projekt.rumpf).toContain(`/blog/${BLOG_SLUG}/`);
    expect(fs.existsSync(BLOG_DATEI)).toBe(true);
  });
});

describe('Agora: Blogbeitrag bleibt mit der Startseiten-Karte kompatibel', () => {
  it('behält Format, Veröffentlichungsdatum und die Tags der Karte', () => {
    expect(feld(blog.kopf, 'format')).toBeTruthy();
    expect(feld(blog.kopf, 'publishedAt')).toBe('2026-08-07');
    for (const tag of ['Multi-Agenten', 'GraphRAG', 'Neo4j']) {
      expect(blog.kopf).toMatch(new RegExp(`^\\s+- ${tag}$`, 'm'));
    }
  });

  it('trägt ein Aktualisierungsdatum nach dem Veröffentlichungsdatum und einen sichtbaren Hinweis', () => {
    const aktualisiert = feld(blog.kopf, 'updatedAt');
    expect(aktualisiert).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // ISO-Daten lassen sich als Zeichenketten vergleichen.
    expect((aktualisiert as string) > (feld(blog.kopf, 'publishedAt') as string)).toBe(true);
    expect(blog.rumpf).toMatch(/Aktualisiert am \d{2}\.\d{2}\.\d{4}/);
  });

  it('enthält die Sätze, die die Karte als Schritttexte zeigt', () => {
    const karte = fs.readFileSync(join(SRC, 'components', 'home', 'AgoraCard.astro'), 'utf-8');
    const texte = [...karte.matchAll(/^\s+text: '([^']+)',$/gm)].map((m) => m[1]);
    expect(texte).toHaveLength(5);

    const quelle = `${feld(blog.kopf, 'tldr') ?? ''}\n${blog.rumpf}`;
    for (const text of texte) {
      for (const satz of text.split(/(?<=\.)\s+/)) {
        expect(quelle, `Satz fehlt im Beitrag: ${satz}`).toContain(satz);
      }
    }
  });

  it('ordnet die Herkunft zu und behauptet keine lokale Ausführung ohne Beleg', () => {
    expect(blog.rumpf).toMatch(/nikmcfly/);
    expect(blog.rumpf).not.toMatch(/Also flog Zep Cloud raus/);
    expect(blog.kopf).not.toMatch(/answer: 'Ja\. Neo4j/);
    expect(blog.kopf).not.toMatch(/AGPL-Fork von MiroFish und wird seit April/);
  });

  it('nennt die überholten Zahlen der ersten Fassung nicht mehr', () => {
    expect(blog.rumpf).not.toMatch(/4\.560|171 Testdateien|17 verpflichtende/);
    expect(blog.rumpf).not.toMatch(/greift im Report-Pfad noch nicht überall/);
    expect(blog.rumpf).not.toMatch(/Run-Manifest für reproduzierbare Wiederholungen fehlt/);
  });
});

describe('Agora: Bilder', () => {
  const ENTFERNT = [
    join(SRC, 'assets', 'blog', 'agora-teaser-poster.jpg'),
    join(ROOT, 'public', 'media', 'projekte', 'agora-teaser.mp4'),
    join(ROOT, 'public', 'images', 'blog', 'agora-feature'),
  ];

  it('die Bilder und das Video der alten Oberfläche sind entfernt', () => {
    for (const pfad of ENTFERNT) {
      expect(fs.existsSync(pfad), `${pfad} darf nicht mehr existieren`).toBe(false);
    }
  });

  it('keine Seite und kein Inhalt verweist auf die entfernten Dateien', () => {
    const geprueft = [
      PROJEKT_DATEI,
      BLOG_DATEI,
      join(SRC, 'pages', 'ueber-mich.astro'),
      join(SRC, 'pages', 'projekte', 'index.astro'),
    ];
    for (const datei of geprueft) {
      const text = fs.readFileSync(datei, 'utf-8');
      expect(text, datei).not.toMatch(/agora-teaser|agora-feature/);
    }
  });

  it('Bilder im Beitragstext liegen in public/, haben Alt-Text und bleiben unter 300 KB', () => {
    const bilder = [...blog.rumpf.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(bilder.length).toBeGreaterThan(0);

    for (const tag of bilder) {
      const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
      const alt = tag.match(/\salt="([^"]*)"/)?.[1];
      expect(src, tag).toBeTruthy();
      expect(alt?.trim().length ?? 0, `Alt-Text fehlt: ${src}`).toBeGreaterThan(20);

      const datei = join(ROOT, 'public', src as string);
      expect(fs.existsSync(datei), `${src} fehlt in public/`).toBe(true);
      expect(fs.statSync(datei).size, `${src} ist zu groß`).toBeLessThan(MAX_BILD_BYTES);
    }
  });

  it('das Titelbild liegt unter src/assets/ und bleibt unter 300 KB', () => {
    const hero = feld(projekt.kopf, 'heroImage');
    expect(hero).toBe(feld(blog.kopf, 'heroImage'));
    const datei = resolve(dirname(PROJEKT_DATEI), hero as string);
    expect(fs.existsSync(datei)).toBe(true);
    expect(fs.statSync(datei).size).toBeLessThan(MAX_BILD_BYTES);
    expect(feld(projekt.kopf, 'heroImageAlt')?.length ?? 0).toBeGreaterThan(20);
    expect(feld(blog.kopf, 'heroVideo')).toBeUndefined();
  });
});

describe('Startseite: Agora nicht doppelt', () => {
  it('filtert den Projekteintrag agora aus der Projektliste', () => {
    const quelle = fs.readFileSync(join(SRC, 'pages', 'index.astro'), 'utf-8');
    const kopf = quelle.match(/^---([\s\S]*?)\n---/)?.[1] ?? '';
    expect(kopf).toMatch(/project\.id\s*!==\s*'agora'/);
  });
});
