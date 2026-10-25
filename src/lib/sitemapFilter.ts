// Sitemap-Ausschlussregel für @astrojs/sitemap (Option `filter`).
// Ausgeschlossen werden:
//   /admin, /api         — geschützt/intern
//   /design-system       — Developer-Preview
//   /kontakt/danke       — Danke-Seite nach dem Absenden
//   /status              — Ops-Status, dünner Inhalt
//   /ai                  — englischer One-Pager für Bewerbungen, noindex
//   /ki-agenten-lab      — noindex, konsistent mit /ai
//   /blog/terminal-demo  — interne Demo, kein Produktiv-Content
//   /projekte/windows-terminal-missionen/app — WebContainer-Entrypoint, kein Index-Content
//   /apps/compose-builder — doppelte Utility-Oberfläche, über die stärkere Elternseite abgedeckt
// Die Linux-Krimi-Apps (Staffel 1 und 2) sind indexierbar und bleiben in der Sitemap.
const BLOCKED =
  /^\/(admin|api|ai|design-system|ki-agenten-lab|kontakt\/danke|status)(\/|$)|^\/apps\/compose-builder\/?$|^\/projekte\/windows-terminal-missionen\/app(\/|$)|^\/blog\/terminal-demo\/?$/;

export function isExcludedFromSitemap(pathname: string): boolean {
  return BLOCKED.test(pathname);
}

export function sitemapFilter(page: string): boolean {
  return !isExcludedFromSitemap(new URL(page).pathname);
}
