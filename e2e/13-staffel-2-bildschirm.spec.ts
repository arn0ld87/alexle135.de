import { expect, test, type Page } from '@playwright/test';
import {
  BILDSCHIRM_ERLEDIGT,
  GESEHEN,
  bildschirmErmittlung,
  oeffneMitErmittlung,
} from './helpers/bildschirmErmittlung';
import { STAFFEL2 } from './helpers/staffel2';

// Ticket 13 (ADR 0008): Bildschirm nur für Ermittlungen mit `bildschirm: true`. Ein Gastprogramm
// schreibt als azubi, ohne Prompt; erst „Stand prüfen“ löst den Prüflauf aus.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');

const BILDSCHIRM_ASSETS = '/missions/linux/bildschirm/';

function vmAbrufe(page: Page) {
  const pfade: string[] = [];
  page.on('request', (req) => {
    const pfad = new URL(req.url()).pathname;
    if (pfad.startsWith('/missions/linux/')) pfade.push(pfad);
  });
  return pfade;
}

async function tippeImTerminal(page: Page, befehl: string) {
  await page.getByTestId('v86-terminal').click();
  await page.keyboard.type(befehl);
  await page.keyboard.press('Enter');
}

test('Bildschirm: Gastprogramm schreibt als azubi, „Stand prüfen“ prüft', async ({
  page,
}, info) => {
  test.setTimeout(420_000);
  const abrufe = vmAbrufe(page);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await oeffneMitErmittlung(page, bildschirmErmittlung);

  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 180_000 });
  const rows = page.locator('.xterm-rows').first();
  await expect(rows).toContainText(/azubi@rw-srv01/, { timeout: 90_000 });
  // Setup mit bildbeleg lief durch (sonst stünde der Rahmenfehler da), der Auftrag steht im Pager.
  await expect(page.getByTestId('pager')).toContainText('Schreib die Zahl vom Zettel', {
    timeout: 60_000,
  });
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(abrufe).toContain(`${BILDSCHIRM_ASSETS}alpine-state.bin.zst`);
  expect(abrufe).not.toContain('/missions/linux/alpine-state.bin.zst');

  // Der Bildbeleg ist ein PNG; seinen Text trägt er nur als Pixel (geprüft im Image-Build).
  await tippeImTerminal(page, 'file ~/fotos/zettel.png');
  await expect(rows).toContainText('PNG image data', { timeout: 30_000 });

  // Bildbetrachter zeigt den Zettel auf dem Bildschirm. Die Marke entsteht erst in der Ausgabe
  // (ZETTEL-42), sonst träfe schon das Echo des getippten Befehls.
  await tippeImTerminal(
    page,
    `feh ~/fotos/zettel.png & until xwininfo -root -tree | grep -q '"feh'; do sleep 1; done; echo ZETTEL-$((40+2))`
  );
  await expect(rows).toContainText('ZETTEL-42', { timeout: 120_000 });
  await page.getByRole('tab', { name: 'Bildschirm', exact: true }).click();
  await expect(page.getByTestId('pager')).toContainText('Das ist der Bildschirm des Rechners.');
  const bildschirm = page.getByTestId('v86-bildschirm');
  await expect(bildschirm).toBeVisible();
  await page.waitForTimeout(3_000);
  await bildschirm.screenshot({ path: info.outputPath('bildschirm-zettel.png') });

  // Editor als Gastprogramm öffnen; er läuft als azubi.
  await page.getByRole('tab', { name: 'Terminal', exact: true }).click();
  await tippeImTerminal(
    page,
    `pkill -x feh; mousepad ~/belege/gesehen.txt >/dev/null 2>&1 & until xwininfo -root -tree | grep -q gesehen.txt; do sleep 1; done; ps -o user,comm | grep '[m]ousepad'`
  );
  await expect(rows).toContainText(/azubi\s+mousepad/, { timeout: 180_000 });

  // Auf dem Bildschirm tippen und speichern: kein Prompt, also kein automatischer Prüflauf.
  await page.getByRole('tab', { name: 'Bildschirm', exact: true }).click();
  await bildschirm.focus();
  await page.waitForTimeout(2_000);
  await page.keyboard.type(GESEHEN);
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(8_000);
  await bildschirm.screenshot({ path: info.outputPath('bildschirm-editor.png') });
  await expect(page.getByTestId('pager')).not.toContainText(BILDSCHIRM_ERLEDIGT);

  // „Stand prüfen“ löst den vollen Prüflauf aus; das Speichern im Gast kann kurz nachlaufen.
  const standPruefen = page.getByRole('button', { name: 'Stand prüfen' });
  await expect(async () => {
    await standPruefen.click();
    await expect(page.getByTestId('pager')).toContainText(BILDSCHIRM_ERLEDIGT, {
      timeout: 10_000,
    });
  }).toPass({ timeout: 90_000 });
});

test('Ohne Bildschirmbedarf: Episode 1 und Staffel 1 laden kein Bildschirm-Image', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const abrufe = vmAbrufe(page);
  await page.setViewportSize({ width: 1400, height: 1000 });

  await page.goto(STAFFEL2);
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  await expect(page.locator('.xterm-rows').first()).toContainText(/azubi@rw-srv01/, {
    timeout: 90_000,
  });
  await expect(page.getByRole('tab', { name: 'Bildschirm', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stand prüfen' })).toHaveCount(0);

  await page.goto('/projekte/terminal-missionen/app');
  await page.getByRole('button', { name: /Erster Tag/ }).click();
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 90_000 });
  await expect(page.getByTestId('vorfall-schritt')).toContainText(/^Schritt 1\/\d+/, {
    timeout: 30_000,
  });
  await expect(page.getByRole('tab', { name: 'Bildschirm', exact: true })).toHaveCount(0);

  expect(abrufe).toContain('/missions/linux/alpine-state.bin.zst');
  expect(abrufe.filter((pfad) => pfad.startsWith(BILDSCHIRM_ASSETS))).toEqual([]);
});
