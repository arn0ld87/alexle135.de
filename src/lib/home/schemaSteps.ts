/**
 * Bedienung des Agora-Schemas auf der Startseite (Systemwerk, D-08, D-11).
 *
 * Das Schema ist eine Illustration. Fünf Knoten sind Schaltflächen mit `aria-pressed`;
 * genau einer ist aktiv und sein Text steht im Detailfeld. Ohne JavaScript steht die
 * vollständige Schrittliste (`ol`) im Markup, alle fünf Texte sind sichtbar, die Knoten
 * sind dann nicht interaktiv. Dieses Modul blendet auf „ein Text auf einmal“ um.
 *
 * Attribute unterhalb von `data-schema`:
 * - `data-schema-node="{schlüssel}"`   Knoten (Schaltfläche)
 * - `data-schema-step="{schlüssel}"`   Listeneintrag mit `data-schema-step-label` und
 *                                      `data-schema-step-text`; einzige Quelle der Texte
 * - `data-schema-list`                 die vollständige Liste, wird beim Binden verborgen
 * - `data-schema-detail`               Detailfeld (Live-Region), ohne JavaScript verborgen,
 *                                      mit `data-schema-detail-label` und `data-schema-detail-text`
 *
 * Texte gelangen nur über `textContent` ins Detailfeld, nie als Markup. Das Schema zeigt
 * keine Zähler, Laufzeiten oder Betriebszustände (D-11).
 */

const NOOP = () => {};

/**
 * Bindet das Schema genau einmal (`dataset.initialized`) und liefert die Aufräumfunktion:
 * sie zeigt die Liste wieder, verbirgt das Detailfeld, nimmt die Markierung der Knoten zurück,
 * deaktiviert sie wieder und entfernt den Listener.
 */
export function bindSchema(root: HTMLElement): () => void {
  if (root.dataset.initialized === 'true') return NOOP;

  const nodes = [...root.querySelectorAll<HTMLElement>('[data-schema-node]')];
  if (nodes.length === 0) return NOOP;

  const list = root.querySelector<HTMLElement>('[data-schema-list]');
  const detail = root.querySelector<HTMLElement>('[data-schema-detail]');
  const label = root.querySelector<HTMLElement>('[data-schema-detail-label]');
  const text = root.querySelector<HTMLElement>('[data-schema-detail-text]');

  root.dataset.initialized = 'true';

  function stepOf(key: string): HTMLElement | null {
    return (
      [...root.querySelectorAll<HTMLElement>('[data-schema-step]')].find(
        (step) => step.dataset.schemaStep === key
      ) ?? null
    );
  }

  /** Setzt den Knoten aktiv; ohne zugehörigen Listeneintrag bleibt alles beim Alten. */
  function activate(node: HTMLElement) {
    const step = stepOf(node.dataset.schemaNode ?? '');
    if (!step) return;

    for (const other of nodes) {
      other.setAttribute('aria-pressed', String(other === node));
    }
    if (label) {
      label.textContent = step.querySelector('[data-schema-step-label]')?.textContent?.trim() ?? '';
    }
    if (text) {
      text.textContent = step.querySelector('[data-schema-step-text]')?.textContent?.trim() ?? '';
    }
  }

  function onClick(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const node = target.closest<HTMLElement>('[data-schema-node]');
    if (node && root.contains(node)) activate(node);
  }

  if (list) list.hidden = true;
  if (detail) detail.hidden = false;
  // Das Markup liefert die Knoten deaktiviert aus; erst mit Skript sind sie bedienbar.
  for (const node of nodes) {
    if (node instanceof HTMLButtonElement) node.disabled = false;
  }
  activate(nodes[0]);
  root.addEventListener('click', onClick);

  return () => {
    root.removeEventListener('click', onClick);
    for (const node of nodes) {
      node.setAttribute('aria-pressed', 'false');
      if (node instanceof HTMLButtonElement) node.disabled = true;
    }
    if (list) list.hidden = false;
    if (detail) detail.hidden = true;
    delete root.dataset.initialized;
  };
}
