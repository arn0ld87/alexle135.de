import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_COLORS,
  THEME_INIT_SCRIPT,
  THEME_INIT_SHA256,
  VARIANTS,
  VARIANT_STORAGE_KEY,
  parseVariant,
} from '../themeInit';

function runInitScript() {
  new Function(THEME_INIT_SCRIPT)();
}

function themeColorOf(doc: Document = document) {
  return doc.querySelector('meta[name="theme-color"]')?.getAttribute('content');
}

function dispatchBeforeSwap(newDocument: Document) {
  const event = new Event('astro:before-swap');
  Object.defineProperty(event, 'newDocument', { value: newDocument });
  document.dispatchEvent(event);
}

function freshDocument() {
  const doc = document.implementation.createHTMLDocument('neu');
  const meta = doc.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', THEME_COLORS.papier);
  doc.head.appendChild(meta);
  return doc;
}

describe('themeInit: Konstanten', () => {
  it('hält Schlüssel, Allowlist und Theme-Farben fest', () => {
    expect(VARIANT_STORAGE_KEY).toBe('systemwerk-variant');
    expect([...VARIANTS]).toEqual(['papier', 'bauplan']);
    expect(THEME_COLORS).toEqual({ papier: '#eeeee6', bauplan: '#123b66' });
  });
});

describe('parseVariant', () => {
  it('lässt genau bauplan als bauplan durch', () => {
    expect(parseVariant('bauplan')).toBe('bauplan');
  });

  it.each([
    ['papier', 'papier'],
    [null, null],
    [undefined, undefined],
    ['', ''],
    ['true', 'true'],
    ['BAUPLAN', 'BAUPLAN'],
    [' bauplan', ' bauplan'],
    ['bauplan ', 'bauplan '],
    ['dark', 'dark'],
    [{}, '{}'],
    [['bauplan'], '["bauplan"]'],
    [1, '1'],
    ['"><script>alert(1)</script>', 'Skriptversuch'],
  ])('ergibt für %j die Papieransicht (%s)', (value) => {
    expect(parseVariant(value)).toBe('papier');
  });
});

describe('THEME_INIT_SCRIPT: Ausführung', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-variant');
    document.head.innerHTML = `<meta name="theme-color" content="${THEME_COLORS.papier}">`;
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-variant');
  });

  it('setzt bei gespeichertem bauplan das Attribut und die theme-color', () => {
    localStorage.setItem(VARIANT_STORAGE_KEY, 'bauplan');
    runInitScript();
    expect(document.documentElement.getAttribute('data-variant')).toBe('bauplan');
    expect(themeColorOf()).toBe('#123b66');
  });

  it.each(['papier', '', 'true', 'BAUPLAN', 'dark', '{"v":"bauplan"}', '<b>'])(
    'lässt bei gespeichertem Wert %j die Papieransicht',
    (stored) => {
      localStorage.setItem(VARIANT_STORAGE_KEY, stored);
      runInitScript();
      expect(document.documentElement.hasAttribute('data-variant')).toBe(false);
      expect(themeColorOf()).toBe('#eeeee6');
    }
  );

  it('lässt bei leerem Speicher die Papieransicht', () => {
    runInitScript();
    expect(document.documentElement.hasAttribute('data-variant')).toBe(false);
    expect(themeColorOf()).toBe('#eeeee6');
  });

  it('entfernt ein vorhandenes Attribut, wenn nichts Gültiges gespeichert ist', () => {
    document.documentElement.setAttribute('data-variant', 'bauplan');
    runInitScript();
    expect(document.documentElement.hasAttribute('data-variant')).toBe(false);
  });

  it('wirft nicht und bleibt bei Papier, wenn getItem wirft', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blockiert', 'SecurityError');
    });
    expect(() => runInitScript()).not.toThrow();
    expect(document.documentElement.hasAttribute('data-variant')).toBe(false);
  });

  it('kommt ohne meta[name=theme-color] ohne Fehler aus', () => {
    document.head.innerHTML = '';
    localStorage.setItem(VARIANT_STORAGE_KEY, 'bauplan');
    expect(() => runInitScript()).not.toThrow();
    expect(document.documentElement.getAttribute('data-variant')).toBe('bauplan');
  });

  it('überträgt die Variante bei astro:before-swap auf das neue Dokument', () => {
    localStorage.setItem(VARIANT_STORAGE_KEY, 'bauplan');
    runInitScript();
    const next = freshDocument();
    dispatchBeforeSwap(next);
    expect(next.documentElement.getAttribute('data-variant')).toBe('bauplan');
    expect(themeColorOf(next)).toBe('#123b66');
  });

  it('lässt das neue Dokument bei Papier ohne Attribut', () => {
    runInitScript();
    const next = freshDocument();
    next.documentElement.setAttribute('data-variant', 'bauplan');
    dispatchBeforeSwap(next);
    expect(next.documentElement.hasAttribute('data-variant')).toBe(false);
    expect(themeColorOf(next)).toBe('#eeeee6');
  });

  it('wirft beim Seitenwechsel nicht, wenn der Speicher blockiert ist', () => {
    runInitScript();
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blockiert', 'SecurityError');
    });
    const next = freshDocument();
    expect(() => dispatchBeforeSwap(next)).not.toThrow();
    expect(next.documentElement.hasAttribute('data-variant')).toBe(false);
  });
});

describe('THEME_INIT_SCRIPT: Beschaffenheit', () => {
  it('ist ein statischer String kürzer als 1024 Zeichen', () => {
    expect(typeof THEME_INIT_SCRIPT).toBe('string');
    expect(THEME_INIT_SCRIPT.length).toBeGreaterThan(0);
    expect(THEME_INIT_SCRIPT.length).toBeLessThan(1024);
  });

  it('enthält keine Laufzeitanteile und keine Syntax nach ES5', () => {
    expect(THEME_INIT_SCRIPT).not.toContain('${');
    expect(THEME_INIT_SCRIPT).not.toMatch(/=>|\blet\b|\bconst\b|`/);
  });

  it('nennt Schlüssel und beide Theme-Farben exakt wie die Konstanten', () => {
    expect(THEME_INIT_SCRIPT).toContain(VARIANT_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain(THEME_COLORS.papier);
    expect(THEME_INIT_SCRIPT).toContain(THEME_COLORS.bauplan);
  });

  it('liest weder Systemfarbwahl noch Cookies und sendet nichts', () => {
    expect(THEME_INIT_SCRIPT).not.toMatch(
      /prefers-color-scheme|cookie|fetch|XMLHttpRequest|sendBeacon|gtag/
    );
  });

  it('hat den festgehaltenen SHA-256 (Base64)', () => {
    const hash = createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64');
    expect(hash).toBe(THEME_INIT_SHA256);
  });
});
