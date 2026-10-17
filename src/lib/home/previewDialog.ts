/**
 * Vorschau-Dialog der Startseite (Systemwerk, D-09).
 *
 * Eine Zeile bleibt ein Link auf die Detailseite. Daneben steht ein Vorschau-Button
 * (`data-preview-open`), der ohne JavaScript `hidden` ist. Dieses Modul blendet ihn ein und
 * öffnet auf Klick ein natives `dialog`, dessen Inhalt aus einem serverseitig gerenderten
 * `template` geklont wird. Collection-Text gelangt nur über Klonen ins DOM, nie als Markup
 * aus einer Zeichenfolge.
 *
 * Attribute:
 * - `data-preview-open`      Button; `data-preview-template` nennt die `id` des `template`,
 *                            `data-preview-href` die Detailseite für den Rückfall
 * - `data-preview-dialog`    das einzige `dialog` der Seite
 * - `data-preview-body`      Körper im Dialog, nimmt den Klon auf
 * - `data-preview-kicker`    im Klon: Text der Kopfzeile, wird in den Dialog-Kopf übernommen
 * - `data-preview-title`     im Klon: Titel, seine `id` wird `aria-labelledby` des Dialogs
 * - `data-preview-close`     Schließen-Button (in der Kopfzeile des Dialogs und im Klon);
 *                            der erste bekommt beim Öffnen den Fokus
 *
 * Fehlt das `template`, der Dialog oder `showModal`, oder wirft `showModal`, öffnet sich nichts
 * und der Button führt zur Detailseite; es gibt keinen Fehlerdialog und keine Ausnahme nach außen.
 * Bindung: pro Wurzel genau einmal (`dataset.initialized`), Klick-Listener an der Wurzel.
 */

export interface PreviewOptions {
  /** Navigation für den Rückfall; Standard ist `location.assign`. */
  navigate?: (href: string) => void;
}

const NOOP = () => {};

export function bindPreview(root: HTMLElement, options: PreviewOptions = {}): () => void {
  if (root.dataset.initialized === 'true') return NOOP;

  const openers = [...root.querySelectorAll<HTMLElement>('[data-preview-open]')];
  if (openers.length === 0) return NOOP;

  const doc = root.ownerDocument;
  const navigate = options.navigate ?? ((href: string) => window.location.assign(href));
  const dialog = doc.querySelector<HTMLDialogElement>('[data-preview-dialog]');
  const body = dialog?.querySelector<HTMLElement>('[data-preview-body]') ?? null;

  /** Der Button, der den Dialog geöffnet hat; dorthin kehrt der Fokus zurück. */
  let trigger: HTMLElement | null = null;
  /** Ziel des letzten `pointerdown` im Dialog: Ein Klick zählt nur als Hintergrundklick, wenn auch das Drücken dort begann. */
  let pressTarget: EventTarget | null = null;

  root.dataset.initialized = 'true';

  // Ohne JavaScript verborgen, hier bedienbar.
  for (const opener of openers) opener.hidden = false;

  function reset() {
    body?.replaceChildren();
    dialog?.removeAttribute('aria-labelledby');
  }

  function fill(template: HTMLTemplateElement, target: HTMLDialogElement, into: HTMLElement) {
    const fragment = template.content.cloneNode(true) as DocumentFragment;

    // Der Kicker gehört in die haftende Kopfzeile des Dialogs, nicht in den scrollenden Körper.
    const kickerSource = fragment.querySelector<HTMLElement>('[data-preview-kicker]');
    const kickerTarget = target.querySelector<HTMLElement>('[data-preview-kicker]');
    if (kickerSource && kickerTarget) {
      kickerTarget.textContent = kickerSource.textContent ?? '';
      kickerSource.remove();
    }

    const title = fragment.querySelector<HTMLElement>('[data-preview-title]');
    into.replaceChildren(fragment);
    if (title?.id) target.setAttribute('aria-labelledby', title.id);
    else target.removeAttribute('aria-labelledby');
  }

  function open(opener: HTMLElement) {
    const href = opener.dataset.previewHref;
    try {
      const template = doc.getElementById(opener.dataset.previewTemplate ?? '');
      if (
        !(template instanceof HTMLTemplateElement) ||
        !dialog ||
        !body ||
        typeof dialog.showModal !== 'function'
      ) {
        throw new Error('Vorschau nicht verfügbar');
      }
      fill(template, dialog, body);
      trigger = opener;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-preview-close]')?.focus();
    } catch {
      trigger = null;
      reset();
      if (href) navigate(href);
    }
  }

  function onRootClick(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const opener = target.closest<HTMLElement>('[data-preview-open]');
    if (opener && root.contains(opener)) open(opener);
  }

  function onDialogPointerDown(event: Event) {
    pressTarget = event.target;
  }

  function onDialogClick(event: Event) {
    if (!dialog) return;
    const target = event.target;
    const pressed = pressTarget;
    pressTarget = null;

    // Klick auf den Hintergrund: Ziel ist das dialog-Element selbst.
    if (target === dialog) {
      if (pressed === null || pressed === dialog) dialog.close();
      return;
    }
    if (target instanceof Element && target.closest('[data-preview-close]')) dialog.close();
  }

  // Auch nach Escape: Der Browser löst `close` aus, ohne dass Code `close()` aufruft.
  function onDialogClose() {
    const origin = trigger;
    trigger = null;
    origin?.focus();
  }

  root.addEventListener('click', onRootClick);
  dialog?.addEventListener('pointerdown', onDialogPointerDown);
  dialog?.addEventListener('click', onDialogClick);
  dialog?.addEventListener('close', onDialogClose);

  return () => {
    root.removeEventListener('click', onRootClick);
    dialog?.removeEventListener('pointerdown', onDialogPointerDown);
    dialog?.removeEventListener('click', onDialogClick);
    dialog?.removeEventListener('close', onDialogClose);
    trigger = null;
    // Ein offener modaler Dialog sperrt das Scrollen (`body:has(dialog[open])`); vor dem
    // Seitenwechsel schließen.
    if (dialog?.open) dialog.close();
    reset();
    delete root.dataset.initialized;
  };
}
