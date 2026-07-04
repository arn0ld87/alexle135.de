import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderOgPng } from '../og';

// The real @resvg/resvg-js renderer is a native binary. We only need to
// verify the SVG markup og.ts builds and the render options it passes in —
// so we mock the constructor and capture its arguments instead of asking a
// native renderer to actually rasterize anything. vi.mock() is hoisted above
// the static `import { renderOgPng } from '../og'` below, so the mock class
// must be defined via vi.hoisted() to avoid a temporal-dead-zone error.
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

describe('og.ts renderOgPng', () => {
  beforeEach(() => {
    constructorCalls.length = 0;
  });

  it('returns a PNG buffer produced by the resvg renderer', async () => {
    const buf = await renderOgPng({ title: 'Hello World' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('fake-png-bytes');
    expect(constructorCalls).toHaveLength(1);
  });

  it('escapes XML-special characters in the title', async () => {
    await renderOgPng({ title: `<script>alert("x")</script> & 'it\\'s'` });
    const [svg] = constructorCalls[0]!;
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;x&quot;');
    expect(svg).toContain('&apos;');
  });

  it('uses the default kicker "alexle135.de" when none is given', async () => {
    await renderOgPng({ title: 'Some title' });
    const [svg] = constructorCalls[0]!;
    expect(svg).toContain('ALEXLE135.DE');
  });

  it('renders a custom kicker uppercased', async () => {
    await renderOgPng({ title: 'Title', kicker: 'Blog' });
    const [svg] = constructorCalls[0]!;
    expect(svg).toContain('BLOG');
  });

  it('renders meta text uppercased when provided', async () => {
    await renderOgPng({ title: 'Title', meta: 'juli 2026' });
    const [svg] = constructorCalls[0]!;
    expect(svg).toContain('JULI 2026');
  });

  it('omits the meta text element when meta is not provided', async () => {
    await renderOgPng({ title: 'Title without meta' });
    const [svg] = constructorCalls[0]!;
    expect(svg).not.toMatch(/fill="#ada398"/);
  });

  it('escapes special characters in kicker and meta too', async () => {
    await renderOgPng({ title: 'T', kicker: 'A & B', meta: '<tag>' });
    const [svg] = constructorCalls[0]!;
    expect(svg).toContain('A &amp; B');
    expect(svg).toContain('&lt;TAG&gt;');
  });

  it('wraps long titles across multiple lines, capped at 4 with an ellipsis', async () => {
    const longTitle = Array.from({ length: 40 }, (_, i) => `wort${i}`).join(' ');
    await renderOgPng({ title: longTitle });
    const [svg] = constructorCalls[0]!;
    const titleLineMatches = svg.match(/font-size="80"/g) ?? [];
    expect(titleLineMatches.length).toBe(4);
    expect(svg).toContain('…');
  });

  it('renders a short title as a single line without an ellipsis', async () => {
    await renderOgPng({ title: 'Kurzer Titel' });
    const [svg] = constructorCalls[0]!;
    const titleLineMatches = svg.match(/font-size="80"/g) ?? [];
    expect(titleLineMatches.length).toBe(1);
    expect(svg).toContain('Kurzer Titel');
    expect(svg).not.toContain('…');
  });

  it('includes the fixed footer signature and canvas dimensions', async () => {
    await renderOgPng({ title: 'Title' });
    const [svg] = constructorCalls[0]!;
    expect(svg).toContain('ALEXLE135.DE');
    expect(svg).toContain('width="1200" height="630"');
  });

  it('passes bundled font files to resvg when TTFs are present on disk', async () => {
    await renderOgPng({ title: 'Title' });
    const [, opts] = constructorCalls[0]! as [string, { font: Record<string, unknown> }];
    expect(opts.font.loadSystemFonts).toBe(false);
    expect(Array.isArray(opts.font.fontFiles)).toBe(true);
    expect((opts.font.fontFiles as string[]).length).toBe(2);
    expect(opts.font.defaultFontFamily).toBe('Newsreader 16pt');
  });

  // Note: og.ts computes FONT_FILES once at module top-level via
  // resolveFontFiles(). Vitest's dynamic-import module graph for a given
  // specifier is only fully re-evaluated once per test file even across
  // vi.resetModules() calls in this project's pool configuration, so the
  // "no bundled fonts found -> system-font fallback + warn" branch cannot be
  // exercised reliably from within this shared test file without a second
  // dedicated test file (out of scope here). The default "fonts found"
  // branch below covers the code path actually exercised in dev and prod.
});
