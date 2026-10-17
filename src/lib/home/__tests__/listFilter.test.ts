import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindListFilter, matchesFilter } from '../listFilter';
import { matchesNote, noteStatusLine } from '../logbook';
import { projectStatusLine } from '../works';

/** Fixture als geparstes Fragment einsetzen, ohne Markup-Zuweisung an Elementeigenschaften. */
function setBody(html: string) {
  document.body.replaceChildren(document.createRange().createContextualFragment(html));
}

interface FixtureItem {
  category: string;
  number: string;
  text?: string;
}

const DEFAULT_ITEMS: FixtureItem[] = [
  { category: 'KI', number: '02' },
  { category: 'Infrastruktur', number: '03' },
  { category: 'Web', number: '04' },
  { category: 'Web', number: '05' },
];

function mount(items: FixtureItem[] = DEFAULT_ITEMS, chips = ['KI', 'Infrastruktur', 'Web']) {
  setBody(`
    <section data-filter-root>
      <div role="group" aria-label="Projekte filtern" hidden>
        <button type="button" data-filter-chip="" aria-pressed="true">Alle</button>
        ${chips
          .map(
            (c) =>
              `<button type="button" data-filter-chip="${c}" aria-pressed="false"><span>${c}</span></button>`
          )
          .join('')}
      </div>
      <p data-filter-status aria-live="polite">${projectStatusLine(items.length, items.length)}</p>
      <div data-filter-empty hidden>
        <p>Keine Projekte in dieser Kategorie.</p>
        <button type="button" data-filter-reset>Alle anzeigen</button>
      </div>
      <ul>
        ${items
          .map(
            (item) =>
              `<li data-filter-item data-category="${item.category}"${
                item.text ? ` data-filter-text="${item.text}"` : ''
              }><a href="/projekte/x/"><span class="num">${item.number}</span></a></li>`
          )
          .join('')}
      </ul>
    </section>`);
  const root = document.querySelector<HTMLElement>('[data-filter-root]')!;
  return {
    root,
    group: root.querySelector<HTMLElement>('[role="group"]')!,
    status: root.querySelector<HTMLElement>('[data-filter-status]')!,
    empty: root.querySelector<HTMLElement>('[data-filter-empty]')!,
    items: [...root.querySelectorAll<HTMLElement>('[data-filter-item]')],
    chip: (value: string) =>
      root.querySelector<HTMLButtonElement>(`[data-filter-chip="${value}"]`)!,
    reset: root.querySelector<HTMLButtonElement>('[data-filter-reset]')!,
  };
}

const visible = (items: HTMLElement[]) => items.filter((item) => !item.hidden).length;
const numbers = (items: HTMLElement[]) =>
  items.map((item) => item.querySelector('.num')?.textContent);

afterEach(() => {
  document.body.replaceChildren();
});

describe('bindListFilter', () => {
  it('blendet beim Binden die Chip-Gruppe ein', () => {
    const view = mount();
    expect(view.group.hidden).toBe(true);
    bindListFilter(view.root, { statusLine: projectStatusLine });
    expect(view.group.hidden).toBe(false);
  });

  it('wählt mit einem Klick genau einen Chip, verbirgt andere Kategorien und schreibt die Statuszeile', () => {
    const view = mount();
    bindListFilter(view.root, { statusLine: projectStatusLine });

    view.chip('Web').click();

    expect(view.chip('Web').getAttribute('aria-pressed')).toBe('true');
    for (const other of ['', 'KI', 'Infrastruktur']) {
      expect(view.chip(other).getAttribute('aria-pressed')).toBe('false');
    }
    expect(view.items.map((item) => item.hidden)).toEqual([true, true, false, false]);
    expect(view.status.textContent).toBe('2 von 4 Projekten');
    expect(view.empty.hidden).toBe(true);
  });

  it('findet den Chip auch bei einem Klick auf ein Kindelement', () => {
    const view = mount();
    bindListFilter(view.root, { statusLine: projectStatusLine });

    view.chip('KI').querySelector('span')!.click();

    expect(view.chip('KI').getAttribute('aria-pressed')).toBe('true');
    expect(visible(view.items)).toBe(1);
  });

  it('zeigt mit dem Chip „Alle“ (leerer Wert) wieder alle Einträge', () => {
    const view = mount();
    bindListFilter(view.root, { statusLine: projectStatusLine });

    view.chip('KI').click();
    expect(visible(view.items)).toBe(1);

    view.chip('').click();
    expect(visible(view.items)).toBe(4);
    expect(view.chip('').getAttribute('aria-pressed')).toBe('true');
    expect(view.chip('KI').getAttribute('aria-pressed')).toBe('false');
    expect(view.status.textContent).toBe('4 Projekte');
  });

  it('zeigt eine Kategorie mit genau einem Projekt als normale Zeile mit „1 von 4 Projekten“', () => {
    const view = mount();
    bindListFilter(view.root, { statusLine: projectStatusLine });

    view.chip('Infrastruktur').click();

    expect(visible(view.items)).toBe(1);
    expect(view.status.textContent).toBe('1 von 4 Projekten');
    expect(view.empty.hidden).toBe(true);
  });

  it('zeigt bei null Treffern den Leerzustand; „Alle anzeigen“ setzt den Filter zurück', () => {
    const view = mount([{ category: 'Web', number: '02' }], ['Web', 'KI']);
    bindListFilter(view.root, { statusLine: projectStatusLine });

    view.chip('KI').click();

    expect(visible(view.items)).toBe(0);
    expect(view.empty.hidden).toBe(false);
    expect(view.status.textContent).toBe('0 von 1 Projekten');

    view.reset.click();

    expect(view.empty.hidden).toBe(true);
    expect(visible(view.items)).toBe(1);
    expect(view.chip('').getAttribute('aria-pressed')).toBe('true');
    expect(view.chip('KI').getAttribute('aria-pressed')).toBe('false');
    expect(view.status.textContent).toBe('1 Projekt');
    // Der Leerzustand verschwindet mit dem Klick: Der Fokus geht auf „Alle“, nicht ins Leere.
    expect(document.activeElement).toBe(view.chip(''));
  });

  it('lässt die Nummern der Zeilen beim Filtern unverändert', () => {
    const view = mount();
    bindListFilter(view.root, { statusLine: projectStatusLine });
    const before = numbers(view.items);

    view.chip('Web').click();
    expect(numbers(view.items)).toEqual(before);

    view.chip('KI').click();
    expect(numbers(view.items)).toEqual(before);
    expect(before).toEqual(['02', '03', '04', '05']);
  });

  it('ignoriert Klicks außerhalb von Chips und Zurücksetzen-Button', () => {
    const view = mount();
    const statusLine = vi.fn(projectStatusLine);
    bindListFilter(view.root, { statusLine });
    statusLine.mockClear();

    view.items[0].querySelector('a')!.addEventListener('click', (event) => event.preventDefault());
    view.items[0].querySelector('a')!.click();
    view.status.click();

    expect(statusLine).not.toHaveBeenCalled();
  });

  it('führt beim zweimaligen Binden desselben Elements zu genau einer Zustandsänderung je Klick', () => {
    const view = mount();
    const statusLine = vi.fn(projectStatusLine);
    bindListFilter(view.root, { statusLine });
    bindListFilter(view.root, { statusLine });
    statusLine.mockClear();

    view.chip('KI').click();

    expect(statusLine).toHaveBeenCalledTimes(1);
    expect(view.root.dataset.initialized).toBe('true');
  });

  it('entfernt mit der Aufräumfunktion Listener und dataset.initialized', () => {
    const view = mount();
    const statusLine = vi.fn(projectStatusLine);
    const cleanup = bindListFilter(view.root, { statusLine });
    statusLine.mockClear();

    cleanup();

    expect(view.root.dataset.initialized).toBeUndefined();
    view.chip('KI').click();
    expect(statusLine).not.toHaveBeenCalled();
    expect(view.items.every((item) => !item.hidden)).toBe(true);

    // Danach lässt sich das Element erneut binden.
    bindListFilter(view.root, { statusLine });
    statusLine.mockClear();
    view.chip('KI').click();
    expect(statusLine).toHaveBeenCalledTimes(1);
  });

  it('tut nichts, wenn die Wurzel keine Einträge enthält', () => {
    setBody('<section data-filter-root></section>');
    const root = document.querySelector<HTMLElement>('[data-filter-root]')!;
    expect(() => bindListFilter(root, { statusLine: projectStatusLine })()).not.toThrow();
  });
});

describe('matchesFilter', () => {
  const item = (category: string, text?: string) => {
    const element = document.createElement('li');
    element.dataset.category = category;
    if (text !== undefined) element.dataset.filterText = text;
    return element;
  };

  it('prüft die Kategorie; leere Kategorie lässt alles durch', () => {
    expect(matchesFilter(item('KI'), { category: '', query: '' })).toBe(true);
    expect(matchesFilter(item('KI'), { category: 'KI', query: '' })).toBe(true);
    expect(matchesFilter(item('KI'), { category: 'Web', query: '' })).toBe(false);
  });

  it('verknüpft Kategorie und Suchtext mit UND, ohne Groß-/Kleinschreibung und Akzente', () => {
    const entry = item('Web', 'Café Docker Compose');
    expect(matchesFilter(entry, { category: 'Web', query: 'docker' })).toBe(true);
    expect(matchesFilter(entry, { category: 'Web', query: 'CAFE' })).toBe(true);
    expect(matchesFilter(entry, { category: 'KI', query: 'docker' })).toBe(false);
    expect(matchesFilter(entry, { category: 'Web', query: 'kubernetes' })).toBe(false);
  });

  it('prüft bei Zeilen mit Tag-Liste (data-tags) die ganze Liste, getrennt durch „|“', () => {
    const entry = document.createElement('li');
    entry.dataset.tags = 'Docker|Linux|Betrieb';
    expect(matchesFilter(entry, { category: 'Linux', query: '' })).toBe(true);
    expect(matchesFilter(entry, { category: 'Betrieb', query: '' })).toBe(true);
    expect(matchesFilter(entry, { category: 'Dock', query: '' })).toBe(false);
    expect(matchesFilter(entry, { category: 'Web', query: '' })).toBe(false);
    expect(matchesFilter(entry, { category: '', query: '' })).toBe(true);
  });

  it('behandelt eine leere Tag-Liste als Zeile ohne Tags', () => {
    const entry = document.createElement('li');
    entry.dataset.tags = '';
    expect(matchesFilter(entry, { category: 'Docker', query: '' })).toBe(false);
    expect(matchesFilter(entry, { category: '', query: '' })).toBe(true);
  });

  it('liest den Suchtext aus data-search-text und nutzt die übergebene Vergleichsfunktion', () => {
    const entry = document.createElement('li');
    entry.dataset.searchText = 'docker compose';
    const match = vi.fn(matchesNote);
    expect(matchesFilter(entry, { category: '', query: 'compose' }, match)).toBe(true);
    expect(match).toHaveBeenCalledWith('docker compose', 'compose');
    expect(matchesFilter(entry, { category: '', query: 'kubernetes' }, match)).toBe(false);
  });
});

interface LogItem {
  slug: string;
  tags: string[];
  text: string;
}

const LOG_ITEMS: LogItem[] = [
  { slug: 'a', tags: ['Docker', 'Betrieb'], text: 'docker compose im alltag docker betrieb' },
  { slug: 'b', tags: ['Docker'], text: 'container netzwerk docker' },
  { slug: 'c', tags: ['Linux'], text: 'uber systemd linux' },
  { slug: 'd', tags: [], text: 'ohne tags notiz' },
];

function mountLog(items: LogItem[] = LOG_ITEMS, chips = ['Docker', 'Linux']) {
  setBody(`
    <section data-filter-root>
      <div role="group" aria-label="Logbuch nach Thema filtern" hidden>
        <button type="button" data-filter-chip="" aria-pressed="true">Alle Notizen</button>
        ${chips
          .map(
            (c) =>
              `<button type="button" data-filter-chip="${c}" aria-pressed="false">${c}</button>`
          )
          .join('')}
      </div>
      <div data-search-block hidden>
        <label for="q">Logbuch durchsuchen</label>
        <input id="q" type="search" data-filter-search />
      </div>
      <p data-filter-status aria-live="polite">${noteStatusLine(items.length, items.length)}</p>
      <ul>
        ${items
          .map(
            (item) =>
              `<li data-filter-item data-tags="${item.tags.join('|')}" data-search-text="${item.text}"><a href="/blog/${item.slug}/">${item.slug}</a></li>`
          )
          .join('')}
      </ul>
      <div data-filter-empty hidden>
        <p>Keine passende Notiz.</p>
        <button type="button" data-filter-reset>Filter zurücksetzen</button>
      </div>
    </section>`);
  const root = document.querySelector<HTMLElement>('[data-filter-root]')!;
  const search = root.querySelector<HTMLInputElement>('[data-filter-search]')!;
  return {
    root,
    search,
    block: root.querySelector<HTMLElement>('[data-search-block]')!,
    group: root.querySelector<HTMLElement>('[role="group"]')!,
    status: root.querySelector<HTMLElement>('[data-filter-status]')!,
    empty: root.querySelector<HTMLElement>('[data-filter-empty]')!,
    reset: root.querySelector<HTMLButtonElement>('[data-filter-reset]')!,
    items: [...root.querySelectorAll<HTMLElement>('[data-filter-item]')],
    chip: (value: string) =>
      root.querySelector<HTMLButtonElement>(`[data-filter-chip="${value}"]`)!,
    type(value: string) {
      search.value = value;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    },
    visibleSlugs: () =>
      [...root.querySelectorAll<HTMLElement>('[data-filter-item]')]
        .filter((item) => !item.hidden)
        .map((item) => item.querySelector('a')!.textContent),
  };
}

const logOptions = { statusLine: noteStatusLine, match: matchesNote };

describe('bindListFilter mit Suchfeld', () => {
  it('blendet den verborgenen Suchblock beim Binden ein', () => {
    const view = mountLog();
    expect(view.block.hidden).toBe(true);
    bindListFilter(view.root, logOptions);
    expect(view.block.hidden).toBe(false);
    expect(view.group.hidden).toBe(false);
  });

  it('filtert sofort beim input-Ereignis über den Suchtext', () => {
    const view = mountLog();
    bindListFilter(view.root, logOptions);

    view.type('systemd');

    expect(view.visibleSlugs()).toEqual(['c']);
    expect(view.status.textContent).toBe('1 von 4 Notizen');
    expect(view.empty.hidden).toBe(true);
  });

  it('vergleicht ohne Beachtung von Groß-/Kleinschreibung und Akzenten', () => {
    const view = mountLog();
    bindListFilter(view.root, logOptions);

    view.type('ÜBER');
    expect(view.visibleSlugs()).toEqual(['c']);

    view.type('DOCKER');
    expect(view.visibleSlugs()).toEqual(['a', 'b']);
  });

  it('verknüpft Chip und Suchtext mit UND', () => {
    const view = mountLog();
    bindListFilter(view.root, logOptions);

    view.chip('Docker').click();
    expect(view.visibleSlugs()).toEqual(['a', 'b']);

    view.type('compose');
    expect(view.visibleSlugs()).toEqual(['a']);
    expect(view.status.textContent).toBe('1 von 4 Notizen');

    view.type('systemd');
    expect(view.visibleSlugs()).toEqual([]);
    expect(view.empty.hidden).toBe(false);
    expect(view.status.textContent).toBe('0 von 4 Notizen');
  });

  it('prüft den Chip gegen die ganze Tag-Liste einer Zeile', () => {
    const view = mountLog();
    bindListFilter(view.root, logOptions);

    view.chip('Docker').click();
    expect(view.visibleSlugs()).toEqual(['a', 'b']);

    view.items[0].dataset.tags = 'Betrieb|Docker';
    view.chip('Linux').click();
    expect(view.visibleSlugs()).toEqual(['c']);
  });

  it('wertet einen leeren Suchtext wieder als „alle“', () => {
    const view = mountLog();
    bindListFilter(view.root, logOptions);

    view.type('docker');
    expect(view.visibleSlugs()).toHaveLength(2);

    view.type('   ');
    expect(view.visibleSlugs()).toHaveLength(4);
    expect(view.status.textContent).toBe('4 Notizen');
  });

  it('behandelt Sonderzeichen im Suchtext wörtlich und wirft nicht', () => {
    const view = mountLog();
    bindListFilter(view.root, logOptions);

    for (const query of ['c++', '(', '.*', '[a-']) {
      expect(() => view.type(query)).not.toThrow();
      expect(view.visibleSlugs()).toEqual([]);
      expect(view.empty.hidden).toBe(false);
    }
  });

  it('setzt mit „Filter zurücksetzen“ Chip und Suchfeld zurück und stellt alle Einträge wieder her', () => {
    const view = mountLog();
    bindListFilter(view.root, logOptions);

    view.chip('Linux').click();
    view.type('nichts');
    expect(view.empty.hidden).toBe(false);

    view.reset.click();

    expect(view.search.value).toBe('');
    expect(view.chip('').getAttribute('aria-pressed')).toBe('true');
    expect(view.chip('Linux').getAttribute('aria-pressed')).toBe('false');
    expect(view.visibleSlugs()).toEqual(['a', 'b', 'c', 'd']);
    expect(view.empty.hidden).toBe(true);
    expect(view.status.textContent).toBe('4 Notizen');
    expect(document.activeElement).toBe(view.chip(''));
  });

  it('setzt den Fokus beim Zurücksetzen auf das Suchfeld, wenn es keine Chips gibt', () => {
    const view = mountLog(LOG_ITEMS, []);
    view.chip('').remove();
    bindListFilter(view.root, logOptions);

    view.type('nichts davon');
    view.reset.click();

    expect(view.search.value).toBe('');
    expect(document.activeElement).toBe(view.search);
  });

  it('filtert ohne match-Option mit der eingebauten Normalisierung', () => {
    const view = mountLog();
    bindListFilter(view.root, { statusLine: noteStatusLine });

    view.type('ÜBER');
    expect(view.visibleSlugs()).toEqual(['c']);
  });

  it('entfernt mit der Aufräumfunktion beide Listener und leert das Suchfeld', () => {
    const view = mountLog();
    const statusLine = vi.fn(noteStatusLine);
    const cleanup = bindListFilter(view.root, { statusLine, match: matchesNote });
    view.type('docker');
    statusLine.mockClear();

    cleanup();

    expect(view.search.value).toBe('');
    expect(view.root.dataset.initialized).toBeUndefined();
    view.type('linux');
    view.chip('Linux').click();
    expect(statusLine).not.toHaveBeenCalled();
  });

  it('bindet ein zweites Mal ohne doppelte Reaktion auf eine Eingabe', () => {
    const view = mountLog();
    const statusLine = vi.fn(noteStatusLine);
    bindListFilter(view.root, { statusLine, match: matchesNote });
    bindListFilter(view.root, { statusLine, match: matchesNote });
    statusLine.mockClear();

    view.type('docker');

    expect(statusLine).toHaveBeenCalledTimes(1);
  });

  it('behält das Verhalten ohne Suchfeld bei', () => {
    const view = mount();
    bindListFilter(view.root, { statusLine: projectStatusLine });
    view.chip('Web').click();
    expect(visible(view.items)).toBe(2);
  });

  it('schreibt den Suchtext nirgends hin: kein Web-Speicher, kein Verlauf, keine Adresse, kein Netzwerk', () => {
    const view = mountLog();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const networkCall = vi.fn();
    vi.stubGlobal('fetch', networkCall);
    const href = window.location.href;

    bindListFilter(view.root, logOptions);
    view.type('docker');
    view.type('systemd');
    view.chip('Linux').click();
    view.reset.click();

    expect(setItem).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(networkCall).not.toHaveBeenCalled();
    expect(window.location.href).toBe(href);
    expect(view.root.querySelector('form')).toBeNull();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
