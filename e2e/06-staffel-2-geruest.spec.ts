import { expect, test } from '@playwright/test';

// Staffel 2 braucht die gebootete Missions-VM; ohne MISSION_VM laufen nur die übrigen E2E-Tests.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');

const STAFFEL2 = '/projekte/terminal-missionen/app/staffel-2';
const STAFFEL1 = '/projekte/terminal-missionen/app';
// Kleinster echter Beleg aus Episode 1: die Audit-Zeile zur Regeldatei unter /etc/sudoers.d.
const ANFANG = 'Serverraum der Rechenwerk Ostwind GmbH';
const AUDIT_BEFEHL = 'grep sudoers.d /var/log/rechenwerk-audit.log > ~/belege/log-zeile.txt';

async function warteAufPrompt(page: import('@playwright/test').Page, name: string) {
  const rows = page.locator('.xterm-rows').first();
  await expect(rows).toContainText(new RegExp(`azubi@${name}`), { timeout: 90_000 });
  return rows;
}

async function messePrompt(
  rows: import('@playwright/test').Locator,
  start: number,
  budgetMs: number
) {
  await expect
    .poll(async () => /log-zeile\.txt[\s\S]*azubi@rw-srv01/.test((await rows.textContent()) ?? ''), {
      timeout: Math.max(1, budgetMs - (Date.now() - start)),
      intervals: [20, 50, 100],
    })
    .toBe(true);
  return Date.now() - start;
}

async function messePager(page: import('@playwright/test').Page, start: number, budgetMs: number) {
  await expect(page.getByTestId('pager')).toContainText('Erledigt: Sichere die passende Audit-Zeile', {
    timeout: Math.max(1, budgetMs - (Date.now() - start)),
  });
  return Date.now() - start;
}

test('Staffel 2: der Prompt blockiert nicht und die Prüfung meldet im Pager', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(STAFFEL2);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  const rows = await warteAufPrompt(page, 'rw-srv01');
  // Der Auftrag erscheint erst, wenn das Setup der Episode durch ist; gemessen wird ab Enter.
  await expect(page.getByTestId('pager')).toContainText(ANFANG, { timeout: 30_000 });
  await page.getByTestId('v86-terminal').click();

  const befehl = AUDIT_BEFEHL;
  await page.keyboard.type(befehl);
  const start = Date.now();
  await page.keyboard.press('Enter');

  const [promptMs, pagerMs] = await Promise.all([
    messePrompt(rows, start, 1500),
    messePager(page, start, 15_000),
  ]);
  console.log(`T03-LATENZ prompt=${promptMs}ms`);
  console.log(`T03-LATENZ pager=${pagerMs}ms`);

  expect(promptMs).toBeLessThan(1500);
});

// Der Linux-Krimi zielt auf den PC (Entscheidung 2026-10-24): kein Budget für 6-fache
// CPU-Drosselung mehr. Darstellung auf schmalen Bildschirmen prüfen weiterhin 07 und 08.
test.skip('Staffel 2: unter CPU-Drosselung meldet die Prüfung weiter im Pager', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(STAFFEL2);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  const rows = await warteAufPrompt(page, 'rw-srv01');

  await expect(page.getByTestId('pager')).toContainText(ANFANG, { timeout: 90_000 });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.getByTestId('v86-terminal').click();

  await page.keyboard.type(AUDIT_BEFEHL);
  const start = Date.now();
  await page.keyboard.press('Enter');

  const [promptMs, pagerMs] = await Promise.all([
    messePrompt(rows, start, 60_000).catch(() => null),
    messePager(page, start, 60_000),
  ]);
  console.log(`T03-LATENZ gedrosselt-prompt=${promptMs === null ? 'nicht beobachtet' : `${promptMs}ms`}`);
  console.log(`T03-LATENZ gedrosselt-pager=${pagerMs}ms`);
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
