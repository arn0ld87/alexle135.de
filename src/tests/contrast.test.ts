import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Kontrastnachweis der Systemwerk-Paletten (Phase 2, D-36, D-37).
// Die Werte stammen aus src/styles/systemwerk.css, der einzigen Quelle beider
// Varianten (Papier auf :root, Bauplan auf :root[data-variant='bauplan']).
// Der Vergleich läuft bewusst ohne Rundung: ein Verhältnis von 4,49 besteht
// die Schwelle 4,5 nicht, auch wenn toFixed(1) "4.5" ausgäbe.
const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '..', 'styles', 'systemwerk.css');

export type Variant = 'papier' | 'bauplan';

export const TOKENS = [
  '--paper',
  '--ink',
  '--muted',
  '--line',
  '--accent',
  '--panel',
  '--panel-text',
  '--accent-strong',
  '--accent-press',
  '--marker-on-ink',
  '--panel-accent',
  '--panel-muted',
  '--panel-edge',
  '--panel-rule',
  '--danger',
  '--selection-bg',
  '--selection-text',
] as const;

const TERMINAL_TOKENS = ['--terminal-bg', '--terminal-fg'] as const;

/** WCAG 2.x relative Luminanz eines Hexwerts (#rrggbb). */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Kein Hexwert: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x Kontrastverhältnis, ungerundet. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

function blockOf(css: string, selectorPattern: RegExp): string {
  const m = selectorPattern.exec(css);
  if (!m) throw new Error(`Block nicht gefunden: ${selectorPattern}`);
  return m[1];
}

const ROOT_BLOCK = /^:root\s*\{([^}]*)\}/m;
const BAUPLAN_BLOCK = /^:root\[data-variant='bauplan'\]\s*\{([^}]*)\}/m;

/** Hexwerte einer Variante aus systemwerk.css; Bauplan erbt nicht gesetzte Tokens aus Papier. */
export function readTokens(variant: Variant): Record<string, string> {
  const css = readFileSync(cssPath, 'utf8');
  const papier = declarations(blockOf(css, ROOT_BLOCK));
  const terminal = declarations(
    TERMINAL_TOKENS.map(
      (name) => new RegExp(`${name}\\s*:\\s*#[0-9a-fA-F]{6}\\s*;`).exec(css)?.[0] ?? ''
    ).join('\n')
  );
  const base = { ...papier, ...terminal };
  if (variant === 'papier') return base;
  return { ...base, ...declarations(blockOf(css, BAUPLAN_BLOCK)) };
}

function ownBauplanTokens(): Record<string, string> {
  return declarations(blockOf(readFileSync(cssPath, 'utf8'), BAUPLAN_BLOCK));
}

const meets = (fg: string, bg: string, threshold: number) => contrastRatio(fg, bg) >= threshold;

// Tabelle "Kontrastnachweis" der UI-SPEC: [Vordergrund, Hintergrund, Schwelle].
// Ausgenommen (dekorativ, ohne Schwelle): --line auf --paper, --panel-rule auf --panel.
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['--ink', '--paper', 4.5],
  ['--muted', '--paper', 4.5],
  ['--accent-strong', '--paper', 4.5],
  ['--accent', '--paper', 3],
  ['--paper', '--ink', 4.5],
  ['--paper', '--accent-strong', 4.5],
  ['--paper', '--accent-press', 4.5],
  ['--marker-on-ink', '--ink', 3],
  ['--panel-text', '--panel', 4.5],
  ['--panel-muted', '--panel', 4.5],
  ['--panel-accent', '--panel', 4.5],
  ['--panel', '--panel-text', 4.5],
  ['--panel-edge', '--panel', 3],
  ['--danger', '--paper', 4.5],
  ['--selection-text', '--selection-bg', 4.5],
];

// Werte laut Ausführungsrahmen, Abschnitt 2.
const EXPECTED: Record<Variant, Record<(typeof TOKENS)[number], string>> = {
  papier: {
    '--paper': '#eeeee6',
    '--ink': '#252620',
    '--muted': '#66685f',
    '--line': '#c7c9bf',
    '--accent': '#db4a26',
    '--panel': '#20231e',
    '--panel-text': '#eeeee6',
    '--accent-strong': '#b43716',
    '--accent-press': '#9c2f13',
    '--marker-on-ink': '#ed7650',
    '--panel-accent': '#ed7650',
    '--panel-muted': '#b8bcb0',
    '--panel-edge': '#747a67',
    '--panel-rule': '#55584e',
    '--danger': '#a3281a',
    '--selection-bg': '#e9c0b0',
    '--selection-text': '#252620',
  },
  bauplan: {
    '--paper': '#123b66',
    '--ink': '#e2ebee',
    '--muted': '#aabfd1',
    '--line': '#527592',
    '--accent': '#eb9877',
    '--panel': '#082b4b',
    '--panel-text': '#e2ebee',
    '--accent-strong': '#f2a98c',
    '--accent-press': '#eb9877',
    '--marker-on-ink': '#b8502a',
    '--panel-accent': '#eb9877',
    '--panel-muted': '#aabfd1',
    '--panel-edge': '#6f94b3',
    '--panel-rule': '#527592',
    '--danger': '#ffb4a6',
    '--selection-bg': '#eb9877',
    '--selection-text': '#082b4b',
  },
};

describe('Kontrastberechnung (WCAG 2.x, ungerundet)', () => {
  it('Schwarz auf Weiß ergibt 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
  });

  it('ein Paar mit rund 4,48:1 besteht die Schwelle 4,5 nicht, obwohl toFixed(1) 4.5 ergäbe', () => {
    const ratio = contrastRatio('#777777', '#ffffff');
    expect(ratio).toBeGreaterThan(4.4);
    expect(ratio).toBeLessThan(4.5);
    expect(ratio.toFixed(1)).toBe('4.5');
    expect(meets('#777777', '#ffffff', 4.5)).toBe(false);
  });

  it('das Verhältnis ist symmetrisch', () => {
    expect(contrastRatio('#123b66', '#e2ebee')).toBeCloseTo(
      contrastRatio('#e2ebee', '#123b66'),
      12
    );
  });
});

for (const variant of ['papier', 'bauplan'] as const) {
  describe(`Variante ${variant}`, () => {
    const tokens = readTokens(variant);

    for (const name of TOKENS) {
      it(`${name} ist definiert und hat den Wert aus dem Rahmen`, () => {
        expect(tokens[name], `Token ${name} fehlt in systemwerk.css`).toBeDefined();
        expect(tokens[name]).toBe(EXPECTED[variant][name]);
      });
    }

    for (const [fg, bg, threshold] of PAIRS) {
      it(`${fg} auf ${bg} erreicht ${threshold}:1`, () => {
        const ratio = contrastRatio(tokens[fg], tokens[bg]);
        expect(ratio, `${fg} auf ${bg}: ${ratio.toFixed(3)}`).toBeGreaterThanOrEqual(threshold);
      });
    }

    it('--terminal-fg auf --terminal-bg erreicht 4,5:1', () => {
      expect(
        contrastRatio(tokens['--terminal-fg'], tokens['--terminal-bg'])
      ).toBeGreaterThanOrEqual(4.5);
    });
  });
}

describe('Kennfarben und Sonderfälle', () => {
  it('die vier Kennfarben der Papieransicht sind unverändert', () => {
    const t = readTokens('papier');
    expect([t['--paper'], t['--ink'], t['--accent'], t['--panel']]).toEqual([
      '#eeeee6',
      '#252620',
      '#db4a26',
      '#20231e',
    ]);
  });

  it('--accent-strong ist #b43716 (Papier) und #f2a98c (Bauplan)', () => {
    expect(readTokens('papier')['--accent-strong']).toBe('#b43716');
    expect(readTokens('bauplan')['--accent-strong']).toBe('#f2a98c');
  });

  it('die Terminal-Insel ist in beiden Varianten gleich und unverändert dunkel', () => {
    const p = readTokens('papier');
    const b = readTokens('bauplan');
    expect(p['--terminal-bg']).toBe('#14181a');
    expect(p['--terminal-fg']).toBe('#e7e4da');
    expect(b['--terminal-bg']).toBe(p['--terminal-bg']);
    expect(b['--terminal-fg']).toBe(p['--terminal-fg']);
    expect(ownBauplanTokens()['--terminal-bg']).toBeUndefined();
  });

  it('der Bauplan-Block überschreibt jedes der 17 Tokens selbst (keine Vererbung aus Papier)', () => {
    const own = ownBauplanTokens();
    for (const name of TOKENS) {
      expect(own[name], `Bauplan-Block setzt ${name} nicht`).toBeDefined();
    }
  });

  it('die beiden dekorativen Paare sind ausgenommen und nur dokumentiert, nicht geprüft', () => {
    // --line auf --paper (1,44 / 2,34) und --panel-rule auf --panel (2,19 / 2,96)
    // sind Trennlinien ohne Informationsgehalt (UI-SPEC, Kontrastnachweis).
    const excluded = PAIRS.filter(([fg]) => fg === '--line' || fg === '--panel-rule');
    expect(excluded).toHaveLength(0);
  });
});

// Syntaxfarben der Codeblöcke: --astro-code-* (Shiki-Theme css-variables) in
// systemwerk.css zeigen auf Panel-Tokens oder mischen zwei davon. Aufgelöst wird
// pro Variante, das Mischen folgt color-mix(in srgb) von CSS.
const SYNTAX_VARS = [
  '--astro-code-foreground',
  '--astro-code-token-comment',
  '--astro-code-token-keyword',
  '--astro-code-token-function',
  '--astro-code-token-string',
  '--astro-code-token-string-expression',
  '--astro-code-token-constant',
  '--astro-code-token-parameter',
  '--astro-code-token-punctuation',
  '--astro-code-token-link',
] as const;

function syntaxDeclarations(): Record<string, string> {
  const css = readFileSync(cssPath, 'utf8');
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--astro-code-[a-z-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function mixHex(a: string, pa: number, b: string): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i, 3 + i), 16);
  return (
    '#' +
    [0, 2, 4]
      .map((i) =>
        Math.round((ch(a, i) * pa) / 100 + (ch(b, i) * (100 - pa)) / 100)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

function resolveSyntax(
  value: string,
  decl: Record<string, string>,
  tokens: Record<string, string>
): string {
  const ref = /^var\((--[a-z-]+)\)$/.exec(value);
  if (ref) {
    return ref[1].startsWith('--astro-code-')
      ? resolveSyntax(decl[ref[1]], decl, tokens)
      : tokens[ref[1]];
  }
  const mix = /^color-mix\(in srgb,\s*var\((--[a-z-]+)\)\s+(\d+)%,\s*var\((--[a-z-]+)\)\)$/.exec(
    value
  );
  if (!mix) throw new Error(`Nicht auflösbar: ${value}`);
  return mixHex(tokens[mix[1]], Number(mix[2]), tokens[mix[3]]);
}

for (const variant of ['papier', 'bauplan'] as const) {
  describe(`Syntaxfarben der Codeblöcke, Variante ${variant}`, () => {
    const tokens = readTokens(variant);
    const decl = syntaxDeclarations();

    it('Fläche und Grundfarbe sind --panel und --panel-text', () => {
      expect(decl['--astro-code-background']).toBe('var(--panel)');
      expect(decl['--astro-code-foreground']).toBe('var(--panel-text)');
    });

    for (const name of SYNTAX_VARS) {
      it(`${name} erreicht 4,5:1 auf --panel`, () => {
        expect(decl[name], `${name} fehlt in systemwerk.css`).toBeDefined();
        const color = resolveSyntax(decl[name], decl, tokens);
        const ratio = contrastRatio(color, tokens['--panel']);
        expect(ratio, `${name} (${color}): ${ratio.toFixed(3)}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
