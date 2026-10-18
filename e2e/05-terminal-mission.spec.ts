// Terminal-Mission-E2E: Die Linux-Missionen laufen auf echtem Linux im Browser (v86,
// src/components/missions/LinuxMissions.tsx + V86Terminal.tsx). Die Assets der VM baut der
// CI-Job vorher (scripts/mission-image/build.sh). xterm rendert hier über den DOM-Renderer,
// der Zeilentext ist deshalb über .xterm-rows lesbar.
import { expect, test } from '@playwright/test';

test.describe('Terminal-Mission', () => {
  test('Mission wählen, Linux bootet, Shell und Befehl mission antworten', async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/projekte/terminal-missionen/app');
    await expect(page.getByRole('heading', { name: 'Terminal Missionen' })).toBeVisible();
    await expect(page.getByText(/^Linux \d+\/\d+ · Git \d+\/\d+$/)).toBeVisible();

    await page.getByRole('button', { name: /Linux Grundlagen/ }).click();
    await expect(page.getByRole('heading', { name: 'Linux Grundlagen' })).toBeVisible();

    // Boot aus dem Savestate und Agent bereit.
    await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', {
      timeout: 90_000,
    });
    // Engine hat setup ausgeführt und zeigt den ersten Schritt.
    await expect(page.getByText(/^Schritt 1\/\d+$/)).toBeVisible({ timeout: 30_000 });

    const rows = page.locator('.xterm-rows').first();
    await page.getByTestId('v86-terminal').click();
    await page.keyboard.type('whoami');
    await page.keyboard.press('Enter');
    await expect(rows).toContainText(/whoami\s*lernende/, { timeout: 15_000 });

    await page.keyboard.type('mission status');
    await page.keyboard.press('Enter');
    await expect(rows).toContainText(/Schritt 1\/\d+/, { timeout: 15_000 });
    await expect(rows).not.toContainText('command not found');

    expect(
      pageErrors,
      `Unerwartete Browser-Fehler: ${pageErrors.map((e) => e.message).join(', ')}`
    ).toHaveLength(0);
  });

  // Regression (ClientRouter): Wer per Link von der Projektseite ins Terminal wechselt, muss ein
  // frisch geladenes Dokument mit der Missions-CSP bekommen. Tauscht der ClientRouter nur das DOM,
  // gilt die Default-CSP des alten Dokuments weiter und v86 darf sein WebAssembly nicht kompilieren.
  test('Link-Navigation ins Terminal liefert ein frisches Dokument', async ({ page }) => {
    await page.goto('/projekte/terminal-missionen/');
    await page.evaluate(() => Object.assign(window, { __beforeLink: true }));

    const appResponse = page.waitForResponse(
      (response) =>
        /\/projekte\/terminal-missionen\/app\/?$/.test(new URL(response.url()).pathname) &&
        response.request().resourceType() === 'document'
    );
    await page.locator('a[href^="/projekte/terminal-missionen/app"]').first().click();
    const response = await appResponse;
    await page.waitForURL(/\/projekte\/terminal-missionen\/app\/?$/);
    await page.waitForLoadState('load');

    expect(response.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'");
    const state = await page.evaluate(() => ({
      isolated: self.crossOriginIsolated,
      freshDocument: !('__beforeLink' in window),
    }));
    expect(state).toEqual({ isolated: false, freshDocument: true });

    // Zurück auf eine Normalseite: Die Missions-CSP darf nicht mitwandern.
    await page.evaluate(() => Object.assign(window, { __beforeLink: true }));
    await page.getByRole('link', { name: 'Blog' }).first().click();
    await page.waitForURL(/\/blog\/?$/);
    await page.waitForLoadState('load');
    expect(await page.evaluate(() => !('__beforeLink' in window))).toBe(true);
  });
});
