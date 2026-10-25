/**
 * Ausweg aus der Tastaturfalle des Terminals (WCAG 2.1.2, #151).
 *
 * Im fokussierten Terminal gehört Tab der Shell (Vervollständigung). Wer allein mit der
 * Tastatur arbeitet, drückt Esc und danach Tab: Dieser Tab geht nicht an die Shell, sondern
 * verlässt das Terminal wie in jedem anderen Element. Jede andere Taste dazwischen hebt das
 * Vormerken auf, Esc selbst geht unverändert an die Shell (vi, Readline).
 */
export const TERMINAL_TAB_HINWEIS = 'Tab verlassen: Esc, dann Tab';

/** Handler für `Terminal.attachCustomKeyEventHandler`: `false` = xterm lässt die Taste dem Browser. */
export function createTabExitHandler(): (event: KeyboardEvent) => boolean {
  let escGedrueckt = false;
  return (event) => {
    if (event.type !== 'keydown') return true;
    if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const verlassen = escGedrueckt;
      escGedrueckt = false;
      return !verlassen;
    }
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return true;
    escGedrueckt = event.key === 'Escape';
    return true;
  };
}
