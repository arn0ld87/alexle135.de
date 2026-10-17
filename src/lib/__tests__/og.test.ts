import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderOgPng,
  renderOgBannerPng,
  loadFontFiles,
  fontOptions,
  PAPER,
  INK,
  MUTED,
  LINE,
  ACCENT,
} from '../og';
import { OG_IMAGE_VERSION } from '../ogVersion';

// Der echte @resvg/resvg-js-Renderer ist eine native Bibliothek. Dieser Test prüft das
// SVG, das og.ts baut, und die Optionen, die es an resvg gibt: Der Konstruktor wird
// ersetzt und seine Argumente werden festgehalten. Das tatsächliche Zeichnen deckt
// og.render.test.ts ohne Mock ab. vi.mock() wird über den statischen Import oben
// gehoben; die Ersatzklasse entsteht deshalb in vi.hoisted().
const { constructorCalls, MockResvg } = vi.hoisted(() => {
  const constructorCalls: Array<[string, unknown]> = [];
  class MockResvg {
    constructor(svg: string, opts: unknown) {
      constructorCalls.push([svg, opts]);
    }
    render() {
      return { asPng: () => Buffer.from('fake-png-bytes') };
    }
  }
  return { constructorCalls, MockResvg };
});

vi.mock('@resvg/resvg-js', () => {
  return { Resvg: MockResvg };
});

const here = dirname(fileURLToPath(import.meta.url));
const systemwerkCss = resolve(here, '..', '..', 'styles', 'systemwerk.css');
const layoutPath = resolve(here, '..', '..', 'layouts', 'V2Layout.astro');
const ogPath = resolve(here, '..', 'og.ts');

/** Das zuletzt an resvg gegebene SVG. */
function lastSvg(): string {
  return constructorCalls[constructorCalls.length - 1]![0];
}

/** Titelzeilen eines Titels als Textinhalte: alle `<text>` mit der gegebenen Schriftgröße. */
function textsWithSize(svg: string, size: number): string[] {
  const out: string[] = [];
  const re = new RegExp(`<text\\b[^>]*font-size="${size}"[^>]*>([^<]*)</text>`, 'g');
  for (const m of svg.matchAll(re)) out.push(m[1]!);
  return out;
}

/** Wort aus n gleichen Buchstaben, damit die Zeilenlänge in der Näherung bekannt ist. */
const word = (n: number, ch: string) => ch.repeat(n);

describe('og.ts renderOgPng', () => {
  beforeEach(() => {
    constructorCalls.length = 0;
  });

  it('liefert den PNG-Puffer des resvg-Renderers', async () => {
    const buf = await renderOgPng({ title: 'Hello World' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('fake-png-bytes');
    expect(constructorCalls).toHaveLength(1);
  });

  describe('Fläche und Farben', () => {
    it('zeichnet eine Vollfläche in Papier und enthält weder Verlauf noch Glow noch Filter', async () => {
      await renderOgPng({ title: 'Titel' });
      const svg = lastSvg();
      expect(svg).toContain('width="1200" height="630"');
      expect(svg).toMatch(/<rect width="1200" height="630" fill="#eeeee6"\/>/);
      expect(svg).not.toMatch(/linearGradient|radialGradient|<filter|filter=|<circle/);
    });

    it('setzt den Hintergrund von resvg auf Papier', async () => {
      await renderOgPng({ title: 'Titel' });
      const [, opts] = constructorCalls[0]! as [string, { background: string }];
      expect(opts.background).toBe('#eeeee6');
    });

    it('hält die fünf Farbkonstanten wertgleich mit dem Papier-Block von systemwerk.css', () => {
      const css = readFileSync(systemwerkCss, 'utf8');
      const block = /^:root\s*\{([^}]*)\}/m.exec(css)?.[1] ?? '';
      const token = (name: string) =>
        new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(block)?.[1]?.toLowerCase();
      expect(PAPER).toBe(token('--paper'));
      expect(INK).toBe(token('--ink'));
      expect(MUTED).toBe(token('--muted'));
      expect(LINE).toBe(token('--line'));
      expect(ACCENT).toBe(token('--accent'));
    });
  });

  describe('Kicker, Monogramm, Linien', () => {
    it('zeichnet den Standard-Kicker als Versalien neben einem Akzent-Quadrat bei (72, 72)', async () => {
      await renderOgPng({ title: 'Some title' });
      const svg = lastSvg();
      expect(svg).toMatch(/<rect x="72" y="72" width="16" height="16" fill="#db4a26"\/>/);
      expect(svg).toMatch(
        /<text x="104"[^>]*font-family="Geist Mono"[^>]*font-size="24"[^>]*fill="#66685f"[^>]*>ALEX-SCHNEIDER\.DEV<\/text>/
      );
    });

    it('setzt einen übergebenen Kicker in Versalien', async () => {
      await renderOgPng({ title: 'Title', kicker: 'Blog' });
      expect(lastSvg()).toContain('>BLOG</text>');
    });

    it('zeichnet das Monogramm a/s rechtsbündig bei x=1128, den Schrägstrich in Akzent', async () => {
      await renderOgPng({ title: 'Titel' });
      const svg = lastSvg();
      const mono =
        /<text x="1128"[^>]*text-anchor="end"[^>]*font-size="56"[^>]*>(.*?)<\/text>/.exec(svg);
      expect(mono).not.toBeNull();
      expect(mono![0]).toContain('font-family="TeX Gyre Heros"');
      expect(mono![0]).toContain('font-weight="700"');
      expect(mono![1]).toBe(
        '<tspan fill="#252620">a</tspan><tspan fill="#db4a26">/</tspan><tspan fill="#252620">s</tspan>'
      );
    });

    it('zeichnet die Akzentlinie 96 x 6 bei (72, 168) und die Fußlinie 2 px bei y=534', async () => {
      await renderOgPng({ title: 'Titel' });
      const svg = lastSvg();
      expect(svg).toMatch(/<rect x="72" y="168" width="96" height="6" fill="#db4a26"\/>/);
      expect(svg).toMatch(
        /<line x1="72" y1="534" x2="1128" y2="534" stroke="#c7c9bf" stroke-width="2"\/>/
      );
    });
  });

  describe('Titel und Größenleiter', () => {
    it('setzt den Titel in Heros Bold, Tinte, links bei x=72, erste Grundlinie y=280', async () => {
      await renderOgPng({ title: 'Kurzer Titel' });
      const svg = lastSvg();
      expect(svg).toMatch(
        /<text x="72" y="280"[^>]*font-family="TeX Gyre Heros"[^>]*font-weight="700"[^>]*font-size="80"[^>]*fill="#252620"[^>]*>Kurzer Titel<\/text>/
      );
      expect(svg).not.toContain('…');
    });

    it('nutzt 80 px bei höchstens zwei Zeilen', async () => {
      await renderOgPng({ title: `${word(20, 'a')} ${word(20, 'b')}` });
      expect(textsWithSize(lastSvg(), 80)).toHaveLength(2);
      expect(textsWithSize(lastSvg(), 72)).toHaveLength(0);
      expect(textsWithSize(lastSvg(), 64)).toHaveLength(0);
    });

    it('nutzt 72 px bei drei Zeilen', async () => {
      await renderOgPng({ title: `${word(20, 'a')} ${word(20, 'b')} ${word(20, 'c')}` });
      expect(textsWithSize(lastSvg(), 72)).toHaveLength(3);
      expect(textsWithSize(lastSvg(), 80)).toHaveLength(0);
      expect(lastSvg()).not.toContain('…');
    });

    it('nutzt 64 px, höchstens drei Zeilen, und bricht mit „…" ab', async () => {
      const longTitle = Array.from({ length: 40 }, (_, i) => `wort${i}`).join(' ');
      await renderOgPng({ title: longTitle });
      const lines = textsWithSize(lastSvg(), 64);
      expect(lines).toHaveLength(3);
      expect(lines[2]!.endsWith('…')).toBe(true);
      expect(lines[0]!.endsWith('…')).toBe(false);
      expect(textsWithSize(lastSvg(), 80)).toHaveLength(0);
    });

    it('setzt den Zeilenabstand auf das 1,05-Fache der Schriftgröße', async () => {
      await renderOgPng({ title: `${word(20, 'a')} ${word(20, 'b')}` });
      expect(lastSvg()).toMatch(/<text x="72" y="364"/);
    });

    it('trennt ein einzelnes überlanges Wort hart statt über den Rand zu laufen', async () => {
      await renderOgPng({ title: word(100, 'x') });
      const lines = textsWithSize(lastSvg(), 64);
      expect(lines.length).toBeGreaterThan(1);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(31);
    });

    it('begrenzt die Eingabe auf 300 Zeichen', async () => {
      await renderOgPng({ title: Array.from({ length: 200 }, () => 'abcd').join(' ') });
      const rendered = textsWithSize(lastSvg(), 64).join(' ');
      expect(rendered.length).toBeLessThanOrEqual(300);
    });

    it.each([['' as string], ['   '], ['\n\t  ']])(
      'wirft bei leerem Titel %j nicht und zeigt „alex-schneider.dev"',
      async (title) => {
        await expect(renderOgPng({ title })).resolves.toBeInstanceOf(Buffer);
        expect(textsWithSize(lastSvg(), 80)).toEqual(['alex-schneider.dev']);
      }
    );
  });

  describe('Maskierung und Wohlgeformtheit', () => {
    it('maskiert XML-Sonderzeichen im Titel', async () => {
      await renderOgPng({ title: `<script>alert("x")</script> & 'it\\'s'` });
      const svg = lastSvg();
      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&quot;x&quot;');
      expect(svg).toContain('&apos;');
    });

    it('maskiert auch Kicker und Meta', async () => {
      await renderOgPng({ title: 'T', kicker: 'A & B', meta: '<tag>' });
      const svg = lastSvg();
      expect(svg).toContain('>A &amp; B</text>');
      expect(svg).toContain('&lt;tag&gt;');
    });

    it('ergibt mit Umlauten, Anführungszeichen und Sonderzeichen ein wohlgeformtes SVG', async () => {
      const title = 'Müller & <Söhne> „x“ "y"';
      await renderOgPng({ title, kicker: 'Größe & <Maß>', meta: 'Ä & <Ö> "Ü"' });
      const doc = new DOMParser().parseFromString(lastSvg(), 'image/svg+xml');
      expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
      const titleText = Array.from(doc.getElementsByTagName('text'))
        .filter((node) => node.getAttribute('font-size') === '80')
        .map((node) => node.textContent)
        .join(' ');
      expect(titleText).toBe(title);
      const all = Array.from(doc.getElementsByTagName('text')).map((n) => n.textContent);
      expect(all).toContain('GRÖSSE & <MASS>');
      expect(all).toContain('Ä & <Ö> "Ü"');
    });

    it('entfernt für XML unzulässige Steuerzeichen und bleibt wohlgeformt', async () => {
      await renderOgPng({ title: 'Ti\u0001te\u0000l\u000B' });
      const doc = new DOMParser().parseFromString(lastSvg(), 'image/svg+xml');
      expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
      expect(textsWithSize(lastSvg(), 80)).toEqual(['Titel']);
    });
  });

  describe('Fußzeile und Meta', () => {
    it('zeichnet die Fußzeile mit Domain links und Meta rechtsbündig in gedämpftem Ton', async () => {
      await renderOgPng({ title: 'Title', meta: '12.03.2026 · 8 MIN.' });
      const svg = lastSvg();
      expect(svg).toMatch(
        /<text x="72" y="582"[^>]*font-family="Geist Mono"[^>]*font-size="24"[^>]*fill="#252620"[^>]*>alex-schneider\.dev<\/text>/
      );
      expect(svg).toMatch(
        /<text x="1128" y="582"[^>]*text-anchor="end"[^>]*font-family="Geist Mono"[^>]*fill="#66685f"[^>]*>12\.03\.2026 · 8 MIN\.<\/text>/
      );
    });

    it('lässt die Meta-Zeile weg, wenn keine übergeben wurde', async () => {
      await renderOgPng({ title: 'Title without meta' });
      expect(lastSvg()).not.toMatch(/<text x="1128" y="582"/);
    });

    it('kürzt eine überlange Meta-Zeile, damit sie die Domain nicht überdeckt', async () => {
      await renderOgPng({ title: 'T', meta: 'm'.repeat(120) });
      const meta = /<text x="1128" y="582"[^>]*>([^<]*)<\/text>/.exec(lastSvg());
      expect(meta![1]!.length).toBeLessThanOrEqual(52);
      expect(meta![1]!.endsWith('…')).toBe(true);
    });
  });

  describe('Schriften', () => {
    it('übergibt Heros Bold und Geist Mono als gebündelte Dateien an resvg', async () => {
      await renderOgPng({ title: 'Title' });
      const [, opts] = constructorCalls[0]! as [string, { font: Record<string, unknown> }];
      expect(opts.font.loadSystemFonts).toBe(false);
      const files = opts.font.fontFiles as string[];
      expect(files).toHaveLength(2);
      expect(files[0]!.endsWith('texgyreheros-bold.otf')).toBe(true);
      expect(files[1]!.endsWith('GeistMono-Regular.ttf')).toBe(true);
      expect(opts.font.defaultFontFamily).toBe('TeX Gyre Heros');
    });
  });
});

describe('og.ts renderOgBannerPng', () => {
  beforeEach(() => {
    constructorCalls.length = 0;
  });

  it('baut das Standard-Banner aus denselben Bausteinen', async () => {
    const buf = await renderOgBannerPng();
    expect(buf.toString()).toBe('fake-png-bytes');
    const svg = lastSvg();
    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toMatch(/<rect width="1200" height="630" fill="#eeeee6"\/>/);
    expect(svg).toContain('>SYSTEMINTEGRATION / DEVOPS / KI</text>');
    expect(textsWithSize(svg, 112)).toEqual(['Alexander', 'Schneider']);
    expect(svg).toMatch(
      /<text x="72"[^>]*font-family="Geist Mono"[^>]*font-size="28"[^>]*fill="#66685f"[^>]*>Systemintegration, DevOps und KI<\/text>/
    );
    expect(svg).toContain('>alex-schneider.dev</text>');
    expect(svg).toMatch(/<text x="1128" y="582"[^>]*>Leipzig<\/text>/);
    expect(svg).not.toMatch(/linearGradient|radialGradient|<filter/);
  });

  it('nutzt dieselben Schriftoptionen wie das Kartenbild', async () => {
    await renderOgBannerPng();
    const [, opts] = constructorCalls[0]! as [
      string,
      { background: string; font: Record<string, unknown> },
    ];
    expect(opts.background).toBe('#eeeee6');
    expect(opts.font.defaultFontFamily).toBe('TeX Gyre Heros');
  });
});

describe('og.ts ohne gebündelte Schriften', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('schreibt die Warnung und liefert keine Dateien, wenn keine Schrift gefunden wird', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadFontFiles(() => false, '/nirgends')).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('[og]');
  });

  it('fällt dann auf Systemschriften zurück', () => {
    expect(fontOptions([])).toEqual({ loadSystemFonts: true, defaultFontFamily: 'sans-serif' });
  });

  it('bevorzugt dist/client/fonts/og vor public/fonts/og', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const both = loadFontFiles(() => true, '/app');
    expect(both[0]).toBe('/app/dist/client/fonts/og/texgyreheros-bold.otf');
    const onlyPublic = loadFontFiles((p) => p.includes('/public/fonts/og/'), '/app');
    expect(onlyPublic[1]).toBe('/app/public/fonts/og/GeistMono-Regular.ttf');
    expect(warn).not.toHaveBeenCalled();
  });

  it('verlangt beide Dateien eines Verzeichnisses', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadFontFiles((p) => p.endsWith('.otf'), '/app')).toEqual([]);
  });
});

describe('Versionsparameter der OG-Bild-Adressen (D-47)', () => {
  const layout = readFileSync(layoutPath, 'utf8');

  it('hat die Version sw1', () => {
    expect(OG_IMAGE_VERSION).toBe('sw1');
  });

  it('setzt den Parameter v im Layout aus der Konstante', () => {
    expect(layout).toMatch(/import \{ OG_IMAGE_VERSION \} from '\.\.\/lib\/ogVersion';/);
    expect(layout).toContain("searchParams.set('v', OG_IMAGE_VERSION)");
  });

  it('versioniert den dynamischen Zweig und das Standard-Banner, nicht ein eigenes Bild', () => {
    expect(layout).toMatch(
      /ogSlug\s*\?\s*withOgVersion\(new URL\(`\$\{ogBasePath\}\/\$\{ogSlug\}\.png`, Astro\.site\)\)/
    );
    expect(layout).toMatch(
      /withOgVersion\(new URL\('\/media\/alexle135-og-banner\.png', Astro\.site\)\)/
    );
    expect(layout).toMatch(/image\s*\?\s*new URL\(image, Astro\.site\)/);
  });

  it('gibt og:image und twitter:image dieselbe Adresse', () => {
    expect(layout).toContain('<meta property="og:image" content={ogImage}>');
    expect(layout).toContain('<meta name="twitter:image" content={ogImage}>');
  });

  it('lässt den Renderer ohne Import der Versionsdatei', () => {
    expect(readFileSync(ogPath, 'utf8')).not.toMatch(/ogVersion/);
  });
});
