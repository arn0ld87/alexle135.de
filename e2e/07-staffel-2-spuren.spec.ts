import { expect, test } from '@playwright/test';
import { flaeche, oeffneAkte } from './helpers/staffel2';

// Ticket 4/9: freie Spurenreihenfolge und Fortschritt ausschließlich aus der echten VM,
// jetzt an den Belegen von Episode 1.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');

const STAFFEL2 = '/projekte/terminal-missionen/app/staffel-2?episode=1';

// Geprüfte Lösungswege aus Episode 1; jeder Befehl ist ein eigener Beleg.
const LOG = 'grep sudoers.d /var/log/rechenwerk-audit.log > ~/belege/log-zeile.txt';
const RECHTE_REGEL = 'grep -B1 nadia /etc/sudoers.d/rw-fernwartung > ~/belege/rechte-zeile.txt';
const RECHTE_METADATEN =
  'ls -l /etc/sudoers.d/rw-fernwartung $(find /usr/local -perm -4000 -type f) > ~/belege/rechte-metadaten.txt';
const ANFANG = 'Serverraum der Rechenwerk Ostwind GmbH';
const RECHTE_0 = 'Rechte, 0 von 5 Schritten erledigt';
const LOG_0 = 'Log, 0 von 1 Schritten erledigt';

async function warteAufPrompt(page: import('@playwright/test').Page, name: string) {
  const rows = page.locator('.xterm-rows').first();
  await expect(rows).toContainText(new RegExp(`azubi@${name}`), { timeout: 90_000 });
  return rows;
}

const spur = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('button', { name });

test('Staffel 2: Spur Log vor Spur Rechte lösen, je ein Schritt pro Bündel', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(STAFFEL2);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  await warteAufPrompt(page, 'rw-srv01');
  // Erst nach dem Setup steht die Startauswahl fest; vorher würde sie überschrieben.
  await expect(page.getByTestId('pager')).toContainText(ANFANG, { timeout: 15_000 });

  await oeffneAkte(page);
  await expect(spur(page, RECHTE_0)).toBeVisible();
  await expect(spur(page, LOG_0)).toBeVisible();

  // 1. Log wählen und den einzigen Schritt dieser Spur lösen. Rechte bleibt offen, obwohl die
  //    Spur in den Daten zuerst steht: Die Auswahl schaltet nichts frei und prüft keine VM.
  await spur(page, LOG_0).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Log', exact: true })).toBeVisible();
  await page.getByTestId('v86-terminal').click();
  await page.keyboard.type(LOG);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pager')).toContainText(
    'Erledigt: Sichere die passende Audit-Zeile',
    {
      timeout: 15_000,
    }
  );
  await expect(spur(page, 'Log, 1 von 1 Schritten erledigt, abgeschlossen')).toBeVisible();
  await expect(spur(page, RECHTE_0)).toBeVisible();
  await expect(page.getByText('Alle Schritte dieser Spur sind erledigt.')).toBeVisible();

  // 2. Erst jetzt Rechte wählen; die Reihenfolge zwischen den Spuren ist frei. Die beiden Schritte
  //    folgen als eigene Befehle: Je Bündel gilt nur der aktuelle Schritt einer Spur.
  await spur(page, RECHTE_0).click();
  await page.getByTestId('v86-terminal').click();
  await page.keyboard.type(RECHTE_REGEL);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pager')).toContainText(
    'Erledigt: Sichere die unerwartete sudo-Regel',
    {
      timeout: 15_000,
    }
  );
  await expect(spur(page, 'Rechte, 1 von 5 Schritten erledigt')).toBeVisible();
  await expect(spur(page, 'Log, 1 von 1 Schritten erledigt, abgeschlossen')).toBeVisible();

  // Der zweite Schritt ist ein Ablesen: Er wartet auf die Antwort, nicht auf den Befehl.
  await page
    .getByLabel('Unter welcher Änderungskennung wurde die Regel eingespielt?')
    .fill('RW-1042');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(page.getByTestId('pager')).toContainText('Erledigt: Lies die Änderungskennung ab', {
    timeout: 30_000,
  });
  await expect(spur(page, 'Rechte, 2 von 5 Schritten erledigt')).toBeVisible();

  await page.getByTestId('v86-terminal').click();
  await page.keyboard.type(RECHTE_METADATEN);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pager')).toContainText(
    'Erledigt: Sichere Besitzer, Rechte und Datum',
    {
      timeout: 15_000,
    }
  );
  await expect(spur(page, 'Rechte, 3 von 5 Schritten erledigt')).toBeVisible();

  // 3. Die fertige Spur bleibt auswählbar und zeigt ihr Abschlussdetail; Rechte läuft weiter.
  await spur(page, 'Log, 1 von 1 Schritten erledigt, abgeschlossen').click();
  await expect(page.getByText('Alle Schritte dieser Spur sind erledigt.')).toBeVisible();
  await spur(page, 'Rechte, 3 von 5 Schritten erledigt').click();
  await expect(page.getByText('Alle Schritte dieser Spur sind erledigt.')).toHaveCount(0);

  // 4. Browser-Zoom ist nicht zuverlässig automatisierbar; ausdrücklich manuell offen.
  console.log(
    'T04-ZOOM: 200-%-Zoom auf Desktop ist ein manueller Check und hier nicht automatisiert.'
  );
});

test('Staffel 2: mobile Flächen behalten Terminalausgabe und Spurenauswahl', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(STAFFEL2);
  // Im Spielmodus (#170) liegt das Cookie-Banner über dem Terminal, bis entschieden ist.
  const consent = page.locator('#cookie-banner');
  if (await consent.isVisible()) {
    await consent.getByRole('button', { name: 'Ablehnen', exact: true }).click();
  }
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  const rows = await warteAufPrompt(page, 'rw-srv01');
  await expect(page.getByTestId('pager')).toContainText(ANFANG, { timeout: 15_000 });

  await page.getByTestId('v86-terminal').click();
  await page.keyboard.type('echo T04-MOBIL');
  await page.keyboard.press('Enter');
  await expect(rows).toContainText('T04-MOBIL', { timeout: 15_000 });

  await oeffneAkte(page);
  const liste = page.getByRole('region', { name: 'Spuren' });
  await expect(liste).toBeVisible();
  await expect(spur(page, RECHTE_0)).toBeVisible();
  await expect(spur(page, LOG_0)).toBeVisible();

  const keinQuerscrollen = await liste.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1
  );
  expect(keinQuerscrollen).toBe(true);

  await spur(page, LOG_0).click();
  await flaeche(page, 'Terminal');
  await expect(page.getByTestId('v86-terminal')).toBeVisible();
  await expect(rows).toContainText('T04-MOBIL');
  await expect(rows).toContainText(/azubi@rw-srv01/);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux');

  await oeffneAkte(page);
  await expect(spur(page, LOG_0)).toHaveAttribute('aria-pressed', 'true');
  await expect(spur(page, RECHTE_0)).toBeVisible();
});
