// Escape gehört dem Terminal (xterm, #151): Overlays der Spieloberfläche schließen per Escape nur,
// wenn der Fokus außerhalb davon liegt. Gemeinsame Prüfung für Verlauf, Akte und Dialoge (#170).

/** Liegt der Fokus im Terminal (xterm-Eingabefeld oder Terminal-Container)? */
export function fokusImTerminal(): boolean {
  const el = document.activeElement;
  return el instanceof Element && el.closest('.xterm, [data-testid="v86-terminal"]') !== null;
}
