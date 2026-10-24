import { expect, test } from '@playwright/test';

// Staffel 2 braucht die gebootete Missions-VM; ohne MISSION_VM laufen nur die übrigen E2E-Tests.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');

const STAFFEL2 = '/projekte/terminal-missionen/app/staffel-2';
const STAFFEL1 = '/projekte/terminal-missionen/app';

async function warteAufPrompt(page: import('@playwright/test').Page, name: string) {
  const rows = page.locator('.xterm-rows').first();
  await expect(rows).toContainText(new RegExp(`azubi@${name}`), { timeout: 90_000 });
  return rows;
}

test('Staffel 2: der Prompt blockiert nicht und die Prüfung meldet im Pager', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(STAFFEL2);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  const rows = await warteAufPrompt(page, 'rw-srv01');
  await page.getByTestId('v86-terminal').click();

  const befehl = 'printf x > ~/belege/notiz.txt';
  await page.keyboard.type(befehl);
  const start = Date.now();
  await page.keyboard.press('Enter');

  await expect
    .poll(async () => /notiz\.txt[\s\S]*azubi@rw-srv01/.test((await rows.textContent()) ?? ''), {
      timeout: 5_000,
      intervals: [20, 50, 100],
    })
    .toBe(true);
  const promptMs = Date.now() - start;
  console.log(`T03-LATENZ prompt=${promptMs}ms`);

  await expect(page.getByTestId('pager')).toContainText('Erledigt: Lege eine Notiz an', {
    timeout: 15_000,
  });
  const pagerMs = Date.now() - start;
  console.log(`T03-LATENZ pager=${pagerMs}ms`);

  expect(promptMs).toBeLessThan(1500);
});

test('Staffel 2: unter CPU-Drosselung meldet die Prüfung weiter im Pager', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(STAFFEL2);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  const rows = await warteAufPrompt(page, 'rw-srv01');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.getByTestId('v86-terminal').click();

  await page.keyboard.type('printf x > ~/belege/notiz.txt');
  const start = Date.now();
  await page.keyboard.press('Enter');

  await expect
    .poll(async () => /notiz\.txt[\s\S]*azubi@rw-srv01/.test((await rows.textContent()) ?? ''), {
      timeout: 30_000,
      intervals: [50, 120, 300],
    })
    .toBe(true);
  console.log(`T03-LATENZ gedrosselt-prompt=${Date.now() - start}ms`);

  await expect(page.getByTestId('pager')).toContainText('Erledigt: Lege eine Notiz an', {
    timeout: 60_000,
  });
  console.log(`T03-LATENZ gedrosselt-pager=${Date.now() - start}ms`);
});

test('Staffel 1 bleibt unverändert', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(STAFFEL1);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ein Linux-Krimi');
  // Wie in e2e/05: Staffel 1 startet das Terminal erst nach der Episodenwahl.
  await page.getByRole('button', { name: /Erster Tag/ }).click();
  const rows = page.locator('.xterm-rows').first();
  await expect(rows).toContainText(/azubi@alex-schneider/, { timeout: 90_000 });
});
