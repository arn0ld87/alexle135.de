/**
 * Auswahl, Reihenfolge und Beschriftung der Projektliste im Abschnitt „Arbeiten“
 * der Startseite (Systemwerk, D-08, D-09, D-11).
 *
 * Reine Funktionen ohne DOM: Sie bekommen die Einträge der Collection `projects`
 * (`getCollection('projects')`) und liefern die Zeilen, die `Works.astro` rendert.
 * Der Filter im Browser (`listFilter.ts`) arbeitet danach nur noch auf diesem Markup.
 */

export const CATEGORY_ORDER = ['KI', 'Infrastruktur', 'Web'] as const;

export type ProjectCategory = (typeof CATEGORY_ORDER)[number];

export const STATUS_LABELS = {
  planning: 'Geplant',
  'in-progress': 'In Arbeit',
  completed: 'Abgeschlossen',
  archived: 'Archiviert',
} as const;

export type ProjectStatus = keyof typeof STATUS_LABELS;

/** Form der Einträge aus `getCollection('projects')`, soweit die Liste sie braucht. */
export interface ProjectEntryLike {
  id: string;
  data: {
    title: string;
    summary: string;
    category: ProjectCategory;
    techStack?: string[];
    role?: string;
    publishedAt?: Date;
    status?: ProjectStatus;
    featured?: boolean;
  };
}

export interface ProjectRow {
  /** Laufnummer ab „02“ (die „01“ gehört der Agora-Karte); bleibt beim Filtern stabil. */
  number: string;
  slug: string;
  href: string;
  title: string;
  summary: string;
  /** Kann leer sein; dann entfällt die Stack-Zeile ohne Leerraum. */
  stack: string[];
  category: ProjectCategory;
  status: ProjectStatus;
  role?: string;
}

/** Die erste Projektzeile trägt die Nummer „02“, weil „01“ die Agora-Karte ist. */
const FIRST_NUMBER = 2;

function compareEntries(a: ProjectEntryLike, b: ProjectEntryLike): number {
  const featured = Number(b.data.featured === true) - Number(a.data.featured === true);
  if (featured !== 0) return featured;

  // Fehlendes Datum zuletzt: -Infinity sortiert hinter jedem echten Datum.
  const dateA = a.data.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const dateB = b.data.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (dateA !== dateB) return dateA > dateB ? -1 : 1;

  // Gleichstand: nach Slug, damit die Reihenfolge bei jedem Aufruf gleich ist.
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Wählt höchstens `limit` Projekte: zuerst `featured`, dann nach Datum absteigend
 * (fehlendes Datum zuletzt), bei Gleichstand nach Slug aufsteigend.
 */
export function selectProjects(entries: readonly ProjectEntryLike[], limit = 6): ProjectRow[] {
  return [...entries]
    .sort(compareEntries)
    .slice(0, Math.max(0, limit))
    .map((entry, index) => ({
      number: String(index + FIRST_NUMBER).padStart(2, '0'),
      slug: entry.id,
      href: `/projekte/${entry.id}/`,
      title: entry.data.title,
      summary: entry.data.summary,
      stack: entry.data.techStack ? [...entry.data.techStack] : [],
      category: entry.data.category,
      status: entry.data.status ?? 'completed',
      role: entry.data.role,
    }));
}

/** Kategorien, die in der gezeigten Menge vorkommen, in der Reihenfolge von `CATEGORY_ORDER`. */
export function categoriesOf(rows: readonly ProjectRow[]): ProjectCategory[] {
  const present = new Set(rows.map((row) => row.category));
  return CATEGORY_ORDER.filter((category) => present.has(category));
}

/** „6 Projekte“, „1 Projekt“ oder „2 von 6 Projekten“. */
export function projectStatusLine(visible: number, total: number): string {
  if (visible === total) return `${total} ${total === 1 ? 'Projekt' : 'Projekte'}`;
  return `${visible} von ${total} Projekten`;
}

/** Datum als `TT.MM.JJJJ`. Frontmatter-Daten sind UTC-Mitternacht, daher mit UTC-Feldern gelesen. */
export function formatDateDe(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getUTCFullYear()}`;
}
