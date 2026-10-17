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

  // Regression (Mission-Shell): Im echten WebContainer muss `whoami` die Shell der Missionen
  // erreichen und `visitor` ausgeben (vorher startete nur das nackte jsh: "command not found").
  // Bootet WebContainer in der Umgebung nicht (Mock-Fallback), entfällt die Prüfung.
  test('Linux Grundlagen: whoami läuft in der Mission-Shell', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/projekte/terminal-missionen/app');
    await page.getByText('Linux Grundlagen').first().click();
    await expect(page.getByText('Zurück zur Missionsauswahl')).toBeVisible();
    await expect(page.getByText('Initializing Linux Environment...')).toBeHidden({
      timeout: 45_000,
    });

    const rows = page.locator('.xterm-rows').first();
    await expect(rows).toContainText(/Mock Mode|visitor@linux/, { timeout: 15_000 });
    test.skip(
      (await rows.innerText()).includes('Mock Mode'),
      'WebContainer bootet in dieser Umgebung nicht (Mock-Fallback)'
    );

    await page.locator('.xterm').first().click();
    await page.keyboard.type('whoami');
    await page.keyboard.press('Enter');
    // Zeilen eines xterm-DOM-Renderers haben keine Zeilenumbrüche im Textinhalt.
    await expect(rows).toContainText(/whoami\s*visitor\s*visitor@linux/);
    await expect(rows).not.toContainText('command not found');
  });
});
