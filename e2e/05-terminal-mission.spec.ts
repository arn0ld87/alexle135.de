// Terminal-Mission-E2E (Issue #296): Seite lädt, Mission-Auswahl funktioniert,
// und das Laden des Terminals löst sich in einen nutzbaren Zustand auf —
// unabhängig davon, ob WebContainer.boot() im Headless-CI wirklich gelingt.
//
// src/components/interactive/BaseMissionTerminal.tsx rendert im
// Linux-Modus (mode="linux", genutzt von
// src/pages/projekte/terminal-missionen/app.astro) nach Missionsauswahl
// LazyWebContainerTerminal (src/components/interactive/WebContainerTerminal.tsx).
// Diese Komponente prüft canUseWebContainer() (SharedArrayBuffer /
// crossOriginIsolated) und fällt bei fehlender Voraussetzung ODER einem
// fehlgeschlagenen WebContainer.boot() auf einen simulierten Mock-Modus
// zurück (initMockMode) — ohne die Seite in einem hängenden Ladezustand zu
// belassen. xterm.js rendert seinen Inhalt auf <canvas>, daher wird hier NICHT
// der Terminal-Text geprüft (nicht zuverlässig aus dem DOM lesbar), sondern
// der strukturelle Übergang: Auswahl → Mission-Ansicht → Ladeindikator
// verschwindet (isBooting=false), egal welcher Pfad (WebContainer oder Mock)
// dahinterliegt.
import { expect, test } from '@playwright/test';

test.describe('Terminal-Mission', () => {
  test('Seite lädt, Missionsauswahl funktioniert, Terminal-Ladezustand löst sich auf', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/projekte/terminal-missionen/app');

    await expect(page.getByRole('heading', { name: 'Terminal Missionen' })).toBeVisible();

    // Missionsauswahl: mindestens eine anklickbare Mission-Karte.
    const missionCards = page.locator('main button').filter({ hasText: /./ });
    await expect(missionCards.first()).toBeVisible({ timeout: 15_000 });
    await missionCards.first().click();

    // Nach der Auswahl wechselt die Ansicht in die Mission-Detailansicht
    // (Zurück-Button + Fortschrittsanzeige, siehe BaseMissionTerminal.tsx).
    await expect(page.getByText('Zurück zur Missionsauswahl')).toBeVisible();

    // Der Boot-/Ladezustand (WebContainer ODER Mock-Fallback) muss sich
    // innerhalb einer großzügigen Frist auflösen — die Seite darf nicht im
    // "Initializing Linux Environment..."-Spinner hängen bleiben.
    await expect(page.getByText('Initializing Linux Environment...')).toBeHidden({
      timeout: 45_000,
    });

    // Das Terminal-DOM-Grundgerüst (xterm) muss in jedem Fall vorhanden sein.
    await expect(page.locator('.xterm').first()).toBeVisible();

    expect(
      pageErrors,
      `Unerwartete Browser-Fehler: ${pageErrors.map((e) => e.message).join(', ')}`
    ).toHaveLength(0);
  });
});
