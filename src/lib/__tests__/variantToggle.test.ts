import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_COLORS, VARIANT_STORAGE_KEY } from '../themeInit';
import { applyVariant, bindVariantToggle, currentVariant } from '../variantToggle';

const root = () => document.documentElement;

function themeColor() {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
}

function makeButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Bauplan-Ansicht');
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('data-variant-toggle', '');
  document.body.appendChild(button);
  return button;
}

function countVariantEvents() {
  const handler = vi.fn();
  window.addEventListener('systemwerk-variant', handler);
  return {
    handler,
    stop: () => window.removeEventListener('systemwerk-variant', handler),
  };
}

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

beforeEach(() => {
  root().removeAttribute('data-variant');
  root().classList.remove('variant-transition');
  document.head.innerHTML = `<meta name="theme-color" content="${THEME_COLORS.papier}">`;
  document.body.innerHTML = '';
  localStorage.clear();
  mockReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('currentVariant', () => {
  it('liest bauplan aus data-variant', () => {
    root().setAttribute('data-variant', 'bauplan');
    expect(currentVariant()).toBe('bauplan');
  });

  it('ergibt ohne Attribut und bei fremden Werten papier', () => {
    expect(currentVariant()).toBe('papier');
    root().setAttribute('data-variant', 'dark');
    expect(currentVariant()).toBe('papier');
  });

  it('liest ein übergebenes Wurzelelement', () => {
    const other = document.implementation.createHTMLDocument('x').documentElement;
    other.setAttribute('data-variant', 'bauplan');
    expect(currentVariant(other)).toBe('bauplan');
    expect(currentVariant()).toBe('papier');
  });
});

describe('applyVariant', () => {
  it('bauplan: setzt Attribut, Speicher, theme-color und sendet das Ereignis', () => {
    const events = countVariantEvents();
    applyVariant('bauplan');
    expect(root().getAttribute('data-variant')).toBe('bauplan');
    expect(localStorage.getItem(VARIANT_STORAGE_KEY)).toBe('bauplan');
    expect(themeColor()).toBe('#123b66');
    expect(events.handler).toHaveBeenCalledTimes(1);
    events.stop();
  });

  it('papier: entfernt das Attribut und schreibt papier', () => {
    applyVariant('bauplan');
    const events = countVariantEvents();
    applyVariant('papier');
    expect(root().hasAttribute('data-variant')).toBe(false);
    expect(localStorage.getItem(VARIANT_STORAGE_KEY)).toBe('papier');
    expect(themeColor()).toBe('#eeeee6');
    expect(events.handler).toHaveBeenCalledTimes(1);
    events.stop();
  });

  it('persist: false schreibt nicht in den Speicher, schaltet aber um', () => {
    applyVariant('bauplan', { persist: false });
    expect(root().getAttribute('data-variant')).toBe('bauplan');
    expect(localStorage.getItem(VARIANT_STORAGE_KEY)).toBeNull();
  });

  it('behandelt einen ungültigen Wert wie papier', () => {
    applyVariant('bauplan');
    applyVariant('dark' as never);
    expect(root().hasAttribute('data-variant')).toBe(false);
    expect(localStorage.getItem(VARIANT_STORAGE_KEY)).toBe('papier');
  });

  it('bleibt wirksam und wirft nicht, wenn setItem wirft', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Kontingent', 'QuotaExceededError');
    });
    const events = countVariantEvents();
    expect(() => applyVariant('bauplan')).not.toThrow();
    expect(root().getAttribute('data-variant')).toBe('bauplan');
    expect(themeColor()).toBe('#123b66');
    expect(events.handler).toHaveBeenCalledTimes(1);
    events.stop();
  });

  it('kommt ohne meta[name=theme-color] aus', () => {
    document.head.innerHTML = '';
    expect(() => applyVariant('bauplan')).not.toThrow();
    expect(root().getAttribute('data-variant')).toBe('bauplan');
  });

  it('liest die Systemfarbwahl nicht', () => {
    applyVariant('papier');
    const queries = (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => String(call[0])
    );
    expect(queries.some((q) => q.includes('prefers-color-scheme'))).toBe(false);
  });
});

describe('applyVariant: Transition', () => {
  it('animate: setzt variant-transition und entfernt sie nach 240 ms', () => {
    vi.useFakeTimers();
    applyVariant('bauplan', { animate: true });
    expect(root().classList.contains('variant-transition')).toBe(true);
    vi.advanceTimersByTime(239);
    expect(root().classList.contains('variant-transition')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(root().classList.contains('variant-transition')).toBe(false);
  });

  it('ein zweiter Wechsel innerhalb der Zeit verlängert das Fenster statt es früh zu beenden', () => {
    vi.useFakeTimers();
    applyVariant('bauplan', { animate: true });
    vi.advanceTimersByTime(200);
    applyVariant('papier', { animate: true });
    vi.advanceTimersByTime(100);
    expect(root().classList.contains('variant-transition')).toBe(true);
    vi.advanceTimersByTime(140);
    expect(root().classList.contains('variant-transition')).toBe(false);
  });

  it('ohne animate wird die Klasse nie gesetzt', () => {
    vi.useFakeTimers();
    applyVariant('bauplan');
    expect(root().classList.contains('variant-transition')).toBe(false);
    vi.advanceTimersByTime(500);
    expect(root().classList.contains('variant-transition')).toBe(false);
  });

  it('unter prefers-reduced-motion: reduce wird die Klasse nie gesetzt', () => {
    vi.useFakeTimers();
    mockReducedMotion(true);
    applyVariant('bauplan', { animate: true });
    expect(root().classList.contains('variant-transition')).toBe(false);
    expect(root().getAttribute('data-variant')).toBe('bauplan');
  });

  it('ohne matchMedia wird trotzdem umgeschaltet', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(() => applyVariant('bauplan', { animate: true })).not.toThrow();
    expect(root().getAttribute('data-variant')).toBe('bauplan');
  });
});

describe('bindVariantToggle', () => {
  it('liest beim Binden den Zustand aus data-variant', () => {
    root().setAttribute('data-variant', 'bauplan');
    const button = makeButton();
    bindVariantToggle(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('beginnt bei Papier mit aria-pressed=false', () => {
    const button = makeButton();
    bindVariantToggle(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('ist idempotent: zweimal binden, ein Klick schaltet genau einmal', () => {
    const button = makeButton();
    const events = countVariantEvents();
    bindVariantToggle(button);
    bindVariantToggle(button);
    button.click();
    expect(events.handler).toHaveBeenCalledTimes(1);
    expect(root().getAttribute('data-variant')).toBe('bauplan');
    events.stop();
  });

  it('zwei Klicks führen zum Ausgangszustand zurück', () => {
    const button = makeButton();
    bindVariantToggle(button);
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem(VARIANT_STORAGE_KEY)).toBe('bauplan');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(root().hasAttribute('data-variant')).toBe(false);
    expect(localStorage.getItem(VARIANT_STORAGE_KEY)).toBe('papier');
  });

  it('ändert den zugänglichen Namen nie', () => {
    const button = makeButton();
    bindVariantToggle(button);
    button.click();
    expect(button.getAttribute('aria-label')).toBe('Bauplan-Ansicht');
    button.click();
    expect(button.getAttribute('aria-label')).toBe('Bauplan-Ansicht');
  });

  it('animiert die Umschaltung per Klick', () => {
    vi.useFakeTimers();
    const button = makeButton();
    bindVariantToggle(button);
    button.click();
    expect(root().classList.contains('variant-transition')).toBe(true);
    vi.advanceTimersByTime(240);
    expect(root().classList.contains('variant-transition')).toBe(false);
  });

  it('nach einem Seitenwechsel bindet ein neuer Button, der alte Listener reagiert nicht mehr doppelt', () => {
    const first = makeButton();
    bindVariantToggle(first);
    first.remove();
    const second = makeButton();
    const events = countVariantEvents();
    bindVariantToggle(second);
    second.click();
    expect(events.handler).toHaveBeenCalledTimes(1);
    events.stop();
  });

  it('schaltet auch bei blockiertem Speicher um und wirft nicht', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('blockiert', 'SecurityError');
    });
    const button = makeButton();
    bindVariantToggle(button);
    expect(() => button.click()).not.toThrow();
    expect(root().getAttribute('data-variant')).toBe('bauplan');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
