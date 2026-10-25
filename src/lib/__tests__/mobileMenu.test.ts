import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindMobileMenu } from '../mobileMenu';

function renderMenu() {
  document.body.innerHTML = `
    <details id="mobile-menu" open><summary>Menü</summary><a href="/a">A</a></details>
    <p id="outside">außen</p>`;
  return document.getElementById('mobile-menu') as HTMLDetailsElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('bindMobileMenu', () => {
  it('schließt bei Klick außerhalb, nicht bei Klick im Menü', () => {
    const details = renderMenu();
    bindMobileMenu(details);
    details.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(details.open).toBe(true);
    document.getElementById('outside')!.click();
    expect(details.open).toBe(false);
  });

  it('bindet dasselbe Element nur einmal', () => {
    const details = renderMenu();
    const add = vi.spyOn(document, 'addEventListener');
    bindMobileMenu(details);
    bindMobileMenu(details);
    expect(add.mock.calls.filter(([type]) => type === 'click')).toHaveLength(1);
    add.mockRestore();
  });

  it('gibt den Dokument-Listener frei, damit kein altes Menü festgehalten wird', () => {
    const details = renderMenu();
    const cleanup = bindMobileMenu(details);
    cleanup();
    details.open = true;
    document.getElementById('outside')!.click();
    expect(details.open).toBe(true);
  });

  it('häuft über mehrere Seitenwechsel keine Dokument-Listener an', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    for (let i = 0; i < 3; i++) {
      const cleanup = bindMobileMenu(renderMenu());
      cleanup();
    }
    const added = add.mock.calls.filter(([type]) => type === 'click').length;
    const removed = remove.mock.calls.filter(([type]) => type === 'click').length;
    expect(removed).toBe(added);
    add.mockRestore();
    remove.mockRestore();
  });
});
