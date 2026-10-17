# Design System: Systemwerk

Stand 2026-10-15.

Systemwerk ist die Gestaltungssprache von alex-schneider.dev: eckig, flach, mit Linien statt Schatten und einem einzigen Akzent. Es gibt zwei Ansichten, Papier (Standard) und Bauplan. Diese Doku beschreibt den Stand im Code. Die Werte leben in den Stylesheets; ein Test (`src/tests/design-doc.test.ts`) hält die Token-Tabelle unten deckungsgleich mit `src/styles/systemwerk.css` und schlägt fehl, sobald ein Wert abweicht oder ein Token in einer der beiden Quellen fehlt. Die lebende Referenz mit allen Farbfeldern, Primitiven und Komponenten ist die Seite `/design-system/`.

## Prinzipien

- Eckig: Alle Radius-Tokens sind 0, Karten, Felder und Buttons haben keine Rundung. Marker sind Quadrate. Rund sind nur funktionale Formen wie die Ladeanzeige, der runde Avatar und die Spur des Schalters.
- Flach: keine Schatten, keine Glasflächen, keine Verläufe. Tiefe entsteht durch Linien (1 px) und Flächenwechsel.
- Linien statt Rahmenflächen: Trennung läuft über Haarlinien in `--line`, nicht über Schatten oder Hintergrundtöne.
- Sparsamer Akzent: `--accent` markiert, füllt aber nie große Flächen. Die Regeln stehen unter „Akzentregel“.
- Zwei Ansichten: Papier ist der Standard, Bauplan ist eine bewusst gewählte Alternative. Beide teilen dieselben Token-Namen.
- Ohne Client-JavaScript lesbar: Astro rendert serverseitig, React-Islands hydratisieren nur bei echter Interaktivität (`client:visible`).
- Tokens statt Literale: Komponenten lesen Farben ausschließlich über `var(--token)` oder `color-mix()` darauf, nie als Hexwert.

## Tokens

Alle Farbwerte stehen in `src/styles/systemwerk.css`: Papier auf `:root`, Bauplan auf `:root[data-variant='bauplan']`. Der Wechsel setzt dieselben Namen am Wurzelelement neu, nie auf `body`.

| Token              | Papier    | Bauplan   | Einsatz                                                         |
| ------------------ | --------- | --------- | --------------------------------------------------------------- |
| `--paper`          | `#eeeee6` | `#123b66` | Seitenfläche                                                    |
| `--ink`            | `#252620` | `#e2ebee` | Text und Primärfläche                                           |
| `--muted`          | `#66685f` | `#aabfd1` | Nebentext, Meta-Zeilen                                          |
| `--line`           | `#c7c9bf` | `#527592` | Haarlinien und Rahmen                                           |
| `--accent`         | `#db4a26` | `#eb9877` | Marker, Keil, Fokusring, Unterstreichung, große Schrift, Grafik |
| `--panel`          | `#20231e` | `#082b4b` | dunkle Panel-Fläche                                             |
| `--panel-text`     | `#eeeee6` | `#e2ebee` | Text auf dem Panel                                              |
| `--accent-strong`  | `#b43716` | `#f2a98c` | farbiger kleiner Text, Hover-Fläche des Primärbuttons           |
| `--accent-press`   | `#9c2f13` | `#eb9877` | gedrückter Zustand des Primärbuttons                            |
| `--marker-on-ink`  | `#ed7650` | `#b8502a` | Marker auf einer Fläche in `--ink`                              |
| `--panel-accent`   | `#ed7650` | `#eb9877` | Akzent auf dem Panel                                            |
| `--panel-muted`    | `#b8bcb0` | `#aabfd1` | Nebentext auf dem Panel                                         |
| `--panel-edge`     | `#747a67` | `#6f94b3` | Rahmen des Panels                                               |
| `--panel-rule`     | `#55584e` | `#527592` | Trennlinien auf dem Panel                                       |
| `--danger`         | `#a3281a` | `#ffb4a6` | Fehlerzustand von Feldern                                       |
| `--selection-bg`   | `#e9c0b0` | `#eb9877` | Hintergrund der Textauswahl                                     |
| `--selection-text` | `#252620` | `#082b4b` | Text der Textauswahl                                            |

Die Terminal-Insel ist die einzige dauerhaft dunkle Fläche außerhalb des Panels. Ihre vier Tokens sind in beiden Ansichten gleich und stehen im zweiten `:root`-Block des Stylesheets:

- `--terminal-bg`: `#14181a`, Hintergrund
- `--terminal-fg`: `#e7e4da`, Text (Kontrast 14,05:1)
- `--terminal-fg-muted`: `#8b968e`, Nebentext (Kontrast 5,83:1)
- `--terminal-accent`: `#4ade80`, Akzent (Kontrast 10,25:1)

## Akzentregel

Der Akzent ist knapp, weil er nur als Markierung wirkt. Welcher Ton wo gilt:

- `--accent`: Marker-Quadrate (8 × 8 px), Keil der Bildmarke, Unterstreichung von Links (1 px, bei Hover 2 px), Fokusring (2 px), aktiver Balken (2 px), Grafik und Schrift ab 24 px normal bzw. 18,66 px fett. Auf `--paper` erreicht er in Papier 3,59:1 und genügt damit nur der Grafik- und Großschrift-Schwelle von 3:1.
- `--accent-strong`: kleiner Text, der farbig sein muss; Hover-Farbe großer Zeilentitel; Hover-Fläche des Primärbuttons. Nur auf Papierflächen, nie auf dem Panel.
- Links im Fließtext und kleiner Mono-Text stehen in `--ink` mit Akzent-Unterstrich oder Marker, nicht in Akzentfarbe.
- Auf dem Panel gelten `--panel-text`, `--panel-muted`, `--panel-accent`, `--panel-edge` und `--panel-rule`. `--accent-strong` und `--muted` sind dort verboten.
- Der Primärbutton hat im Ruhezustand die Fläche `--ink`, den Text `--paper` und ein Marker-Quadrat in `--marker-on-ink`. Er ist nie orange gefüllt.

Gemessene Kontraste (WCAG 2.x, ungerundet geprüft in `src/tests/contrast.test.ts`):

| Paar                                    | Schwelle | Papier  | Bauplan |
| --------------------------------------- | -------- | ------- | ------- |
| `--ink` auf `--paper`                   | 4,5:1    | 13,08:1 | 9,41:1  |
| `--muted` auf `--paper`                 | 4,5:1    | 4,85:1  | 6,01:1  |
| `--accent-strong` auf `--paper`         | 4,5:1    | 5,15:1  | 5,88:1  |
| `--accent` auf `--paper`                | 3:1      | 3,59:1  | 5,04:1  |
| `--paper` auf `--accent-strong`         | 4,5:1    | 5,15:1  | 5,88:1  |
| `--paper` auf `--accent-press`          | 4,5:1    | 6,36:1  | 5,04:1  |
| `--marker-on-ink` auf `--ink`           | 3:1      | 5,31:1  | 4,11:1  |
| `--panel-text` auf `--panel`            | 4,5:1    | 13,64:1 | 11,91:1 |
| `--panel-muted` auf `--panel`           | 4,5:1    | 8,22:1  | 7,60:1  |
| `--panel-accent` auf `--panel`          | 4,5:1    | 5,53:1  | 6,37:1  |
| `--panel-edge` auf `--panel`            | 3:1      | 3,58:1  | 4,50:1  |
| `--danger` auf `--paper`                | 4,5:1    | 6,26:1  | 6,69:1  |
| `--selection-text` auf `--selection-bg` | 4,5:1    | 9,17:1  | 6,37:1  |

Ausgenommen sind die reinen Trennlinien `--line` auf `--paper` und `--panel-rule` auf `--panel`; sie tragen keine Information.

Syntaxfarben der Codeblöcke: Shiki läuft mit dem Theme `css-variables`; die Variablen `--astro-code-*` stehen in `src/styles/systemwerk.css` und zeigen auf Panel-Tokens, folgen also der Variante. Es gibt keine eigenen Farbwerte, nur Panel-Tokens und eine Mischung zweier Panel-Tokens (Strings und Konstanten: 60 % `--panel-text`, 40 % `--panel-accent`). Zuordnung: Grundfarbe, Funktionen und Satzzeichen `--panel-text`, Schlüsselwörter und Links `--panel-accent`, Kommentare (zusätzlich kursiv) und Parameter `--panel-muted`. Jeder Ton erreicht 4,5:1 auf `--panel`, geprüft in `src/tests/contrast.test.ts`. Inline-Code im Fließtext steht ohne Backticks in Mono auf einer leicht getönten `--ink`-Fläche, ohne Radius.

## Typografie

Drei Schriften, alle selbst gehostet, keine externen Quellen:

- TeX Gyre Heros Bold: Display-Schrift für Hero, H1 und Section-H2 sowie das Outline-Wort. Heros liegt nur als Bold vor (`public/fonts/TeXGyreHeros-Bold.woff2`, Subset). Lizenz: GUST Font License, Text und Herkunft in `public/fonts/LICENSE-TeXGyreHeros.txt`. Eine Fallback-Schrift mit angepasster Laufweite (`size-adjust`) verhindert verschobene Zeilenumbrüche beim Laden.
- Geist: Fließtext und Oberfläche (`public/fonts/GeistSans-Variable.woff2`, Lizenz in `public/fonts/LICENSE-Geist.txt`).
- Geist Mono: Kicker, Labels, Meta-Zeilen und Terminal (`public/fonts/GeistMono-Variable.woff2`).

Genau zwei Gewichte: 400 und 700. Seiten setzen Überschriften ausschließlich mit den Display-Klassen; Größe, Zeilenhöhe und Tracking gehören zusammen und werden nicht lokal überschrieben.

| Klasse            | Schrift    | Größe (fließend)                       | Zeilenhöhe | Tracking | Einsatz                         |
| ----------------- | ---------- | -------------------------------------- | ---------- | -------- | ------------------------------- |
| `ds-display-hero` | Heros Bold | 40 bis 88 px, ab 1024 px 64 bis 104 px | 1          | -0,03em  | Hero der Startseite (einmal)    |
| `ds-display-xl`   | Heros Bold | 40 bis 64 px                           | 1,05       | -0,025em | Seiten-H1                       |
| `ds-display-l`    | Heros Bold | 32 bis 48 px                           | 1,1        | -0,02em  | Section-H2, CTA-Abschluss       |
| `ds-display-m`    | Geist Bold | 24 bis 32 px                           | 1,2        | -0,015em | Unterabschnitte, Featured-Titel |
| `ds-display-s`    | Geist Bold | 19 bis 24 px                           | 1,25       | -0,01em  | Karten- und Listentitel         |

- `ds-outline` setzt ein einzelnes Wort als Umriss. Genau eines je Seite, nur in H1 oder H2; es bleibt echter Text und fällt ohne Unterstützung für `-webkit-text-stroke` auf `--accent` zurück.
- Fließtext: Geist 17 px (`--ds-text-body`), Zeilenhöhe 1,55. Kleiner Text: 15 px (`--ds-text-sm`). Mikrotext in Geist Mono: 12 px (`--ds-text-label`), Versalien, Laufweite 0,08em. Unter 12 px steht nirgends sichtbarer Text.
- Die Größen der Display-Klassen liegen als `--text-display-hero` bis `--text-display-s` im Stylesheet.

## Layout

- Shell: `--shell-max` 1240 px, `--shell-narrow` 760 px für Text- und Blogspalten, `--shell-pad` fließend zwischen 20 und 44 px. Die Klasse `ds-shell` setzt Breite und seitlichen Innenabstand.
- Abstandsraster: 4 px. `--space-1` (4 px) bis `--space-12` (128 px) in den Stufen 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 104, 128 px.
- `--section-gap`: fließend 48 bis 64 px zwischen Abschnitten.
- Linienstärke: `--border-hair` 1 px, `--border-thick` 1,5 px.
- Radien: `--ds-radius-*` und die Tailwind-Schlüssel `--radius-*` sind alle 0.

## Primitive und Komponenten

Alle Primitive sind in `src/styles/systemwerk.css` definiert und lesen nur Tokens.

- `ds-pagehead`: Seitenkopf mit Kicker, H1 und Einleitung. Oben `--section-gap`, unten 64 px, untere Kante 1 px in `--line`. Dazu die Teile `ds-pagehead__title`, `ds-pagehead__lead` und `ds-pagehead__aside`.
- `ds-linegrid`: vier gleiche Spalten, getrennt durch Haarlinien, ab 768 px; reiner Hintergrund ohne zusätzliche Elemente.
- `ds-row`: Listenzeile mit 1 px Linie oben, die letzte auch unten, Innenabstand 24 px. Bei Hover und Fokus rückt der Inhalt (`ds-row__content`) um 8 px nach rechts und der Titel (`ds-row__title`) wird `--accent-strong`; nur bei `(hover: hover)`.
- `ds-card`: flache Karte mit 1 px Linie, Papierfläche, 24 px Innenabstand, ohne Schatten. Karten sind nie Panels.
- `ds-panel`: dunkles Panel (zusammen mit `data-surface="panel"`). Erlaubt sind nur der Footer, der CTA-Abschluss, die Agora-Karte und Code-Blöcke. Links darauf sind unterstrichen in `--panel-accent`.
- `ds-kicker`: Mono-Label in Versalien mit Marker-Quadrat 8 × 8 px in `--accent` (auf dem Panel `--panel-accent`).
- `ds-tag`: Mono-Tag mit 1 px Linie, eckig.
- `ds-meta` und `ds-meta--ink`: Meta-Zeile in Geist Mono 12 px, in `--muted` bzw. `--ink`.
- `ds-note`: Hinweisfläche mit linker Linie (2 px `--accent`), 4 % Tinte auf Papier, ohne Schatten.
- `ds-outline`: siehe Typografie.
- Buttons `axb`: Varianten über `data-variant` (`primary`, `secondary`, `ghost`, `terminal`, `danger`), Größen über `data-size` (`sm`, `lg`). Hover wirkt nur bei `(hover: hover)`. Keine Ad-hoc-Buttons bauen.
- Felder `axfield`, `axinput`, `axsel`, `axcheck`, `axswitch`: Beschriftung über `axfield`, Hinweis- und Fehlertext in `axfield-hint`, Fehlerzustand in `--danger`.
- Weitere Bausteine des Bestands: `axcard`, `axtag`, `axcallout`, `axtab` und `axtabs`, `axav`, `axbadge`, `axib`.

## Bauplanansicht

Die Bauplanansicht ist die zweite Ansicht: Blaupausenblau als Fläche, helle Tinte, ein 24-px-Raster statt des Papierrauschens.

- Zustand: das Attribut `data-variant="bauplan"` am Wurzelelement `html`. Papier ist der Zustand ohne Attribut.
- Speicher: `localStorage` unter dem Schlüssel `systemwerk-variant` mit den Werten `papier` und `bauplan`. Jeder andere Wert ergibt Papier.
- Standard ist Papier. Die Systemeinstellung für helles oder dunkles Erscheinungsbild wird nicht gelesen; die Ansicht wechselt nur über den Schalter im Header.
- Ein kleines Pre-Paint-Skript (`src/lib/themeInit.ts`) setzt die Ansicht vor dem ersten Paint und nach jedem Seitenwechsel, damit nichts aufblitzt. Es setzt keine Cookies und sendet nichts.
- Nach dem Wechsel löst das Fenster das Ereignis `systemwerk-variant` aus; Komponenten, die Farben zwischenspeichern (die Farbfelder auf `/design-system/`), lesen die Tokens daraufhin neu. Die Bildmarke im Hero braucht das nicht: sie liest ihre Farben direkt über `--ink`, `--accent` und `--line`.
- Druck ist immer Papier, auch bei gewählter Bauplanansicht: Das Stylesheet setzt die Papierwerte im Druck zurück, Panels werden zu Umrissen, Raster, Canvas und Schalter entfallen.
- Das Panel setzt seine Fläche deckend, damit weder Rauschen noch Raster durchscheinen.

## Bewegung

- Dauern: `--dur-instant` 90 ms, `--dur-fast` 150 ms, `--dur-base` 240 ms, `--dur-slow` 420 ms, `--dur-reveal` 720 ms.
- Kurven: `--ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`), `--ease-inout` (`cubic-bezier(0.65, 0, 0.35, 1)`), `--ease-entry` (`cubic-bezier(0.16, 1, 0.3, 1)`).
- Der Wechsel zwischen Papier und Bauplan überblendet Hintergrund-, Text- und Rahmenfarben in 240 ms, nur nach einer Nutzeraktion und nie beim ersten Laden.
- Reduzierte Bewegung (`prefers-reduced-motion: reduce`): alle `--dur-*` sind 0 ms, es gibt kein weiches Scrollen, die Zeilenverschiebung der Listen entfällt und der Wechsel der Ansicht erfolgt ohne Überblendung.

## Bildmarke

Die Bildmarke ist ein Inline-SVG in `src/components/v2/BrandMark.astro`. Der Körper erbt die Textfarbe (`currentColor`), der Keil liest `--accent`; damit bleibt die Marke in beiden Ansichten sichtbar. Die Datei `public/brand/as-mark.svg` bleibt unverändert für Favicon und feste URLs. Als reine Dekoration ist die Marke vor Hilfstechnik verborgen; wo sie allein steht, trägt sie ein `aria-label`.

Im Hero steht dieselbe Marke als Zeichenbild (`src/components/home/AsciiMark.astro`): die Körper-Ebene liest `--ink`, die Keil-Ebene `--accent`, die Drehachse und die Rahmenlinien `--line`. Die Marke liest ihre Farben direkt über diese Tokens und braucht das Ereignis `systemwerk-variant` deshalb nicht.

## OG-Bilder

Die Bilder für geteilte Links (`og:image`, `twitter:image`) entstehen serverseitig in `src/lib/og.ts` und zeigen immer die Papieransicht, unabhängig von der Ansicht der Besucher. Es gibt keinen Verlauf, keinen Glow, kein Rauschen und keinen Filter.

- Maße und Fläche: 1200 × 630 px, Fläche `--paper`, Rand 72 px. Der Renderer führt die Farben `--paper`, `--ink`, `--muted`, `--line` und `--accent` als Konstanten; ein Test hält sie wertgleich mit dem Papier-Block in `src/styles/systemwerk.css`.
- Schriften: TeX Gyre Heros Bold für Titel und Monogramm, Geist Mono für Kicker, Fußzeile und Meta. Der Renderer liest kein WOFF2; die Dateien liegen als `texgyreheros-bold.otf` und `GeistMono-Regular.ttf` unter `public/fonts/og/`. Fehlen sie, rendert er mit Systemschriften und schreibt eine Warnung; in einem Container ohne Systemschriften bliebe der Text dann leer.
- Titel: Heros Bold in `--ink`, links bei 72 px, erste Grundlinie bei 280 px. Größenleiter: 80 px bis zu zwei Zeilen, 72 px bei drei Zeilen, sonst 64 px; höchstens drei Zeilen, ein längerer Titel endet mit „…“. Der Umbruch folgt den Zeichenbreiten der Schrift. Ein leerer Titel zeigt „alex-schneider.dev“.
- Kicker, Monogramm und Linien: Oben links stehen ein Quadrat in `--accent` (16 × 16 px) und der Kicker in Geist Mono, Versalien, `--muted`: „BLOG“ oder „PROJEKT“, ohne Angabe „ALEX-SCHNEIDER.DEV“. Oben rechts steht das Monogramm „a/s“, der Schrägstrich in `--accent`. Darunter liegt die Akzentlinie (96 × 6 px, `--accent`). Über der Fußzeile verläuft eine Linie in `--line` (2 px).
- Fußzeile: links „alex-schneider.dev“ in `--ink`, rechts die Meta-Zeile in `--muted`. Blog: Datum und Lesezeit als „TT.MM.JJJJ · n MIN.“. Projekt: die ersten drei Einträge des Stacks, getrennt durch „ / “. Fehlt eine Angabe, fehlt sie im Bild.
- Inhalt: Ein OG-Bild zeigt nur, was im Eintrag steht, und die festen Bezeichner der Seite; keine Kennzahlen, Auszeichnungen oder Zustände. Die Abbildung von Eintrag auf Kicker und Meta steht in `src/lib/ogMeta.ts`.
- Standard-Banner: `public/media/alexle135-og-banner.png` (1200 × 630 px) entsteht aus demselben Renderer (`renderOgBannerPng`): Kicker „SYSTEMINTEGRATION / DEVOPS / KI“, der Name in 112 px auf zwei Zeilen, darunter „Systemintegration, DevOps und KI“ in Geist Mono, in der Fußzeile „Leipzig“. Der Pfad bleibt stabil, weil er in Social-Caches steht; bei Änderungen am Renderer wird die Datei neu erzeugt und überschrieben.
- Cache und Version: Die OG-Routen sind ein Jahr als `immutable` gecacht. Deshalb trägt jede Bild-Adresse der dynamischen Bilder und des Standard-Banners den Parameter `v` mit dem Wert aus `src/lib/ogVersion.ts`. Bei jeder sichtbaren Änderung am Renderer oder am Banner wird dieser Wert erhöht; ein eigenes Bild, das eine Seite übergibt, bleibt unversioniert.

## Bilder

Bildquellen liegen genau einmal unter `src/assets/`: Blogbilder in `blog/`, Projektbilder in `projects/` und das Porträt in `portrait/`. Die Collections nennen im Frontmatter relative Pfade wie `heroImage: ../../assets/blog/bild.webp`; das Schema prüft mit `image()`, ob die Datei vorhanden ist. Ein fehlendes Bild bricht den Build ab.

Die Ausgabe verwendet `Picture` aus `astro:assets` mit AVIF und WebP, `fallbackFormat="webp"`, `sizes` sowie festen `width`- und `height`-Attributen. Die Varianten entstehen im Build unter `/_astro/`. Transformationen stehen ausschließlich auf vorab gebauten Seiten; die serverseitig gerenderte Startseite verwendet kein Rasterbild.

| Einsatz                                | Breiten           |
| -------------------------------------- | ----------------- |
| Hero auf Blog- und Projektdetailseiten | 640, 960, 1440 px |
| Karten in der Projektliste             | 480, 800 px       |
| Porträt auf Über mich                  | 480, 720, 1080 px |

Breiten oberhalb der Quellbreite werden nicht erzeugt. Hero-Bilder laden mit `loading="eager"` und `fetchpriority="high"`; Kartenbilder laden verzögert. Der Alternativtext beschreibt den Inhalt des Bildes.

In `public/` bleiben Dateien mit festen Adressen: Favicons, `public/brand/`, OG-Banner, README-Logo, Videos und Bildsätze im rohen HTML eines Beitrags. Diese Dateien werden unverändert ausgeliefert.

Ein neues Bild hinzufügen:

1. Die Quelle unter `src/assets/blog/` oder `src/assets/projects/` ablegen; keine vorab erzeugten Größen- oder Formatdubletten hinzufügen.
2. `pnpm new:blog` oder `pnpm new:projekt` ausführen und den Dateinamen angeben. Das Werkzeug schreibt den relativen Frontmatter-Pfad nur für vorhandene Dateien; anschließend den passenden Alternativtext ergänzen.
3. `pnpm build` ausführen und die Ausgabe der Seite prüfen. Der Build erzeugt die benötigten Varianten automatisch.

### Gewicht der Bilder

`pnpm check:bundle` prüft nach dem JS-Budget drei Bildbudgets aus `bundlesize.config.json` (`budgets.images`): die größte Rasterdatei unter `dist/client` (`maxRasterFileKb`), die Summe der Rasterdateien unter `dist/client/_astro/` (`astroRasterTotalKb`) und das Bildgewicht der Startseite (`homeRasterKb`, 60 KB). Für die Startseite startet das Skript den gebauten Server und misst am ausgelieferten HTML. Eine Überschreitung beendet es mit Exit 1 und einer Zeile `FEHLER:`. SVG und Videos zählen nicht. Die beiden abgeleiteten Werte sind der Ist-Stand plus 15 %, aufgerundet; sie werden nur bewusst und mit Begründung angehoben.

Die Höhe des Budgets für die größte Rasterdatei erklärt sich aus den Vorschausätzen unter `public/media/*_preview.*` und `public/media/threads/`: Sie sind möglicherweise außerhalb des Repos verlinkt und bleiben deshalb liegen (Entscheidung zur Klasse B, Option c). Die größte von ihnen, `media/ansible_preview.png` mit rund 903 KB, steht als benannte Ausnahme im `$comment` der Konfiguration; ohne sie läge `maxRasterFileKb` bei 754 KB. Das Budget gilt trotzdem für alle Rasterdateien, auch für die der Klasse B; das Skript nimmt keine Datei von der Prüfung aus.

## Barrierefreiheit

- Kontrast: Die Paare im Abschnitt „Akzentregel“ werden in `src/tests/contrast.test.ts` für beide Ansichten geprüft; ein End-to-End-Lauf (`e2e/06-variant-a11y.spec.ts`) prüft Kontraste auf allen Seitentypen im Browser, darunter `/design-system/`.
- Fokus: ein Fokusring von 2 px in `--accent` mit Abstand; Listenzeilen und Karten zeigen ihren Hover-Effekt auch bei Fokus innerhalb (`:focus-within`).
- Keine Information allein per Hover; Hover-Effekte gelten nur bei `(hover: hover)`.
- Mindestschrift: sichtbarer Text mindestens 12 px.
- Erzwungene Farben (`forced-colors: active`): das Outline-Wort fällt auf `CanvasText` zurück.
- Reduzierte Bewegung siehe „Bewegung“.

## Quellen

- [src/styles/systemwerk.css](../src/styles/systemwerk.css): Tokens beider Ansichten, Komponentenklassen (`ds-*`, `ax*`)
- [src/styles/v2-theme.css](../src/styles/v2-theme.css): Tailwind-`@theme`, Schriftstapel, Schrift-Einbindung, Basis-Layout
- [src/lib/og.ts](../src/lib/og.ts): Renderer der OG-Bilder; [src/lib/ogMeta.ts](../src/lib/ogMeta.ts) und [src/lib/ogVersion.ts](../src/lib/ogVersion.ts) für Meta-Zeile und Versionskennung
- [src/tests/design-doc.test.ts](../src/tests/design-doc.test.ts): Abgleich dieser Doku mit dem Stylesheet
- `/design-system/`: lebende Referenzseite mit allen Farbfeldern, Primitiven und Komponenten
