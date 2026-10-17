/**
 * Schaltlogik für die Bauplan-Ansicht (Systemwerk, D-07, D-38, D-39).
 *
 * Der Zustand lebt als `data-variant` am `html`-Element; das Pre-Paint-Skript
 * aus `themeInit.ts` setzt ihn vor dem ersten Paint und nach jedem
 * Seitenwechsel. Dieses Modul schaltet nach einem Klick des Nutzers um,
 * speichert die Auswahl und zieht `theme-color` nach.
 *
 * Es liest die Farbschema-Präferenz des Systems nicht, setzt keine Cookies und
 * sendet nichts: Die Auswahl bleibt im Browser (D-38). Bindung des Schalters:
 * pro Button genau einmal (`dataset.initialized`), Listener am Button.
 */
import { THEME_COLORS, VARIANT_STORAGE_KEY, parseVariant, type Variant } from './themeInit';

/** Fensterereignis, auf das z. B. die Farbfelder auf `/design-system/` mit dem Neulesen der Tokens reagieren. */
export const VARIANT_EVENT = 'systemwerk-variant';

const TRANSITION_CLASS = 'variant-transition';
const TRANSITION_MS = 240;

let transitionTimer: ReturnType<typeof setTimeout> | undefined;

export interface ApplyVariantOptions {
  /** In `localStorage` schreiben (Standard: ja). */
  persist?: boolean;
  /** Farben für 240 ms weich überblenden; nur nach einer Nutzeraktion setzen. */
  animate?: boolean;
}

export function currentVariant(root: HTMLElement = document.documentElement): Variant {
  return parseVariant(root.dataset.variant);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function startTransition(root: HTMLElement) {
  root.classList.add(TRANSITION_CLASS);
  if (transitionTimer !== undefined) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
    transitionTimer = undefined;
  }, TRANSITION_MS);
}

export function applyVariant(variant: Variant, options: ApplyVariantOptions = {}): void {
  const { persist = true, animate = false } = options;
  const next = parseVariant(variant);
  const root = document.documentElement;

  // Klasse zuerst: Die Transition gilt für die Änderungen darunter.
  if (animate && !prefersReducedMotion()) startTransition(root);

  if (next === 'bauplan') root.dataset.variant = 'bauplan';
  else delete root.dataset.variant;

  if (persist) {
    try {
      localStorage.setItem(VARIANT_STORAGE_KEY, next);
    } catch {
      // Speicher blockiert oder voll: die Umschaltung gilt bis zum Neuladen.
    }
  }

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[next]);

  window.dispatchEvent(new Event(VARIANT_EVENT));
}

/**
 * Bindet den Schalter genau einmal. Der Zustand wird beim Binden aus
 * `data-variant` gelesen; der zugängliche Name ändert sich nie, der Zustand
 * steckt in `aria-pressed`.
 */
export function bindVariantToggle(button: HTMLButtonElement): void {
  if (button.dataset.initialized === 'true') return;
  button.dataset.initialized = 'true';

  button.setAttribute('aria-pressed', String(currentVariant() === 'bauplan'));

  button.addEventListener('click', () => {
    const next: Variant = currentVariant() === 'bauplan' ? 'papier' : 'bauplan';
    applyVariant(next, { animate: true });
    button.setAttribute('aria-pressed', String(next === 'bauplan'));
  });
}
