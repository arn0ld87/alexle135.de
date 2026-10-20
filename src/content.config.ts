import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// --- Content Collections ---
// glob() erzeugt IDs aus dem Dateinamen (URL-freundlich, lowercase) — gleiches
// Verhalten wie die frühere Legacy-`slug`-Generierung, solange kein `slug`-
// Frontmatter-Override verwendet wird (im Repo nicht der Fall).

// Trailer-Baustein der Projektseite (E3.2): ersetzt das Hero-Bild, wenn gesetzt.
export const projektTrailerSchema = z.object({
  src: z.string().startsWith('/'),
  srcKlein: z.string().startsWith('/').optional(),
  poster: z.string().startsWith('/'),
  textfassung: z.array(z.string().min(1)).min(1),
});

// Eigenes Vorschaubild für og:image und JSON-LD (statt der dynamischen OG-Route).
export const projektOgImageSchema = z.string().startsWith('/');

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      tldr: z.string().optional(),
      tags: z.array(z.string()).default([]),
      techStack: z.array(z.string()).default([]),
      role: z.string().optional(),
      frameLabel: z.string().optional(),
      heroImage: image().optional(),
      heroImageAlt: z.string().max(160).optional(),
      publishedAt: z.date().optional(),
      category: z.enum(['KI', 'Infrastruktur', 'Web']),
      schemaType: z
        .enum(['SoftwareApplication', 'SoftwareSourceCode', 'CreativeWork', 'TechArticle'])
        .default('SoftwareApplication'),
      status: z.enum(['planning', 'in-progress', 'completed', 'archived']).default('completed'),
      // Interne Route einer eigenen App (z. B. Missionen); zeigt einen Start-Button im Kopf.
      appUrl: z.string().startsWith('/').optional(),
      demoUrl: z.url().optional(),
      repoUrl: z.url().optional(),
      featured: z.boolean().default(false),
      trailer: projektTrailerSchema.optional(),
      ogImage: projektOgImageSchema.optional(),
    }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      metaDescription: z.string().optional(),
      tldr: z.string().optional(),
      tags: z.array(z.string()).default([]),
      format: z.string().optional(),
      layout: z.enum(['standard', 'feature']).default('standard'),
      readingTime: z.string().optional(),
      snippet: z.string().optional(),
      heroImage: image().optional(),
      heroImageAlt: z.string().max(160).optional(),
      heroVideo: z.string().optional(),
      heroPoster: image().optional(),
      publishedAt: z.date().optional(),
      updatedAt: z.date().optional(),
      author: z.string().default('Alexander Schneider'),
      draft: z.boolean().default(false),
      faq: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .optional(),
    }),
});

const changelog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/changelog' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    type: z.enum(['architecture', 'quality', 'feature', 'operations']),
    publishedAt: z.date(),
    links: z
      .array(
        z.object({
          label: z.string(),
          href: z.string(),
        })
      )
      .default([]),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    updatedAt: z.date().optional(),
  }),
});

const about = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/about' }),
  schema: z.object({
    title: z.string(),
    profileImage: z.string().optional(),
    profileImageAlt: z.string().optional(),
  }),
});

// --- Data Collections ---
// Je ein JSON-File pro Collection — glob() (statt file()) behält das
// 1-Datei-=-1-Entry-Verhalten der früheren `type: 'data'`-Collections bei.

const hero = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/hero' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    cta: z.string(),
    media: z.string(),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/services' }),
  schema: z.object({
    items: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string().optional(),
        color: z.string().optional(),
      })
    ),
  }),
});

const skills = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/skills' }),
  schema: z.object({
    items: z.array(
      z.object({
        name: z.string(),
        percentage: z.number(),
        category: z.string(),
      })
    ),
  }),
});

export const collections = {
  // Content
  projects,
  blog,
  changelog,
  legal,
  about,
  // Data
  hero,
  services,
  skills,
};
