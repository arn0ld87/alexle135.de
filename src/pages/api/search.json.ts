import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// TypeScript interface for search index entries
interface SearchIndexEntry {
  title: string;
  slug: string;
  summary: string;
  description: string;
  url: string;
  content: string;
  type: 'blog' | 'project' | 'service';
  tags: string[];
  publishedAt: string | null;
  heroImage?: string;
  weight: number; // For search relevance scoring
}

// Runtime generation so the DB/env guard is only evaluated when the
// server boots — not during `docker build` where the request lifecycle
// is irrelevant. Response is cacheable and cheap enough.
export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Load all content collections in parallel
    const [blogEntries, projectEntries, servicesData] = await Promise.all([
      getCollection('blog'),
      getCollection('projects'),
      getCollection('services'),
    ]);

    // Helper function to extract plain text snippet from markdown body
    const extractSnippet = (body: string, maxLength: number = 150): string => {
      // Remove markdown syntax and extract plain text
      const plainText = body
        .replace(/^---[\s\S]*?---/, '') // Remove frontmatter
        .replace(/#{1,6}\s+/g, '') // Remove headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links but keep text
        .replace(/[*_~`]/g, '') // Remove emphasis markers
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim();

      return plainText.length > maxLength ? `${plainText.slice(0, maxLength)}...` : plainText;
    };

    // Map blog entries to search index format
    const blogIndex: SearchIndexEntry[] = blogEntries.map((entry) => ({
      title: entry.data.title,
      slug: entry.id,
      summary: entry.data.summary,
      description: entry.data.summary,
      url: `/blog/${entry.id}/`,
      content: extractSnippet(entry.body ?? ''),
      type: 'blog' as const,
      tags: entry.data.tags || [],
      publishedAt: entry.data.publishedAt?.toISOString() || null,
      heroImage: entry.data.heroImage,
      weight: 1.2, // Higher weight for blog posts (more important in search)
    }));

    // Map project entries to search index format
    const projectIndex: SearchIndexEntry[] = projectEntries.map((entry) => ({
      title: entry.data.title,
      slug: entry.id,
      summary: entry.data.summary,
      description: entry.data.summary,
      url: `/projekte/${entry.id}/`,
      content: extractSnippet(entry.body ?? ''),
      type: 'project' as const,
      tags: entry.data.tags || [],
      publishedAt: entry.data.publishedAt?.toISOString() || null,
      heroImage: entry.data.heroImage,
      weight: 1.5, // Highest weight for projects (showcase items)
    }));

    // Map services to search index format
    // Services is a data collection with a single JSON file containing items array
    const serviceIndex: SearchIndexEntry[] = servicesData.flatMap((serviceEntry) =>
      serviceEntry.data.items.map((item) => ({
        title: item.title,
        slug: item.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        summary: item.description,
        description: item.description,
        url: '/#services',
        content: item.description, // Use description as content
        type: 'service' as const,
        tags: [],
        publishedAt: null,
        weight: 1.0, // Base weight for services
      }))
    );

    // Combine all indexes into a single aggregated search index
    const searchIndex: SearchIndexEntry[] = [...blogIndex, ...projectIndex, ...serviceIndex];

    // Sort by relevance: first by weight, then by publishedAt (newest first)
    searchIndex.sort((a, b) => {
      // Primary sort: weight (descending)
      if (a.weight !== b.weight) {
        return b.weight - a.weight;
      }

      // Secondary sort: publishedAt (newest first)
      if (a.publishedAt && b.publishedAt) {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }

      // Items with publishedAt come before those without
      if (a.publishedAt) return -1;
      if (b.publishedAt) return 1;

      return 0;
    });

    // Return JSON response with proper headers
    return new Response(JSON.stringify(searchIndex), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error building search index:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to build search index',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
