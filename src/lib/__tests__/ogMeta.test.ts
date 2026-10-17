import { describe, it, expect } from 'vitest';
import { blogOgInput, projectOgInput, minutesOf } from '../ogMeta';

describe('minutesOf', () => {
  it.each([
    ['18 Min.', 18],
    ['08 min', 8],
    ['5 Min. Lesezeit', 5],
  ])('liest die Minuten aus %j', (input, expected) => {
    expect(minutesOf(input)).toBe(expected);
  });

  it.each([[''], ['bald'], [undefined]])('liefert für %j undefined', (input) => {
    expect(minutesOf(input)).toBeUndefined();
  });
});

describe('blogOgInput', () => {
  const date = new Date('2026-03-12T10:30:00Z');

  it('bildet Kicker, Titel und Meta aus Datum und Lesezeit', () => {
    expect(blogOgInput({ title: 'Ein Beitrag', publishedAt: date, readingTime: '8 Min.' })).toEqual(
      {
        kicker: 'BLOG',
        title: 'Ein Beitrag',
        meta: '12.03.2026 · 8 MIN.',
      }
    );
  });

  it('liest die Minuten auch aus der berechneten Lesezeit', () => {
    const input = blogOgInput({
      title: 'T',
      publishedAt: date,
      readingTime: '5 Min. Lesezeit',
    });
    expect(input.meta).toBe('12.03.2026 · 5 MIN.');
  });

  it('zeigt nur die Lesezeit, wenn das Datum fehlt', () => {
    expect(blogOgInput({ title: 'T', readingTime: '18 Min.' }).meta).toBe('18 MIN.');
  });

  it('zeigt nur das Datum, wenn die Lesezeit fehlt', () => {
    expect(blogOgInput({ title: 'T', publishedAt: date }).meta).toBe('12.03.2026');
    expect(blogOgInput({ title: 'T', publishedAt: date, readingTime: 'bald' }).meta).toBe(
      '12.03.2026'
    );
  });

  it('lässt Meta weg, wenn beides fehlt', () => {
    const input = blogOgInput({ title: 'T' });
    expect(input.meta).toBeUndefined();
    expect(input.kicker).toBe('BLOG');
  });

  it('behält bei einem Datum um 00:00 UTC den Kalendertag', () => {
    expect(blogOgInput({ title: 'T', publishedAt: new Date('2026-01-01T00:00:00Z') }).meta).toBe(
      '01.01.2026'
    );
    expect(blogOgInput({ title: 'T', publishedAt: new Date('2026-12-31T23:59:59Z') }).meta).toBe(
      '31.12.2026'
    );
  });

  it('behandelt ein ungültiges Datum wie ein fehlendes', () => {
    expect(
      blogOgInput({ title: 'T', publishedAt: new Date('kein Datum'), readingTime: '3 Min.' }).meta
    ).toBe('3 MIN.');
  });

  it('gibt nur Werte aus den Argumenten und den festen Kicker zurück', () => {
    const input = blogOgInput({ title: 'Nur dies', publishedAt: date, readingTime: '2 Min.' });
    expect(Object.keys(input).sort()).toEqual(['kicker', 'meta', 'title']);
  });
});

describe('projectOgInput', () => {
  it('bildet Kicker, Titel und Meta aus den ersten drei Stack-Einträgen', () => {
    expect(
      projectOgInput({ title: 'Compose Builder', techStack: ['Astro', 'React', 'Tailwind'] })
    ).toEqual({
      kicker: 'PROJEKT',
      title: 'Compose Builder',
      meta: 'Astro / React / Tailwind',
    });
  });

  it('nimmt bei mehr als drei Einträgen nur die ersten drei', () => {
    expect(projectOgInput({ title: 'T', techStack: ['A', 'B', 'C', 'D', 'E'] }).meta).toBe(
      'A / B / C'
    );
  });

  it('zeigt bei weniger als drei Einträgen alle', () => {
    expect(projectOgInput({ title: 'T', techStack: ['A'] }).meta).toBe('A');
    expect(projectOgInput({ title: 'T', techStack: ['A', 'B'] }).meta).toBe('A / B');
  });

  it('lässt Meta bei leerem oder fehlendem Stack weg', () => {
    expect(projectOgInput({ title: 'T', techStack: [] }).meta).toBeUndefined();
    expect(projectOgInput({ title: 'T' }).meta).toBeUndefined();
  });

  it('überspringt leere Einträge', () => {
    expect(projectOgInput({ title: 'T', techStack: ['', ' ', 'A', 'B'] }).meta).toBe('A / B');
  });

  it('gibt nur Werte aus den Argumenten und den festen Kicker zurück', () => {
    const input = projectOgInput({ title: 'T', techStack: ['A'] });
    expect(Object.keys(input).sort()).toEqual(['kicker', 'meta', 'title']);
  });
});
