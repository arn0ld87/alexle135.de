/**
 * Auswahl, Reihenfolge, Tag-Chips, Statuszeile und Textvergleich des Logbuchs auf der
 * Startseite (Systemwerk, D-08, D-10, D-11).
 *
 * Reine Funktionen ohne DOM: Sie bekommen die bereits veröffentlichten Einträge der Collection
 * `blog` und liefern die Zeilen, die `Logbook.astro` rendert. Der Filter im Browser
 * (`listFilter.ts`) arbeitet danach nur noch auf diesem Markup.
 *
 * Der Suchtext eines Besuchers wird nur mit `includes` auf normalisierten Zeichenfolgen
 * verglichen; daraus entsteht nie ein Muster, Sonderzeichen gelten wörtlich.
 */
import { getReadingTime } from '../../utils/readingTime';

/** Form der Einträge aus `getCollection('blog')`, soweit das Logbuch sie braucht. */
export interface PostEntryLike {
  id: string;
  body?: string;
  data: {
    title: string;
    summary: string;
    publishedAt?: Date;
    tags?: string[];
    readingTime?: string;
  };
}

export interface NoteRow {
  slug: string;
  href: string;
  /** `TT.MM.JJ`, in UTC gebildet; fehlt, wenn der Beitrag kein Datum hat. */
  date?: string;
  /** `JJJJ-MM-TT` für das `datetime`-Attribut. */
  isoDate?: string;
  title: string;
  summary: string;
  /** Kann leer sein; dann entfällt der Tag samt Trenner in der Meta-Zeile. */
  tags: string[];
  firstTag?: string;
  readingTime: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  timeZone: 'UTC',
});

function compareEntries(a: PostEntryLike, b: PostEntryLike): number {
  // Fehlendes Datum zuletzt: -Infinity sortiert hinter jedem echten Datum.
  const dateA = a.data.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const dateB = b.data.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (dateA !== dateB) return dateA > dateB ? -1 : 1;

  // Gleichstand: nach Slug, damit die Reihenfolge bei jedem Aufruf gleich ist.
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Wählt höchstens `limit` Beiträge: nach Datum absteigend, bei gleichem Datum nach Slug
 * aufsteigend. Die Einträge sind bereits als veröffentlicht gefiltert.
 *
 * Die Lesezeit ist der Wert aus dem Frontmatter, sonst das Ergebnis von `readingTimeOf` für den
 * Beitragstext.
 */
export function selectPosts(
  entries: readonly PostEntryLike[],
  limit = 8,
  readingTimeOf: (text: string) => string = getReadingTime
): NoteRow[] {
  return [...entries]
    .sort(compareEntries)
    .slice(0, Math.max(0, limit))
    .map((entry) => {
      const publishedAt = entry.data.publishedAt;
      const tags = entry.data.tags ? [...entry.data.tags] : [];
      return {
        slug: entry.id,
        href: `/blog/${entry.id}/`,
        date: publishedAt ? DATE_FORMAT.format(publishedAt) : undefined,
        isoDate: publishedAt ? publishedAt.toISOString().slice(0, 10) : undefined,
        title: entry.data.title,
        summary: entry.data.summary,
        tags,
        firstTag: tags[0],
        readingTime: entry.data.readingTime || readingTimeOf(entry.body ?? ''),
      };
    });
}

/**
 * Die häufigsten Tags der gezeigten Zeilen, die in mindestens zwei Zeilen vorkommen: nach
 * Häufigkeit absteigend, bei Gleichstand alphabetisch (Deutsch), höchstens `max`. Kommt kein
 * Tag zweimal vor, ist das Ergebnis leer und die Chipreihe entfällt.
 */
export function topTags(rows: readonly NoteRow[], max = 5): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of new Set(row.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([tagA, countA], [tagB, countB]) => countB - countA || tagA.localeCompare(tagB, 'de'))
    .slice(0, Math.max(0, max))
    .map(([tag]) => tag);
}

/** „8 Notizen“, „1 Notiz“ oder „3 von 8 Notizen“. */
export function noteStatusLine(visible: number, total: number): string {
  if (visible === total) return `${total} ${total === 1 ? 'Notiz' : 'Notizen'}`;
  return `${visible} von ${total} Notizen`;
}

/** Vergleichsform: klein, ohne Akzente, Leerraum zusammengefasst und getrimmt. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('de')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trifft, wenn der normalisierte Suchtext im normalisierten Text vorkommt. Ein leerer oder nur
 * aus Leerzeichen bestehender Suchtext trifft immer.
 */
export function matchesNote(haystack: string, query: string): boolean {
  const needle = normalizeText(query);
  if (needle === '') return true;
  return normalizeText(haystack).includes(needle);
}
