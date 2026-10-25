import { expect, test, type Page } from '@playwright/test';
import {
  STAFFEL2_BASIS,
  anzahlImPager,
  befehl,
  erhebeVorwurf,
  pager,
  rows,
  shot,
  waehleBelege,
} from './helpers/staffel2';

// Episode 2 „Der Prozess, der nicht stirbt“ komplett gegen die echte VM mit Bildschirm: Der Zettel
// steht nur als Bildbeleg im Gast und wird im Bildbetrachter gelesen. Alle Befehle laufen als azubi
// durch die echte Terminaloberfläche.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');
test.setTimeout(900_000);

const EPISODE2 = `${STAFFEL2_BASIS}?episode=2`;
const BILDSCHIRM_ASSETS = '/missions/linux/bildschirm/';
const ANFANG = 'Auf rw-srv01 läuft ein Prozess namens rw-abgleich.';

const PROZESS = "ps | grep -E 'rw-abgleich|crond' > ~/belege/prozess-zeile.txt";
const NUR_BEENDEN = 'sudo pkill -x rw-abgleich';
const ENDGUELTIG = 'sudo crontab -u abgleich -r; sudo pkill -x rw-abgleich';
const JOURNAL =
  "grep 'change=RW-2122 ' /var/log/rechenwerk-wartung.log > ~/belege/wartung-zeile.txt";

const PAGER = {
  prozessErledigt: 'Erledigt: Sichere die Prozesszeile und ihren Starter',
  kommtWieder: 'Cron-Eintrag startet ihn gleich wieder',
  eingriffErledigt: 'Erledigt: Beende den Wiedergänger endgültig',
  kennungErledigt: 'Erledigt: Lies die Kennung vom Zettel ab',
  journalErledigt: 'Erledigt: Sichere die Journalzeile zur Kennung',
  richtig: 'Das passt zusammen: Der Zettel nennt RW-2122',
  falschePerson: 'Diese Person passt nicht zu deinen Belegen.',
} as const;

async function tippeImTerminal(page: Page, text: string) {
  await page.getByRole('button', { name: 'Terminal', exact: true }).click();
  await page.getByTestId('v86-terminal').click({ position: { x: 30, y: 30 } });
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('Episode 2: Wiedergänger beenden, Zettel auf dem Bildschirm lesen, Nadia überführen', async ({
  page,
}, info) => {
  const abrufe: string[] = [];
  page.on('request', (req) => {
    const pfad = new URL(req.url()).pathname;
    if (pfad.startsWith('/missions/linux/')) abrufe.push(pfad);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(EPISODE2);
  const consent = page.locator('#cookie-banner');
  if (await consent.isVisible()) {
    await consent.getByRole('button', { name: 'Ablehnen', exact: true }).click();
  }
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 240_000 });
  await expect(rows(page)).toContainText(/azubi@rw-srv01/, { timeout: 120_000 });
  await expect(pager(page)).toContainText(ANFANG, { timeout: 90_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(abrufe).toContain(`${BILDSCHIRM_ASSETS}alpine-state.bin.zst`);
  await expect(page.getByRole('heading', { level: 2, name: /^Episode 2/ })).toBeVisible();

  // Spur Prozess, Schritt 1: Prozess- und crond-Zeile als Beleg.
  await befehl(page, PROZESS, { pager: PAGER.prozessErledigt, timeout: 60_000 });

  // Typischer Fehler: nur beenden. Die Diagnose nennt den Cron, genau einmal.
  await befehl(page, NUR_BEENDEN, { pager: PAGER.kommtWieder, timeout: 60_000 });
  expect(await anzahlImPager(page, PAGER.kommtWieder)).toBe(1);
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);

  // Richtig: Cron-Eintrag weg und Prozess beendet, in einem Zug.
  await befehl(page, ENDGUELTIG, { pager: PAGER.eingriffErledigt, timeout: 60_000 });

  // Spur Zettel: Bildschirm starten und das Foto im Bildbetrachter ansehen.
  await tippeImTerminal(page, 'bildschirm');
  await expect(rows(page)).toContainText('Bildschirm läuft.', { timeout: 240_000 });
  await tippeImTerminal(
    page,
    `feh ~/fotos/IMG_0417.png & until xwininfo -root -tree | grep -q '"feh'; do sleep 1; done; echo ZETTEL-$((40+2))`
  );
  await expect(rows(page)).toContainText('ZETTEL-42', { timeout: 240_000 });
  await page.getByRole('button', { name: 'Bildschirm', exact: true }).click();
  const bildschirm = page.getByTestId('v86-bildschirm');
  await expect(bildschirm).toBeVisible();
  await page.waitForTimeout(4_000);
  await bildschirm.screenshot({ path: info.outputPath('bildschirm-zettel.png') });
  await shot(page, 'ep2-bildschirm-zettel');

  // Antwortfeld: erst eine Kennung aus dem Journal, die nicht auf dem Zettel steht, dann die richtige.
  const feld = page.getByLabel('Welche Änderungskennung steht auf dem Zettel? (RW-…)');
  await feld.fill('RW-2117');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(pager(page)).toContainText('Das passt nicht zu dem, was das System zeigt.', {
    timeout: 30_000,
  });
  await feld.fill('RW-2122');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(pager(page)).toContainText(PAGER.kennungErledigt, { timeout: 30_000 });

  await befehl(page, JOURNAL, { pager: PAGER.journalErledigt, timeout: 60_000 });

  // Vorwurf: erst die falsche Person, dann Nadia.
  await waehleBelege(page, ['prozess-zeile', 'wartung-zeile']);
  await erhebeVorwurf(page, 'Timo Kessler');
  await expect(pager(page)).toContainText(PAGER.falschePerson, { timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);

  await waehleBelege(page, ['prozess-zeile', 'wartung-zeile']);
  await erhebeVorwurf(page, 'Nadia Brem');
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toBeVisible({ timeout: 45_000 });
  const bereich = page.getByRole('region', { name: 'Fall gelöst' });
  await expect(bereich).toContainText('Der Wiedergänger');
  await expect(bereich).toContainText('Code: S2-E2-PROZESS');
  await expect(pager(page)).toContainText(PAGER.richtig);
  await shot(page, 'ep2-abschluss');
});
