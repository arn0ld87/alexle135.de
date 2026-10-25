import { expect, test } from '@playwright/test';
import { befehl, erhebeVorwurf, pager, startEpisode, waehleBelege } from './helpers/staffel2';

// Spielstand von Staffel 2: Der Abschluss einer Episode bleibt im Browser, die Wiederaufnahme ohne
// ?episode= startet die erste ungelöste Episode, der Reset löscht nur Staffel 2.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');
test.setTimeout(420_000);

const META =
  'ls -l /srv/rechenwerk/uebung/kaffeekasse.csv /srv/rechenwerk/uebung/kaffeekasse.bak > ~/belege/kasse-meta.txt';
const ZEILEN =
  'grep 2026-04-15 /srv/rechenwerk/uebung/kaffeekasse.csv > ~/belege/kasse-zeilen.txt && grep 2026-04-15 /srv/rechenwerk/uebung/kaffeekasse.bak >> ~/belege/kasse-zeilen.txt';
const KOPIE = 'cp /srv/rechenwerk/uebung/kaffeekasse.bak /srv/rechenwerk/uebung/kaffeekasse.csv';

test('Spielstand: Episode 0 lösen, ohne Angabe geht es mit Episode 1 weiter, Reset beginnt neu', async ({
  page,
}) => {
  await startEpisode(page, { episode: 0 });
  const zaehler = page.getByTestId('episoden-zaehler');
  await expect(zaehler).toHaveText(/^0 von \d+ gelöst$/);
  await expect(page.getByText('Neuladen oder „Neu starten“ im Terminal beginnt')).toBeVisible();

  await befehl(page, META, { pager: 'Erledigt: Sichere Besitzer, Rechte und Datum der Dateien' });
  const feld = page.getByLabel('Wem gehört die geänderte Liste? (Benutzername)');
  await feld.fill('kaffee');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(pager(page)).toContainText('Erledigt: Lies den Besitzer der Liste ab', {
    timeout: 30_000,
  });
  await befehl(page, ZEILEN, { pager: 'Erledigt: Sichere die geänderte Zeile und ihr Original' });
  await befehl(page, KOPIE, { pager: 'Erledigt: Stelle die Liste aus der Sicherung wieder her' });
  await waehleBelege(page, ['kasse-meta', 'kasse-zeilen']);
  await erhebeVorwurf(page, 'Kaffeeautomat');
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toBeVisible({
    timeout: 45_000,
  });
  await expect(zaehler).toHaveText(/^1 von \d+ gelöst$/);

  // Neuladen ohne Angabe: die erste ungelöste Episode.
  await page.goto('/projekte/terminal-missionen/app/staffel-2');
  await expect(page.getByRole('heading', { level: 2, name: /^Episode 1/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('episoden-zaehler')).toHaveText(/^1 von \d+ gelöst$/);
  await expect(page.getByRole('link', { name: 'Episode 0 · Probelauf · gelöst' })).toBeVisible();

  // Reset: Dialog bestätigen, danach beginnt Episode 0 wieder.
  await page.getByRole('button', { name: 'Fortschritt von Staffel 2 löschen' }).click();
  await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeHidden();
  await expect(page.getByTestId('episoden-zaehler')).toHaveText(/^1 von \d+ gelöst$/);
  await page.getByRole('button', { name: 'Fortschritt von Staffel 2 löschen' }).click();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /^Episode 0/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('episoden-zaehler')).toHaveText(/^0 von \d+ gelöst$/);
  await expect(page).toHaveURL(/\/app\/staffel-2\/?$/);
});
