import { z } from 'astro/zod';

// Zentrale Zod-Schemas für die Admin-API-Routen (posts, projects, messages).
// Bildet die real erlaubten Felder/Statuswerte aus src/lib/db/repositories.ts ab
// (POST_COLUMNS, PROJECT_COLUMNS, ContactMessageStatus) — keine eigene
// Business-Logik, nur Form- und Wertebereichsprüfung.

// Zod v4: der `error`-Parameter deckt sowohl fehlende Felder als auch falsche
// Typen ab (`required_error`/`invalid_type_error` aus v3 existieren nicht mehr).
export const uuidSchema = z.uuid({ error: 'Ungültige ID.' });

// Einheitliche Slug-Regel: Kleinbuchstaben, Ziffern, einzelne Bindestriche als
// Trenner, kein führender/abschließender Bindestrich.
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string({ error: 'slug ist erforderlich.' })
  .trim()
  .min(1, 'slug ist erforderlich.')
  .max(200, 'slug ist zu lang (max. 200 Zeichen).')
  .regex(SLUG_REGEX, 'slug darf nur Kleinbuchstaben, Ziffern und einzelne Bindestriche enthalten.');

// `demo_url`/`repo_url` sind optional und dürfen explizit `null` sein (Feld
// zurücksetzen). Ein leerer String aus einem Formularfeld wird zu `null`
// normalisiert; wenn gesetzt, muss es eine gültige absolute URL sein.
export const optionalUrlSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.url({ error: 'Ungültige URL.' }).nullable().optional()
);

export const contactMessageStatusSchema = z.enum(['open', 'answered', 'spam', 'follow_up'], {
  message: 'ungueltiger status.',
});

export const projectStatusSchema = z.enum(['planning', 'in-progress', 'completed', 'archived'], {
  message: 'ungueltiger status.',
});

const postFieldsSchema = z.object({
  title: z
    .string({ error: 'title ist erforderlich.' })
    .trim()
    .min(1, 'title ist erforderlich.')
    .max(300, 'title ist zu lang.'),
  slug: slugSchema,
  summary: z.string().max(2000, 'summary ist zu lang.').optional(),
  content: z.string().optional(),
  published: z.boolean().optional(),
  tags: z.array(z.string()).max(30, 'maximal 30 tags erlaubt.').optional(),
});

export const postCreateSchema = postFieldsSchema;
export const postUpdateSchema = postFieldsSchema.partial().extend({ id: uuidSchema });

const projectFieldsSchema = z.object({
  title: z
    .string({ error: 'title ist erforderlich.' })
    .trim()
    .min(1, 'title ist erforderlich.')
    .max(300, 'title ist zu lang.'),
  slug: slugSchema,
  summary: z.string().max(2000, 'summary ist zu lang.').optional(),
  description: z.string().optional(),
  status: projectStatusSchema.optional(),
  demo_url: optionalUrlSchema,
  repo_url: optionalUrlSchema,
  featured: z.boolean().optional(),
});

export const projectCreateSchema = projectFieldsSchema;
export const projectUpdateSchema = projectFieldsSchema.partial().extend({ id: uuidSchema });

export const patchMessageSchema = z.object({
  id: uuidSchema,
  handled: z.boolean().optional(),
  status: contactMessageStatusSchema.optional(),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;
export type PostUpdateInput = z.infer<typeof postUpdateSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type PatchMessageInput = z.infer<typeof patchMessageSchema>;
