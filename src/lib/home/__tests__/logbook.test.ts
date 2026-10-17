import { describe, expect, it, vi } from 'vitest';
import {
  matchesNote,
  noteStatusLine,
  normalizeText,
  selectPosts,
  topTags,
  type NoteRow,
} from '../logbook';

type Entry = Parameters<typeof selectPosts>[0][number];

function post(id: string, data: Partial<Entry['data']> = {}, body = 'Ein kurzer Text.'): Entry {
  return {
    id,
    body,
    data: {
      title: `Titel ${id}`,
      summary: `Kurzfassung ${id}`,
      publishedAt: new Date('2026-08-07T00:00:00.000Z'),
      tags: [],
      ...data,
    },
  };
}

function row(tags: string[]): NoteRow {
  return {
    slug: 'x',
    href: '/blog/x/',
    title: 'X',
    summary: 'X',
    tags,
    firstTag: tags[0],
    readingTime: '1 Min.',
  };
}

describe('selectPosts', () => {
  it('liefert bei leerer Eingabe ein leeres Array', () => {
    expect(selectPosts([])).toEqual([]);
  });

  it('sortiert nach Datum absteigend und begrenzt auf acht Zeilen', () => {
    const entries = Array.from({ length: 11 }, (_, i) =>
      post(`p${String(i).padStart(2, '0')}`, {
        publishedAt: new Date(Date.UTC(2026, 0, i + 1)),
      })
    );
    const rows = selectPosts(entries);
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.slug)).toEqual([
      'p10',
      'p09',
      'p08',
      'p07',
      'p06',
      'p05',
      'p04',
      'p03',
    ]);
  });

  it('respektiert ein anderes Limit', () => {
    const entries = [post('a'), post('b'), post('c')];
    expect(selectPosts(entries, 2)).toHaveLength(2);
    expect(selectPosts(entries, 0)).toEqual([]);
  });

  it('sortiert bei gleichem Datum nach Slug und bei jedem Aufruf gleich', () => {
    const same = new Date('2026-05-01T00:00:00.000Z');
    const a = [
      post('b', { publishedAt: same }),
      post('c', { publishedAt: same }),
      post('a', { publishedAt: same }),
    ];
    const b = [...a].reverse();
    expect(selectPosts(a).map((r) => r.slug)).toEqual(['a', 'b', 'c']);
    expect(selectPosts(b).map((r) => r.slug)).toEqual(['a', 'b', 'c']);
  });

  it('bildet href, Titel, Kurzfassung und Tags aus dem Eintrag', () => {
    const [r] = selectPosts([
      post('docker-compose', {
        title: 'Docker Compose im Alltag',
        summary: 'Warum ich Compose liebe.',
        tags: ['Docker', 'Betrieb'],
      }),
    ]);
    expect(r.slug).toBe('docker-compose');
    expect(r.href).toBe('/blog/docker-compose/');
    expect(r.title).toBe('Docker Compose im Alltag');
    expect(r.summary).toBe('Warum ich Compose liebe.');
    expect(r.tags).toEqual(['Docker', 'Betrieb']);
    expect(r.firstTag).toBe('Docker');
  });

  it('bildet das Datum als TT.MM.JJ in UTC; 00:00 UTC behält seinen Kalendertag', () => {
    const [r] = selectPosts([post('a', { publishedAt: new Date('2026-08-07T00:00:00.000Z') })]);
    expect(r.date).toBe('07.08.26');
    expect(r.isoDate).toBe('2026-08-07');

    const [late] = selectPosts([post('b', { publishedAt: new Date('2026-12-31T23:59:59.000Z') })]);
    expect(late.date).toBe('31.12.26');
  });

  it('setzt Einträge ohne Datum ans Ende, ohne Datumsangabe', () => {
    const rows = selectPosts([
      post('ohne', { publishedAt: undefined }),
      post('mit', { publishedAt: new Date('2020-01-01T00:00:00.000Z') }),
    ]);
    expect(rows.map((r) => r.slug)).toEqual(['mit', 'ohne']);
    expect(rows[1].date).toBeUndefined();
    expect(rows[1].isoDate).toBeUndefined();
  });

  it('nimmt die Lesezeit aus dem Frontmatter', () => {
    const readingTimeOf = vi.fn(() => 'berechnet');
    const [r] = selectPosts([post('a', { readingTime: '18 Min.' })], 8, readingTimeOf);
    expect(r.readingTime).toBe('18 Min.');
    expect(readingTimeOf).not.toHaveBeenCalled();
  });

  it('berechnet die Lesezeit aus dem Beitragstext, wenn sie im Frontmatter fehlt', () => {
    const readingTimeOf = vi.fn((text: string) => `${text.length} Zeichen`);
    const [r] = selectPosts([post('a', {}, 'abcde')], 8, readingTimeOf);
    expect(readingTimeOf).toHaveBeenCalledWith('abcde');
    expect(r.readingTime).toBe('5 Zeichen');
  });

  it('übergibt einen leeren Text, wenn der Beitrag keinen Körper hat', () => {
    const readingTimeOf = vi.fn((text: string) => `[${text}]`);
    const entry = post('a');
    delete entry.body;
    const [r] = selectPosts([entry], 8, readingTimeOf);
    expect(readingTimeOf).toHaveBeenCalledWith('');
    expect(r.readingTime).toBe('[]');
  });

  it('lässt firstTag fehlen, wenn der Eintrag keine Tags hat', () => {
    const [r] = selectPosts([post('a', { tags: [] })]);
    expect(r.tags).toEqual([]);
    expect(r.firstTag).toBeUndefined();
  });

  it('verändert die Eingabe nicht und kopiert die Tags', () => {
    const entries = [post('b', { publishedAt: new Date('2026-01-01T00:00:00.000Z') }), post('a')];
    const copy = [...entries];
    const rows = selectPosts(entries);
    expect(entries).toEqual(copy);
    rows[0].tags.push('x');
    expect(entries[0].data.tags).toEqual([]);
  });
});

describe('topTags', () => {
  it('liefert die Tags, die in mindestens zwei Zeilen vorkommen, nach Häufigkeit', () => {
    const rows = [
      row(['Docker', 'Linux']),
      row(['Docker', 'Linux']),
      row(['Docker']),
      row(['Einzeln']),
    ];
    expect(topTags(rows)).toEqual(['Docker', 'Linux']);
  });

  it('sortiert bei Gleichstand alphabetisch mit deutscher Sortierung', () => {
    const rows = [row(['Zeta', 'Ärger', 'Alpha']), row(['Zeta', 'Ärger', 'Alpha'])];
    expect(topTags(rows)).toEqual(['Alpha', 'Ärger', 'Zeta']);
  });

  it('liefert höchstens max Tags', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const rows = [row(tags), row(tags)];
    expect(topTags(rows)).toHaveLength(5);
    expect(topTags(rows, 2)).toEqual(['a', 'b']);
  });

  it('zählt ein Tag je Zeile nur einmal', () => {
    expect(topTags([row(['Docker', 'Docker'])])).toEqual([]);
  });

  it('ist leer, wenn kein Tag zweimal vorkommt', () => {
    expect(topTags([row(['a']), row(['b']), row(['c'])])).toEqual([]);
    expect(topTags([])).toEqual([]);
    expect(topTags([row([]), row([])])).toEqual([]);
  });
});

describe('noteStatusLine', () => {
  it.each([
    [8, 8, '8 Notizen'],
    [1, 1, '1 Notiz'],
    [3, 8, '3 von 8 Notizen'],
    [1, 8, '1 von 8 Notizen'],
    [0, 8, '0 von 8 Notizen'],
  ])('(%i, %i) ergibt „%s“', (visible, total, expected) => {
    expect(noteStatusLine(visible, total)).toBe(expected);
  });
});

describe('normalizeText', () => {
  it('macht klein, entfernt Akzente und trimmt', () => {
    expect(normalizeText('ÜBER Docker ')).toBe('uber docker');
  });

  it('behandelt „Café“ und „cafe“ gleich', () => {
    expect(normalizeText('Café')).toBe(normalizeText('cafe'));
  });

  it('fasst Leerraum zusammen', () => {
    expect(normalizeText('  a \n\t b  ')).toBe('a b');
  });

  it('lässt Sonderzeichen unverändert', () => {
    expect(normalizeText('C++ (.*) [a-')).toBe('c++ (.*) [a-');
  });
});

describe('matchesNote', () => {
  it('trifft bei leerem oder nur aus Leerzeichen bestehendem Suchtext immer', () => {
    expect(matchesNote('docker compose', '')).toBe(true);
    expect(matchesNote('docker compose', '   ')).toBe(true);
    expect(matchesNote('', '')).toBe(true);
  });

  it('vergleicht ohne Beachtung von Groß- und Kleinschreibung', () => {
    expect(matchesNote('docker compose', 'DOCKER')).toBe(true);
    expect(matchesNote('Docker Compose', 'compose')).toBe(true);
    expect(matchesNote('docker compose', 'kubernetes')).toBe(false);
  });

  it('vergleicht ohne Beachtung von Akzenten und Umlaut-Strichen', () => {
    expect(matchesNote('über mich', 'uber')).toBe(true);
    expect(matchesNote('uber mich', 'ÜBER')).toBe(true);
  });

  it.each(['c++', '(', '.*', '[a-'])(
    'vergleicht den Suchtext „%s“ wörtlich, ohne Fehler',
    (query) => {
      expect(() => matchesNote('nichts davon', query)).not.toThrow();
      expect(matchesNote('nichts davon', query)).toBe(false);
      expect(matchesNote(`vorher ${query} nachher`, query)).toBe(true);
    }
  );

  it('behandelt „.*“ nicht als Platzhalter', () => {
    expect(matchesNote('abc', '.*')).toBe(false);
  });
});
