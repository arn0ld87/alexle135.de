import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgPng } from '../../lib/og';
import { blogOgInput } from '../../lib/ogMeta';
import { getReadingTime } from '../../utils/readingTime';
import { isPublishedBlogPost } from '../../utils/content';

export const prerender = false;

/**
 * 404-Antwort der Route.
 *
 * `no-store` ist hier Absicht: 404 gehört zu den Status, die ein Browser ohne
 * Cache-Header heuristisch zwischenspeichern darf (RFC 9111 §4.2.2). Ein Client, der
 * das OG-Bild eines noch unveröffentlichten Beitrags abruft, bliebe danach auf dem
 * 404 hängen, auch nachdem der Beitrag veröffentlicht wurde. Der 404-Pfad kostet nur
 * einen Collection-Lookup und kein Rendering — jedes erneute Fragen ist billig,
 * ein festgefressener Negativ-Treffer wäre falsch.
 */
function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return notFound();
  }

  const posts = await getCollection('blog');
  const post = posts.find((p) => p.id === slug);
  // Dieselbe Publish-Regel wie die Blog-Detailseite — sonst rendert die öffentlich
  // erreichbare Route Titel und Datum eines Entwurfs oder vordatierten Beitrags.
  if (!post || !isPublishedBlogPost(post)) {
    return notFound();
  }

  const reading = post.data.readingTime || getReadingTime(post.body || '');

  try {
    const png = await renderOgPng(
      blogOgInput({
        title: post.data.title,
        publishedAt: post.data.publishedAt,
        readingTime: reading,
      })
    );

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('OG render failed:', err);
    return new Response('Render error', { status: 500 });
  }
};
