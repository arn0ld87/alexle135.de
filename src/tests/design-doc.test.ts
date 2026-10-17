import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Abgleich der Doku mit dem Stylesheet (Phase 2, Plan 02-13, D-19).
 *
 * `docs/DESIGN_SYSTEM.md` ist der Prüfmaßstab für DSGN-05. Er taugt nur, wenn er
 * nachweislich dem Code entspricht: Dieser Test liest die Token-Tabelle unter der
 * Überschrift „Tokens“ und vergleicht sie in beide Richtungen mit den beiden
 * Token-Blöcken außerhalb von `@media` in `src/styles/systemwerk.css` — Papier auf
 * `:root`, Bauplan auf `:root[data-variant='bauplan']`. Ein Auseinanderlaufen von
 * Doku und Code lässt den Test scheitern (T-02-45).
 *
 * Die verbotenen Namen sind aus Teilstücken zusammengesetzt: Die Datei selbst steht
 * unter `src/tests/` und darf kein zusammenhängendes Muster enthalten.
 */

const here = dirname(fileURLToPath(import.meta.url));
const DOC_PATH = resolve(here, '..', '..', 'docs', 'DESIGN_SYSTEM.md');
const README_PATH = resolve(here, '..', '..', 'docs', 'README.md');
const CSS_PATH = resolve(here, '..', 'styles', 'systemwerk.css');

const doc = readFileSync(DOC_PATH, 'utf8');
const readme = readFileSync(README_PATH, 'utf8');
const css = readFileSync(CSS_PATH, 'utf8');

/** Die zwölf Abschnitte, die die Doku führen muss (Plan 02-13, Schritt 2; OG-Bilder seit Plan 02-15). */
const REQUIRED_SECTIONS = [
  'Prinzipien',
  'Tokens',
  'Akzentregel',
  'Typografie',
  'Layout',
  'Primitive und Komponenten',
  'Bauplanansicht',
  'Bewegung',
  'Bildmarke',
  'OG-Bilder',
  'Barrierefreiheit',
  'Quellen',
];

/** Abschnitte, die erst mit einem späteren Plan entstehen und hier nicht hingehören. */
const ABSENT_SECTIONS = ['Bildpipeline'];

/** Begriffe, die die Doku nennen muss. */
const REQUIRED_TERMS = [
  'TeX Gyre Heros',
  'Geist Mono',
  'systemwerk-variant',
  'data-variant',
  'ds-pagehead',
  '--terminal-bg',
  '--terminal-fg',
  '--terminal-fg-muted',
  '--terminal-accent',
  'LICENSE-TeXGyreHeros.txt',
  'src/styles/systemwerk.css',
  'src/styles/v2-theme.css',
  '/design-system/',
];

/**
 * Namen der gelöschten Übergangs-Aliase (Plan 02-13, Task 3) als Teilstücke
 * (Name, Rest). Der Reste-Check liest auch diese Datei und verbietet die
 * zusammenhängenden Namen unter `src/` ohne Ausnahme.
 */
const LEGACY_TOKEN_PARTS: ReadonlyArray<readonly [string, string]> = [
  ['mono', '-'],
  ['orange', '-'],
  ['clay', '-'],
  ['color', '-'],
  ['text', '-primary'],
  ['text', '-secondary'],
  ['text', '-tertiary'],
  ['text', '-faint'],
  ['text', '-inverse'],
  ['bg', '-base'],
  ['bg', '-sunken'],
  ['bg', '-raised'],
  ['surface', '-'],
  ['border', '-subtle'],
  ['border', '-default'],
  ['border', '-strong'],
  ['signal', '-'],
  ['accent', '-hover'],
  ['accent', '-ink'],
  ['accent', '-soft'],
  ['accent', '-line'],
  ['font', '-editorial'],
  ['font', '-serif'],
  ['shadow', '-editorial'],
];

/** Übergangsstand und Namen der abgelösten Designs, aus Teilstücken zusammengesetzt. */
const FORBIDDEN_TERMS = [
  'Über' + 'gang',
  'Paper' + ' Editorial',
  'Warm' + ' Noir',
  'warm' + '-noir',
  'neon' + '-orange',
  'News' + 'reader',
  ...LEGACY_TOKEN_PARTS.map(([name, rest]) => '--' + name + rest),
  'ds' + '-serif',
];

/** Planungspfade, lokale Pfade und Sitzungs-URLs gehören nicht in eine öffentliche Doku. */
const PRIVATE_PATTERNS = ['\\.planning/', '/Volumes/', '/Users/', 'claude\\.ai/', 'claude\\.ai '];

const ROOT_BLOCK = /^:root\s*\{([^}]*)\}/m;
const BAUPLAN_BLOCK = /^:root\[data-variant='bauplan'\]\s*\{([^}]*)\}/m;
const DECLARATION = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;

function declarations(selector: RegExp): Record<string, string> {
  const match = selector.exec(css);
  if (!match) throw new Error(`Block nicht gefunden: ${selector}`);
  const out: Record<string, string> = {};
  for (const decl of match[1].matchAll(DECLARATION)) out[decl[1]] = decl[2].toLowerCase();
  return out;
}

const papier = declarations(ROOT_BLOCK);
const bauplan = declarations(BAUPLAN_BLOCK);

/** Eine Zeile der Token-Tabelle: Token, Papier, Bauplan. */
type Row = { token: string; papier: string; bauplan: string };

function sectionLines(heading: string): string[] {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/** Zellen einer Markdown-Zeile, ohne die führenden und schließenden Striche. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim().replace(/`/g, ''));
}

const tableRows: Row[] = sectionLines('Tokens')
  .filter((line) => line.trim().startsWith('|'))
  .map(cells)
  .filter((row) => row.length >= 3 && /^--[a-z][a-z0-9-]*$/.test(row[0]))
  .map(([token, papierValue, bauplanValue]) => ({
    token,
    papier: papierValue.toLowerCase(),
    bauplan: bauplanValue.toLowerCase(),
  }));

const docHeadings = [...doc.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());

/** Klassen mit dem Präfix `ds-`, die die Doku nennt (Token-Namen zählen nicht). */
const docClasses = [
  ...new Set([...doc.matchAll(/(?<![\w-])ds-[a-z][a-z0-9-]*/g)].map((m) => m[0])),
];

describe('Doku und Stylesheet bleiben deckungsgleich (D-19)', () => {
  it('die Token-Tabelle nennt mindestens 16 Zeilen', () => {
    expect(tableRows.length, `gefundene Zeilen: ${tableRows.length}`).toBeGreaterThanOrEqual(16);
  });

  it('jedes Token der Tabelle steht in der Papieransicht mit demselben Wert', () => {
    const deviations = tableRows
      .filter((row) => papier[row.token] !== row.papier)
      .map(
        (row) =>
          `${row.token} (Papier): Doku ${row.papier}, Stylesheet ${papier[row.token] ?? 'fehlt'}`
      );
    expect(deviations, deviations.join('\n')).toEqual([]);
  });

  it('jedes Token der Tabelle steht in der Bauplanansicht mit demselben Wert', () => {
    const deviations = tableRows
      .filter((row) => bauplan[row.token] !== row.bauplan)
      .map(
        (row) =>
          `${row.token} (Bauplan): Doku ${row.bauplan}, Stylesheet ${bauplan[row.token] ?? 'fehlt'}`
      );
    expect(deviations, deviations.join('\n')).toEqual([]);
  });

  it('die Tabelle nennt jedes Farb-Token, das der Bauplan-Block überschreibt', () => {
    const named = new Set(tableRows.map((row) => row.token));
    const missing = Object.keys(bauplan).filter((token) => !named.has(token));
    expect(missing, `nicht in der Tabelle: ${missing.join(', ')}`).toEqual([]);
  });

  it('die Tabelle nennt jedes Farb-Token der Papieransicht', () => {
    const named = new Set(tableRows.map((row) => row.token));
    const missing = Object.keys(papier).filter((token) => !named.has(token));
    expect(missing, `nicht in der Tabelle: ${missing.join(', ')}`).toEqual([]);
  });

  it('die Doku nennt die Pflichtbegriffe', () => {
    const missing = REQUIRED_TERMS.filter((term) => !doc.includes(term));
    expect(missing, `fehlt: ${missing.join(', ')}`).toEqual([]);
  });

  it('die Doku nennt keinen Übergangsstand und keinen Namen der abgelösten Designs', () => {
    const found = FORBIDDEN_TERMS.filter((term) => doc.includes(term));
    expect(found, `gefunden: ${found.join(', ')}`).toEqual([]);
  });

  it('die Doku nennt keinen Planungspfad, keinen lokalen Pfad und keine Sitzungs-URL', () => {
    const found = PRIVATE_PATTERNS.filter((pattern) => new RegExp(pattern).test(doc));
    expect(found, `gefunden: ${found.join(', ')}`).toEqual([]);
  });

  it('jede genannte ds-Klasse ist im Stylesheet definiert', () => {
    const missing = docClasses.filter((name) => !css.includes(`.${name}`));
    expect(missing, `nicht in systemwerk.css: ${missing.join(', ')}`).toEqual([]);
  });

  it('die Doku führt die zwölf Abschnitte und keinen zur Bildpipeline', () => {
    const missing = REQUIRED_SECTIONS.filter((heading) => !docHeadings.includes(heading));
    const extra = ABSENT_SECTIONS.filter((heading) => docHeadings.includes(heading));
    expect(missing, `fehlende Abschnitte: ${missing.join(', ')}`).toEqual([]);
    expect(extra, `unerwünschte Abschnitte: ${extra.join(', ')}`).toEqual([]);
  });

  it('der Eintrag in docs/README.md nennt weder Übergangsstand noch abgelösten Namen', () => {
    const found = [
      'Über' + 'gang',
      'Paper' + ' Editorial',
      'Warm' + ' Noir',
      'warm' + '-noir',
    ].filter((term) => readme.includes(term));
    expect(found, `gefunden: ${found.join(', ')}`).toEqual([]);
    expect(readme).toContain('DESIGN_SYSTEM.md');
  });
});
