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
heroImage: /images/projects/ticket-routing.webp
publishedAt: 2025-11-20
featured: true
---

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-4 text-white">Das Problem</h2>
    <p class="text-gray-300 leading-relaxed mb-6">
      Support-Teams verbringen viel Zeit damit, eingehende Tickets manuell zu kategorisieren und an die richtige Abteilung weiterzuleiten. Das kostet Zeit und führt zu Verzögerungen bei der Bearbeitung wichtiger Anfragen.
    </p>
    <h2 class="text-2xl font-bold mb-4 text-white">Die Lösung</h2>
    <p class="text-gray-300 leading-relaxed">
      Ein intelligentes KI-Agent-System, das eingehende Tickets analysiert, den Kontext versteht und sie automatisch der richtigen Fachabteilung zuweist – inklusive Priorisierung.
    </p>
  </div>
  
  <div class="bg-white/5 p-6 rounded-2xl border border-white/10">
    <h3 class="text-xl font-semibold mb-4 text-blue-400">Key Features</h3>
    <ul class="space-y-2 text-gray-300">
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Automatische Ticket-Analyse
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Erkennung von Kategorien (HW/SW/Netzwerk)
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Intelligente Priorisierung
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Routing an Fachabteilungen
      </li>
    </ul>
  </div>
</div>

<div class="grid md:grid-cols-3 gap-6 mb-16">
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">1. Prompt Engineering</h3>
    <p class="text-sm text-gray-400">
      Die Qualität der Kategorisierung hängt stark vom Prompt ab. Iteratives Testen war nötig, um die KI auf spezifische IT-Probleme zu trainieren.
    </p>
  </div>
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">2. Rate Limiting</h3>
    <p class="text-sm text-gray-400">
      Bei hohem Ticketaufkommen müssen API-Limits beachtet werden. Eine Queue-Architektur sorgt für stabile Verarbeitung.
    </p>
  </div>
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">3. Fehlerbehandlung</h3>
    <p class="text-sm text-gray-400">
      Wenn die KI unsicher ist (Confidence Score niedrig), wird das Ticket automatisch an einen menschlichen Dispatcher eskaliert.
    </p>
  </div>
</div>

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-6 text-white">Technologie-Stack</h2>
    <div class="flex flex-wrap gap-3">
      <span class="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">Google Gemini API</span>
      <span class="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30">Node.js & Express</span>
      <span class="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-full text-sm border border-gray-600">Docker</span>
    </div>
    <p class="mt-6 text-gray-400 text-sm">
      Ergebnis: Ein funktionierender Prototyp, der 85% der Tickets korrekt kategorisiert. Für einen Production-Einsatz müsste das System noch robuster werden.
    </p>
  </div>

  <div class="flex flex-col justify-center items-center bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl border border-white/10 p-8 text-center">
    <h3 class="text-2xl font-bold text-white mb-4">Live Demo</h3>
    <p class="text-gray-300 mb-6">
      Die interaktive Demo ist noch nicht öffentlich. Der aktuelle Projektstand steckt in der Konzept- und Routing-Seite.
    </p>
    <a href="/kontakt/" class="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors shadow-lg hover:shadow-blue-500/25">
      Projekt anfragen
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </a>
  </div>
</div>
