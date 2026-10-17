---
title: Docker Compose Builder
category: Infrastruktur
summary: Ein visueller Generator für Compose-Stacks. Services auswählen, Abhängigkeiten injecten und sofort das fertige YAML kopieren.
tags:
  - Docker
  - DevOps
  - Tool
techStack: ['Astro', 'TypeScript', 'Docker Compose', 'UI Logic']
role: 'Produktidee, YAML-Generator & Build-to-copy UX'
frameLabel: 'Stack editor / generated compose output'
heroImage: ../../assets/projects/compose-builder.webp
publishedAt: 2025-11-21
featured: true
---

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-4">Warum das Tool?</h2>
    <p class="leading-relaxed">
      Ich hab früher jede docker-compose.yml von Hand geschrieben. Immer die gleichen Blöcke kopiert, Ports angepasst, Volumes vergessen. Irgendwann nervig.
    </p>
    <p class="leading-relaxed mt-4">
      Der Docker Compose Builder macht das einfacher: Services auswählen, YAML wird live generiert, kopieren, fertig. Kein Googlen mehr nach "mysql docker compose example".
    </p>
  </div>

  <div class="ds-card">
    <h3 class="text-xl font-semibold mb-4">Features</h3>
    <ul class="space-y-2">
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> 9 Services in 6 Kategorien
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Live YAML-Generierung
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Volumes automatisch erkannt
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Ein-Klick Kopieren
      </li>
    </ul>
  </div>
</div>

<div class="grid md:grid-cols-3 gap-6 mb-16">
  <div class="ds-card">
    <h3 class="font-semibold mb-2">1. Services wählen</h3>
    <p class="text-sm">
      Nginx, MySQL, PostgreSQL, Redis, Traefik, Prometheus – alles dabei was du brauchst.
    </p>
  </div>
  <div class="ds-card">
    <h3 class="font-semibold mb-2">2. YAML checken</h3>
    <p class="text-sm">
      Die Konfiguration wird live generiert. Volumes und Umgebungsvariablen sind schon drin.
    </p>
  </div>
  <div class="ds-card">
    <h3 class="font-semibold mb-2">3. Kopieren & Starten</h3>
    <p class="text-sm">
      Ein Klick kopiert alles. Dann docker compose up -d und fertig.
    </p>
  </div>
</div>

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-6">Verfügbare Services</h2>
    <div class="flex flex-wrap gap-3">
      <span class="ds-tag">Nginx</span>
      <span class="ds-tag">PHP-FPM</span>
      <span class="ds-tag">MySQL</span>
      <span class="ds-tag">PostgreSQL</span>
      <span class="ds-tag">Redis</span>
      <span class="ds-tag">Traefik</span>
      <span class="ds-tag">Prometheus</span>
      <span class="ds-tag">Grafana</span>
      <span class="ds-tag">Adminer</span>
    </div>
    <p class="mt-6 text-sm">
      Alle Konfigurationen sind getestet und sofort einsatzbereit. Passwörter kannst du über Environment-Variablen setzen.
    </p>
  </div>

  <div class="flex flex-col justify-center items-center ds-note text-center">
    <h3 class="text-2xl font-bold mb-4">Stack bauen</h3>
    <p class="mb-6">
      Keine Anmeldung, keine Installation. Direkt im Browser.
    </p>
    <a href="/apps/compose-builder/" class="inline-flex items-center justify-center px-6 py-3 bg-[var(--ink)] text-[var(--paper)] font-medium transition-colors hover:bg-[var(--accent-strong)]">
      Builder öffnen
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </a>
  </div>
</div>
