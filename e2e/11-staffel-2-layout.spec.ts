import { expect, test } from '@playwright/test';
import { STAFFEL2 } from './helpers/staffel2';

// #152: Auf dem Desktop scrollt nur die linke Spalte; Terminal und Pager bleiben stehen.
test('T11-1 Desktop 1440x900: linke Spalte scrollt, Terminal bleibt fest', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STAFFEL2);
  const terminal = page.getByTestId('v86-terminal');
  await expect(terminal).toBeVisible({ timeout: 30_000 });

  // Nächster Vorfahr der Spurenliste mit eigenem Scrollbereich: die linke Spalte.
  const spalte = page
    .getByRole('heading', { name: 'Spuren' })
    .locator('xpath=ancestor::div[contains(@class,"lg:overflow-y-auto")][1]');
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
