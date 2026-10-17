import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindPreview } from '../previewDialog';

/** Fixture als geparstes Fragment einsetzen, ohne Markup-Zuweisung an Elementeigenschaften. */
function setBody(html: string) {
  document.body.replaceChildren(document.createRange().createContextualFragment(html));
}

// jsdom kennt von HTMLDialogElement nur `open`; showModal/close werden hier nachgebildet.
type DialogProto = {
  showModal?: (this: HTMLDialogElement) => void;
  close?: (this: HTMLDialogElement) => void;
};
const proto = HTMLDialogElement.prototype as unknown as DialogProto;

function installDialog(showModal: 'ok' | 'throw' | 'missing') {
  if (showModal === 'ok') {
    proto.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
  } else if (showModal === 'throw') {
    proto.showModal = vi.fn(function () {
      throw new DOMException('Dialog ist nicht verbunden', 'InvalidStateError');
    });
  } else {
    delete proto.showModal;
  }
  proto.close = vi.fn(function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
}

interface MountOptions {
  withTemplate?: boolean;
  withDialog?: boolean;
}

function mount({ withTemplate = true, withDialog = true }: MountOptions = {}) {
  setBody(`
    <main>
      <section data-preview-root>
        <ul>
          <li>
            <a href="/projekte/a/">Projekt A</a>
            <button type="button" data-preview-open data-preview-template="tpl-a"
              data-preview-href="/projekte/a/" hidden><span>Vorschau</span></button>
            ${
              withTemplate
                ? `<template id="tpl-a">
                    <p data-preview-kicker>PROJEKT / VORSCHAU</p>
                    <h2 id="preview-title-a" data-preview-title>Projekt A</h2>
                    <p class="summary">Kurzfassung</p>
                    <a href="/projekte/a/">Zur Projektseite</a>
                    <button type="button" data-preview-close>Schließen</button>
                  </template>`
                : ''
            }
          </li>
          <li>
            <a href="/projekte/b/">Projekt B</a>
            <button type="button" data-preview-open data-preview-template="tpl-b"
              data-preview-href="/projekte/b/" hidden>Vorschau</button>
            <template id="tpl-b"><h2 id="preview-title-b" data-preview-title>Projekt B</h2></template>
          </li>
        </ul>
      </section>
      ${
        withDialog
          ? `<dialog data-preview-dialog>
              <div><p data-preview-kicker></p>
              <button type="button" data-preview-close>Schließen</button></div>
              <div data-preview-body></div>
            </dialog>`
          : ''
      }
    </main>`);
  const root = document.querySelector<HTMLElement>('[data-preview-root]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-preview-open]')];
  const dialog = document.querySelector<HTMLDialogElement>('[data-preview-dialog]');
  return {
    root,
    buttons,
    dialog: dialog!,
    body: dialog?.querySelector<HTMLElement>('[data-preview-body]') ?? null,
    kicker: dialog?.querySelector<HTMLElement>('[data-preview-kicker]') ?? null,
    headerClose:
      dialog?.querySelector<HTMLButtonElement>(':scope > div [data-preview-close]') ?? null,
  };
}

beforeEach(() => {
  installDialog('ok');
});

afterEach(() => {
  delete proto.showModal;
  delete proto.close;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('bindPreview: Öffnen', () => {
  it('blendet beim Binden die Vorschau-Buttons ein', () => {
    const view = mount();
    expect(view.buttons.every((button) => button.hidden)).toBe(true);
    bindPreview(view.root, { navigate: vi.fn() });
    expect(view.buttons.every((button) => !button.hidden)).toBe(true);
  });

  it('klont das template in den Körper, benennt den Dialog nach dem Titel, öffnet ihn modal und fokussiert „Schließen“', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });

    view.buttons[0].click();

    expect(proto.showModal).toHaveBeenCalledTimes(1);
    expect(view.dialog.open).toBe(true);
    expect(view.body!.querySelector('h2')?.textContent).toBe('Projekt A');
    expect(view.body!.querySelector('.summary')?.textContent).toBe('Kurzfassung');
    expect(view.dialog.getAttribute('aria-labelledby')).toBe('preview-title-a');
    expect(document.activeElement).toBe(view.headerClose);
    // Das template selbst bleibt unverändert (wiederverwendbar).
    expect(
      (document.getElementById('tpl-a') as HTMLTemplateElement).content.querySelector('h2')
    ).not.toBeNull();
  });

  it('übernimmt den Kicker aus dem geklonten Inhalt in die Kopfzeile', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });

    view.buttons[0].click();

    expect(view.kicker!.textContent).toBe('PROJEKT / VORSCHAU');
    expect(view.body!.querySelector('[data-preview-kicker]')).toBeNull();
  });

  it('ersetzt beim zweiten Öffnen den Inhalt des ersten', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });

    view.buttons[0].click();
    view.dialog.close();
    view.buttons[1].click();

    expect(view.body!.querySelectorAll('h2')).toHaveLength(1);
    expect(view.body!.querySelector('h2')?.textContent).toBe('Projekt B');
    expect(view.dialog.getAttribute('aria-labelledby')).toBe('preview-title-b');
  });

  it('zeigt Text, der wie Markup aussieht, als Text und erzeugt kein Element', () => {
    const view = mount();
    const template = document.getElementById('tpl-a') as HTMLTemplateElement;
    template.content.querySelector('.summary')!.textContent =
      '<img src=x onerror=alert(1)> & <b>fett</b>';
    bindPreview(view.root, { navigate: vi.fn() });

    view.buttons[0].click();

    const summary = view.body!.querySelector('.summary')!;
    expect(summary.textContent).toBe('<img src=x onerror=alert(1)> & <b>fett</b>');
    expect(summary.children).toHaveLength(0);
    expect(view.body!.querySelector('img')).toBeNull();
    expect(view.body!.querySelector('b')).toBeNull();
  });
});

describe('bindPreview: Rückfall auf die Detailseite', () => {
  it('navigiert zur Adresse aus data-preview-href, wenn das template fehlt', () => {
    const view = mount({ withTemplate: false });
    const navigate = vi.fn();
    bindPreview(view.root, { navigate });

    expect(() => view.buttons[0].click()).not.toThrow();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/projekte/a/');
    expect(view.dialog.open).toBe(false);
    expect(proto.showModal).not.toHaveBeenCalled();
  });

  it('navigiert, wenn showModal fehlt', () => {
    installDialog('missing');
    const view = mount();
    const navigate = vi.fn();
    bindPreview(view.root, { navigate });

    expect(() => view.buttons[0].click()).not.toThrow();

    expect(navigate).toHaveBeenCalledWith('/projekte/a/');
    expect(view.dialog.open).toBe(false);
  });

  it('navigiert, wenn showModal wirft, ohne Ausnahme nach außen und ohne halb gefüllten Dialog', () => {
    installDialog('throw');
    const view = mount();
    const navigate = vi.fn();
    bindPreview(view.root, { navigate });

    expect(() => view.buttons[0].click()).not.toThrow();

    expect(proto.showModal).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/projekte/a/');
    expect(view.dialog.open).toBe(false);
    expect(view.body!.childElementCount).toBe(0);
  });

  it('navigiert, wenn die Seite keinen Dialog enthält', () => {
    const view = mount({ withDialog: false });
    const navigate = vi.fn();
    bindPreview(view.root, { navigate });

    expect(() => view.buttons[0].click()).not.toThrow();

    expect(navigate).toHaveBeenCalledWith('/projekte/a/');
  });

  it('tut nichts, wenn weder Vorlage noch Adresse vorhanden sind', () => {
    const view = mount({ withTemplate: false });
    view.buttons[0].removeAttribute('data-preview-href');
    const navigate = vi.fn();
    bindPreview(view.root, { navigate });

    expect(() => view.buttons[0].click()).not.toThrow();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('bindPreview: Schließen', () => {
  it('schließt mit dem Schließen-Button in der Kopfzeile', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });
    view.buttons[0].click();

    view.headerClose!.click();

    expect(view.dialog.open).toBe(false);
  });

  it('schließt mit dem Schließen-Button im geklonten Inhalt', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });
    view.buttons[0].click();

    view.body!.querySelector<HTMLElement>('[data-preview-close]')!.click();

    expect(view.dialog.open).toBe(false);
  });

  it('schließt bei einem Klick auf den Hintergrund (Ziel ist das dialog-Element)', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });
    view.buttons[0].click();

    view.dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(view.dialog.open).toBe(false);
  });

  it('schließt nicht, wenn das Drücken im Inhalt begann und der Klick auf dem Hintergrund endet', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });
    view.buttons[0].click();

    // Textauswahl im Dialog, Maustaste über dem Hintergrund losgelassen.
    view
      .body!.querySelector('.summary')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    view.dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(view.dialog.open).toBe(true);
  });

  it('schließt nicht bei einem Klick auf den Inhalt', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });
    view.buttons[0].click();

    view.body!.querySelector<HTMLElement>('.summary')!.click();

    expect(view.dialog.open).toBe(true);
  });

  it('gibt den Fokus beim Ereignis close an den auslösenden Button zurück', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });

    view.buttons[1].focus();
    view.buttons[1].click();
    expect(document.activeElement).toBe(view.headerClose);

    view.dialog.close();

    expect(document.activeElement).toBe(view.buttons[1]);
  });

  it('gibt den Fokus auch nach Escape zurück (close ohne eigenen Aufruf)', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() });
    view.buttons[0].click();

    // Escape löst im Browser `cancel` und danach `close` aus, ohne dass Code `close()` ruft.
    view.dialog.removeAttribute('open');
    view.dialog.dispatchEvent(new Event('close'));

    expect(document.activeElement).toBe(view.buttons[0]);
  });
});

describe('bindPreview: Idempotenz und Aufräumen', () => {
  it('öffnet bei zweimaligem Binden desselben Elements genau einmal', () => {
    const view = mount();
    const navigate = vi.fn();
    bindPreview(view.root, { navigate });
    bindPreview(view.root, { navigate });

    view.buttons[0].click();

    expect(proto.showModal).toHaveBeenCalledTimes(1);
    expect(view.root.dataset.initialized).toBe('true');
  });

  it('schließt mit der Aufräumfunktion einen offenen Dialog, leert den Körper und entfernt die Listener', () => {
    const view = mount();
    const cleanup = bindPreview(view.root, { navigate: vi.fn() });
    view.buttons[0].click();
    expect(view.dialog.open).toBe(true);

    cleanup();

    expect(view.dialog.open).toBe(false);
    expect(view.body!.childElementCount).toBe(0);
    expect(view.root.dataset.initialized).toBeUndefined();

    view.buttons[0].click();
    expect(proto.showModal).toHaveBeenCalledTimes(1);
    expect(view.dialog.open).toBe(false);
  });

  it('lässt sich nach dem Aufräumen erneut binden', () => {
    const view = mount();
    bindPreview(view.root, { navigate: vi.fn() })();
    bindPreview(view.root, { navigate: vi.fn() });

    view.buttons[0].click();

    expect(view.dialog.open).toBe(true);
  });

  it('tut nichts, wenn die Wurzel keine Vorschau-Buttons enthält', () => {
    setBody('<section data-preview-root></section>');
    const root = document.querySelector<HTMLElement>('[data-preview-root]')!;
    expect(() => bindPreview(root, { navigate: vi.fn() })()).not.toThrow();
  });
});
