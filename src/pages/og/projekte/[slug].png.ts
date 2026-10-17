import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgPng } from '../../../lib/og';
import { projectOgInput } from '../../../lib/ogMeta';

export const prerender = false;

// Eigene Route statt Namespace-Präfix unter /og/{slug}.png (#220): Blog- und
// Projekt-Slugs können kollidieren, eine gemeinsame Route müsste sonst raten,
// welche Collection gemeint ist. /og/projekte/{slug}.png ist kollisionsfrei
// und spiegelt die /projekte/{slug}-Seitenstruktur.
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const projects = await getCollection('projects');
    const project = projects.find((p) => p.id === slug);
    if (!project) {
      return new Response('Not found', { status: 404 });
    }

    const png = await renderOgPng(
      projectOgInput({ title: project.data.title, techStack: project.data.techStack })
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
