import { expect, test } from '@playwright/test';

// Ticket 4: freie Spurenreihenfolge und Fortschritt ausschließlich aus der echten VM.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');

const STAFFEL2 = '/projekte/terminal-missionen/app/staffel-2';

async function warteAufPrompt(page: import('@playwright/test').Page, name: string) {
  const rows = page.locator('.xterm-rows').first();
  await expect(rows).toContainText(new RegExp(`azubi@${name}`), { timeout: 90_000 });
  return rows;
}

const spur = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('button', { name });

test('Staffel 2: Spur B vor A lösen, je ein Schritt pro Bündel', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(STAFFEL2);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  await warteAufPrompt(page, 'rw-srv01');
  // Erst nach dem Setup steht die Startauswahl fest; vorher würde sie überschrieben.
  await expect(page.getByTestId('pager')).toContainText('Leg in ~/belege eine Datei notiz.txt', {
    timeout: 15_000,
  });

  await expect(spur(page, 'Ankommen, 0 von 2 Schritten erledigt')).toBeVisible();
  await expect(spur(page, 'Protokoll, 0 von 2 Schritten erledigt')).toBeVisible();

  // 1. Protokoll wählen und die erste Zeile anlegen. Die zweite Zeile folgt bewusst als
  //    eigener Befehl: Der Prompt-Hook kann während eines laufenden Bündels einen Nachlauf
  //    auslösen; ein einziges Kommando mit beiden Zeilen wäre für die Zwischenanzeige nicht
  //    zuverlässig beobachtbar. Die Ein-Schritt-Grenze je Bündel sichern T4-7 bis T4-10 ab.
  await spur(page, 'Protokoll, 0 von 2 Schritten erledigt').click();
  await expect(page.getByRole('heading', { level: 3, name: 'Protokoll' })).toBeVisible();
  await page.getByTestId('v86-terminal').click();
  await page.keyboard.type("printf 'x\\n' > ~/belege/protokoll.txt");
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pager')).toContainText('Erledigt: Lege ein Protokoll an', {
    timeout: 15_000,
  });
  await expect(spur(page, 'Protokoll, 1 von 2 Schritten erledigt')).toBeVisible();
  await expect(spur(page, 'Ankommen, 0 von 2 Schritten erledigt')).toBeVisible();

  // 2. Der nächste Prompt prüft B2 und schließt B ab, A bleibt unberührt.
  await page.keyboard.type("printf 'fertig\\n' >> ~/belege/protokoll.txt");
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pager')).toContainText('Erledigt: Ergänze fertig in protokoll.txt', {
    timeout: 15_000,
  });
  await expect(
    spur(page, 'Protokoll, 2 von 2 Schritten erledigt, abgeschlossen')
  ).toBeVisible();
  await expect(spur(page, 'Ankommen, 0 von 2 Schritten erledigt')).toBeVisible();
  await expect(page.getByText('Alle Schritte dieser Spur sind erledigt.')).toBeVisible();

  // 3. Erst jetzt A wählen; die Reihenfolge zwischen den Spuren ist frei.
  await spur(page, 'Ankommen, 0 von 2 Schritten erledigt').click();
  await page.getByTestId('v86-terminal').click();
  await page.keyboard.type("printf 'x\\n' > ~/belege/notiz.txt");
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pager')).toContainText('Erledigt: Lege eine Notiz an', {
    timeout: 15_000,
  });
  await expect(spur(page, 'Ankommen, 1 von 2 Schritten erledigt')).toBeVisible();

  await page.keyboard.type("printf 'fertig\\n' >> ~/belege/notiz.txt");
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pager')).toContainText('Erledigt: Ergänze fertig in notiz.txt', {
    timeout: 15_000,
  });
  await expect(
    spur(page, 'Ankommen, 2 von 2 Schritten erledigt, abgeschlossen')
  ).toBeVisible();

  // 4. Beide bleiben auswählbar und zeigen ihr Abschlussdetail.
  await spur(page, 'Protokoll, 2 von 2 Schritten erledigt, abgeschlossen').click();
  await expect(page.getByText('Alle Schritte dieser Spur sind erledigt.')).toBeVisible();
  await spur(page, 'Ankommen, 2 von 2 Schritten erledigt, abgeschlossen').click();
  await expect(page.getByText('Alle Schritte dieser Spur sind erledigt.')).toBeVisible();

  // 5. Browser-Zoom ist nicht zuverlässig automatisierbar; ausdrücklich manuell offen.
  console.log('T04-ZOOM: 200-%-Zoom auf Desktop ist ein manueller Check und hier nicht automatisiert.');
});

test('Staffel 2: mobile Flächen behalten Terminalausgabe und Spurenauswahl', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(STAFFEL2);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  const rows = await warteAufPrompt(page, 'rw-srv01');
  await expect(page.getByTestId('pager')).toContainText('Leg in ~/belege eine Datei notiz.txt', {
    timeout: 15_000,
  });

  await page.getByTestId('v86-terminal').click();
  await page.keyboard.type('echo T04-MOBIL');
  await page.keyboard.press('Enter');
  await expect(rows).toContainText('T04-MOBIL', { timeout: 15_000 });

  await page.getByRole('button', { name: 'Ansicht', exact: true }).click();
  const liste = page.getByRole('region', { name: 'Spuren' });
  await expect(liste).toBeVisible();
  await expect(spur(page, 'Ankommen, 0 von 2 Schritten erledigt')).toBeVisible();
  await expect(spur(page, 'Protokoll, 0 von 2 Schritten erledigt')).toBeVisible();

  const keinQuerscrollen = await liste.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1
  );
  expect(keinQuerscrollen).toBe(true);

  await spur(page, 'Protokoll, 0 von 2 Schritten erledigt').click();
  await page.getByRole('button', { name: 'Terminal', exact: true }).click();
  await expect(page.getByTestId('v86-terminal')).toBeVisible();
  await expect(rows).toContainText('T04-MOBIL');
  await expect(rows).toContainText(/azubi@rw-srv01/);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux');

  await page.getByRole('button', { name: 'Ansicht', exact: true }).click();
  await expect(
    spur(page, 'Protokoll, 0 von 2 Schritten erledigt')
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(spur(page, 'Ankommen, 0 von 2 Schritten erledigt')).toBeVisible();
});
