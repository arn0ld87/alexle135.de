/**
 * Mobiles Menü im Header (`<details id="mobile-menu">`): schließt bei Klick außerhalb, bei
 * Escape und nach Klick auf einen Link.
 *
 * Der Header wird je Seite neu gerendert (kein `transition:persist`). Der Klick-Listener
 * hängt am `document` und hielte sonst mit jedem Seitenwechsel ein altes Menü fest; die
 * Aufräumfunktion aus der Rückgabe löst ihn in `astro:before-swap`. Bindung pro Element
 * genau einmal (`dataset.initialized`).
 */
export function bindMobileMenu(details: HTMLDetailsElement): () => void {
  if (details.dataset.initialized === 'true') return () => {};
  details.dataset.initialized = 'true';

  const onDocumentClick = (e: MouseEvent) => {
    if (!details.open) return;
    if (!details.contains(e.target as Node)) details.open = false;
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && details.open) {
      details.open = false;
      details.querySelector('summary')?.focus();
    }
  };
  const close = () => {
    details.open = false;
  };
  const links = Array.from(details.querySelectorAll('a'));

  document.addEventListener('click', onDocumentClick);
  details.addEventListener('keydown', onKeydown);
  links.forEach((a) => a.addEventListener('click', close));

  return () => {
    document.removeEventListener('click', onDocumentClick);
    details.removeEventListener('keydown', onKeydown);
    links.forEach((a) => a.removeEventListener('click', close));
    delete details.dataset.initialized;
  };
}
