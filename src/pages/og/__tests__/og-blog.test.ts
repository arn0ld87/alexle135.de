/**
 * Tests für src/pages/og/[slug].png.ts
 *
 * Die Route rendert das OG-Titelbild eines Blogposts. Sie ist öffentlich
 * erreichbar (`prerender = false`) und muss deshalb dieselbe Publish-Regel
 * anwenden wie die Blog-Detailseite (`isPublishedBlogPost`): Entwürfe und
 * vordatierte Beiträge dürfen dort kein Bild bekommen, sonst verrät der Titel
 * des Bildes den unveröffentlichten Beitrag.
 *
 * Abgedeckte Szenarien:
 * - Entwurf -> 404, kein Render
 * - vordatierter Beitrag -> 404, kein Render
 * - fehlender Parameter und unbekannter Slug -> 404
 * - veröffentlichter Beitrag -> 200 image/png mit den Daten aus dem Frontmatter
 * - jeder 404-Fall -> `Cache-Control: no-store`, damit ein Client nicht auf einem
 *   heuristisch gecachten 404 hängen bleibt, nachdem der Beitrag veröffentlicht wurde
 * - Fehler im Renderer -> 500
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCollectionMock } = vi.hoisted(() => ({ getCollectionMock: vi.fn() }));
const { renderOgPngMock } = vi.hoisted(() => ({ renderOgPngMock: vi.fn() }));

vi.mock('astro:content', () => ({ getCollection: getCollectionMock }));
// Der Renderer zieht resvg und die gebündelten Schriftdateien nach — für diese
// Route zählt allein, ob überhaupt gerendert wird.
vi.mock('../../../lib/og', () => ({ renderOgPng: renderOgPngMock }));

import { GET } from '../[slug].png';

const publishedAt = new Date('2024-03-10T12:00:00Z');

const post = {
  id: 'mein-blog-post',
  data: {
    title: 'Mein Blog Post',
    summary: 'Kurze Zusammenfassung',
    tags: ['astro'],
    publishedAt,
    draft: false,
    readingTime: '5 Min. Lesezeit',
  },
  body: 'Inhalt',
};

function setup(posts: unknown[]): void {
  getCollectionMock.mockResolvedValue(posts);
}

beforeEach(() => {
  vi.clearAllMocks();
  renderOgPngMock.mockResolvedValue(Buffer.from([1, 2, 3]));
  setup([post]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /og/[slug].png', () => {
  it('rendert das Bild eines veroeffentlichten Beitrags', async () => {
    const res = await GET({ params: { slug: 'mein-blog-post' } } as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(renderOgPngMock).toHaveBeenCalledTimes(1);
  });

  it('gibt fuer einen Entwurf 404 zurueck und rendert nichts', async () => {
    setup([{ ...post, id: 'entwurf', data: { ...post.data, title: 'Entwurf', draft: true } }]);
    const res = await GET({ params: { slug: 'entwurf' } } as never);
    expect(res.status).toBe(404);
    expect(renderOgPngMock).not.toHaveBeenCalled();
  });

  it('gibt fuer einen vordatierten Beitrag 404 zurueck und rendert nichts', async () => {
    setup([
      {
        ...post,
        id: 'vordatiert',
        data: { ...post.data, title: 'Vordatiert', publishedAt: new Date(Date.now() + 86_400_000) },
      },
    ]);
    const res = await GET({ params: { slug: 'vordatiert' } } as never);
    expect(res.status).toBe(404);
    expect(renderOgPngMock).not.toHaveBeenCalled();
  });

  it('findet den veroeffentlichten Beitrag neben Entwurf und Vordatierung', async () => {
    setup([
      { ...post, id: 'entwurf', data: { ...post.data, draft: true } },
      {
        ...post,
        id: 'vordatiert',
        data: { ...post.data, publishedAt: new Date(Date.now() + 60_000) },
      },
      post,
    ]);
    const res = await GET({ params: { slug: 'mein-blog-post' } } as never);
    expect(res.status).toBe(200);
    expect(renderOgPngMock).toHaveBeenCalledTimes(1);
  });

  it('gibt 404 ohne Slug zurueck', async () => {
    const res = await GET({ params: {} } as never);
    expect(res.status).toBe(404);
    expect(renderOgPngMock).not.toHaveBeenCalled();
  });

  it('gibt 404 fuer einen unbekannten Slug zurueck', async () => {
    const res = await GET({ params: { slug: 'gibt-es-nicht' } } as never);
    expect(res.status).toBe(404);
    expect(renderOgPngMock).not.toHaveBeenCalled();
  });

  it('setzt fuer den 404-Fall no-store, damit kein Client auf dem 404 haengen bleibt', async () => {
    setup([{ ...post, id: 'entwurf', data: { ...post.data, draft: true } }]);
    const res = await GET({ params: { slug: 'entwurf' } } as never);
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('setzt no-store auch fuer fehlenden und unbekannten Slug', async () => {
    const ohneSlug = await GET({ params: {} } as never);
    expect(ohneSlug.status).toBe(404);
    expect(ohneSlug.headers.get('Cache-Control')).toBe('no-store');

    const unbekannt = await GET({ params: { slug: 'gibt-es-nicht' } } as never);
    expect(unbekannt.status).toBe(404);
    expect(unbekannt.headers.get('Cache-Control')).toBe('no-store');
  });

  it('gibt 500 zurueck, wenn der Renderer wirft', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderOgPngMock.mockRejectedValue(new Error('resvg kaputt'));
    const res = await GET({ params: { slug: 'mein-blog-post' } } as never);
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
