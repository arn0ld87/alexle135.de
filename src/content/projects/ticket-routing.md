---
title: Ticket-Routing mit KI-Agenten
category: KI
summary: Classifier Workflow. Ein Agent-System analysiert und routet eingehende Support-Tickets automatisch an die korrekte Fachabteilung.
tags:
  - KI
  - Agenten
  - DevOps
techStack: ['Gemini API', 'Node.js', 'Express', 'Docker']
role: 'Workflow-Architektur, Prompt-Logik & Routing-Regeln'
frameLabel: 'Classifier view / escalation logic'
heroImage: ../../assets/projects/ticket-routing.webp
heroImageAlt: 'Routing-Schema: Ein Ticket wird HW, SW oder Netzwerk zugeordnet; ein Prüfpfad führt zur manuellen Sichtung.'
publishedAt: 2025-11-20
featured: true
---

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-4">Das Problem</h2>
    <p class="leading-relaxed mb-6">
      Support-Teams verbringen viel Zeit damit, eingehende Tickets manuell zu kategorisieren und an die richtige Abteilung weiterzuleiten. Das kostet Zeit und führt zu Verzögerungen bei der Bearbeitung wichtiger Anfragen.
    </p>
    <h2 class="text-2xl font-bold mb-4">Die Lösung</h2>
    <p class="leading-relaxed">
      Ein intelligentes KI-Agent-System, das eingehende Tickets analysiert, den Kontext versteht und sie automatisch der richtigen Fachabteilung zuweist – inklusive Priorisierung.
    </p>
  </div>
  
  <div class="ds-card">
    <h3 class="text-xl font-semibold mb-4">Key Features</h3>
    <ul class="space-y-2">
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Automatische Ticket-Analyse
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Erkennung von Kategorien (HW/SW/Netzwerk)
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Intelligente Priorisierung
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Routing an Fachabteilungen
      </li>
    </ul>
  </div>
</div>

<div class="grid md:grid-cols-3 gap-6 mb-16">
  <div class="ds-card">
    <h3 class="font-semibold mb-2">1. Prompt Engineering</h3>
    <p class="text-sm">
      Die Qualität der Kategorisierung hängt stark vom Prompt ab. Iteratives Testen war nötig, um die KI auf spezifische IT-Probleme zu trainieren.
    </p>
  </div>
  <div class="ds-card">
    <h3 class="font-semibold mb-2">2. Rate Limiting</h3>
    <p class="text-sm">
      Bei hohem Ticketaufkommen müssen API-Limits beachtet werden. Eine Queue-Architektur sorgt für stabile Verarbeitung.
    </p>
  </div>
  <div class="ds-card">
    <h3 class="font-semibold mb-2">3. Fehlerbehandlung</h3>
    <p class="text-sm">
      Wenn die KI unsicher ist (Confidence Score niedrig), wird das Ticket automatisch an einen menschlichen Dispatcher eskaliert.
    </p>
  </div>
</div>

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-6">Technologie-Stack</h2>
    <div class="flex flex-wrap gap-3">
      <span class="ds-tag">Google Gemini API</span>
      <span class="ds-tag">Node.js & Express</span>
      <span class="ds-tag">Docker</span>
    </div>
    <p class="mt-6 text-sm">
      Ergebnis: Ein funktionierender Prototyp, der 85% der Tickets korrekt kategorisiert. Für einen Production-Einsatz müsste das System noch robuster werden.
    </p>
  </div>

  <div class="flex flex-col justify-center items-center ds-note text-center">
    <h3 class="text-2xl font-bold mb-4">Live Demo</h3>
    <p class="mb-6">
      Die interaktive Demo ist noch nicht öffentlich. Der aktuelle Projektstand steckt in der Konzept- und Routing-Seite.
    </p>
    <a href="/kontakt/" class="inline-flex items-center justify-center px-6 py-3 bg-[var(--ink)] text-[var(--paper)] font-medium transition-colors hover:bg-[var(--accent-strong)]">
      Projekt anfragen
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </a>
  </div>
</div>
