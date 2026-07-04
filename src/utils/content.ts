import type { CollectionEntry } from 'astro:content';

export function isPublishedBlogPost(post: CollectionEntry<'blog'>): boolean {
  const publishedAt = post.data.publishedAt;
  return !post.data.draft && (!publishedAt || publishedAt.getTime() <= Date.now());
}

export function sortContentByDate(
  a: CollectionEntry<'blog' | 'projects'>,
  b: CollectionEntry<'blog' | 'projects'>
) {
  const dateA = a.data.publishedAt || new Date(0);
  const dateB = b.data.publishedAt || new Date(0);
  return dateB.getTime() - dateA.getTime();
}

/**
 * Ermittelt "Ähnliche Artikel" für einen Blog-Post.
 *
 * Ranking: Anzahl gemeinsamer Tags (absteigend), bei Gleichstand neuester
 * Artikel zuerst. Drafts und der aktuelle Artikel selbst werden ausgeschlossen.
 * Gibt es keinerlei Tag-Überschneidung mit anderen Artikeln, greift ein
 * Fallback auf die zwei neuesten anderen Artikel.
 */
export function getRelatedPosts(
  current: CollectionEntry<'blog'>,
  allPosts: CollectionEntry<'blog'>[],
  limit = 3
): CollectionEntry<'blog'>[] {
  const currentTags = new Set(current.data.tags ?? []);

  const candidates = allPosts.filter((post) => post.id !== current.id && isPublishedBlogPost(post));

  const scored = candidates
    .map((post) => {
      const postTags = post.data.tags ?? [];
      const sharedTags = postTags.filter((tag) => currentTags.has(tag)).length;
      return { post, sharedTags };
    })
    .sort((a, b) => {
      if (b.sharedTags !== a.sharedTags) return b.sharedTags - a.sharedTags;
      return sortContentByDate(a.post, b.post);
    });

  // Nur echt verwandte Artikel (>= 1 gemeinsamer Tag) — kein Auffüllen mit
  // unähnlichen Artikeln, damit die Empfehlungen relevant bleiben
  const related = scored.filter((entry) => entry.sharedTags > 0);
  if (related.length > 0) {
    return related.slice(0, limit).map((entry) => entry.post);
  }

  const fallbackLimit = 2;
  return scored.slice(0, fallbackLimit).map((entry) => entry.post);
}
