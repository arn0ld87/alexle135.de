import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgPng } from '../../lib/og';
import { getReadingTime } from '../../utils/readingTime';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const posts = await getCollection('blog');
  const post = posts.find((p) => p.id === slug);
  if (!post) {
    return new Response('Not found', { status: 404 });
  }

  const dateStr = post.data.publishedAt
    ? new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }).format(
        new Date(post.data.publishedAt)
      )
    : '';
  const reading = post.data.readingTime || getReadingTime(post.body || '');
  const meta = [dateStr, reading].filter(Boolean).join('  ·  ');

  try {
    const png = await renderOgPng({
      title: post.data.title,
      kicker: 'Logbuch · alexle135.de',
      meta,
    });

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
