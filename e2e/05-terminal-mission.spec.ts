// Terminal-Mission-E2E: Die Linux-Missionen laufen auf echtem Linux im Browser (v86,
// src/components/missions/StaffelApp.tsx + V86Terminal.tsx). Die Assets der VM baut der
// CI-Job vorher (scripts/mission-image/build.sh). xterm rendert hier über den DOM-Renderer,
// der Zeilentext ist deshalb über .xterm-rows lesbar.
import { expect, test } from '@playwright/test';

test.describe('Terminal-Mission', () => {
  test('Episode wählen, Linux bootet, Pager und Befehl mission antworten', async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto('/projekte/terminal-missionen/app');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Terminal-Missionen');
    await expect(page.getByTestId('akte-zaehler')).toHaveText(/^\d+\/\d+$/);

    await page.getByRole('button', { name: /Erster Tag/ }).click();

    // Boot aus dem Savestate und Agent bereit.
    await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', {
      timeout: 90_000,
    });
    // Engine hat setup ausgeführt; der Auftrag steht im Pager, nicht in der motd.
    await expect(page.getByTestId('vorfall-schritt')).toContainText(/^Schritt 1\/\d+/, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('pager')).toContainText('Moin, ich bin Alex.');

    // #411: Der Seitentitel steht ganz unter der Navigation, auch nachdem das Terminal im Bild ist.
    const titelFrei = async () => {
      const nav = (await page.locator('body > header').boundingBox())!;
      const titel = (await page.locator('main h1').boundingBox())!;
      return titel.y - (nav.y + nav.height);
    };
    await expect.poll(titelFrei).toBeGreaterThanOrEqual(0);
    // … und die Sprechblase zeigt nur ganze Zeilen (Höhe ein Vielfaches der Zeilenhöhe).
    const zeilenRest = await page.getByTestId('pager-text').evaluate((el) => {
      const zeile = parseFloat(getComputedStyle(el).lineHeight);
      return el.clientHeight % zeile;
    });
    expect(zeilenRest).toBe(0);

    // #399: Das Terminal füllt auf dem Desktop mindestens 60 % der Fensterhöhe und steht ganz im Bild.
    const viewport = page.viewportSize()!;
    const box = (await page.getByTestId('v86-terminal').boundingBox())!;
    expect(box.height / viewport.height).toBeGreaterThanOrEqual(0.6);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    // #411: Bei 1440×900 steht das Terminal ganz im Bild und der Titel frei.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect
      .poll(async () => {
        const b = (await page.getByTestId('v86-terminal').boundingBox())!;
        return b.y + b.height;
      })
      .toBeLessThanOrEqual(900);
    await expect.poll(titelFrei).toBeGreaterThanOrEqual(0);
    // Auch auf einem niedrigen Laptop-Display (1366×768) steht das Terminal ganz im Bild.
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect
      .poll(async () => {
        const b = (await page.getByTestId('v86-terminal').boundingBox())!;
        return b.y + b.height;
      })
      .toBeLessThanOrEqual(768);
    await expect.poll(titelFrei).toBeGreaterThanOrEqual(0);
    // … auch mit geöffneten Werkzeugen.
    await page.getByRole('button', { name: 'Werkzeuge' }).click();
    await expect
      .poll(async () => {
        const b = (await page.getByTestId('v86-terminal').boundingBox())!;
        return b.y + b.height;
      })
      .toBeLessThanOrEqual(768);
    await page.getByRole('button', { name: 'Werkzeuge' }).click();
    await page.setViewportSize({ width: 1400, height: 1000 });

    const rows = page.locator('.xterm-rows').first();
    await page.getByTestId('v86-terminal').click();
    await page.keyboard.type('whoami');
    await page.keyboard.press('Enter');
    await expect(rows).toContainText(/whoami\s*azubi/, { timeout: 15_000 });

    await page.keyboard.type('mission status');
    await page.keyboard.press('Enter');
    await expect(rows).toContainText(/Schritt 1\/\d+/, { timeout: 15_000 });
    await expect(rows).not.toContainText('command not found');

    // Zustand statt Abfrage: Der Ordner reicht, der Pager meldet den nächsten Schritt.
    await page.keyboard.type('mkdir notizen');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('vorfall-schritt')).toContainText('Schritt 2/', {
      timeout: 20_000,
    });

    // mission next startet den nächsten offenen Vorfall.
    await page.keyboard.type('mission next');
    await page.keyboard.press('Enter');
    // Die Ankündigung steht im Pager; das Terminal wird beim Wechsel (#426) geleert und steht im Home.
    await expect(page.getByTestId('pager')).toContainText('Episode 1: Platte voll', {
      timeout: 40_000,
    });
    await expect(rows).toContainText('azubi@alex-schneider:~$', { timeout: 15_000 });
    await expect(rows).not.toContainText('mission next');

    expect(
      pageErrors,
      `Unerwartete Browser-Fehler: ${pageErrors.map((e) => e.message).join(', ')}`
    ).toHaveLength(0);
  });

  // #426: Wer den Vorfall wechselt, startet sauber im Home, ohne alte Ausgabe.
  test('Episodenwechsel leert das Terminal und setzt die Shell ins Home', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto('/projekte/terminal-missionen/app');
    await page.getByRole('button', { name: /Erster Tag/ }).click();
    await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', {
      timeout: 90_000,
    });
    await expect(page.getByTestId('vorfall-schritt')).toContainText(/^Schritt 1\/\d+/, {
      timeout: 30_000,
    });

    const rows = page.locator('.xterm-rows').first();
    await page.getByTestId('v86-terminal').click();
    await page.keyboard.type('cd /etc');
    await page.keyboard.press('Enter');
    await expect(rows).toContainText('/etc$', { timeout: 15_000 });
    await page.keyboard.type('echo ALTE-AUSGABE');
    await page.keyboard.press('Enter');
    await expect(rows).toContainText('ALTE-AUSGABE', { timeout: 15_000 });

    const start = Date.now();
    await page.getByRole('button', { name: /Platte voll/ }).click();
    await expect(rows).not.toContainText('ALTE-AUSGABE', { timeout: 5_000 });
    await expect(rows).toContainText('azubi@alex-schneider:~$', { timeout: 5_000 });
    expect(Date.now() - start).toBeLessThan(5_000);
    await expect(rows).not.toContainText('/etc$');
    await expect(page.getByTestId('vorfall-schritt')).toContainText(/^Schritt 1\/\d+/, {
      timeout: 30_000,
    });
  });

  test('mobil: Reiter für Terminal, Akte und Werkzeuge sind bedienbar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/projekte/terminal-missionen/app');
    const tab = (name: string) => page.getByRole('tab', { name });
    await expect(tab('Akte')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /Erster Tag/ })).toBeVisible();

    await tab('Werkzeuge').click();
    await expect(tab('Werkzeuge')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Glossar: alle gelernten Befehle/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Erster Tag/ })).toBeHidden();

    await tab('Terminal').click();
    await expect(page.getByText('Wähle eine Episode in der Akte.', { exact: false })).toBeVisible();
    await expect(page.getByTestId('pager')).toBeVisible();
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
