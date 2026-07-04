# Information Architecture & Navigation

## 1. Sitemap Structure

- **Home** (`/`)
  - Hero (Value Prop)
  - Featured Projects (Cards)
  - Services Teaser (List)
  - About Teaser (Bio)
  - Blog Latest (Grid)
  - Contact CTA
- **Über mich** (`/ueber-mich`)
  - Extended Bio
  - Career Timeline
  - Tech Stack / Skills
  - CV Download
- **Leistungen** (`/leistungen`)
  - Detailed Service Offerings
  - Process / Workflow
  - Pricing / Packages (optional)
  - FAQ
- **Projekte** (`/projekte`)
  - Project Archive (Filterable?)
  - **Single Project** (`/projekte/[slug]`)
    - Overview
    - Tech Stack
    - Solution
    - Gallery
- **Blog** (`/blog`)
  - Article List
  - **Single Post** (`/blog/[slug]`)
    - Content
    - TOC
    - Related Posts
- **Kontakt** (`/kontakt`)
  - Contact Form
  - Social Links
  - Availability Status
- **Legal**
  - Impressum (`/legal/impressum`)
  - Datenschutz (`/legal/datenschutz`)

## 2. Navigation Menus

### Main Header (Desktop)

1.  **Logo** (Home)
2.  **Links:**
    - Über mich
    - Leistungen
    - Projekte
    - Blog
3.  **Actions:**
    - Theme Toggle (Icon)
    - "Kontakt" (Button, Primary)

### Mobile Menu (Hamburger)

- Fullscreen Overlay (Glass)
- Large Links
- Social Icons at bottom

### Footer

- **Column 1:** Brand + Short mission statement.
- **Column 2:** Navigation (Sitemap).
- **Column 3:** Socials (GitHub, LinkedIn, Twitter/X).
- **Column 4:** Legal (Impressum, Datenschutz).
- **Bottom Bar:** Copyright © 2026 Alexander Schneider.

## 3. URL Structure

- Keep standard: `/category/slug`.
- Projects: `/projekte/projekt-name`.
- Blog: `/blog/article-name` (or `/blog/2026/article-name`).

## 4. Internal Linking Strategy

- **Home -> Projects:** "Mehr Projekte ansehen".
- **Home -> Services:** "Alle Leistungen".
- **Service -> Contact:** "Jetzt anfragen".
- **Project -> Contact:** "Projekt anfragen".
- **Blog -> Project:** "Siehe Fallstudie XYZ".
