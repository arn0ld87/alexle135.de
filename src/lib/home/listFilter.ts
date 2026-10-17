/**
 * Chip-Filter und Suchfeld für Listen der Startseite (Systemwerk, D-08, D-10).
 *
 * Arbeitet nur auf bereits gerendertem Markup unterhalb einer Wurzel mit
 * `data-filter-root`: kein Netzwerkaufruf, keine Inhalte als Zeichenfolge im DOM, der Suchtext
 * wird nirgends gespeichert und gelangt nicht in Adresse oder Verlauf. Ohne diesen Code bleibt
 * jede Zeile ein Link, Chip-Gruppe und Suchblock bleiben `hidden` (progressive Erweiterung, D-12).
 *
 * Attribute:
 * - `data-filter-chip`   Schaltfläche; der Wert ist die Kategorie bzw. der Tag, leer steht für „alle“
 * - `data-filter-item`   Zeile; `data-category` nennt ihre Kategorie, alternativ nennt `data-tags`
 *                        mehrere Tags, getrennt durch `|` (der Chip passt, wenn der Tag in der Liste steht)
 * - `data-search-text`   durchsuchbarer Text der Zeile (alternativ `data-filter-text`)
 * - `data-filter-search` Suchfeld (`input`) unterhalb der Wurzel; verborgene Vorfahren bis zur
 *                        Wurzel werden beim Binden eingeblendet
 * - `data-filter-status` Statuszeile (Live-Region)
 * - `data-filter-empty`  Leerzustand, erscheint bei null sichtbaren Zeilen
 * - `data-filter-reset`  Schaltfläche im Leerzustand, setzt Chip und Suchfeld zurück
 *
 * Der Zustand besteht aus Kategorie und Suchtext, beide sind mit UND verknüpft. Den Vergleich des
 * Suchtexts liefert der Aufrufer über `match` (das Logbuch übergibt `matchesNote`), damit dieses
 * Modul nichts vom Logbuch weiß; ohne `match` gilt ein einfacher Vergleich ohne Groß-/Kleinschreibung
 * und ohne Akzente. Aus dem Suchtext entsteht nie ein Muster.
 * Bindung wie die übrigen Startseiten-Module: pro Wurzel genau einmal
 * (`dataset.initialized`), Klick-Listener an der Wurzel, `input`-Listener am Suchfeld,
 * Aufräumfunktion als Rückgabe.
 */

export interface FilterState {
  /** Kategorie bzw. Tag der gewählten Chips; leer steht für „alle“. */
  category: string;
  /** Suchtext; leer sucht nichts ein. */
  query: string;
}

export interface ListFilterOptions {
  /** Text der Statuszeile aus der Zahl sichtbarer und aller Zeilen. */
  statusLine: (visible: number, total: number) => string;
  /** Vergleich von Zeilentext und Suchtext; Standard ist `defaultMatch`. */
  match?: TextMatch;
}

export type TextMatch = (haystack: string, query: string) => boolean;

/** Vergleichsform ohne Groß-/Kleinschreibung und ohne Akzente. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

function defaultMatch(haystack: string, query: string): boolean {
  const needle = fold(query.trim());
  return needle === '' || fold(haystack).includes(needle);
}

/** Der Chip passt zur Zeile: Kategorie gleich oder Tag in der `|`-getrennten Liste. */
function matchesCategory(item: HTMLElement, category: string): boolean {
  if (category === '') return true;
  const tags = item.dataset.tags;
  if (tags !== undefined) return tags.split('|').includes(category);
  return item.dataset.category === category;
}

/** Kategorie und Suchtext sind mit UND verknüpft. */
export function matchesFilter(
  item: HTMLElement,
  state: FilterState,
  match: TextMatch = defaultMatch
): boolean {
  if (!matchesCategory(item, state.category)) return false;
  if (state.query.trim() === '') return true;
  return match(item.dataset.searchText ?? item.dataset.filterText ?? '', state.query);
}

const NOOP = () => {};

/**
 * Bindet den Filter genau einmal und liefert die Aufräumfunktion (entfernt die Listener, leert das
 * Suchfeld und löscht `dataset.initialized`). Ein zweiter Aufruf für dieselbe Wurzel ändert nichts.
 */
export function bindListFilter(root: HTMLElement, options: ListFilterOptions): () => void {
  if (root.dataset.initialized === 'true') return NOOP;

  const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')];
  if (items.length === 0) return NOOP;

  const chips = [...root.querySelectorAll<HTMLElement>('[data-filter-chip]')];
  const search = root.querySelector<HTMLInputElement>('input[data-filter-search]');
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
  // Ein vom Browser wiederhergestellter Wert im Suchfeld gilt von Anfang an.
  const state: FilterState = { category: '', query: search?.value ?? '' };

  root.dataset.initialized = 'true';

  // Chip-Gruppe und Suchblock sind ohne JavaScript verborgen; hier werden sie bedienbar.
  for (const chip of chips) {
    const group = chip.closest<HTMLElement>('[role="group"]');
    if (group && root.contains(group)) group.hidden = false;
  }
  for (let node = search?.parentElement; node && node !== root; node = node.parentElement) {
    node.hidden = false;
  }

  function render() {
    let visible = 0;
    for (const item of items) {
      const show = matchesFilter(item, state, options.match);
      item.hidden = !show;
      if (show) visible += 1;
    }
    for (const chip of chips) {
      chip.setAttribute('aria-pressed', String((chip.dataset.filterChip ?? '') === state.category));
    }
    if (status) status.textContent = options.statusLine(visible, items.length);
    if (empty) empty.hidden = visible !== 0;
  }

  function onClick(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const reset = target.closest<HTMLElement>('[data-filter-reset]');
    if (reset && root.contains(reset)) {
      state.category = '';
      state.query = '';
      if (search) search.value = '';
      render();
      // Der Leerzustand verschwindet mit dem Klick; der Fokus geht auf „alle“ (ohne Chips auf das
      // Suchfeld) statt ins Leere.
      const all = chips.find((chip) => (chip.dataset.filterChip ?? '') === '');
      (all ?? search)?.focus();
      return;
    }

    const chip = target.closest<HTMLElement>('[data-filter-chip]');
    if (chip && root.contains(chip)) {
      state.category = chip.dataset.filterChip ?? '';
      render();
    }
  }

  function onInput() {
    state.query = search?.value ?? '';
    render();
  }

  root.addEventListener('click', onClick);
  search?.addEventListener('input', onInput);
  render();

  return () => {
    root.removeEventListener('click', onClick);
    search?.removeEventListener('input', onInput);
    if (search) search.value = '';
    delete root.dataset.initialized;
  };
}
