import { describe, expect, it } from 'vitest';
import { isExcludedFromSitemap, sitemapFilter } from '../sitemapFilter';

// Regressionstest für die Sitemap-Ausschlussregel (Phase 1, D-27/D-28):
// Interne, noindex- oder Entwickler-Routen dürfen nie in der Sitemap landen.

describe('isExcludedFromSitemap', () => {
  it.each([
    '/design-system/',
    '/status/',
    '/ai/',
    '/ki-agenten-lab/',
    '/ki-agenten-lab',
    '/admin/login',
    '/api/search.json',
    '/kontakt/danke/',
    '/apps/compose-builder/',
    '/projekte/terminal-missionen/app/',
    '/projekte/terminal-missionen/app/staffel-2',
    '/projekte/windows-terminal-missionen/app/',
    '/blog/terminal-demo/',
  ])('schließt %s aus', (pathname) => {
    expect(isExcludedFromSitemap(pathname)).toBe(true);
  });

  it.each([
    '/',
    '/kontakt/',
    '/apps/',
    '/apps/ihk-radar/',
    '/apps/roi-rechner/',
    '/kompetenzen/',
    '/changelog/',
    '/blog/',
    '/projekte/terminal-missionen/',
    '/legal/impressum/',
  ])('lässt %s in der Sitemap', (pathname) => {
    expect(isExcludedFromSitemap(pathname)).toBe(false);
  });

  it.each(['/ai-agenten/', '/ki-agenten-lab-notizen/', '/statusbericht/'])(
    'schließt %s nicht aus (Segmentgrenze, ein Präfix allein reicht nicht)',
    (pathname) => {
      expect(isExcludedFromSitemap(pathname)).toBe(false);
    }
  );
});

describe('sitemapFilter', () => {
  it('liefert false für ausgeschlossene Seiten (/ki-agenten-lab/)', () => {
    expect(sitemapFilter('https://alex-schneider.dev/ki-agenten-lab/')).toBe(false);
  });

  it('liefert false für /design-system/', () => {
    expect(sitemapFilter('https://alex-schneider.dev/design-system/')).toBe(false);
  });

  it('liefert true für reguläre Seiten', () => {
    expect(sitemapFilter('https://alex-schneider.dev/kontakt/')).toBe(true);
  });
});
