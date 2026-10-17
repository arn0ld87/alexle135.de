import type { CollectionEntry } from 'astro:content';
import { isPublishedBlogPost } from '../../utils/content';

/** Ein thematischer Block des Lernpfads. `slugs` ist die feste, kuratierte Reihenfolge. */
export interface FisiSection {
  readonly title: string;
  readonly intro: string;
  readonly slugs: readonly string[];
}

/**
 * Wählt die kuratierten Beiträge in der Reihenfolge von `slugs`.
 *
 * Der Publish-Guard (`isPublishedBlogPost`) greift vor der Kuratierung: ein
 * kuratierter Beitrag, der auf `draft: true` steht oder vordatiert ist, fällt hier
 * heraus — und damit sowohl aus der JSON-LD-`ItemList` (die `pickCuratedPosts`
 * direkt verwendet) als auch aus den Zeilen der Seite (über `hydrateSections`).
 * Ohne den Guard verlinkt `/fisi/` sonst auf eine 404 und zeigt Titel, Summary und
 * Lesezeit eines unveröffentlichten Beitrags.
 */
export function pickCuratedPosts(
  slugs: readonly string[],
  posts: readonly CollectionEntry<'blog'>[]
): CollectionEntry<'blog'>[] {
  const published = posts.filter(isPublishedBlogPost);
  return slugs
    .map((slug) => published.find((post) => post.id === slug))
    .filter((post): post is CollectionEntry<'blog'> => Boolean(post));
}

/** Verteilt die kuratierten Beiträge auf die thematischen Blöcke der Seite. */
export function hydrateSections(
  sections: readonly FisiSection[],
  posts: readonly CollectionEntry<'blog'>[]
): (FisiSection & { posts: CollectionEntry<'blog'>[] })[] {
  return sections.map((section) => ({
    ...section,
    posts: pickCuratedPosts(section.slugs, posts),
  }));
}
