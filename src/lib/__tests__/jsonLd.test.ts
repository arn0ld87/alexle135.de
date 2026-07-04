import { describe, expect, it } from 'vitest';
import { safeJsonLd } from '../jsonLd';

describe('safeJsonLd', () => {
  it('escaped < und > zu \\u003c / \\u003e', () => {
    const result = safeJsonLd({ x: '</script><b>' });
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('\\u003c');
    expect(result).toContain('\\u003e');
  });

  it('escaped & zu \\u0026', () => {
    const result = safeJsonLd({ x: 'foo & bar' });
    expect(result).not.toContain('&');
    expect(result).toContain('\\u0026');
  });

  it('Kombination aus <, > und &', () => {
    const result = safeJsonLd({ x: '</script><b>&' });
    expect(result).not.toMatch(/[<>&]/);
    expect(result).toContain('\\u003c');
    expect(result).toContain('\\u003e');
    expect(result).toContain('\\u0026');
  });

  it('liefert nach JSON.parse das Originalobjekt zurück (\\uXXXX ist valides JSON)', () => {
    const obj = { a: '<x>', b: 'foo & bar', c: '</script>' };
    const parsed = JSON.parse(safeJsonLd(obj));
    expect(parsed).toEqual(obj);
  });

  it('gültiges JSON bleibt parsebar bei verschachtelten Objekten', () => {
    const nested = { outer: { inner: '<script>alert("xss")</script>' } };
    const parsed = JSON.parse(safeJsonLd(nested));
    expect(parsed).toEqual(nested);
  });

  it('wirft nicht bei undefined / nicht-serialisierbaren Werten, sondern liefert ""', () => {
    expect(safeJsonLd(undefined)).toBe('');
    expect(safeJsonLd(() => {})).toBe('');
  });
});
