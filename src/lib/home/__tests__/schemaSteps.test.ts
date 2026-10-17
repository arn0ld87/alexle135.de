import { afterEach, describe, expect, it } from 'vitest';
import { bindSchema } from '../schemaSteps';

/** Fixture als geparstes Fragment einsetzen, ohne Markup-Zuweisung an Elementeigenschaften. */
function setBody(html: string) {
  document.body.replaceChildren(document.createRange().createContextualFragment(html));
}

const STEPS = [
  ['quellen', '01 / Quellen', 'Dokumente und Webseiten werden aufgenommen.'],
  ['graph', '02 / Wissensgraph', 'Neo4j speichert Entitäten und Beziehungen.'],
  ['agenten', '03 / Agenten', 'Aus dem Graph entstehen Personas.'],
  ['pruefung', '04 / Prüfung', 'Der Report prüft die Evidenz.'],
  ['bericht', '05 / Bericht', 'Der Report trennt Quellen und Hypothesen.'],
] as const;

function mount(steps: readonly (readonly [string, string, string])[] = STEPS) {
  setBody(`
    <div data-schema>
      <div>
        ${steps
          .map(
            ([key]) =>
              `<button type="button" data-schema-node="${key}" aria-pressed="false" disabled><span>${key}</span></button>`
          )
          .join('')}
      </div>
      <div data-schema-detail aria-live="polite" hidden>
        <span data-schema-detail-label></span>
        <p data-schema-detail-text></p>
      </div>
      <ol data-schema-list>
        ${steps
          .map(
            ([key, label, text]) =>
              `<li data-schema-step="${key}"><strong data-schema-step-label>${label}</strong> <span data-schema-step-text>${text}</span></li>`
          )
          .join('')}
      </ol>
    </div>`);
  const root = document.querySelector<HTMLElement>('[data-schema]')!;
  return {
    root,
    nodes: [...root.querySelectorAll<HTMLButtonElement>('[data-schema-node]')],
    detail: root.querySelector<HTMLElement>('[data-schema-detail]')!,
    label: root.querySelector<HTMLElement>('[data-schema-detail-label]')!,
    text: root.querySelector<HTMLElement>('[data-schema-detail-text]')!,
    list: root.querySelector<HTMLElement>('[data-schema-list]')!,
  };
}

const pressed = (nodes: HTMLElement[]) => nodes.map((node) => node.getAttribute('aria-pressed'));

afterEach(() => {
  document.body.replaceChildren();
});

describe('Markup ohne Bindung', () => {
  it('zeigt alle fünf Texte in der Liste und markiert keinen Knoten als gedrückt', () => {
    const view = mount();
    expect(view.list.hidden).toBe(false);
    expect(view.list.querySelectorAll('li')).toHaveLength(5);
    expect(pressed(view.nodes)).toEqual(['false', 'false', 'false', 'false', 'false']);
    expect(view.detail.hidden).toBe(true);
  });

  it('liefert die Knoten deaktiviert aus, damit sie ohne JavaScript nicht bedienbar wirken', () => {
    const view = mount();
    expect(view.nodes.map((node) => node.disabled)).toEqual([true, true, true, true, true]);
  });
});

describe('bindSchema', () => {
  it('schaltet die Knoten beim Binden frei und beim Aufräumen wieder ab', () => {
    const view = mount();
    const unbind = bindSchema(view.root);
    expect(view.nodes.map((node) => node.disabled)).toEqual([false, false, false, false, false]);

    unbind();
    expect(view.nodes.map((node) => node.disabled)).toEqual([true, true, true, true, true]);
  });

  it('aktiviert beim Binden den ersten Knoten, füllt das Detailfeld und verbirgt die Liste', () => {
    const view = mount();
    bindSchema(view.root);

    expect(pressed(view.nodes)).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(view.detail.hidden).toBe(false);
    expect(view.label.textContent).toBe('01 / Quellen');
    expect(view.text.textContent).toBe('Dokumente und Webseiten werden aufgenommen.');
    expect(view.list.hidden).toBe(true);
  });

  it('macht mit einem Klick genau den gewählten Knoten aktiv und schreibt seinen Text ins Detailfeld', () => {
    const view = mount();
    bindSchema(view.root);

    view.nodes[3].click();

    expect(pressed(view.nodes)).toEqual(['false', 'false', 'false', 'true', 'false']);
    expect(view.label.textContent).toBe('04 / Prüfung');
    expect(view.text.textContent).toBe('Der Report prüft die Evidenz.');
  });

  it('findet den Knoten auch bei einem Klick auf ein Kindelement', () => {
    const view = mount();
    bindSchema(view.root);

    view.nodes[1].querySelector('span')!.click();

    expect(pressed(view.nodes)).toEqual(['false', 'true', 'false', 'false', 'false']);
  });

  it('lässt den aktiven Knoten bei erneutem Klick aktiv', () => {
    const view = mount();
    bindSchema(view.root);

    view.nodes[2].click();
    view.nodes[2].click();

    expect(pressed(view.nodes)).toEqual(['false', 'false', 'true', 'false', 'false']);
  });

  it('liest den Text aus dem Listeneintrag und setzt ihn als Text, nicht als Markup', () => {
    const view = mount([
      ['quellen', '01 / Quellen', 'a'],
      ['graph', '02 / Wissensgraph', 'platzhalter'],
    ]);
    // Der Listentext ist Text mit spitzen Klammern (so rendert Astro ein maskiertes Zeichen).
    view.list.querySelectorAll('[data-schema-step-text]')[1].textContent =
      '<img src=x onerror=alert(1)> & mehr';
    bindSchema(view.root);

    view.nodes[1].click();

    expect(view.text.textContent).toBe('<img src=x onerror=alert(1)> & mehr');
    expect(view.text.querySelector('img')).toBeNull();
  });

  it('ändert nichts, wenn zu einem Knoten kein Listeneintrag gehört', () => {
    const view = mount();
    view.nodes[4].setAttribute('data-schema-node', 'unbekannt');
    bindSchema(view.root);

    view.nodes[4].click();

    expect(pressed(view.nodes)).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(view.label.textContent).toBe('01 / Quellen');
  });

  it('bindet dasselbe Element nur einmal (dataset.initialized)', () => {
    const view = mount();
    bindSchema(view.root);
    expect(view.root.dataset.initialized).toBe('true');

    const cleanupOfSecondBind = bindSchema(view.root);
    cleanupOfSecondBind();

    // Die zweite Bindung ist wirkungslos: Die erste bleibt aktiv.
    expect(view.root.dataset.initialized).toBe('true');
    expect(view.list.hidden).toBe(true);
    view.nodes[2].click();
    expect(pressed(view.nodes)).toEqual(['false', 'false', 'true', 'false', 'false']);
  });

  it('zeigt mit der Aufräumfunktion die Liste wieder und entfernt die Listener', () => {
    const view = mount();
    const cleanup = bindSchema(view.root);
    view.nodes[2].click();

    cleanup();

    expect(view.list.hidden).toBe(false);
    expect(view.detail.hidden).toBe(true);
    expect(pressed(view.nodes)).toEqual(['false', 'false', 'false', 'false', 'false']);
    expect(view.root.dataset.initialized).toBeUndefined();

    view.nodes[1].click();
    expect(pressed(view.nodes)).toEqual(['false', 'false', 'false', 'false', 'false']);
  });

  it('tut nichts, wenn das Element keine Knoten enthält', () => {
    setBody('<div data-schema></div>');
    const root = document.querySelector<HTMLElement>('[data-schema]')!;
    expect(() => bindSchema(root)()).not.toThrow();
    expect(root.dataset.initialized).toBeUndefined();
  });
});
