import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Die Vitest-Umgebung kann .astro-Dateien nicht rendern. Wie bei den übrigen Projekt-Tests
// (appUrl, repoUrl) prüft dieser Test deshalb die Vorlage selbst: ohne Frontmatter-Fence
// und ohne HTML-Kommentare bleibt übrig, was die Komponente ausgibt.
describe('ProjectEntry: „Mein Teil“ statt „proves“', () => {
  const source = readFileSync('src/components/site/ProjectEntry.astro', 'utf8');
  const template = source.replace(/^---[\s\S]*?---/, '').replace(/<!--[\s\S]*?-->/g, '');

  it('gibt das Label „Mein Teil“ mit dem Satz aus meinTeil aus', () => {
    expect(template).toContain('Mein Teil:');
    expect(template).toContain('{meinTeil}');
  });

  it('gibt „proves“ nicht mehr aus', () => {
    expect(template).not.toMatch(/proves/i);
    expect(template).not.toContain('{proofLine}');
  });

  it('kennt das Feld proofLine nirgends mehr', () => {
    expect(source).not.toContain('proofLine');
  });

  it('beschriftet die Karte auf Deutsch', () => {
    expect(template).toContain('Projekteintrag');
    expect(template).toContain('Ansehen');
    for (const englisch of ['Case entry', 'View project', 'Tech stack']) {
      expect(template).not.toContain(englisch);
    }
  });
});
