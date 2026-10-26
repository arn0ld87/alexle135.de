import { expect, test } from '@playwright/test';
import { flaeche, STAFFEL2 } from './helpers/staffel2';

// #152: Auf dem Desktop scrollt nur die linke Spalte; Terminal und Pager bleiben stehen.
test('T11-1 Desktop 1440x900: linke Spalte scrollt, Terminal bleibt fest', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STAFFEL2);
  const terminal = page.getByTestId('v86-terminal');
  await expect(terminal).toBeVisible({ timeout: 30_000 });

  // Nächster Vorfahr der Spurenliste mit eigenem Scrollbereich: die linke Spalte.
  const spalte = page
    .getByRole('heading', { name: 'Spuren' })
    .locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');
  const scrollt = await spalte.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrollt).toBe(true);

  const vorher = await terminal.boundingBox();
  await spalte.evaluate((el) => el.scrollBy(0, 400));
  await expect.poll(() => spalte.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const nachher = await terminal.boundingBox();
  expect(nachher?.y).toBe(vorher?.y);
  expect(nachher?.height).toBe(vorher?.height);

  // Das Terminal reicht nicht über das Fenster hinaus.
  expect((vorher?.y ?? 0) + (vorher?.height ?? 0)).toBeLessThanOrEqual(900);
});

// #170 UI-01: Im Spielmodus fehlen Website-Navigation und Footer, die Spielfläche füllt genau das
// Fenster (100dvh), und die ganze Seite scrollt bei keiner Größe.
for (const groesse of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`T11-2 Spielmodus ${groesse.width}x${groesse.height}: kein Seitenscroll, Pager und Terminal im Fenster`, async ({
    page,
  }) => {
    await page.setViewportSize(groesse);
    await page.goto(STAFFEL2);
    await expect(page.getByTestId('pager')).toBeVisible({ timeout: 30_000 });
    await flaeche(page, 'Terminal');
    const terminal = page.getByTestId('v86-terminal');
    await expect(terminal).toBeVisible({ timeout: 30_000 });

    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    const seite = await page.evaluate(() => ({
      scroll: document.scrollingElement?.scrollHeight ?? 0,
      hoehe: window.innerHeight,
    }));
    expect(seite.scroll).toBeLessThanOrEqual(seite.hoehe);

    for (const ziel of [page.getByTestId('pager'), terminal]) {
      const box = await ziel.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(groesse.height);
    }
    // Die Arbeitsfläche bleibt benutzbar und wird nicht auf null gedrückt.
    expect((await terminal.boundingBox())!.height).toBeGreaterThanOrEqual(240);
  });
}
