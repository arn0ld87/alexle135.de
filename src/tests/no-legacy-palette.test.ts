import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reste-Check für Systemwerk (Phase 2, D-20, Plan 02-04).
 *
 * Schlägt fehl, wenn in `src/` oder `public/` ein Farbwert, ein Schriftname oder ein
 * Scope-Name der abgelösten Designs (Warm Noir, Paper Editorial) auftaucht, es sei denn,
 * die Stelle steht in der Übergangsliste TRANSITION. Die Liste kann nur schrumpfen:
 * ein Eintrag ohne Treffer lässt den Test ebenfalls scheitern. Jeder Eintrag nennt den
 * Plan, der ihn entfernt (T-02-14). Seit Plan 02-15 ist sie leer und bleibt als leere
 * Zuordnung bestehen; ein neuer Eintrag lässt den Test scheitern, die Fundstelle wird bereinigt.
 *
 * Dritter Teil (Plan 02-13, D-16, D-44): ALIAS_PATTERNS verbietet die Namen der gelöschten
 * Übergangs-Aliase (die Tinten- und Orange-Rampen, ihre Themeschlüssel, die alten Farbnamen
 * sowie die Schrift- und Klassen-Aliase der Serifenschrift) dauerhaft und ohne Ausnahme.
 *
 * Geprüft werden Dateiinhalte (Textdateien nach Endung) und alle Dateinamen samt
 * Verzeichnispfad (auch Binärdateien wie Schriften). Diese Datei ist die einzige feste
 * Ausnahme; ihre Muster sind aus zwei Teilstücken zusammengesetzt und stehen nirgends
 * als zusammenhängende Zeichenfolge.
 *
 * Zweiter Teil (Plan 02-10, D-45): Standard-Palettenklassen von Tailwind (`text-gray-400`,
 * `bg-white`, `border-blue-500` …) in `astro`, `tsx` und `ts` unter `src/` sowie seit
 * Plan 02-12.1 in den Markdown-Dateien unter `src/content/` (dort ohne eingezäunte
 * Code-Blöcke, die Beispielcode zeigen). Zwei Listen: PALETTE_TRANSITION (Dateien, die ein
 * späterer Plan noch umstellt, je mit Plan-Nummer; ein Eintrag ohne Treffer lässt den Test
 * scheitern; seit 02-12.1 leer) und
 * TERMINAL_ISLAND (dauerhafte Ausnahme der Terminal-Insel: je Datei Begründung und die dort
 * erlaubten Klassennamen; eine erlaubte, aber nicht mehr vorkommende Klasse lässt den Test
 * scheitern, damit die Liste nicht unbemerkt wächst — T-02-42).
 */

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..');
const SCAN_DIRS = ['src', 'public'] as const;
const SELF = 'src/tests/no-legacy-palette.test.ts';

const TEXT_EXTENSIONS = new Set([
  'astro',
  'ts',
  'tsx',
  'js',
  'mjs',
  'css',
  'md',
  'mdx',
  'json',
  'svg',
  'html',
  'txt',
  'xml',
]);

export const LEGACY_PATTERNS = {
  paperOld: '#faf8' + 'f4',
  inkOld: '#1c1b' + '18',
  greenOld: '#1453' + '2d',
  orangeOld: '#ff6a' + '00',
  darkOld: '#0d0c' + '0c',
  serifFont: 'News' + 'reader',
  scope: 'warm' + '-noir',
} as const;

type PatternName = keyof typeof LEGACY_PATTERNS;

/**
 * Einzige Ausnahmeliste: Dateipfad (relativ zum Repo-Root, mit `/`) auf die dort noch
 * erlaubten Musternamen, je Muster mit dem Plan, der den Rest entfernt.
 */
export const TRANSITION: Record<string, Partial<Record<PatternName, string>>> = {
  // Leer seit Plan 02-15: OG-Renderer, Test und die abgelösten Schriftdateien sind bereinigt.
};

type Hit = { file: string; pattern: PatternName };

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.DS_Store') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(toPosix(relative(ROOT, full)));
  }
}

function listFiles(): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) walk(join(ROOT, dir), files);
  return files.filter((file) => file !== SELF).sort();
}

function isText(file: string): boolean {
  const dot = file.lastIndexOf('.');
  return dot !== -1 && TEXT_EXTENSIONS.has(file.slice(dot + 1).toLowerCase());
}

function collectHits(): Hit[] {
  const hits: Hit[] = [];
  const names = Object.keys(LEGACY_PATTERNS) as PatternName[];
  for (const file of listFiles()) {
    const pathLower = file.toLowerCase();
    const content = isText(file) ? fs.readFileSync(join(ROOT, file), 'utf8').toLowerCase() : '';
    for (const name of names) {
      const needle = LEGACY_PATTERNS[name].toLowerCase();
      if (pathLower.includes(needle) || content.includes(needle))
        hits.push({ file, pattern: name });
    }
  }
  return hits;
}

// --- Übergangs-Aliase (D-16, D-44, Plan 02-13) ----------------------------------------------

/**
 * Namensmuster der Übergangs-Aliase, die Plan 02-13 gelöscht hat. Sie gelten dauerhaft und ohne
 * Ausnahme in `src/` und `public/`: Ein Treffer ist eine Verwendung oder eine Neudefinition eines
 * gelöschten Namens (Token, Tailwind-Themeschlüssel, Utility-Klasse oder Klassenname). Die Muster
 * sind aus Teilstücken zusammengesetzt; diese Datei ist ohnehin die einzige feste Ausnahme.
 */
const DASHES = '--';

export const ALIAS_PATTERNS: Record<string, RegExp> = {
  // Primitive und Themeschlüssel der Tinten-Rampe: --mono-50 … --mono-975, --color-mono-50 … -950
  monoRamp: new RegExp(`${DASHES}(?:color-)?mono-\\d`),
  // Utility-Klassen aus den Themeschlüsseln: bg-mono-950, text-mono-50, border-mono-800 …
  monoUtility: /\bmono-\d{2,3}\b/,
  // Orange-Primitive und der Themeschlüssel samt Utility-Klasse: --orange-500, --color-neon-orange
  orangePrimitive: new RegExp(`${DASHES}orange-(?:\\d|ink|glow)`),
  neonOrange: new RegExp(`neon${'-'}orange`),
  clayPrimitive: new RegExp(`${DASHES}clay-\\d`),
  // Farbnamen des Bestands (Text, Fläche, Rahmen, Signal, Akzent-Ableitungen, Glow)
  textNames: new RegExp(`${DASHES}text-(?:primary|secondary|tertiary|faint|inverse)\\b`),
  backgroundNames: new RegExp(`${DASHES}bg-(?:base|sunken|raised)\\b`),
  surfaceNames: new RegExp(`${DASHES}surface-`),
  borderNames: new RegExp(`${DASHES}border-(?:subtle|default|strong)\\b`),
  signalNames: new RegExp(`${DASHES}signal-`),
  accentNames: new RegExp(`${DASHES}accent-(?:hover|ink|soft|line)\\b`),
  atmosGlow: new RegExp(`${DASHES}atmos-glow`),
  // Schriftschlüssel der abgelösten Serifenschrift, Schatten-Alias, Klasse für Serifenschrift
  fontAliases: new RegExp(`font-(?:${'editorial'}|${'serif'})`),
  shadowAlias: new RegExp(`shadow-${'editorial'}`),
  serifClass: new RegExp(`ds-${'serif'}`),
};

/** Namen, die bestehen bleiben und von keinem Muster getroffen werden dürfen. */
const KEPT_NAMES = [
  '--text-display-hero',
  '--text-display-s',
  '--text-h1',
  '--ds-text-body',
  '--accent',
  '--accent-strong',
  '--accent-press',
  '--border-hair',
  '--border-thick',
  '--font-display',
  '--font-sans',
  '--font-mono',
  '--font-ui',
  '--ds-shadow-md',
  '--terminal-bg',
  '--panel-text',
];

/** Je Muster ein Beispielname, den es treffen muss (Selbsttest gegen Tippfehler im Muster). */
const ALIAS_SAMPLES: Record<string, string> = {
  monoRamp: '--color-mono-950',
  monoUtility: 'bg-mono-900',
  orangePrimitive: '--orange-500',
  neonOrange: 'text-neon-orange',
  clayPrimitive: '--clay-400',
  textNames: '--text-secondary',
  backgroundNames: '--bg-raised',
  surfaceNames: '--surface-solid',
  borderNames: '--border-default',
  signalNames: '--signal-danger',
  accentNames: '--accent-ink',
  atmosGlow: '--atmos-glow',
  fontAliases: 'font-' + 'editorial',
  shadowAlias: 'shadow-' + 'editorial',
  serifClass: 'ds-' + 'serif',
};

function aliasHits(): string[] {
  const hits: string[] = [];
  for (const file of listFiles()) {
    if (!isText(file)) continue;
    const text = fs.readFileSync(join(ROOT, file), 'utf8');
    for (const [name, pattern] of Object.entries(ALIAS_PATTERNS)) {
      if (pattern.test(text)) hits.push(`${file}: ${name}`);
    }
  }
  return hits;
}

// --- Standard-Palettenklassen (D-45) --------------------------------------------------------

const PALETTE_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'from',
  'to',
  'via',
  'divide',
  'placeholder',
  'fill',
  'stroke',
  'outline',
  'decoration',
].join('|');

const PALETTE_NAMES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
].join('|');

/** Utility-Präfix mit Farbname der Standard-Palette und Stufe, dazu Weiß und Schwarz. */
export const PALETTE_CLASSES = new RegExp(
  `\\b(?:${PALETTE_PREFIXES})-(?:${PALETTE_NAMES})-\\d{2,3}\\b|\\b(?:bg|text|border)-(?:white|black)\\b`
);

const PALETTE_EXTENSIONS = new Set(['astro', 'tsx', 'ts']);

/**
 * Dateien, die ein späterer Plan noch auf Tokens umstellt (Pfad auf entfernenden Plan).
 *
 * Leer seit Plan 02-12.1: die geteilten Komponenten (02-10), die Unterseiten (02-11), die
 * Terminal-Insel, Apps- und Tutor-Seiten (02-12) und der Admin-Bereich (02-12.1) stehen auf
 * den Tokens; `PALETTE_CLASSES` ist damit überall unter `src/` und `src/content/` scharf.
 * Ein neuer Eintrag ist nur zulässig, wenn ein späterer Plan die Datei wirklich noch anfasst.
 */
export const PALETTE_TRANSITION: Record<string, string> = {};

/**
 * Dauerhafte Ausnahme der Terminal-Insel (Plan 02-12, D-45): Dateipfad auf Begründung und die
 * dort erlaubten Klassennamen. Erlaubt ist nur, was der Plan als ANSI- oder Zustandsfarbe der
 * Ausgabe stehen lässt; jede Nennung braucht einen Treffer in der Datei, sonst schlägt der Test
 * fehl (T-02-42). Alles andere in diesen Dateien steht auf `--terminal-*`.
 */
export const TERMINAL_ISLAND: Record<string, { reason: string; allowed: string[] }> = {
  'src/components/interactive/BaseMissionTerminal.tsx': {
    reason:
      'Zustandsfarbe der Ausgabe: der grüne Rahmen umschließt die Abschlussfläche der erfüllten Mission.',
    allowed: ['border-green-500'],
  },
  'src/components/interactive/MissionSelector.tsx': {
    reason:
      'Zustandsfarben der Ausgabe: die Schwierigkeitsstufen der Missionskarten stehen als Grün, Gelb und Rot.',
    allowed: [
      'bg-green-500',
      'border-green-500',
      'text-green-400',
      'bg-yellow-500',
      'border-yellow-500',
      'text-yellow-400',
      'bg-red-500',
      'border-red-500',
      'text-red-400',
    ],
  },
  'src/components/interactive/Terminal.tsx': {
    reason:
      'Zustandsfarbe der Ausgabe: die Schließen-Schaltfläche der nachgebauten Windows-Leiste färbt sich rot.',
    allowed: ['bg-red-600'],
  },
  'src/components/interactive/WebContainerTerminal.tsx': {
    reason:
      'Zustandsfarbe der Ausgabe: das Fehlerband meldet den abgebrochenen Start der Terminal-Insel in Rot.',
    allowed: ['bg-red-900'],
  },
};

/**
 * Dateien, die die Palettenprüfung liest: Code unter `src/` und seit Plan 02-12.1 auch die
 * Markdown-Dateien unter `src/content/`. Deren eingebettetes HTML trägt Klassen, die auf
 * jeder Projekt- und Beitragsseite landen; ohne sie zählte die Recherche 440 Klassen zu wenig
 * (D-45).
 */
function paletteFiles(): string[] {
  return listFiles().filter((file) => {
    if (!file.startsWith('src/')) return false;
    const dot = file.lastIndexOf('.');
    if (dot === -1) return false;
    const extension = file.slice(dot + 1).toLowerCase();
    if (file.startsWith('src/content/')) return extension === 'md';
    return PALETTE_EXTENSIONS.has(extension);
  });
}

/**
 * Eingezäunte Code-Blöcke in Markdown-Dateien bleiben außen vor: sie zeigen Beispielcode,
 * dessen Klassen nicht zur Seite gehören. An ihrer Stelle stehen leere Zeilen, damit die
 * Zeilennummern der Meldungen zum Original passen.
 */
function withoutFencedCode(text: string): string {
  const lines: string[] = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      lines.push('');
      continue;
    }
    lines.push(inFence ? '' : line);
  }
  return lines.join('\n');
}

/** Datei auf die darin vorkommenden Palettenklassen (jede Nennung genau einmal). */
function paletteHits(): Map<string, string[]> {
  const hits = new Map<string, string[]>();
  for (const file of paletteFiles()) {
    const text = fs.readFileSync(join(ROOT, file), 'utf8');
    const scanner = new RegExp(PALETTE_CLASSES.source, 'g');
    const classes = new Set(
      [...withoutFencedCode(text).matchAll(scanner)].map((match) => match[0])
    );
    if (classes.size > 0) hits.set(file, [...classes].sort());
  }
  return hits;
}

describe('Reste-Check Systemwerk (D-20)', () => {
  const hits = collectHits();

  it('findet keinen Rest außerhalb der Übergangsliste', () => {
    const violations = hits
      .filter(({ file, pattern }) => !(pattern in (TRANSITION[file] ?? {})))
      .map(({ file, pattern }) => `${file}: ${pattern}`);
    expect(
      violations,
      `Reste der abgelösten Designs ohne Eintrag in TRANSITION:\n${violations.join('\n')}`
    ).toEqual([]);
  });

  it('hat für jeden Eintrag der Übergangsliste noch einen Treffer (Liste kann nur schrumpfen)', () => {
    const hitKeys = new Set(hits.map(({ file, pattern }) => `${file}\u0000${pattern}`));
    const stale: string[] = [];
    for (const [file, patterns] of Object.entries(TRANSITION)) {
      for (const [pattern, plan] of Object.entries(patterns)) {
        if (!hitKeys.has(`${file}\u0000${pattern}`)) {
          stale.push(
            `${file}: ${pattern} (Plan ${plan}) hat keinen Treffer mehr, Eintrag entfernen`
          );
        }
      }
    }
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('nennt in der Übergangsliste nur existierende Pfade, Muster und entfernende Pläne', () => {
    const problems: string[] = [];
    const files = new Set(listFiles());
    for (const [file, patterns] of Object.entries(TRANSITION)) {
      if (!files.has(file)) problems.push(`${file}: Pfad existiert nicht`);
      for (const [pattern, plan] of Object.entries(patterns)) {
        if (!(pattern in LEGACY_PATTERNS)) problems.push(`${file}: unbekanntes Muster ${pattern}`);
        if (!plan || !/^02-\d{2}(\.\d)?$/.test(plan)) {
          problems.push(`${file}: ${pattern} nennt keinen entfernenden Plan (02-NN)`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('Reste-Check Übergangs-Aliase (D-16, D-44)', () => {
  it('findet in src/ und public/ keinen gelöschten Alias, ohne Ausnahme', () => {
    const violations = aliasHits();
    expect(violations, `Gelöschte Aliase tauchen wieder auf:\n${violations.join('\n')}`).toEqual(
      []
    );
  });

  it('jedes Muster trifft seinen Beispielnamen, kein Muster trifft einen bleibenden Namen', () => {
    const problems: string[] = [];
    for (const [name, pattern] of Object.entries(ALIAS_PATTERNS)) {
      const sample = ALIAS_SAMPLES[name];
      if (!sample) problems.push(`${name}: Beispielname fehlt`);
      else if (!pattern.test(sample)) problems.push(`${name}: trifft ${sample} nicht`);
      for (const kept of KEPT_NAMES) {
        if (pattern.test(kept)) problems.push(`${name}: trifft den bleibenden Namen ${kept}`);
      }
    }
    for (const name of Object.keys(ALIAS_SAMPLES)) {
      if (!(name in ALIAS_PATTERNS)) problems.push(`${name}: Beispielname ohne Muster`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('TRANSITION ist leer (Plan 02-15)', () => {
    expect(Object.keys(TRANSITION)).toEqual([]);
  });
});

describe('Reste-Check Standard-Palettenklassen (D-45)', () => {
  const hits = paletteHits();

  it('findet keine Palettenklasse außerhalb der Ausnahmelisten', () => {
    const violations: string[] = [];
    for (const [file, classes] of hits) {
      if (file in PALETTE_TRANSITION) continue;
      const allowed = TERMINAL_ISLAND[file]?.allowed ?? [];
      for (const name of classes) {
        if (!allowed.includes(name)) violations.push(`${file}: ${name}`);
      }
    }
    expect(
      violations,
      `Standard-Palettenklassen ohne Eintrag in PALETTE_TRANSITION oder TERMINAL_ISLAND:\n${violations.join('\n')}`
    ).toEqual([]);
  });

  it('hat für jeden Eintrag der Übergangsliste noch einen Treffer (Liste kann nur schrumpfen)', () => {
    const stale = Object.keys(PALETTE_TRANSITION).filter((file) => !hits.has(file));
    expect(stale, `Eintrag ohne Treffer, entfernen:\n${stale.join('\n')}`).toEqual([]);
  });

  it('hat für jede erlaubte Klasse der Terminal-Insel noch einen Treffer', () => {
    const stale: string[] = [];
    for (const [file, { allowed }] of Object.entries(TERMINAL_ISLAND)) {
      const found = hits.get(file) ?? [];
      for (const name of allowed) {
        if (!found.includes(name)) {
          stale.push(`${file}: ${name} kommt nicht mehr vor, Eintrag entfernen`);
        }
      }
    }
    expect(stale, `Erlaubte Klasse ohne Treffer:\n${stale.join('\n')}`).toEqual([]);
  });

  it('nennt nur existierende Pfade, entfernende Pläne und Begründungen', () => {
    const files = new Set(paletteFiles());
    const problems: string[] = [];
    for (const [file, plan] of Object.entries(PALETTE_TRANSITION)) {
      if (!files.has(file)) problems.push(`${file}: Pfad existiert nicht`);
      if (!['02-11', '02-12', '02-12.1'].includes(plan)) {
        problems.push(`${file}: nennt Plan ${plan}, erwartet 02-11, 02-12 oder 02-12.1`);
      }
      if (file in TERMINAL_ISLAND) problems.push(`${file}: steht in beiden Listen`);
    }
    for (const [file, { reason, allowed }] of Object.entries(TERMINAL_ISLAND)) {
      if (!files.has(file)) problems.push(`${file}: Pfad existiert nicht`);
      if (!reason || reason.trim().length < 10) problems.push(`${file}: Begründung fehlt`);
      if (allowed.length === 0) problems.push(`${file}: nennt keine erlaubte Klasse`);
      if (file in PALETTE_TRANSITION) problems.push(`${file}: steht in beiden Listen`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
