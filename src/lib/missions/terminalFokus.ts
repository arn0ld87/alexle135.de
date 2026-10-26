// Escape gehört dem Terminal (xterm, #151): Overlays der Spieloberfläche schließen per Escape nur,
// wenn der Fokus außerhalb davon liegt. Gemeinsame Prüfung für Verlauf, Akte und Dialoge (#170).

/** Liegt der Fokus im Terminal (xterm-Eingabefeld oder Terminal-Container)? */
export function fokusImTerminal(): boolean {
  const el = document.activeElement;
  return el instanceof Element && el.closest('.xterm, [data-testid="v86-terminal"]') !== null;
}

const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex="0"]';

/** Fokusfalle: Tab und Umschalt+Tab bleiben im Container; liegt der Fokus draußen, zieht Tab ihn hinein. */
export function haltFokusIn(e: KeyboardEvent, container: HTMLElement | null): void {
  if (e.key !== 'Tab' || !container) return;
  const ziele = [...container.querySelectorAll<HTMLElement>(FOKUSSIERBAR)].filter(
    (el) => {
      if (el.closest('[hidden]') !== null) return false;
      const zu = el.closest('details:not([open])');
      return zu === null || el.parentElement === zu;
    }
  );
  const erstes = ziele[0];
  const letztes = ziele[ziele.length - 1];
  if (!erstes || !letztes) return;
  const aktiv = document.activeElement;
  if (!(aktiv instanceof Node) || !container.contains(aktiv)) {
    e.preventDefault();
    erstes.focus();
  } else if (e.shiftKey && aktiv === erstes) {
    e.preventDefault();
    letztes.focus();
  } else if (!e.shiftKey && aktiv === letztes) {
    e.preventDefault();
    erstes.focus();
  }
}
