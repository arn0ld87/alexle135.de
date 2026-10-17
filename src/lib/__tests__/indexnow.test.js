import { describe, expect, it } from 'vitest';

import { collectChangedUrls, mapFilePathToUrl } from '../../../scripts/indexnow.js';

describe('mapFilePathToUrl', () => {
  const siteUrl = 'https://alex-schneider.dev';

  it('maps blog content files to canonical blog URLs', () => {
    expect(mapFilePathToUrl('src/content/blog/docker-compose-beispiele.md', siteUrl)).toBe(
      'https://alex-schneider.dev/blog/docker-compose-beispiele/'
    );
  });

  it('maps top-level pages and nested index pages', () => {
    expect(mapFilePathToUrl('src/pages/index.astro', siteUrl)).toBe('https://alex-schneider.dev/');
    expect(mapFilePathToUrl('src/pages/blog/index.astro', siteUrl)).toBe(
      'https://alex-schneider.dev/blog/'
    );
  });

  it('ignores dynamic, internal and non-indexable routes', () => {
    expect(mapFilePathToUrl('src/pages/blog/[...slug].astro', siteUrl)).toBeNull();
    expect(mapFilePathToUrl('src/pages/admin/dashboard.astro', siteUrl)).toBeNull();
    expect(mapFilePathToUrl('src/pages/api/search.json.ts', siteUrl)).toBeNull();
    expect(mapFilePathToUrl('src/pages/status.astro', siteUrl)).toBeNull();
  });
});

describe('collectChangedUrls', () => {
  const siteUrl = 'https://alex-schneider.dev';

  it('deduplicates URLs and adds collection indexes for changed content', () => {
    const urls = collectChangedUrls(
      [
        'src/content/blog/docker-compose-beispiele.md',
        'src/content/blog/nala-apt-alternative-debian-ubuntu.md',
        'src/content/projects/compose-builder.md',
        'src/content/projects/compose-builder.md',
      ],
      siteUrl
    );

    expect(urls).toEqual([
      'https://alex-schneider.dev/blog/',
      'https://alex-schneider.dev/blog/docker-compose-beispiele/',
      'https://alex-schneider.dev/blog/nala-apt-alternative-debian-ubuntu/',
      'https://alex-schneider.dev/projekte/',
      'https://alex-schneider.dev/projekte/compose-builder/',
    ]);
  });
});
