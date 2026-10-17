/**
 * Tests für src/lib/fisi/curated.ts
 *
 * `/fisi/` ist öffentlich und zieht seine Einträge aus festen Slug-Listen. Ohne
 * Publish-Guard erschiene ein kuratierter Beitrag auch dann auf der Seite, wenn er
 * auf `draft: true` steht oder vordatiert ist — mit Titel, Summary und Lesezeit auf
 * `/fisi/` und einer URL auf eine 404 im JSON-LD-`ItemList`.
 *
 * Abgedeckte Szenarien:
 * - Publish-Guard greift vor der Kuratierung (Entwurf, Vordatierung, unbekannter Slug)
 * - Reihenfolge der Kuratierung bleibt die Reihenfolge der Slug-Liste
 * - `hydrateSections` (Seitenpfad) und `pickCuratedPosts` (JSON-LD-Pfad) liefern
 *   denselben bereinigten Bestand
 */

import { describe, expect, it } from 'vitest';
import { hydrateSections, pickCuratedPosts, type FisiSection } from '../curated';

const past = new Date('2024-03-10T12:00:00Z');
const future = new Date(Date.now() + 86_400_000);

function post(id: string, title: string, over: Record<string, unknown> = {}) {
  return {
    id,
    data: {
      title,
      summary: `${title} Summary`,
      tags: [],
      publishedAt: past,
      draft: false,
      ...over,
    },
    body: `${title} Inhalt`,
  };
}

// Bestand: ein veröffentlichter, ein Entwurf, ein vordatierter und ein kuratierter,
// der in der Collection gar nicht existiert.
const posts = [
  post('linux-grundlagen', 'Linux Grundlagen'),
  post('docker-einstieg', 'Docker Einstieg', { draft: true }),
  post('nginx-proxy', 'Nginx Proxy', { publishedAt: future }),
] as never;

const curatedSlugs = [
  'linux-grundlagen',
  'docker-einstieg',
  'nginx-proxy',
  'gibt-es-nicht',
] as const;

const sections: readonly FisiSection[] = [
  { title: 'Linux-Grundlagen', intro: 'a', slugs: ['linux-grundlagen', 'gibt-es-nicht'] },
  { title: 'Services & Netzwerk', intro: 'b', slugs: ['nginx-proxy'] },
  { title: 'Container', intro: 'c', slugs: ['docker-einstieg'] },
];

describe('pickCuratedPosts (JSON-LD-Pfad)', () => {
  it('laesst einen kuratierten Entwurf weg', () => {
    const ids = pickCuratedPosts(curatedSlugs, posts).map((p) => p.id);
    expect(ids).not.toContain('docker-einstieg');
  });

  it('laesst einen kuratierten vordatierten Beitrag weg', () => {
    const ids = pickCuratedPosts(curatedSlugs, posts).map((p) => p.id);
    expect(ids).not.toContain('nginx-proxy');
  });

  it('laesst einen kuratierten, aber unbekannten Slug weg', () => {
    const ids = pickCuratedPosts(curatedSlugs, posts).map((p) => p.id);
    expect(ids).toEqual(['linux-grundlagen']);
  });

  it('haelt die Reihenfolge der Kuratierung ein', () => {
    const reversed = [...curatedSlugs].reverse();
    const ids = pickCuratedPosts(reversed, posts).map((p) => p.id);
    expect(ids).toEqual(['linux-grundlagen']);
  });

  it('gibt bei leerem Bestand ein leeres Array zurueck', () => {
    expect(pickCuratedPosts(curatedSlugs, [])).toEqual([]);
  });
});

describe('hydrateSections (Seitenpfad)', () => {
  it('laesst einen kuratierten Entwurf aus den Zeilen der Seite weg', () => {
    const hydrated = hydrateSections(sections, posts);
    const container = hydrated.find((s) => s.title === 'Container');
    expect(container?.posts).toEqual([]);
  });

  it('laesst einen kuratierten vordatierten Beitrag weg', () => {
    const hydrated = hydrateSections(sections, posts);
    const netzwerk = hydrated.find((s) => s.title === 'Services & Netzwerk');
    expect(netzwerk?.posts).toEqual([]);
  });

  it('behaelt den veroeffentlichten Beitrag mit den Abschnittsdaten', () => {
    const [linux] = hydrateSections(sections, posts);
    expect(linux.title).toBe('Linux-Grundlagen');
    expect(linux.intro).toBe('a');
    expect(linux.posts.map((p) => p.id)).toEqual(['linux-grundlagen']);
  });

  it('liefert denselben bereinigten Bestand wie der JSON-LD-Pfad', () => {
    const ids = (list: { id: string }[]) => list.map((p) => p.id).sort();
    const seite = ids(hydrateSections(sections, posts).flatMap((s) => s.posts));
    const jsonLd = ids(pickCuratedPosts(curatedSlugs, posts));
    expect(seite).toEqual(jsonLd);
  });
});
