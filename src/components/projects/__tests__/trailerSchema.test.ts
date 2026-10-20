// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// content.config.ts ruft defineCollection aus astro:content auf; der Stub kennt es nicht.
vi.mock('astro:content', () => ({ defineCollection: (config: unknown) => config }));

const { projektTrailerSchema, projektOgImageSchema } = await import('../../../content.config');

const gueltig = {
  src: '/media/trailer/projekt.mp4',
  srcKlein: '/media/trailer/projekt-klein.mp4',
  poster: '/media/trailer/projekt.jpg',
  textfassung: ['Erste Einblendung', 'Zweite Einblendung'],
};

describe('Projekt-Schema: trailer', () => {
  it('akzeptiert ein gültiges Trailer-Objekt', () => {
    expect(projektTrailerSchema.safeParse(gueltig).success).toBe(true);
  });

  it('akzeptiert den Trailer ohne srcKlein', () => {
    expect(projektTrailerSchema.safeParse({ ...gueltig, srcKlein: undefined }).success).toBe(true);
  });

  it('lehnt einen Trailer ohne poster ab', () => {
    expect(projektTrailerSchema.safeParse({ ...gueltig, poster: undefined }).success).toBe(false);
  });

  it('lehnt eine leere textfassung ab', () => {
    expect(projektTrailerSchema.safeParse({ ...gueltig, textfassung: [] }).success).toBe(false);
  });

  it('lehnt leere Zeilen in der textfassung ab', () => {
    expect(projektTrailerSchema.safeParse({ ...gueltig, textfassung: [''] }).success).toBe(false);
  });

  it('lehnt src ohne führenden Schrägstrich ab', () => {
    expect(
      projektTrailerSchema.safeParse({ ...gueltig, src: 'media/trailer/projekt.mp4' }).success
    ).toBe(false);
  });
});

describe('Projekt-Schema: ogImage', () => {
  it('akzeptiert einen Pfad mit führendem Schrägstrich', () => {
    expect(projektOgImageSchema.safeParse('/media/og/projekt.png').success).toBe(true);
  });

  it('lehnt einen Pfad ohne führenden Schrägstrich ab', () => {
    expect(projektOgImageSchema.safeParse('media/og/projekt.png').success).toBe(false);
  });
});
