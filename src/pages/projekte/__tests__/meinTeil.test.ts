// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it, vi } from 'vitest';

// content.config.ts ruft defineCollection aus astro:content auf; der Stub kennt es nicht.
vi.mock('astro:content', () => ({ defineCollection: (config: unknown) => config }));

const { projektMeinTeilSchema } = await import('../../../content.config');

const PROJEKTE = 'src/content/projects';
const eintraege = readdirSync(PROJEKTE)
  .filter((datei) => datei.endsWith('.md'))
  .sort();

describe('Projekt-Schema: meinTeil', () => {
  it('akzeptiert einen konkreten Satz', () => {
    expect(
      projektMeinTeilSchema.safeParse('Ich habe den Generator selbst gebaut und getestet.').success
    ).toBe(true);
  });

  it('lehnt einen leeren oder nur aus Leerzeichen bestehenden Satz ab', () => {
    expect(projektMeinTeilSchema.safeParse('').success).toBe(false);
    expect(projektMeinTeilSchema.safeParse('                         ').success).toBe(false);
  });

  it('lehnt einen Schlagwort-Fetzen unter 20 Zeichen ab', () => {
    expect(projektMeinTeilSchema.safeParse('Alles selbst gebaut').success).toBe(false);
  });

  it('lehnt mehr als 300 Zeichen ab', () => {
    expect(projektMeinTeilSchema.safeParse('a'.repeat(301)).success).toBe(false);
  });

  it('ist im projects-Schema ein Pflichtfeld', () => {
    const config = readFileSync('src/content.config.ts', 'utf8');
    expect(config).toMatch(/meinTeil: projektMeinTeilSchema,/);
  });
});

describe('Projekteinträge: „Mein Teil“', () => {
  it('findet die Einträge der Collection', () => {
    expect(eintraege.length).toBeGreaterThanOrEqual(9);
  });

  it.each(eintraege)('%s hat ein gültiges meinTeil ohne „proves“', (datei) => {
    const { data } = matter(readFileSync(join(PROJEKTE, datei), 'utf8'));
    const ergebnis = projektMeinTeilSchema.safeParse(data.meinTeil);
    expect(ergebnis.success, `meinTeil fehlt oder ist ungültig in ${datei}`).toBe(true);
    expect(String(data.meinTeil)).not.toMatch(/proves|proof/i);
    expect(data).not.toHaveProperty('proofLine');
  });

  it('kein Eintrag teilt sich den Satz mit einem anderen', () => {
    const saetze = eintraege.map(
      (datei) => matter(readFileSync(join(PROJEKTE, datei), 'utf8')).data.meinTeil
    );
    expect(new Set(saetze).size).toBe(saetze.length);
  });
});

describe('Projektübersicht: kein hartkodierter proofLine mehr', () => {
  const seite = readFileSync('src/pages/projekte/index.astro', 'utf8');

  it('reicht meinTeil aus der Collection durch', () => {
    expect(seite).toContain('meinTeil={project.data.meinTeil}');
  });

  it('kennt weder proofLine noch proofLines', () => {
    expect(seite).not.toMatch(/proofLines?/);
  });
});
