import { expect, test, type Page } from '@playwright/test';

test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');

async function flaeche(page: Page, name: 'Ansicht' | 'Terminal') {
  const button = page.getByRole('button', { name, exact: true });
  if (await button.isVisible()) await button.click();
}

async function kommando(page: Page, text: string, warteAufPrompt = true) {
  const rows = page.locator('.xterm-rows').first();
  const count = async () => ((await rows.textContent())?.match(/azubi@rw-srv01/g) ?? []).length;
  const vorher = await count();
  await page.getByTestId('v86-terminal').click({ position: { x: 30, y: 30 } });
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  if (warteAufPrompt) await expect.poll(count, { timeout: 15_000 }).toBeGreaterThan(vorher);
}

for (const width of [1400, 390]) {
  test(`T7: frische Belege und bedienbare Aktenwand bei ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/projekte/terminal-missionen/app/staffel-2');
    const consent = page.locator('#cookie-banner');
    if (await consent.isVisible()) {
      await consent.getByRole('button', { name: 'Ablehnen', exact: true }).click();
    }
    await expect(page.locator('.xterm-rows').first()).toContainText('azubi@rw-srv01', {
      timeout: 90_000,
    });
    const terminal = await page.getByTestId('v86-terminal').elementHandle();
    await kommando(page, 'printf x > ~/belege/notiz.txt');
    await flaeche(page, 'Ansicht');
    await page.getByRole('button', { name: 'Aktenwand', exact: true }).click();
    await expect(page.getByRole('checkbox')).toHaveCount(1, { timeout: 30_000 });
    await page.getByRole('checkbox').check();

    // Der Prompt erkennt den neuen Beleg, die Aktenwand hat noch ihren alten Snapshot.
    await flaeche(page, 'Terminal');
    await kommando(page, 'printf x > ~/belege/protokoll.txt');
    await flaeche(page, 'Ansicht');
    await page.getByRole('button', { name: 'Vorwurf erheben', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Vorwurf erheben', exact: true });
    await expect(dialog.getByRole('checkbox')).toHaveCount(2, { timeout: 30_000 });
    await dialog.getByRole('checkbox').nth(1).check();
    await expect(dialog.getByRole('checkbox').nth(1)).toBeChecked();
    await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();

    // Die Datei fehlt bereits, der nächste Prompt-Hook bleibt durch sleep noch aus.
    await flaeche(page, 'Terminal');
    await kommando(page, 'rm ~/belege/protokoll.txt; sleep 30', false);
    await page.waitForTimeout(1500);
    await flaeche(page, 'Ansicht');
    await page.getByRole('button', { name: 'Vorwurf erheben', exact: true }).click();
    await dialog.getByRole('radio', { name: /Person A/ }).check();
    await dialog.getByRole('button', { name: 'Absenden', exact: true }).click();
    await expect(page.locator('main')).toContainText(
      'Ein ausgewählter Beleg ist nicht mehr gültig. Aktualisiere die Aktenwand.',
      { timeout: 30_000 }
    );
    await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);

    await flaeche(page, 'Terminal');
    await page.getByTestId('v86-terminal').click({ position: { x: 30, y: 30 } });
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    await kommando(page, 'printf x > ~/belege/protokoll.txt');
    await flaeche(page, 'Ansicht');
    await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
    await expect(page.getByRole('checkbox')).toHaveCount(2, { timeout: 30_000 });

    const boxes = await page.getByRole('checkbox').all();
    const perTabErreicht = boxes.map(() => false);
    await page.getByRole('button', { name: 'Aktualisieren', exact: true }).focus();
    for (let i = 0; i < 12 && !perTabErreicht.every(Boolean); i++) {
      await page.keyboard.press('Tab');
      for (let j = 0; j < boxes.length; j++) {
        if (await boxes[j].evaluate((node) => node === document.activeElement)) {
          perTabErreicht[j] = true;
        }
      }
    }
    expect(perTabErreicht.every(Boolean)).toBe(true);
    for (const box of boxes) {
      await box.scrollIntoViewIfNeeded();
      expect(
        await box.evaluate((node) => {
          const r = node.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === node;
        })
      ).toBe(true);
      await box.check();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.getByRole('button', { name: 'Vorwurf erheben', exact: true }).click();
    await dialog.getByRole('radio', { name: /Person A/ }).check();
    await dialog.getByRole('button', { name: 'Absenden', exact: true }).click();
    const titel = page.getByRole('heading', { name: 'Fall gelöst' });
    await expect(titel).toBeVisible({ timeout: 30_000 });
    await expect(titel).toBeFocused();
    expect(await terminal!.evaluate((node) => node.isConnected)).toBe(true);
    await flaeche(page, 'Terminal');
    await expect(page.getByTestId('v86-terminal')).toBeVisible();
    console.log(
      `T07-VM width=${width} snapshot=true frisch=true hit-test=true tab=true abschluss=true`
    );
  });
}
