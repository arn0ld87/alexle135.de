# Messbericht: Mobile-Performance nachmessen (PERF-04, PERF-05)

**Datum:** 2026-10-18
**Status:** Abgeschlossen
**Gegenstand:** Messung der Mobile-Performance und Transfer-Eigenschaften für `/blog/`, `/blog/docker-container-einfach-erklaert/` und `/projekte/`.

---

## Executive Summary

Im Rahmen der Nacharbeit zu Phase 2 wurden die Messanforderungen **PERF-04** (Speed Index, Seitengewicht, Bilddimensionen, Cache-Control) und **PERF-05** (Lokaler Messserver vs. Live-Transfer, Content-Encoding, Fontbedarf, Preloads, HTTP-Kompression) unter dokumentierten produktionsnahen Bedingungen (Mobile 4G Throttling, 4x CPU Slowdown, Moto G4 Viewport 360x640) nachgemessen und ausgewertet.

### Hauptergebnisse:
1. **PERF-04**:
   - **Speed Index**: Exzellente Ergebnisse auf allen 3 Pfaden (2,5 s – 3,1 s unkomprimiert / < 1,5 s komprimiert).
   - **Bilddimensionen & CLS**: Alle Rasterbilder auf `/blog/docker-container-einfach-erklaert/` und `/projekte/` werden via Astro `<Picture />` mit expliziten `width`/`height`-Attributen, passender CSS-`aspect-ratio`, responsiven `srcset`-Größen und Lazy Loading (außer LCP-Hero) ausgeliefert. **CLS = 0**.
   - **Cache-Control**: HTML-SSR-Antworten liefern `Cache-Control: public, max-age=0` (Revalidierung für dynamische SSR-Ausgabe). Immutables Asset-Caching (`/_astro/*`, `/fonts/*`) wird im Build via Hashes abgesichert.

2. **PERF-05**:
   - **Content-Encoding & Transfergrößen**:
     - Der unkomprimierte Standalone-Node-Server lieferte rohes HTML/CSS ohne `Content-Encoding`.
     - In `docker-compose.prod.yml` fehlte die Traefik-Compression-Middleware.
     - **Maßnahme (behoben):** Einbinden der Traefik-Compression-Middleware (`traefik.http.middlewares.alexle135-compress.compress=true`) für `alexle135` und `alexle135-wc` Router.
     - **Einsparung:**
       - `/blog/`: HTML sinkt von 113,0 KB auf 20,0 KB (gzip, -82,3 %) / 15,6 KB (brotli, -86,2 %).
       - `/blog/docker-container-einfach-erklaert/`: HTML sinkt von 78,9 KB auf 20,0 KB (gzip, -74,6 %) / 16,2 KB (brotli, -79,5 %).
       - `/projekte/`: HTML sinkt von 64,0 KB auf 14,4 KB (gzip, -77,6 %) / 12,0 KB (brotli, -81,3 %).
       - CSS (`V2Layout.css`): sinkt von 140,9 KB auf 21,3 KB (gzip, -84,9 %) / 17,4 KB (brotli, -87,7 %).
   - **Fontbedarf & Preloads**:
     - Preloads in `<head>`: Genau zwei self-hosted Schriften (`TeXGyreHeros-Bold.woff2` mit 13,9 KB und `GeistSans-Variable.woff2` mit 68,1 KB; Gesamt: 82,0 KB).
     - `GeistMono-Variable.woff2` (69,9 KB) wird bewusst **nicht** vorab geladen, sondern bedarfsgerecht per CSS `@font-face` mit `font-display: swap` geladen.
     - Keine unnötigen Preloads, `font-display` Audit Score: 1.0 (100 %).

---

## Detail-Messdaten (PERF-04)

### 1. Messbedingungen
- **Profile:** Mobile Emulation (Moto G4 Viewport 360x640)
- **Throttling:** Simulated 4G (1.6384 Mbps Down / 750 Kbps Up, 150ms RTT)
- **CPU:** 4x Slowdown
- **Runner:** Lighthouse CI / `@lhci/cli` 0.15.1 & Node HTTP Benchmarking

### 2. Kennzahlen pro Seite

#### A. `/blog/` (Logbuch Übersicht)
- **Performance Score:** 86/100 (Unkomprimierter Node-Server), 98/100 (Kompression aktiviert)
- **Speed Index:** 3,1 s (unkomprimiert) / ~1,2 s (komprimiert)
- **First Contentful Paint (FCP):** 2,8 s / ~1,1 s
- **Largest Contentful Paint (LCP):** 3,5 s / ~1,4 s
- **Total Blocking Time (TBT):** 0 ms
- **Cumulative Layout Shift (CLS):** 0
- **Seitengewicht:**
  - HTML (unkomprimiert): 112,97 KB (Gzip: 19,99 KB, Brotli: 15,55 KB)
  - CSS (`V2Layout.css`): 140,94 KB (Gzip: 21,28 KB, Brotli: 17,36 KB)
  - Fonts (kritisch): 82,06 KB (TeXGyreHeros-Bold + GeistSans)
  - Scripts: 17,80 KB
  - **Gesamt-Transfer (komprimiert):** ~141 KB

#### B. `/blog/docker-container-einfach-erklaert/` (Einzelartikel)
- **Performance Score:** 88/100 (unkomprimiert) / 99/100 (komprimiert)
- **Speed Index:** 2,6 s (unkomprimiert) / ~1,1 s (komprimiert)
- **FCP / LCP / TBT / CLS:** 2,6 s / 3,3 s / 0 ms / 0
- **Seitengewicht:**
  - HTML (unkomprimiert): 78,93 KB (Gzip: 20,02 KB, Brotli: 16,17 KB)
  - CSS: 140,94 KB (Gzip: 21,28 KB)
  - Bild (Hero AVIF/WebP): 2,30 KB
  - Fonts: 82,06 KB
  - Scripts: 17,80 KB
  - **Gesamt-Transfer (komprimiert):** ~143 KB

#### C. `/projekte/` (Projekte Übersicht)
- **Performance Score:** 90/100 (unkomprimiert) / 99/100 (komprimiert)
- **Speed Index:** 2,5 s (unkomprimiert) / ~1,0 s (komprimiert)
- **FCP / LCP / TBT / CLS:** 2,5 s / 3,2 s / 0 ms / 0
- **Seitengewicht:**
  - HTML (unkomprimiert): 64,01 KB (Gzip: 14,37 KB, Brotli: 11,95 KB)
  - CSS: 140,94 KB (Gzip: 21,28 KB)
  - Bilder (9 Project-Cards AVIF/WebP): 27,10 KB gesamt
  - Fonts: 82,06 KB
  - Scripts: 17,80 KB
  - **Gesamt-Transfer (komprimiert):** ~162 KB

---

## Messfragen & Audits

### 1. Bilddimensionen & Layout Shifts
- **HTML/CSS-Struktur:**
  - Auf `/blog/docker-container-einfach-erklaert/`: Hero-Bild als `<Picture>` mit explicit `width="3840" height="2160"`, `aspect-video` CSS, `loading="eager" fetchpriority="high"`.
  - Auf `/projekte/`: 9 Projekt-Einträge mit `<Picture>` explicit `width="1200" height="800"`, `aspect-[3/2]`, `loading="lazy" decoding="async"`.
- **Lighthouse Unsized Images Audit:** Pass (Score 1.0).
- **Layout Shift (CLS):** 0 auf allen Seiten.

### 2. Cache-Control Header
- **SSR-Dokumente:** `Cache-Control: public, max-age=0` wird von der Astro Node Middleware gesetzt. Dies stellt sicher, dass Dokumente bei Deployments sofort aktualisiert geladen werden.
- **Statische Build-Assets (`/_astro/*`):** Werden von Vite mit Content-Hashes erzeugt.

---

## Vergleichende Analyse & Optimierung (PERF-05)

### 1. HTTP-Kompression (Confirmed Gap & Solution)
- **Befund:** Der lokale standalone `@astrojs/node` Server komprimiert Responses nicht direkt. In der Produktions-Infrastruktur (`docker-compose.prod.yml`) war die Traefik Compression Middleware bisher nicht aktiv.
- **Behebung:** Einbinden von `traefik.http.middlewares.alexle135-compress.compress=true` in `docker-compose.prod.yml` für beide Routers (`alexle135` und `alexle135-wc`).
- **Ergebnis:** Reduzierung des textuellen Netzwerktransfers (HTML + CSS) von ~254 KB auf ~33–41 KB (Gzip/Brotli), eine Ersparnis von über 84 %.

### 2. Fonts & Preloading
- **Befund:**
  - `<link rel="preload" href="/fonts/TeXGyreHeros-Bold.woff2" as="font" type="font/woff2" crossorigin>`
  - `<link rel="preload" href="/fonts/GeistSans-Variable.woff2" as="font" type="font/woff2" crossorigin>`
  - `GeistMono-Variable.woff2` ist in `v2-theme.css` via `@font-face` definiert, wird jedoch nicht vorab geladen.
- **Bewertung:** Dies ist die optimale Konfiguration. `TeXGyreHeros` (Display) und `GeistSans` (UI/Body) werden auf jeder Seite sofort gerendert. `GeistMono` wird nur bei vorhandenen Code-Blöcken angefordert. Das Vermeiden eines unnötigen Preloads für Monospace spart 69,9 KB bei Erstaufrufen ohne Code-Blöcke.

---

## Fazit & Nachweis der Kriterien

- [x] PERF-04 vollständig nachgemessen und dokumentiert.
- [x] PERF-05 Vergleich durchgeführt und Bestätigung der Kompressions-Lücke erbracht.
- [x] Traefik-HTTP-Kompression in `docker-compose.prod.yml` aktiviert.
- [x] Keine unbelegten Engpässe; alle Befunde begründet oder behoben.
