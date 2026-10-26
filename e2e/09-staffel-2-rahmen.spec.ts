import { expect, test, type Page } from '@playwright/test';
import {
  LOG,
  PAGER,
  VERSTOSS,
  aktualisiere,
  anzahlImPager,
  befehl,
  flaeche,
  oeffneAnsicht,
  rows,
  shot,
  startEpisode,
  vorwurfKnopf,
  oeffneAkte,
} from './helpers/staffel2';

// Ticket 10: echter Einsatzrahmen-Verstoß (sudo-Aufruf im ausgeschlossenen Ordner) und beide
// Erholungswege gegen die echte VM. Jedes Szenario bootet eine eigene VM.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');
test.describe.configure({ mode: 'parallel' });
test.setTimeout(420_000);

/** Führt den ausgeschlossenen Aufruf aus und wartet, bis die Oberfläche den Verstoß zeigt. */
async function verstossAusfuehren(page: Page): Promise<void> {
  await befehl(page, VERSTOSS);
  // Die echte Datei wurde gelesen; der nächste reguläre Prompt löst die Prüfung des sudo-Protokolls aus.
  await expect(rows(page)).toContainText('Fiktive Uebungsdatei der Rechenwerk Ostwind GmbH');
  await befehl(page, 'true');
  await flaeche(page, 'Ansicht');
  await oeffneAkte(page);
  await expect(page.getByRole('region', { name: 'Einsatzrahmen' })).toContainText(
    'Einsatzrahmen verletzt.',
    { timeout: 45_000 }
  );
}

const gesperrt = async (page: Page): Promise<void> => {
  await oeffneAnsicht(page, 'Aktenwand');
  await expect(vorwurfKnopf(page)).toBeDisabled({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Ansichten' })).toContainText(PAGER.gesperrt);
};

test('T10-7: ausgeschlossener sudo-Aufruf wird erkannt, Folge einmal, Sperre sichtbar', async ({
  page,
}) => {
  await startEpisode(page);
  await verstossAusfuehren(page);
  await oeffneAkte(page);
  await expect(page.getByRole('region', { name: 'Einsatzrahmen' })).toContainText(PAGER.gesperrt);
  await expect.poll(() => anzahlImPager(page, PAGER.folge), { timeout: 30_000 }).toBe(1);

  await gesperrt(page);
  await shot(page, 't10-7-sperrhinweis');

  // Weitere reguläre Prompts und Aktualisierungen wiederholen die Folge nicht.
  await befehl(page, 'true');
  await aktualisiere(page);
  expect(await anzahlImPager(page, PAGER.folge)).toBe(1);
});

test('T10-8a: Erholung durch einen weiteren gesicherten Beleg', async ({ page }) => {
  await startEpisode(page);
  await verstossAusfuehren(page);
  await gesperrt(page);

  // Abfrage-Aktualisierung allein baut die Sperre nicht ab.
  for (let i = 0; i < 3; i++) {
    await aktualisiere(page);
    await expect(vorwurfKnopf(page)).toBeDisabled({ timeout: 30_000 });
  }

  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await expect(vorwurfKnopf(page)).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Ansichten' })).not.toContainText(PAGER.gesperrt);
  await oeffneAkte(page);
  await expect(page.getByRole('region', { name: 'Einsatzrahmen' })).not.toContainText(
    PAGER.gesperrt
  );
  await oeffneAkte(page);
  await expect(page.getByRole('region', { name: 'Einsatzrahmen' })).toContainText(
    'Einsatzrahmen verletzt.'
  );
  expect(await anzahlImPager(page, PAGER.folge)).toBe(1);
});

test('T10-8b: Erholung durch drei vollständige Prüfungen', async ({ page }) => {
  await startEpisode(page);
  await verstossAusfuehren(page);
  await gesperrt(page);

  for (let i = 0; i < 3; i++) {
    await aktualisiere(page);
    await expect(vorwurfKnopf(page)).toBeDisabled({ timeout: 30_000 });
  }

  // Nach der 1. und 2. vollständigen Prüfung bleibt die Sperre, erst die 3. gibt frei.
  for (let i = 1; i <= 2; i++) {
    await befehl(page, 'true');
    await expect(vorwurfKnopf(page)).toBeDisabled();
    await expect(page.getByRole('region', { name: 'Ansichten' })).toContainText(PAGER.gesperrt);
  }
  await befehl(page, 'true');
  await expect(vorwurfKnopf(page)).toBeEnabled({ timeout: 45_000 });
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Ansichten' })).not.toContainText(PAGER.gesperrt);
  await oeffneAkte(page);
  await expect(page.getByRole('region', { name: 'Einsatzrahmen' })).not.toContainText(
    PAGER.gesperrt
  );
  expect(await anzahlImPager(page, PAGER.folge)).toBe(1);
});
