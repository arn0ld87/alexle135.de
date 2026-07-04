import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const blog = await getCollection('blog');

  // Sortiere nach Datum (neueste zuerst)
  const sortedPosts = blog.sort((a, b) => {
    const dateA = a.data.publishedAt ? new Date(a.data.publishedAt).getTime() : 0;
    const dateB = b.data.publishedAt ? new Date(b.data.publishedAt).getTime() : 0;
    return dateB - dateA;
  });

  return rss({
    title: 'Alexander Schneider - Blog',
    description: 'IT-Systemintegration, DevOps & Cloud-Lösungen aus Leipzig',
    site: context.site ?? 'https://alexle135.de',
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      link: `/blog/${post.id}/`,
      pubDate: post.data.publishedAt || new Date(),
      categories: post.data.tags || [],
    })),
    customData: `<language>de-DE</language>`,
  });
}
