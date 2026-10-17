/**
 * Tests für src/pages/api/search.json.ts
 *
 * Abgedeckte Szenarien:
 * - HTTP-Antwort: Status 200, Cache-Control, Content-Type
 * - JSON-Shape jedes Eintragstyps (blog, project, service)
 * - Markdown-Bereinigung im content-Feld
 * - Sortierung nach weight desc, dann publishedAt desc
 * - publishedAt als ISO-String oder null
 * - tags-Fallback auf leeres Array
 * - Publish-Regel `isPublishedBlogPost` (Entwurf + Vordatierung) fuer Blog-Eintraege
 * - 500-Fehlerfall bei getCollection-Exception
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks (werden vor Imports ausgeführt) ---
const { getCollectionMock } = vi.hoisted(() => ({
  getCollectionMock: vi.fn(),
}));

vi.mock('astro:content', () => ({
  getCollection: getCollectionMock,
}));

import { GET } from '../search.json';

// --- Fixtures ---
// Bildmetadaten wie aus `image()` im Schema; die Route gibt nur `src` weiter.
const heroImageMeta = {
  src: '/_astro/blog-hero.abc12345.jpg',
  width: 1200,
  height: 630,
  format: 'jpg',
};

const blogEntry = {
  id: 'mein-blog-post',
  data: {
    title: 'Mein Blog Post',
    summary: 'Kurze Zusammenfassung',
    tags: ['astro', 'vitest'],
    publishedAt: new Date('2024-03-10T12:00:00Z'),
    draft: false,
    heroImage: heroImageMeta as typeof heroImageMeta | undefined,
  },
  body: '# Überschrift\n\n[Link](https://example.com) *Fett* normaler Text',
};

const projectEntry = {
  id: 'mein-projekt',
  data: {
    title: 'Mein Projekt',
    summary: 'Projektbeschreibung',
    tags: ['react', 'typescript'],
    publishedAt: new Date('2024-01-20T09:00:00Z'),
    heroImage: undefined as typeof heroImageMeta | undefined,
  },
  body: 'Projektinhalt ohne Markdown',
};

const serviceEntry = {
  data: {
    items: [
      { title: 'Webentwicklung', description: 'Ich entwickle moderne Webseiten' },
      { title: 'Beratung', description: 'Technische Beratung fuer Projekte' },
    ],
  },
};

type EntryLike = typeof blogEntry | typeof projectEntry;

function setupMocks(
  opts: {
    blog?: EntryLike[];
    projects?: EntryLike[];
    services?: (typeof serviceEntry)[];
  } = {}
) {
  getCollectionMock.mockImplementation((collection: string) => {
    if (collection === 'blog') return Promise.resolve(opts.blog ?? [blogEntry]);
    if (collection === 'projects') return Promise.resolve(opts.projects ?? [projectEntry]);
    if (collection === 'services') return Promise.resolve(opts.services ?? [serviceEntry]);
    return Promise.resolve([]);
  });
}

// --- Tests ---
describe('GET /api/search.json', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // -----------------------------------------------------------------------
  describe('HTTP-Antwort', () => {
    it('gibt Status 200 zurueck', async () => {
      const res = await GET({} as never);
      expect(res.status).toBe(200);
    });

    it('setzt Cache-Control: public, max-age=3600', async () => {
      const res = await GET({} as never);
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    });

    it('setzt Content-Type: application/json', async () => {
      const res = await GET({} as never);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('gibt ein Array zurueck', async () => {
      const res = await GET({} as never);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  describe('JSON-Shape: Blog-Eintrag', () => {
    beforeEach(() => setupMocks({ projects: [], services: [] }));

    it('enthaelt alle Pflichtfelder mit korrekten Werten', async () => {
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry).toMatchObject({
        title: 'Mein Blog Post',
        slug: 'mein-blog-post',
        summary: 'Kurze Zusammenfassung',
        description: 'Kurze Zusammenfassung',
        url: '/blog/mein-blog-post/',
        type: 'blog',
        tags: ['astro', 'vitest'],
        weight: 1.2,
        heroImage: '/_astro/blog-hero.abc12345.jpg',
        publishedAt: '2024-03-10T12:00:00.000Z',
      });
    });

    it('content ist ein nicht-leerer String', async () => {
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry.content).toBeTypeOf('string');
      expect(entry.content.length).toBeGreaterThan(0);
    });

    it('content enthaelt keine Markdown-Header-Syntax', async () => {
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry.content).not.toMatch(/#{1,6}\s/);
    });

    it('content enthaelt keine Markdown-Links', async () => {
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry.content).not.toMatch(/\[.*?\]\(.*?\)/);
    });

    it('kuerzter langen content auf max 150 Zeichen + "..."', async () => {
      const longEntry = { ...blogEntry, body: 'a'.repeat(200) };
      setupMocks({ blog: [longEntry], projects: [], services: [] });
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry.content).toHaveLength(153); // 150 + '...'
      expect(entry.content.endsWith('...')).toBe(true);
    });

    it('laesst kurzen content unveraendert (kein "...")', async () => {
      const shortEntry = { ...blogEntry, body: 'Kurzer Inhalt' };
      setupMocks({ blog: [shortEntry], projects: [], services: [] });
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry.content.endsWith('...')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  describe('JSON-Shape: Projekt-Eintrag', () => {
    beforeEach(() => setupMocks({ blog: [], services: [] }));

    it('enthaelt alle Pflichtfelder mit korrekten Werten', async () => {
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry).toMatchObject({
        title: 'Mein Projekt',
        slug: 'mein-projekt',
        summary: 'Projektbeschreibung',
        description: 'Projektbeschreibung',
        url: '/projekte/mein-projekt/',
        type: 'project',
        tags: ['react', 'typescript'],
        weight: 1.5,
        publishedAt: '2024-01-20T09:00:00.000Z',
      });
    });

    it('heroImage fehlt in JSON wenn nicht gesetzt', async () => {
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry.heroImage).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  describe('JSON-Shape: Service-Eintrag', () => {
    beforeEach(() => setupMocks({ blog: [], projects: [] }));

    it('erzeugt einen Eintrag pro Service-Item', async () => {
      const res = await GET({} as never);
      const data = await res.json();
      expect(data).toHaveLength(2);
    });

    it('Service-Eintrag hat korrekte Felder', async () => {
      const res = await GET({} as never);
      const [first] = await res.json();
      expect(first).toMatchObject({
        title: 'Webentwicklung',
        slug: 'webentwicklung',
        summary: 'Ich entwickle moderne Webseiten',
        description: 'Ich entwickle moderne Webseiten',
        url: '/#services',
        type: 'service',
        tags: [],
        weight: 1.0,
        publishedAt: null,
      });
    });

    it('content entspricht der description', async () => {
      const res = await GET({} as never);
      const [service] = await res.json();
      expect(service.content).toBe(service.description);
    });
  });

  // -----------------------------------------------------------------------
  describe('Sortierung', () => {
    it('sortiert Projekte (1.5) vor Blogs (1.2) vor Services (1.0)', async () => {
      setupMocks();
      const res = await GET({} as never);
      const data = await res.json();
      const types = data.map((e: { type: string }) => e.type);
      // Vollständiger Reihenfolge-Vergleich statt indexOf (Gemini-Finding #206):
      // indexOf prüft nur das erste Vorkommen, nicht die gesamte Ordnung.
      expect(types).toEqual(['project', 'blog', 'service', 'service']);
    });

    it('sortiert innerhalb gleichen Weights nach publishedAt absteigend', async () => {
      const olderBlog = {
        id: 'alter-post',
        data: {
          ...blogEntry.data,
          title: 'Alter Post',
          publishedAt: new Date('2023-01-01T00:00:00Z'),
        },
        body: 'alt',
      };
      const newerBlog = {
        id: 'neuer-post',
        data: {
          ...blogEntry.data,
          title: 'Neuer Post',
          publishedAt: new Date('2024-06-01T00:00:00Z'),
        },
        body: 'neu',
      };
      setupMocks({ blog: [olderBlog, newerBlog], projects: [], services: [] });
      const res = await GET({} as never);
      const data = await res.json();
      expect(data[0].title).toBe('Neuer Post');
      expect(data[1].title).toBe('Alter Post');
    });

    it('Eintraege mit publishedAt kommen vor solchen ohne', async () => {
      const withDate = {
        id: 'mit-datum',
        data: {
          ...blogEntry.data,
          title: 'Mit Datum',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
        },
        body: 'x',
      };
      const withoutDate = {
        id: 'ohne-datum',
        data: { ...blogEntry.data, title: 'Ohne Datum', publishedAt: null as unknown as Date },
        body: 'y',
      };
      setupMocks({ blog: [withoutDate, withDate], projects: [], services: [] });
      const res = await GET({} as never);
      const data = await res.json();
      expect(data[0].title).toBe('Mit Datum');
      expect(data[1].title).toBe('Ohne Datum');
    });
  });

  // -----------------------------------------------------------------------
  describe('Edge Cases', () => {
    it('tags fehlt -> leeres Array im Ergebnis', async () => {
      const entryNoTags = {
        ...blogEntry,
        data: { ...blogEntry.data, tags: undefined as unknown as string[] },
      };
      setupMocks({ blog: [entryNoTags], projects: [], services: [] });
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry.tags).toEqual([]);
    });

    it('publishedAt fehlt -> null im JSON', async () => {
      const entryNoDate = {
        ...blogEntry,
        data: { ...blogEntry.data, publishedAt: null as unknown as Date },
      };
      setupMocks({ blog: [entryNoDate], projects: [], services: [] });
      const res = await GET({} as never);
      const [entry] = await res.json();
      expect(entry.publishedAt).toBeNull();
    });

    it('leere Collections -> gibt leeres Array zurueck', async () => {
      setupMocks({ blog: [], projects: [], services: [] });
      const res = await GET({} as never);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it('laesst Entwuerfe aus dem Index (Publish-Regel wie in der Blog-Detailseite)', async () => {
      // Die Detailseite leitet einen Entwurf auf /404 um. Der Suchindex ist
      // oeffentlich und cachebar — er muss dieselbe Regel anwenden, sonst sind
      // Titel, Summary, Tags und Fliesstext des Entwurfs abrufbar.
      const draftEntry = {
        ...blogEntry,
        id: 'entwurf',
        data: { ...blogEntry.data, title: 'Entwurf', draft: true },
        body: 'geheimer Entwurfstext',
      };
      setupMocks({ blog: [draftEntry], projects: [], services: [] });
      const res = await GET({} as never);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it('laesst vordatierte Beitraege aus dem Index', async () => {
      const futureEntry = {
        ...blogEntry,
        id: 'vordatiert',
        data: {
          ...blogEntry.data,
          title: 'Vordatiert',
          draft: false,
          publishedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        body: 'noch nicht oeffentlicher Text',
      };
      setupMocks({ blog: [futureEntry], projects: [], services: [] });
      const res = await GET({} as never);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it('nimmt Entwurf und Vordatierung aus einem gemischten Bestand heraus', async () => {
      const draftEntry = {
        ...blogEntry,
        id: 'entwurf',
        data: { ...blogEntry.data, title: 'Entwurf', draft: true },
        body: 'geheim',
      };
      const futureEntry = {
        ...blogEntry,
        id: 'vordatiert',
        data: {
          ...blogEntry.data,
          title: 'Vordatiert',
          publishedAt: new Date(Date.now() + 60_000),
        },
        body: 'geheim',
      };
      setupMocks({ blog: [draftEntry, blogEntry, futureEntry], projects: [], services: [] });
      const res = await GET({} as never);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe('Mein Blog Post');
    });

    it('mehrere Collections werden zusammengefuehrt', async () => {
      setupMocks({
        blog: [blogEntry],
        projects: [projectEntry],
        services: [serviceEntry],
      });
      const res = await GET({} as never);
      const data = await res.json();
      // 1 blog + 1 project + 2 service items = 4
      expect(data).toHaveLength(4);
    });
  });

  // -----------------------------------------------------------------------
  describe('Fehlerfall', () => {
    // console.error in der Route unterdrücken, sonst flutet der Stacktrace die
    // Test-Konsole (Gemini-Finding #206 – Test-Output-Pollution).
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('gibt 500 zurueck wenn getCollection wirft', async () => {
      getCollectionMock.mockRejectedValue(new Error('DB unreachable'));
      const res = await GET({} as never);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Failed to build search index');
      expect(json.message).toBe('DB unreachable');
    });

    it('500-Antwort enthaelt Content-Type application/json', async () => {
      getCollectionMock.mockRejectedValue(new Error('fail'));
      const res = await GET({} as never);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('500-Antwort hat message "Unknown error" fuer Nicht-Error-Objekte', async () => {
      getCollectionMock.mockRejectedValue('ein String-Fehler');
      const res = await GET({} as never);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.message).toBe('Unknown error');
    });
  });
});
