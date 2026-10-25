import { expect, test, type Page } from '@playwright/test';
import {
  ANFANG_E3,
  STAFFEL2_E3,
  anzahlImPager,
  befehl,
  belegBox,
  dialog,
  erhebeVorwurf,
  flaeche,
  oeffneAnsicht,
  pager,
  startEpisode,
  vorwurfKnopf,
  waehleBelege,
} from './helpers/staffel2';

// Episode 3 „Die Lücke im Log“ komplett gegen die echte VM: Ablesen mit Antwortfeld, zwei
// Belege, Ordnen in die Quarantäne, falsche und richtige Vorwürfe, Abschluss und Neuladen.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');
test.describe.configure({ mode: 'parallel' });
test.setTimeout(600_000);

const LOG = '/var/log/rechenwerk-auth.log';
const KOPIE = '/srv/rechenwerk/log-spiegel/rechenwerk-auth.log';
const SKRIPT = '/srv/rechenwerk/wartung/bin/logkuerzen.sh';

// Geprüfte Lösungswege (identisch zu den Tipps der dritten Stufe und zum VM-Test).
const ZEILEN = `grep -vxFf ${LOG} ${KOPIE} > ~/belege/luecke-zeilen.txt`;
const ZAEHLUNG = `grep -vxFf ${LOG} ${KOPIE} | cut -d' ' -f2 | sort | uniq -c > ~/belege/konten-zaehlung.txt`;
const ZAEHLUNG_GANZ = `cut -d' ' -f2 ${KOPIE} | sort | uniq -c > ~/belege/konten-zaehlung.txt`;
const ORDNEN = `mkdir -p ~/quarantaene && mv ${SKRIPT} ~/quarantaene/`;
const ORDNEN_KOPIERT = `mkdir -p ~/quarantaene && cp ${SKRIPT} ~/quarantaene/`;

const FRAGE = 'Wann steht die erste, wann die letzte fehlende Zeile? (HH:MM-HH:MM)';
const PAGER = {
  zeitraum: 'Erledigt: Lies ab, wann Zeilen fehlen',
  zeilen: 'Erledigt: Sichere die fehlenden Zeilen',
  zaehlung: 'Erledigt: Sichere die Häufigkeit je Konto',
  ordnen: 'Erledigt: Verschiebe das Löschskript in die Quarantäne',
  falscheAntwort: 'Das passt nicht zu dem, was das System zeigt.',
  richtig: 'Das passt zusammen: Die fehlenden Zeilen zeigen, dass Nadia',
  falschePerson: 'Diese Person passt nicht zu deinen Belegen.',
  zuWenig: 'Die Person könnte stimmen, aber die Begründung trägt noch nicht.',
  wieder: 'Der Vorwurf ist wieder möglich.',
  offen: 'Der Vorwurf sitzt. Bevor der Fall abgeschlossen ist, fehlt noch:',
  ordnenTitel: 'Verschiebe das Löschskript in die Quarantäne',
  diagnoseGanzesLog: 'Eine Zahl oder ein Konto stimmt nicht.',
  diagnoseKopiert: 'Das Original liegt noch im Wartungsordner.',
} as const;

async function antworte(page: Page, text: string): Promise<void> {
  await flaeche(page, 'Ansicht');
  await page.getByLabel(FRAGE).fill(text);
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
}

async function erwarteAbschluss(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toBeVisible({
    timeout: 45_000,
  });
  const bereich = page.getByRole('region', { name: 'Fall gelöst' });
  await expect(bereich).toContainText('Die Lücke im Log');
  await expect(bereich).toContainText('Code: S2-E3-LUECKE');
}

test('E3-1: Episode durchspielen mit falschen Vorwürfen, Diagnosen und richtigem Abschluss', async ({
  page,
}) => {
  await startEpisode(page, { episode: 3 });
  await expect(page.getByRole('heading', { level: 2, name: /^Episode 3/ })).toBeVisible();

  // Raumansicht: Werte kommen aus der VM.
  await oeffneAnsicht(page, 'Serverschrank');
  await page.getByRole('button', { name: 'Logserver', exact: true }).click();
  await expect(page.getByTestId('hotspot-detail')).toContainText(
    'Anmeldelog auf dem Server: 17 Zeilen',
    { timeout: 30_000 }
  );
  await expect(page.getByTestId('hotspot-detail')).toContainText(
    'Kopie auf dem Logserver: 24 Zeilen'
  );

  // Ablesen: erst falsch (Zeit der Nachbarzeilen), dann richtig, geprüft gegen den VM-Zustand.
  await antworte(page, '02:07-04:05');
  await expect(pager(page)).toContainText(PAGER.falscheAntwort, { timeout: 30_000 });
  expect(await anzahlImPager(page, PAGER.zeitraum)).toBe(0);
  await antworte(page, '02:14-03:09');
  await expect(pager(page)).toContainText(PAGER.zeitraum, { timeout: 30_000 });

  // Sichern: Das ganze Log zu zählen ist falsch, die Diagnose sagt warum.
  await befehl(page, ZAEHLUNG_GANZ, { pager: PAGER.diagnoseGanzesLog });
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);
  await befehl(page, ZEILEN, { pager: PAGER.zeilen });
  await befehl(page, ZAEHLUNG, { pager: PAGER.zaehlung });

  // Ordnen: Kopieren genügt nicht, die Diagnose sagt warum; Verschieben schließt die Spur.
  await befehl(page, ORDNEN_KOPIERT, { pager: PAGER.diagnoseKopiert });
  await befehl(page, `rm ~/quarantaene/logkuerzen.sh; ${ORDNEN}`, { pager: PAGER.ordnen });

  await waehleBelege(page, ['luecke-zeilen', 'konten-zaehlung']);
  await expect(page.getByText('Als Beleg erkannt')).toHaveCount(2);
  await expect(page.getByText('luecke-zeilen.txt', { exact: true })).toBeVisible();

  // Falsche Vorwürfe haben Folgen im Pager, aber keine Sackgasse.
  await erhebeVorwurf(page, 'Timo Kessler');
  await expect(pager(page)).toContainText(PAGER.falschePerson, { timeout: 45_000 });
  await waehleBelege(page, ['luecke-zeilen', 'konten-zaehlung']);
  await erhebeVorwurf(page, 'Margit Ostwind');
  await expect(dialog(page)).toBeHidden({ timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);

  await waehleBelege(page, ['luecke-zeilen', 'konten-zaehlung']);
  await erhebeVorwurf(page, 'Nadia Brem');
  await erwarteAbschluss(page);
  await expect(pager(page)).toContainText(PAGER.richtig);
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(1);
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(1);
});

test('E3-2: richtige Person mit nur einem Beleg sperrt, der zweite Beleg öffnet den Vorwurf', async ({
  page,
}) => {
  await startEpisode(page, { episode: 3 });
  await antworte(page, '02:14-03:09');
  await expect(pager(page)).toContainText(PAGER.zeitraum, { timeout: 30_000 });
  await befehl(page, ZEILEN, { pager: PAGER.zeilen });
  await waehleBelege(page, ['luecke-zeilen']);

  await erhebeVorwurf(page, 'Nadia Brem');
  await expect(pager(page)).toContainText(PAGER.zuWenig, { timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);
  await flaeche(page, 'Ansicht');
  await expect(vorwurfKnopf(page)).toBeDisabled({ timeout: 30_000 });

  // Ein zweiter erkannter Beleg hebt die Sperre auf; der Rest der Episode bleibt spielbar.
  await befehl(page, ZAEHLUNG, { pager: PAGER.zaehlung });
  await expect(pager(page)).toContainText(PAGER.wieder, { timeout: 30_000 });
  await waehleBelege(page, ['luecke-zeilen', 'konten-zaehlung']);

  // Der Vorwurf sitzt, aber die Quarantäne fehlt noch: Der Pager sagt, was offen ist.
  await erhebeVorwurf(page, 'Nadia Brem');
  await expect(pager(page)).toContainText(PAGER.offen, { timeout: 45_000 });
  await expect(pager(page)).toContainText(PAGER.ordnenTitel);
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);
  await befehl(page, ORDNEN, { pager: PAGER.ordnen });
  await erwarteAbschluss(page);
  await expect(pager(page)).toContainText(PAGER.richtig);
});

test('E3-3: Neuladen setzt Episode und VM zurück; die Episode ist danach erneut lösbar', async ({
  page,
}) => {
  await startEpisode(page, { episode: 3 });
  await antworte(page, '02:14-03:09');
  await expect(pager(page)).toContainText(PAGER.zeitraum, { timeout: 30_000 });
  await befehl(page, ZEILEN, { pager: PAGER.zeilen });
  await befehl(page, ORDNEN);
  await waehleBelege(page, ['luecke-zeilen']);

  await page.reload();
  const kopf = page.locator('#cookie-banner');
  if (await kopf.isVisible())
    await kopf.getByRole('button', { name: 'Ablehnen', exact: true }).click();
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 120_000 });
  await expect(pager(page)).toContainText(ANFANG_E3, { timeout: 120_000 });
  expect(await anzahlImPager(page, PAGER.zeitraum)).toBe(0);
  await expect(page).toHaveURL(new RegExp(`${STAFFEL2_E3.replace('?', '\\?')}$`));

  // Neue VM, neuer Stand: kein Beleg, Skript wieder an seinem Platz.
  await oeffneAnsicht(page, 'Aktenwand');
  await expect(page.getByText('Noch keine Dateien in ~/belege/.')).toBeVisible({ timeout: 30_000 });
  await befehl(page, `ls ${SKRIPT}`);
  await expect(page.locator('.xterm-rows').first()).not.toContainText('No such file');

  // Der Lösungsweg funktioniert nach dem Neuladen von vorn.
  await antworte(page, '02:14-03:09');
  await expect(pager(page)).toContainText(PAGER.zeitraum, { timeout: 30_000 });
  await befehl(page, ZEILEN, { pager: PAGER.zeilen });
  await befehl(page, ZAEHLUNG, { pager: PAGER.zaehlung });
  await befehl(page, ORDNEN, { pager: PAGER.ordnen });
  await waehleBelege(page, ['luecke-zeilen', 'konten-zaehlung']);
  await expect(belegBox(page, 'konten-zaehlung')).toBeChecked();
  await erhebeVorwurf(page, 'Nadia Brem');
  await erwarteAbschluss(page);
});
