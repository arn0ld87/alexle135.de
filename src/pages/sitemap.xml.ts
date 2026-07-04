import type { APIRoute } from 'astro';

// Astro's @astrojs/sitemap integration emits /sitemap-index.xml + /sitemap-0.xml.
// Many crawlers probe the canonical /sitemap.xml path first — redirect them.
export const prerender = false;

export const GET: APIRoute = () => {
  return new Response(null, {
    status: 301,
    headers: {
      Location: '/sitemap-index.xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
