import { readdirSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ORDER,
  STATUS_LABELS,
  categoriesOf,
  formatDateDe,
  projectStatusLine,
  selectProjects,
  type ProjectRow,
} from '../works';

type Data = Parameters<typeof selectProjects>[0][number]['data'];

function entry(id: string, data: Partial<Data> = {}) {
  return {
    id,
    data: {
      title: `Titel ${id}`,
      summary: `Kurzfassung ${id}`,
      category: 'Web' as const,
      ...data,
    },
  };
}

function row(category: ProjectRow['category']): ProjectRow {
  return {
    number: '02',
    slug: 'x',
    href: '/projekte/x/',
    title: 'X',
    summary: 'X',
    stack: [],
    category,
    status: 'completed',
  };
}

describe('selectProjects', () => {
  it('liefert bei leerer Eingabe ein leeres Array', () => {
    expect(selectProjects([])).toEqual([]);
  });

  it('begrenzt neun Einträge auf sechs Zeilen mit den Nummern „02“ bis „07“', () => {
    const entries = Array.from({ length: 9 }, (_, index) =>
      entry(`projekt-${index}`, { publishedAt: new Date(2026, 0, index + 1) })
    );
    const rows = selectProjects(entries);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.number)).toEqual(['02', '03', '04', '05', '06', '07']);
  });

  it('respektiert ein eigenes Limit', () => {
    const entries = [entry('a'), entry('b'), entry('c')];
    expect(selectProjects(entries, 2)).toHaveLength(2);
  });

  it('bildet die Felder einer Zeile ab', () => {
    const [first] = selectProjects([
      entry('ticket-routing', {
        title: 'Ticket-Routing',
        summary: 'Routet Tickets.',
        techStack: ['n8n', 'LLM'],
        category: 'KI',
        status: 'in-progress',
        role: 'Workflow-Architektur',
      }),
    ]);
    expect(first).toEqual({
      number: '02',
      slug: 'ticket-routing',
      href: '/projekte/ticket-routing/',
      title: 'Ticket-Routing',
      summary: 'Routet Tickets.',
      stack: ['n8n', 'LLM'],
      category: 'KI',
      status: 'in-progress',
      role: 'Workflow-Architektur',
    });
  });

  it('setzt Standardwerte: leerer Stack, Status „completed“, keine Rolle', () => {
    const [first] = selectProjects([entry('a')]);
    expect(first.stack).toEqual([]);
    expect(first.status).toBe('completed');
    expect(first.role).toBeUndefined();
  });

  it('stellt Einträge mit featured vor die übrigen, danach nach Datum absteigend', () => {
    const rows = selectProjects([
      entry('alt', { publishedAt: new Date('2025-01-01') }),
      entry('neu', { publishedAt: new Date('2026-06-01') }),
      entry('wichtig-alt', { featured: true, publishedAt: new Date('2024-01-01') }),
    ]);
    expect(rows.map((r) => r.slug)).toEqual(['wichtig-alt', 'neu', 'alt']);
  });

  it('sortiert bei gleichem featured und gleichem Datum nach Slug und bleibt dabei stabil', () => {
    const date = new Date('2026-03-03');
    const input = ['delta', 'alpha', 'charlie', 'bravo'].map((id) =>
      entry(id, { publishedAt: date })
    );
    const expected = ['alpha', 'bravo', 'charlie', 'delta'];

    expect(selectProjects(input).map((r) => r.slug)).toEqual(expected);
    expect(selectProjects([...input].reverse()).map((r) => r.slug)).toEqual(expected);
    expect(selectProjects(input).map((r) => r.slug)).toEqual(expected);
  });

  it('stellt Einträge ohne Datum innerhalb ihrer Gruppe ans Ende', () => {
    const rows = selectProjects([
      entry('ohne-datum'),
      entry('mit-datum', { publishedAt: new Date('2020-01-01') }),
      entry('featured-ohne-datum', { featured: true }),
      entry('featured-mit-datum', { featured: true, publishedAt: new Date('2020-01-01') }),
    ]);
    expect(rows.map((r) => r.slug)).toEqual([
      'featured-mit-datum',
      'featured-ohne-datum',
      'mit-datum',
      'ohne-datum',
    ]);
  });

  it('verändert die Eingabe nicht', () => {
    const input = [entry('b'), entry('a')];
    selectProjects(input);
    expect(input.map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('categoriesOf', () => {
  it('liefert nur vorkommende Kategorien in der Reihenfolge KI, Infrastruktur, Web', () => {
    expect(categoriesOf([row('Web'), row('KI'), row('Web'), row('Infrastruktur')])).toEqual([
      'KI',
      'Infrastruktur',
      'Web',
    ]);
    expect(categoriesOf([row('Web'), row('Infrastruktur')])).toEqual(['Infrastruktur', 'Web']);
  });

  it('liefert bei leerer Eingabe ein leeres Array', () => {
    expect(categoriesOf([])).toEqual([]);
  });

  it('legt die Reihenfolge in CATEGORY_ORDER fest', () => {
    expect([...CATEGORY_ORDER]).toEqual(['KI', 'Infrastruktur', 'Web']);
  });
});

describe('projectStatusLine', () => {
  it.each([
    [6, 6, '6 Projekte'],
    [1, 1, '1 Projekt'],
    [2, 6, '2 von 6 Projekten'],
    [1, 6, '1 von 6 Projekten'],
    [0, 6, '0 von 6 Projekten'],
  ])('(%i, %i) ergibt „%s“', (visible, total, expected) => {
    expect(projectStatusLine(visible, total)).toBe(expected);
  });
});

describe('STATUS_LABELS', () => {
  it('bildet die vier Status auf deutsche Bezeichnungen ab', () => {
    expect(STATUS_LABELS).toEqual({
      planning: 'Geplant',
      'in-progress': 'In Arbeit',
      completed: 'Abgeschlossen',
      archived: 'Archiviert',
    });
  });
});

describe('formatDateDe', () => {
  it('formatiert als TT.MM.JJJJ aus den UTC-Feldern', () => {
    expect(formatDateDe(new Date('2026-08-07'))).toBe('07.08.2026');
    expect(formatDateDe(new Date('2025-12-31T23:59:59Z'))).toBe('31.12.2025');
    expect(formatDateDe(new Date('2026-01-01T00:00:00Z'))).toBe('01.01.2026');
  });
});

describe('selectProjects mit den echten Projekteinträgen', () => {
  const dir = 'src/content/projects';
  const eintraege = readdirSync(dir)
    .filter((datei) => datei.endsWith('.md') && datei !== 'agora.md')
    .map((datei) => {
      const { data } = matter(readFileSync(`${dir}/${datei}`, 'utf8'));
      return { id: datei.replace(/\.md$/, ''), data: data as Data };
    });

  it('zeigt Staffel 2 als „02“ und Staffel 1 als „03“ direkt nach der Agora-Karte', () => {
    const rows = selectProjects(eintraege);
    expect(rows.slice(0, 2).map((r) => [r.number, r.slug])).toEqual([
      ['02', 'linux-krimi-staffel-2'],
      ['03', 'terminal-missionen'],
    ]);
  });
});
