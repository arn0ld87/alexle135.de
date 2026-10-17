/**
 * Abbildung von Collection-Einträgen auf Kicker, Titel und Meta-Zeile der OG-Bilder
 * (Plan 02-15, D-24, D-43). Reine Funktionen über schlichte Objekte, ohne Astro-Importe:
 * Ein OG-Bild zeigt nur Werte aus dem Eintrag und die beiden festen Kicker.
 */

import type { OgCardInput } from './og';

/** Minuten aus einer Lesezeit-Angabe wie "18 Min.", "08 min" oder "5 Min. Lesezeit". */
export function minutesOf(readingTime: string | undefined): number | undefined {
  const match = /\d+/.exec(readingTime ?? '');
  return match ? Number(match[0]) : undefined;
}

/** TT.MM.JJJJ, der Kalendertag wird in UTC gebildet (ein Datum um 00:00 UTC behält ihn). */
function formatDate(date: Date | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

export function blogOgInput(post: {
  title: string;
  publishedAt?: Date;
  readingTime?: string;
}): OgCardInput {
  const minutes = minutesOf(post.readingTime);
  const parts = [
    formatDate(post.publishedAt),
    minutes === undefined ? undefined : `${minutes} MIN.`,
  ];
  const meta = parts.filter((part): part is string => Boolean(part)).join(' · ');
  return { kicker: 'BLOG', title: post.title, meta: meta || undefined };
}

export function projectOgInput(project: { title: string; techStack?: string[] }): OgCardInput {
  const stack = (project.techStack ?? [])
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 3);
  return { kicker: 'PROJEKT', title: project.title, meta: stack.join(' / ') || undefined };
}
