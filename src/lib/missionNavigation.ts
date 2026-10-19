// Die CSP hängt am Dokument, nicht an der URL: Header aus der HTTP-Antwort
// gelten nur für das Dokument, das der Browser wirklich lädt. Der
// Astro-ClientRouter tauscht beim Seitenwechsel nur das DOM; wer per Link von
// einer Seite mit Default-CSP auf eine Missions-Route wechselt, bleibt im alten
// Dokument ohne 'wasm-unsafe-eval' — v86 kann sein WebAssembly dann nicht
// kompilieren. Umgekehrt nähme ein client-seitiger Wechsel aus der
// Missions-Route die gelockerte Policy auf Seiten mit, die sie nicht wollen.
// Deshalb laufen Wechsel in eine oder aus einer Missions-Route immer als
// voller Seitenaufruf.

import { isMissionRoute } from './security-headers';

export function needsFullNavigation(from: URL, to: URL): boolean {
  if (from.origin !== to.origin) return false;
  if (from.pathname === to.pathname) return false;
  return isMissionRoute(from.pathname) || isMissionRoute(to.pathname);
}

// Ein abgebrochenes `astro:before-preparation` delegiert der Router an den
// Browser (`location.href = to.href`), also an einen vollen Seitenaufruf.
export function installMissionNavigationGuard(target: Document): void {
  target.addEventListener('astro:before-preparation', (event) => {
    const { from, to } = event as Event & { from: URL; to: URL };
    if (needsFullNavigation(from, to)) event.preventDefault();
  });
}
