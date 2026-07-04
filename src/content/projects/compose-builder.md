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
heroImage: /images/projects/compose-builder.webp
publishedAt: 2025-11-21
featured: true
---

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-4 text-white">Warum das Tool?</h2>
    <p class="text-gray-300 leading-relaxed">
      Ich hab früher jede docker-compose.yml von Hand geschrieben. Immer die gleichen Blöcke kopiert, Ports angepasst, Volumes vergessen. Irgendwann nervig.
    </p>
    <p class="text-gray-300 leading-relaxed mt-4">
      Der Docker Compose Builder macht das einfacher: Services auswählen, YAML wird live generiert, kopieren, fertig. Kein Googlen mehr nach "mysql docker compose example".
    </p>
  </div>

  <div class="bg-white/5 p-6 rounded-2xl border border-white/10">
    <h3 class="text-xl font-semibold mb-4 text-blue-400">Features</h3>
    <ul class="space-y-2 text-gray-300">
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> 9 Services in 6 Kategorien
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Live YAML-Generierung
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Volumes automatisch erkannt
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Ein-Klick Kopieren
      </li>
    </ul>
  </div>
</div>

<div class="grid md:grid-cols-3 gap-6 mb-16">
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">1. Services wählen</h3>
    <p class="text-sm text-gray-400">
      Nginx, MySQL, PostgreSQL, Redis, Traefik, Prometheus – alles dabei was du brauchst.
    </p>
  </div>
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">2. YAML checken</h3>
    <p class="text-sm text-gray-400">
      Die Konfiguration wird live generiert. Volumes und Umgebungsvariablen sind schon drin.
    </p>
  </div>
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">3. Kopieren & Starten</h3>
    <p class="text-sm text-gray-400">
      Ein Klick kopiert alles. Dann docker compose up -d und fertig.
    </p>
  </div>
</div>

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-6 text-white">Verfügbare Services</h2>
    <div class="flex flex-wrap gap-3">
      <span class="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">Nginx</span>
      <span class="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">PHP-FPM</span>
      <span class="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30">MySQL</span>
      <span class="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30">PostgreSQL</span>
      <span class="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm border border-red-500/30">Redis</span>
      <span class="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30">Traefik</span>
      <span class="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm border border-orange-500/30">Prometheus</span>
      <span class="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm border border-orange-500/30">Grafana</span>
      <span class="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-full text-sm border border-gray-600">Adminer</span>
    </div>
    <p class="mt-6 text-gray-400 text-sm">
      Alle Konfigurationen sind getestet und sofort einsatzbereit. Passwörter kannst du über Environment-Variablen setzen.
    </p>
  </div>

  <div class="flex flex-col justify-center items-center bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl border border-white/10 p-8 text-center">
    <h3 class="text-2xl font-bold text-white mb-4">Stack bauen</h3>
    <p class="text-gray-300 mb-6">
      Keine Anmeldung, keine Installation. Direkt im Browser.
    </p>
    <a href="/apps/compose-builder/" class="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors shadow-lg hover:shadow-blue-500/25">
      Builder öffnen
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </a>
  </div>
</div>
