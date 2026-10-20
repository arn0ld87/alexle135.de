---
title: M.2 Schnittstelle Vortrag
category: Infrastruktur
schemaType: CreativeWork
summary: 'Vortrag über M.2-SSDs: Formfaktoren und Keys, NVMe gegen SATA, Einbau und ein Leistungsvergleich.'
meinTeil: 'Ich habe den Vortrag gehalten und die Folien mit python-pptx programmatisch erzeugt, damit das Design auf jeder Folie gleich bleibt.'
tags:
  - Hardware
  - Präsentation
  - IT-Grundlagen
heroImage: ../../assets/projects/m2-schnittstelle.webp
heroImageAlt: 'Stilisierte technische Ansicht einer M.2-SSD mit Speicherbausteinen, Steckkontakten und Formfaktor 2280.'
---

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-4">Der Vortrag</h2>
    <p class="leading-relaxed">
      Für die FISI-Ausbildung habe ich einen Vortrag über die M.2-Schnittstelle gehalten. Er erklärt, woran man Formfaktor und Key erkennt, vergleicht NVMe mit SATA und zeigt, worauf beim Einbau zu achten ist.
    </p>
  </div>
  
  <div class="ds-card">
    <h3 class="text-xl font-semibold mb-4">Inhalte</h3>
    <ul class="space-y-2">
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Formfaktoren & Keys (B/M-Key)
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> NVMe vs. SATA Protokolle
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Installationstipps
      </li>
      <li class="flex items-center gap-2">
        <span class="text-[var(--accent-strong)]">✓</span> Performance-Benchmarks
      </li>
    </ul>
  </div>
</div>

<div class="grid md:grid-cols-3 gap-6 mb-16">
  <div class="ds-card">
    <h3 class="font-semibold mb-2">1. Was ist M.2?</h3>
    <p class="text-sm">
      Erklärung der Spezifikation, Größen (2242, 2260, 2280) und der verschiedenen Key-Typen, die über die Kompatibilität entscheiden.
    </p>
  </div>
  <div class="ds-card">
    <h3 class="font-semibold mb-2">2. Performance</h3>
    <p class="text-sm">
      Vergleich der Geschwindigkeiten: SATA SSD (~550 MB/s) vs. M.2 NVMe Gen4 (~7.000 MB/s), also mehr als das Zwölffache.
    </p>
  </div>
  <div class="ds-card">
    <h3 class="font-semibold mb-2">3. Einbau</h3>
    <p class="text-sm">
      Welcher Key zu welchem Steckplatz passt, entscheidet über die Kompatibilität. Darauf läuft der Einbau hinaus.
    </p>
  </div>
</div>

<div class="grid md:grid-cols-2 gap-12 mb-12">
  <div>
    <h2 class="text-2xl font-bold mb-6">Tools & Design</h2>
    <div class="flex flex-wrap gap-3">
      <span class="ds-tag">Python</span>
      <span class="ds-tag">python-pptx</span>
      <span class="ds-tag">PowerPoint</span>
    </div>
    <p class="mt-6 text-sm">
      Die Präsentation wurde programmatisch mit Python erstellt, um das Corporate Design (Dark Mode, Glassmorphism) konsistent auf alle Folien anzuwenden.
    </p>
  </div>

  <div class="flex flex-col justify-center items-center ds-note text-center">
    <h3 class="text-2xl font-bold mb-4">Präsentation ansehen</h3>
    <p class="mb-6">
      Die vollständigen Folien sind noch nicht separat veröffentlicht. Aktuell ist diese Projektseite die zentrale Zusammenfassung.
    </p>
    <a href="/kontakt/" class="inline-flex items-center justify-center px-6 py-3 bg-[var(--ink)] text-[var(--paper)] font-medium transition-colors hover:bg-[var(--accent-strong)]">
      Präsentation anfragen
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </a>
  </div>
</div>
