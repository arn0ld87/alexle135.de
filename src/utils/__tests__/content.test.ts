import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import { getRelatedPosts, isPublishedBlogPost } from '../content';

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

describe('isPublishedBlogPost', () => {
  it('returns false for draft: true', () => {
    const post = { data: { draft: true } } as unknown as CollectionEntry<'blog'>;
    expect(isPublishedBlogPost(post)).toBe(false);
  });

  it('returns true for draft: false', () => {
    const post = { data: { draft: false } } as unknown as CollectionEntry<'blog'>;
    expect(isPublishedBlogPost(post)).toBe(true);
  });

  it('returns true when draft is undefined (published by default)', () => {
    const post = { data: {} } as unknown as CollectionEntry<'blog'>;
    expect(isPublishedBlogPost(post)).toBe(true);
  });

  it('returns false when publishedAt is in the future', () => {
    const post = {
      data: { draft: false, publishedAt: tomorrow },
    } as unknown as CollectionEntry<'blog'>;
    expect(isPublishedBlogPost(post)).toBe(false);
  });

  it('returns true when publishedAt is in the past', () => {
    const post = {
      data: { draft: false, publishedAt: yesterday },
    } as unknown as CollectionEntry<'blog'>;
    expect(isPublishedBlogPost(post)).toBe(true);
  });

  it('returns true when publishedAt is absent and not draft', () => {
    const post = { data: { draft: false } } as unknown as CollectionEntry<'blog'>;
    expect(isPublishedBlogPost(post)).toBe(true);
  });
});

describe('isPublishedBlogPost: Build-Zeitpunkt als Grenze', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('blendet einen Beitrag aus, dessen Datum erst nach dem Build verstrichen ist', () => {
    // Detailseite wurde beim Build nicht erzeugt (Datum lag danach), das Datum ist inzwischen vorbei.
    vi.stubEnv('PUBLIC_BUILD_TIME', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());
    const post = {
      data: { draft: false, publishedAt: yesterday },
    } as unknown as CollectionEntry<'blog'>;
    expect(isPublishedBlogPost(post)).toBe(false);
  });

  it('zeigt einen Beitrag, dessen Datum vor dem Build lag', () => {
    vi.stubEnv('PUBLIC_BUILD_TIME', new Date().toISOString());
    const post = {
      data: { draft: false, publishedAt: yesterday },
    } as unknown as CollectionEntry<'blog'>;
    expect(isPublishedBlogPost(post)).toBe(true);
  });
});

function makePost(
  id: string,
  tags: string[],
  publishedAt: Date,
  draft = false
): CollectionEntry<'blog'> {
  return {
    id,
    data: { title: id, tags, publishedAt, draft },
  } as unknown as CollectionEntry<'blog'>;
}

describe('getRelatedPosts', () => {
  const current = makePost('current', ['linux', 'docker'], new Date('2026-01-01'));

  it('ranks posts by number of shared tags, highest first', () => {
    const oneShared = makePost('one-shared', ['linux'], new Date('2025-01-01'));
    const twoShared = makePost('two-shared', ['linux', 'docker'], new Date('2025-01-01'));
    const noShared = makePost('no-shared', ['react'], new Date('2025-06-01'));

    const result = getRelatedPosts(current, [oneShared, twoShared, noShared]);

    // no-shared wird nicht als Auffüller mitgeliefert — nur echte Überschneidungen
    expect(result.map((p) => p.id)).toEqual(['two-shared', 'one-shared']);
  });

  it('breaks ties in shared-tag count by newest publishedAt first', () => {
    const older = makePost('older', ['linux'], new Date('2024-01-01'));
    const newer = makePost('newer', ['linux'], new Date('2025-01-01'));

    const result = getRelatedPosts(current, [older, newer]);

    expect(result.map((p) => p.id)).toEqual(['newer', 'older']);
  });

  it('excludes draft posts', () => {
    const draftPost = makePost('draft-post', ['linux', 'docker'], new Date('2025-01-01'), true);
    const published = makePost('published', ['linux'], new Date('2024-01-01'));

    const result = getRelatedPosts(current, [draftPost, published]);

    expect(result.map((p) => p.id)).toEqual(['published']);
  });

  it('excludes the current post itself', () => {
    const other = makePost('other', ['linux'], new Date('2025-01-01'));

    const result = getRelatedPosts(current, [current, other]);

    expect(result.map((p) => p.id)).toEqual(['other']);
  });

  it('respects the limit for posts with tag overlap', () => {
    const posts = [
      makePost('a', ['linux'], new Date('2025-01-01')),
      makePost('b', ['docker'], new Date('2025-02-01')),
      makePost('c', ['linux'], new Date('2025-03-01')),
      makePost('d', ['docker'], new Date('2025-04-01')),
    ];

    const result = getRelatedPosts(current, posts, 3);

    expect(result).toHaveLength(3);
  });

  it('falls back to the two newest other posts when there is no tag overlap', () => {
    const noOverlapCurrent = makePost('current-no-tags', ['ki'], new Date('2026-01-01'));
    const posts = [
      makePost('a', ['react'], new Date('2024-01-01')),
      makePost('b', ['vue'], new Date('2025-06-01')),
      makePost('c', ['svelte'], new Date('2025-01-01')),
    ];

    const result = getRelatedPosts(noOverlapCurrent, posts, 3);

    expect(result.map((p) => p.id)).toEqual(['b', 'c']);
  });
});
