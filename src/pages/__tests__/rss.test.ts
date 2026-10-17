/**
 * Tests für src/pages/rss.xml.ts
 *
 * Der Feed ist unter `/rss.xml` öffentlich abrufbar und wird von Feed-Readern und
 * Crawlern abgeholt. Er muss deshalb dieselbe Publish-Regel anlegen wie die
 * Blog-Detailseite (`isPublishedBlogPost`): Titel, Summary, Link und Datum eines
 * Entwurfs oder vordatierten Beitrags dürfen nicht im Feed landen — `/blog/<slug>/`
 * liefert für beide korrekt 404, der Feed würde die Existenz sonst verraten.
 *
 * Abgedeckte Szenarien:
 * - veröffentlichter Beitrag -> ein `<item>` mit Titel und Link
 * - Entwurf -> kein Eintrag, Titel und Link kommen im Feed nicht vor
 * - vordatierter Beitrag -> kein Eintrag, Titel kommt im Feed nicht vor
 * - gemischter Bestand -> nur der veröffentlichte Beitrag bleibt übrig
 * - Sortierung der veröffentlichten Beiträge nach Datum, neueste zuerst
 * - leerer Bestand -> Feed ohne `<item>`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCollectionMock } = vi.hoisted(() => ({ getCollectionMock: vi.fn() }));

vi.mock('astro:content', () => ({ getCollection: getCollectionMock }));

import { GET } from '../rss.xml';

const site = new URL('https://alex-schneider.dev');

function post(over: Record<string, unknown> = {}) {
  return {
    id: 'veroeffentlicht',
    data: {
      title: 'Veroeffentlichter Beitrag',
      summary: 'Kurze Zusammenfassung',
      tags: ['astro'],
      publishedAt: new Date('2024-03-10T12:00:00Z'),
      draft: false,
      ...over,
    },
    body: 'Inhalt',
  };
}

function setup(posts: unknown[]): void {
  getCollectionMock.mockResolvedValue(posts);
}

async function feedItems(): Promise<string[]> {
  const res = await GET({ site } as never);
  const xml = await res.text();
  return xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
}

beforeEach(() => {
  vi.clearAllMocks();
  setup([post()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /rss.xml', () => {
  it('gibt Status 200 zurueck', async () => {
    const res = await GET({ site } as never);
    expect(res.status).toBe(200);
  });

  it('gibt den veroeffentlichten Beitrag aus', async () => {
    const items = await feedItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toContain('Veroeffentlichter Beitrag');
    expect(items[0]).toContain('/blog/veroeffentlicht/');
  });

  it('laesst einen Entwurf aus dem Feed', async () => {
    setup([post({ id: 'entwurf', title: 'Geheimer Entwurf', draft: true })]);
    const items = await feedItems();
    expect(items).toHaveLength(0);
    const res = await GET({ site } as never);
    const xml = await res.text();
    expect(xml).not.toContain('Geheimer Entwurf');
    expect(xml).not.toContain('/blog/entwurf/');
  });

  it('laesst einen vordatierten Beitrag aus dem Feed', async () => {
    setup([
      post({
        id: 'vordatiert',
        title: 'Noch geheim',
        publishedAt: new Date(Date.now() + 86_400_000),
      }),
    ]);
    const items = await feedItems();
    expect(items).toHaveLength(0);
    const res = await GET({ site } as never);
    const xml = await res.text();
    expect(xml).not.toContain('Noch geheim');
  });

  it('nimmt Entwurf und Vordatierung aus einem gemischten Bestand heraus', async () => {
    setup([
      post({ id: 'entwurf', title: 'Geheimer Entwurf', draft: true }),
      post({ id: 'vordatiert', title: 'Noch geheim', publishedAt: new Date(Date.now() + 60_000) }),
      post(),
    ]);
    const items = await feedItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toContain('Veroeffentlichter Beitrag');
  });

  it('sortiert veroeffentlichte Beitraege nach Datum, neueste zuerst', async () => {
    setup([
      post({ id: 'alt', title: 'Alter Beitrag', publishedAt: new Date('2023-01-01T00:00:00Z') }),
      post({ id: 'neu', title: 'Neuer Beitrag', publishedAt: new Date('2024-06-01T00:00:00Z') }),
    ]);
    const items = await feedItems();
    expect(items).toHaveLength(2);
    expect(items[0]).toContain('Neuer Beitrag');
    expect(items[1]).toContain('Alter Beitrag');
  });

  it('bleibt ohne veroeffentlichte Beitraege ein Feed ohne Eintraege', async () => {
    setup([]);
    expect(await feedItems()).toHaveLength(0);
  });
});
