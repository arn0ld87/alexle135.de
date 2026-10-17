import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { isPublishedBlogPost } from '../utils/content';

export async function GET(context: APIContext) {
  // Der Feed ist unter /rss.xml oeffentlich erreichbar und wird von Feed-Readern und
  // Crawlern abgeholt. Deshalb gilt hier dieselbe Publish-Regel wie auf der
  // Blog-Detailseite (`isPublishedBlogPost`: Draft + Future-Date-Guard) — sonst
  // landen Titel, Summary, Link und Datum eines Entwurfs oder vordatierten Beitrags
  // im Feed, obwohl `/blog/<slug>/` dafuer korrekt 404 liefert.
  const blog = (await getCollection('blog')).filter(isPublishedBlogPost);

  // Sortiere nach Datum (neueste zuerst)
  const sortedPosts = blog.sort((a, b) => {
    const dateA = a.data.publishedAt ? new Date(a.data.publishedAt).getTime() : 0;
    const dateB = b.data.publishedAt ? new Date(b.data.publishedAt).getTime() : 0;
    return dateB - dateA;
  });

  return rss({
    title: 'Alexander Schneider - Blog',
    description: 'IT-Systemintegration, DevOps & Cloud-Lösungen aus Leipzig',
    site: context.site ?? 'https://alex-schneider.dev',
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
