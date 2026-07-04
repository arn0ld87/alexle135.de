---
title: KI Nachrichten Portal
category: KI
summary: Automatisiertes News-Portal für KI-Entwicklungen – tägliche Updates via GitHub Actions und Gemini API
tags:
  - KI
  - Automation
  - Node.js
  - GitHub Actions
heroImage: /images/projects/ki-nachrichten-portal.webp
---

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-4 text-white">Die Idee</h2>
    <p class="text-gray-300 leading-relaxed">
      Ein automatisiertes News-Portal, das die neuesten Entwicklungen im KI-Bereich sammelt und aufbereitet – ohne dass ich täglich manuell News suchen muss. Es läuft vollautomatisch und liefert jeden Morgen ein kurzes Update.
    </p>
  </div>
  
  <div class="bg-white/5 p-6 rounded-2xl border border-white/10">
    <h3 class="text-xl font-semibold mb-4 text-blue-400">Key Features</h3>
    <ul class="space-y-2 text-gray-300">
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Tägliche Updates via GitHub Actions
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Multi-Source RSS Aggregation
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> KI-Zusammenfassungen (Gemini)
      </li>
      <li class="flex items-center gap-2">
        <span class="text-blue-500">✓</span> Dubletten-Erkennung & Filterung
      </li>
    </ul>
  </div>
</div>

<div class="grid md:grid-cols-3 gap-6 mb-16">
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">1. Datensammlung</h3>
    <p class="text-sm text-gray-400">
      Ein Cron-Job sammelt täglich News aus diversen RSS-Feeds (OpenAI, Anthropic, Hugging Face) und filtert sie nach Relevanz.
    </p>
  </div>
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">2. KI-Verarbeitung</h3>
    <p class="text-sm text-gray-400">
      Google Gemini 2.5 analysiert die Artikel, erstellt deutsche Zusammenfassungen und bewertet die Wichtigkeit der News.
    </p>
  </div>
  <div class="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
    <h3 class="font-semibold text-white mb-2">3. Deployment</h3>
    <p class="text-sm text-gray-400">
      Die aufbereiteten News werden automatisch als statische HTML-Seite generiert und auf dem VPS deployt.
    </p>
  </div>
</div>

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-6 text-white">Technologie-Stack</h2>
    <div class="flex flex-wrap gap-3">
      <span class="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">GitHub Actions</span>
      <span class="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30">Node.js</span>
      <span class="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30">Gemini API</span>
      <span class="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-full text-sm border border-gray-600">Tailwind CSS</span>
    </div>
    <p class="mt-6 text-gray-400 text-sm">
      Herausforderungen waren vor allem die unterschiedlichen RSS-Feed-Strukturen und die zuverlässige Dubletten-Erkennung bei gleichen News aus verschiedenen Quellen.
    </p>
  </div>

  <div class="flex flex-col justify-center items-center bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl border border-white/10 p-8 text-center">
    <h3 class="text-2xl font-bold text-white mb-4">Status</h3>
    <p class="text-gray-300 mb-6">
      Das Projekt befindet sich aktuell in Überarbeitung – die automatische Update-Funktion wird optimiert.
    </p>
    <span class="inline-flex items-center justify-center px-6 py-3 bg-gray-700 text-gray-300 font-medium rounded-xl cursor-not-allowed">
      Wartungsarbeiten
    </span>
  </div>
</div>
