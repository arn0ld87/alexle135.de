import { expect, test } from '@playwright/test';
import {
  ANFANG,
  anzahlImPager,
  befehl,
  erhebeVorwurf,
  pager,
  startEpisode,
  waehleBelege,
} from './helpers/staffel2';

// Ticket 12: Episode 0 „Probelauf“ komplett gegen die echte VM, mit einer Diagnose bei einem
// halben Beleg und dem Link zu Episode 1.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');
test.setTimeout(420_000);

const META =
  'ls -l /srv/rechenwerk/uebung/kaffeekasse.csv /srv/rechenwerk/uebung/kaffeekasse.bak > ~/belege/kasse-meta.txt';
const META_HALB = 'ls -l /srv/rechenwerk/uebung/kaffeekasse.csv > ~/belege/kasse-meta.txt';
const ZEILEN =
  'grep 2026-04-15 /srv/rechenwerk/uebung/kaffeekasse.csv > ~/belege/kasse-zeilen.txt && grep 2026-04-15 /srv/rechenwerk/uebung/kaffeekasse.bak >> ~/belege/kasse-zeilen.txt';

const DIAGNOSE =
  'In deinem Beleg fehlt noch kaffeekasse.bak. Beide Dateien gehören in denselben Beleg.';
const META_ERLEDIGT = 'Erledigt: Sichere Besitzer, Rechte und Datum der Dateien';
const BESITZER_ERLEDIGT = 'Erledigt: Lies den Besitzer der Liste ab';
const ZEILEN_ERLEDIGT = 'Erledigt: Sichere die geänderte Zeile und ihr Original';
const RICHTIG = 'Das passt zusammen: Die Liste gehört dem Konto kaffee';

test('T12-1: Episode 0 durchspielen, Diagnose sehen, weiter zu Episode 1', async ({ page }) => {
  await startEpisode(page, { episode: 0 });
  await expect(page.getByRole('heading', { level: 2, name: /^Episode 0/ })).toBeVisible();

  // Halber Beleg: Der Pager nennt, was fehlt, genau einmal.
  await befehl(page, META_HALB, { pager: DIAGNOSE });
  expect(await anzahlImPager(page, DIAGNOSE)).toBe(1);
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);

  await befehl(page, META, { pager: META_ERLEDIGT });

  // Antwortfeld: erst falsch, dann richtig.
  const feld = page.getByLabel('Wem gehört die geänderte Liste? (Benutzername)');
  await feld.fill('azubi');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(pager(page)).toContainText('Das passt nicht zu dem, was das System zeigt.', {
    timeout: 30_000,
  });
  await feld.fill('kaffee');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(pager(page)).toContainText(BESITZER_ERLEDIGT, { timeout: 30_000 });

  await befehl(page, ZEILEN, { pager: ZEILEN_ERLEDIGT });

  await waehleBelege(page, ['kasse-meta', 'kasse-zeilen']);
  await erhebeVorwurf(page, 'Kaffeeautomat');

  const titel = page.getByRole('heading', { name: 'Fall gelöst' });
  await expect(titel).toBeVisible({ timeout: 45_000 });
  const bereich = page.getByRole('region', { name: 'Fall gelöst' });
  await expect(bereich).toContainText('Die Kaffeekasse');
  await expect(bereich).toContainText('Code: S2-E0-KASSE');
  await expect(pager(page)).toContainText(RICHTIG);

  // Der Link ist ein echter Link und führt zu Episode 1.
  const weiter = bereich.getByRole('link', { name: 'Weiter zu Episode 1' });
  await expect(weiter).toHaveAttribute('href', /\?episode=1$/);
  await weiter.click();
  await expect(page).toHaveURL(/\/app\/staffel-2\?episode=1$/);
  await expect(page.getByRole('heading', { level: 2, name: /^Episode 1/ })).toBeVisible();
  await expect(pager(page)).toContainText(ANFANG, { timeout: 240_000 });
});

test('T12-2: ohne Angabe oder mit unbekanntem Wert startet Episode 0, mit episode=1 Episode 1', async ({
  page,
}) => {
  for (const [query, titel] of [
    ['', /^Episode 0/],
    ['?episode=7', /^Episode 0/],
    ['?episode=abc', /^Episode 0/],
    ['?episode=1', /^Episode 1/],
  ] as const) {
    await page.goto(`/projekte/terminal-missionen/app/staffel-2${query}`);
    await expect(page.getByRole('heading', { level: 2, name: titel })).toBeVisible({
      timeout: 30_000,
    });
  }
});
