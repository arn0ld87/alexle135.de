# Information Architecture & Navigation

Stand 2026-10-15 (abgeglichen mit src/pages/ und src/components/v2/).

## 1. Sitemap (öffentlich)

```
/                       Startseite (Hero mit Bildmarke als Zeichenbild, Arbeiten, Ansatz, Logbuch, Kontakt)
/leistungen/            „Was ich kann" — Kompetenzprofil
/projekte/              Projektliste (Case-Einträge)
/projekte/[slug]/       Projekt-Detail (Content Collection)
/projekte/terminal-missionen/app/          „Ein Linux-Krimi“: Lernspiel auf echtem Alpine Linux im Browser (v86)
/projekte/windows-terminal-missionen/app/  Windows-Terminal-Lernapp: Simulation von CMD/PowerShell im Browser (kein echtes Windows)
/blog/                  Logbuch (Liste)
/blog/[slug]/           Artikel (MDX, OG-Bild via /og/{slug}.png)
/ueber-mich/            Person, Werdegang, Arbeitsweise
/fisi/                  FISI-Umschulung: Lernpfad + Status
/ai/ · /ki-agenten-lab/ KI-/Agenten-Seiten (beide noindex, nicht in der Sitemap)
/kompetenzen/           Skill-Matrix
/certifications/        Zertifikate (Wikidata-verknüpft)
/apps/                  App-Übersicht
/kontakt/ (+/danke/)    Kontaktformular → contact_messages
/status/                Betriebsstatus (noindex, nicht in der Sitemap, im Footer verlinkt)
/changelog/             Changelog (öffentlich, in der Sitemap, derzeit ohne eingehenden Link)
/design-system/         Design-System-Referenz (internes Werkzeug, noindex, nicht in der Sitemap)
/legal/impressum/ · /legal/datenschutz/ · /404
```

Admin unter `/admin/*` (Better Auth, Middleware-geschützt) — nicht Teil der öffentlichen IA.

## 2. Navigation

- **Header (Desktop + Mobile):** Was ich kann · Projekte · Über mich · Blog · Zertifikate · Kontakt. Logo → `/`.
- **Nicht im Header** (bewusst, Zweitebene über Footer/interne Links): fisi, ai, ki-agenten-lab, kompetenzen, apps, status, changelog, design-system.
- **Footer:** Spalten Navigation (/, leistungen, projekte, blog, certifications), Socials (GitHub ×2, LinkedIn, Facebook, Instagram, Threads, Mail), Rechtliches (Impressum, Datenschutz, Status). Kein Twitter/X.

## 3. URL-Regeln

- Trailing Slash, sprechende deutsche Slugs, Collections steuern Projekt-/Blog-Slugs.
- Canonical + Sitemap via `@astrojs/sitemap`; 404 mit Navigationsangebot.

## 4. Interne Verlinkung

- Blog-Artikel → RelatedPosts (thematisch) + CTA-Abschluss.
- Projekt-Detail → verwandte Projekte + Kontakt-CTA.
- Startseite verlinkt alle Kernbereiche oberhalb des Footers.
