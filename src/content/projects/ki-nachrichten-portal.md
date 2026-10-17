---
title: KI Nachrichten Portal
category: KI
summary: Automatisiertes News-Portal für KI-Entwicklungen – tägliche Updates via GitHub Actions und Gemini API
tags:
  - KI
  - Automation
  - Node.js
  - GitHub Actions
heroImage: ../../assets/projects/ki-nachrichten-portal.webp
---

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-4">Die Idee</h2>
    <p class="leading-relaxed">
      Ein automatisiertes News-Portal, das die neuesten Entwicklungen im KI-Bereich sammelt und aufbereitet – ohne dass ich täglich manuell News suchen muss. Es läuft vollautomatisch und liefert jeden Morgen ein kurzes Update.
    </p>
  </div>
  
  <div class="ds-card">
    <h3 class="text-xl font-semibold mb-4">Key Features</h3>
    <ul class="space-y-2">
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Tägliche Updates via GitHub Actions
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Multi-Source RSS Aggregation
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> KI-Zusammenfassungen (Gemini)
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Dubletten-Erkennung & Filterung
      </li>
    </ul>
  </div>
</div>

<div class="grid md:grid-cols-3 gap-6 mb-16">
  <div class="ds-card">
    <h3 class="font-semibold mb-2">1. Datensammlung</h3>
    <p class="text-sm">
      Ein Cron-Job sammelt täglich News aus diversen RSS-Feeds (OpenAI, Anthropic, Hugging Face) und filtert sie nach Relevanz.
    </p>
  </div>
  <div class="ds-card">
    <h3 class="font-semibold mb-2">2. KI-Verarbeitung</h3>
    <p class="text-sm">
      Google Gemini 2.5 analysiert die Artikel, erstellt deutsche Zusammenfassungen und bewertet die Wichtigkeit der News.
    </p>
  </div>
  <div class="ds-card">
    <h3 class="font-semibold mb-2">3. Deployment</h3>
    <p class="text-sm">
      Die aufbereiteten News werden automatisch als statische HTML-Seite generiert und auf dem VPS deployt.
    </p>
  </div>
</div>

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-6">Technologie-Stack</h2>
    <div class="flex flex-wrap gap-3">
      <span class="ds-tag">GitHub Actions</span>
      <span class="ds-tag">Node.js</span>
      <span class="ds-tag">Gemini API</span>
      <span class="ds-tag">Tailwind CSS</span>
    </div>
    <p class="mt-6 text-sm">
      Herausforderungen waren vor allem die unterschiedlichen RSS-Feed-Strukturen und die zuverlässige Dubletten-Erkennung bei gleichen News aus verschiedenen Quellen.
    </p>
  </div>

  <div class="flex flex-col justify-center items-center ds-note text-center">
    <h3 class="text-2xl font-bold mb-4">Status</h3>
    <p class="mb-6">
      Das Projekt befindet sich aktuell in Überarbeitung – die automatische Update-Funktion wird optimiert.
    </p>
    <span class="inline-flex items-center justify-center px-6 py-3 border border-[var(--line)] text-[var(--muted)] font-medium cursor-not-allowed">
      Wartungsarbeiten
    </span>
  </div>
</div>
