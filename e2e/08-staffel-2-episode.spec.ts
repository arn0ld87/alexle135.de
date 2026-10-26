import { expect, test } from '@playwright/test';
import {
  ANFANG,
  BELEG_DATEI,
  FRAGE_KENNUNG,
  LOG,
  PAGER,
  RECHTE_METADATEN,
  RECHTE_REGEL,
  REGEL_WEG,
  STATUS_WEG,
  aktualisiere,
  antworte,
  anzahlImPager,
  befehl,
  belegBox,
  dialog,
  erhebeVorwurf,
  erwarteAbschluss,
  flaeche,
  loeseRechteRest,
  oeffneAnsicht,
  pager,
  rows,
  shot,
  startEpisode,
  vorwurfKnopf,
  waehleBelege,
} from './helpers/staffel2';

// Ticket 10: Episode 1 von der Raumansicht bis zum Abschluss, falsche und unvollständige Vorwürfe,
// Belegverlust und Aktenwand-Sonderfälle gegen die echte VM. Jedes Szenario bootet eine eigene VM.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');
test.describe.configure({ mode: 'parallel' });
test.setTimeout(420_000);

const gesperrtSichtbar = async (page: import('@playwright/test').Page) => {
  await flaeche(page, 'Ansicht');
  await expect(vorwurfKnopf(page)).toBeDisabled({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Ansichten' })).toContainText(PAGER.gesperrt);
};

test('T10-1: Raum lesen, Log vor Rechte-Zeile sichern, richtiger Vorwurf', async ({ page }) => {
  await startEpisode(page);

  // Raumansicht: Werte kommen aus der VM, nicht aus dem Datensatz.
  await oeffneAnsicht(page, 'Serverschrank');
  await page.getByRole('button', { name: 'Schild am Rack', exact: true }).click();
  await expect(page.getByTestId('hotspot-detail')).toContainText('rw-srv01', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Verwaltungsterminal', exact: true }).click();
  await expect(page.getByTestId('hotspot-detail')).toContainText('timo (UID 1101), Timo Kessler');
  await page.getByRole('button', { name: 'Statusleuchte', exact: true }).click();
  await expect(page.getByTestId('hotspot-detail')).toContainText('Laufzeit seit Neustart');
  await shot(page, 't10-1-raum');

  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });

  // Aktenwand: echte Dateien mit Größe, nur erkannte Belege sind wählbar.
  await waehleBelege(page, ['log-zeile', 'rechte-zeile']);
  await expect(page.getByText('log-zeile.txt', { exact: true })).toBeVisible();
  await expect(page.getByText('rechte-zeile.txt', { exact: true })).toBeVisible();
  await expect(page.getByText('Als Beleg erkannt')).toHaveCount(2);
  await shot(page, 't10-1-aktenwand');

  await flaeche(page, 'Ansicht');
  await vorwurfKnopf(page).click();
  await expect(dialog(page)).toBeVisible();
  await shot(page, 't10-1-dialog');
  await dialog(page).getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await erhebeVorwurf(page, 'Timo Kessler');

  // Der Vorwurf sitzt, der Fall schließt erst mit dem Rest der Spur Rechte.
  await expect(pager(page)).toContainText(PAGER.vorwurfOffen, { timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(0);
  await loeseRechteRest(page, 'kennung');
  await erwarteAbschluss(page);
  await shot(page, 't10-1-abschluss');
  await expect(pager(page)).toContainText(PAGER.richtig);
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(1);
  await expect(page.getByText('Der Rechtefund')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(1);

  // Spielmodus (#170): Auch auf dem Handy ist der ganze Abschluss bis zum letzten Element
  // erreichbar, obwohl die Seite selbst nicht scrollt.
  const abschluss = page.locator('section[aria-labelledby="ermittlung-abschluss"]');
  const letztes = abschluss.locator('a, p').last();
  for (const height of [844, 667]) {
    await page.setViewportSize({ width: 390, height });
    // Kein scrollIntoView: Das scrollt per Skript auch Container mit overflow:hidden, die Finger
    // und Mausrad nicht bewegen. Erreichbar ist, was im Fenster liegt oder in einem Bereich mit
    // eigenem Scrollen.
    const erreichbar = await letztes.evaluate((el) => {
      if (el.getBoundingClientRect().bottom <= window.innerHeight) return true;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const { overflowY } = getComputedStyle(p);
        if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
          return p.getBoundingClientRect().bottom <= window.innerHeight;
        }
      }
      return false;
    });
    expect(erreichbar, `Abschluss bei 390x${height}`).toBe(true);
  }
});

test('T10-2: umgekehrte Spurenreihenfolge, Rechte-Spur bleibt linear', async ({ page }) => {
  await startEpisode(page);

  // Dritter Rechte-Schritt zuerst: Er zählt nicht, solange die Schritte davor fehlen.
  await befehl(page, RECHTE_METADATEN);
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });
  expect(await anzahlImPager(page, PAGER.metaErledigt)).toBe(0);
  // Auch ein weiterer Prompt ändert daran nichts, erst die Antwort schaltet den Beleg-Schritt frei.
  await befehl(page, 'true');
  expect(await anzahlImPager(page, PAGER.metaErledigt)).toBe(0);
  await antworte(page, FRAGE_KENNUNG, 'RW-1042');
  await expect(pager(page)).toContainText(PAGER.kennungErledigt, { timeout: 30_000 });
  await befehl(page, 'true', { pager: PAGER.metaErledigt });
  await befehl(page, LOG, { pager: PAGER.logErledigt });

  // Rechte-Metadaten plus Log genügt, ohne die Rechte-Zeile zu wählen.
  await waehleBelege(page, ['log-zeile', 'rechte-metadaten']);
  await erhebeVorwurf(page, 'Timo Kessler');
  await expect(pager(page)).toContainText(PAGER.vorwurfOffen, { timeout: 45_000 });
  await loeseRechteRest(page, 'regel');
  await erwarteAbschluss(page);
  await expect(pager(page)).toContainText(PAGER.richtig);
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(1);
});

test('T10-3: falsche Person bei erkannten Belegen', async ({ page }) => {
  await startEpisode(page);
  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });
  await waehleBelege(page, ['log-zeile', 'rechte-zeile']);

  await erhebeVorwurf(page, 'Nadia Brem');
  await expect(pager(page)).toContainText(PAGER.falschePerson, { timeout: 45_000 });
  await gesperrtSichtbar(page);
  await shot(page, 't10-3-sperre');
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);
  expect(await anzahlImPager(page, PAGER.falschePerson)).toBe(1);
  // Aktualisieren verändert weder Versuch noch Sperre.
  await aktualisiere(page);
  await expect(belegBox(page, 'log-zeile')).toBeVisible({ timeout: 30_000 });
  await gesperrtSichtbar(page);
  expect(await anzahlImPager(page, PAGER.falschePerson)).toBe(1);

  // Die Sperre ist begrenzt: Der dritte erkannte Beleg hebt sie auf (Sperre lag bei zwei erkannten
  // Belegen auf dem dritten), danach ist der Vorwurf wieder möglich.
  await befehl(page, RECHTE_METADATEN, { pager: PAGER.wieder, timeout: 60_000 });
  await flaeche(page, 'Ansicht');
  await expect(vorwurfKnopf(page)).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Ansichten' })).not.toContainText(PAGER.gesperrt);
});

test('T10-4: richtige Person, aber nur Belege aus der Rechte-Spur', async ({ page }) => {
  await startEpisode(page);
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });
  await befehl(page, RECHTE_METADATEN);
  await waehleBelege(page, ['rechte-zeile', 'rechte-metadaten']);

  await erhebeVorwurf(page, 'Timo Kessler');
  await expect(pager(page)).toContainText(PAGER.zuWenig, { timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);
  await expect(page.getByText('Der Rechtefund')).toHaveCount(0);
  expect(await anzahlImPager(page, PAGER.zuWenig)).toBe(1);
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(0);
  await gesperrtSichtbar(page);
});

test('T10-5: Beleg nach der letzten Prüfung gelöscht, Frischprüfung erkennt den Verlust', async ({
  page,
}) => {
  await startEpisode(page);
  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });
  await waehleBelege(page, ['log-zeile', 'rechte-zeile']);

  // Vorbedingung über das echte Terminal: Die Datei fehlt, der nächste Prompt (und damit die
  // nächste Hook-Prüfung) bleibt durch sleep aus. Der Browser-Snapshot kennt den Beleg noch.
  await flaeche(page, 'Terminal');
  await page.getByTestId('v86-terminal').click({ position: { x: 30, y: 30 } });
  await page.keyboard.type('rm ~/belege/rechte-zeile.txt ; echo ZZ""T10DEL ; sleep 60');
  await page.keyboard.press('Enter');
  await expect(rows(page)).toContainText('ZZT10DEL', { timeout: 30_000 });

  await erhebeVorwurf(page, 'Timo Kessler');
  await expect(page.locator('main')).toContainText(PAGER.belegWeg, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(0);
  // Kein bewerteter Versuch: keine Bewertungsantwort, keine Sperre.
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(0);
  expect(await anzahlImPager(page, PAGER.zuWenig)).toBe(0);
  expect(await anzahlImPager(page, PAGER.falschePerson)).toBe(0);
  await flaeche(page, 'Ansicht');
  await expect(vorwurfKnopf(page)).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Ansichten' })).not.toContainText(PAGER.gesperrt);

  // Erholung ohne verbrauchten Versuch: Beleg neu sichern, erneut absenden.
  await flaeche(page, 'Terminal');
  await page.getByTestId('v86-terminal').click({ position: { x: 30, y: 30 } });
  await page.keyboard.press('Control+c');
  await befehl(page, RECHTE_REGEL);
  await waehleBelege(page, ['log-zeile', 'rechte-zeile']);
  await erhebeVorwurf(page, 'Timo Kessler');
  await expect(pager(page)).toContainText(PAGER.vorwurfOffen, { timeout: 45_000 });
  await loeseRechteRest(page, 'kennung');
  await erwarteAbschluss(page);
  await expect(pager(page)).toContainText(PAGER.richtig);
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(1);
});

test('T10-6: Doppelklick auf Absenden bewertet nur einmal', async ({ page }) => {
  await startEpisode(page);
  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });
  await befehl(page, RECHTE_METADATEN);
  await waehleBelege(page, ['log-zeile', 'rechte-zeile', 'rechte-metadaten']);

  await erhebeVorwurf(page, 'Timo Kessler', { doppelklick: true });
  await expect(pager(page)).toContainText(PAGER.vorwurfOffen, { timeout: 45_000 });
  expect(await anzahlImPager(page, PAGER.vorwurfOffen)).toBe(1);
  await loeseRechteRest(page, 'kennung');
  await erwarteAbschluss(page);
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toHaveCount(1);
  await expect(page.getByText('Der Rechtefund')).toHaveCount(1);
  await expect(pager(page)).toContainText(PAGER.richtig);
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(1);
  expect(await anzahlImPager(page, PAGER.falschePerson)).toBe(0);
});

test('ADR 0009: Episode 1 mit allen Schrittarten durchspielen, bis zum Vorwurf und Abschluss', async ({
  page,
}) => {
  await startEpisode(page);

  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });

  // Ablesen: erst falsch (Hinweis, nichts erledigt), dann richtig.
  await antworte(page, FRAGE_KENNUNG, 'RW-1041');
  await expect(pager(page)).toContainText('Das passt nicht zu dem, was das System zeigt.', {
    timeout: 30_000,
  });
  expect(await anzahlImPager(page, PAGER.kennungErledigt)).toBe(0);
  await antworte(page, FRAGE_KENNUNG, 'RW-1042');
  await expect(pager(page)).toContainText(PAGER.kennungErledigt, { timeout: 30_000 });

  await befehl(page, RECHTE_METADATEN, { pager: PAGER.metaErledigt });

  // Reparieren: Kopieren statt Verschieben löst nichts und bekommt eine Diagnose.
  await befehl(page, 'cp /etc/sudoers.d/rw-fernwartung ~/quarantaene/', {
    pager: 'Die Regel liegt noch in /etc/sudoers.d, in der Quarantäne nur eine Kopie.',
  });
  expect(await anzahlImPager(page, PAGER.regelWegErledigt)).toBe(0);
  await befehl(page, REGEL_WEG, { pager: PAGER.regelWegErledigt, timeout: 60_000 });

  // Ordnen schließt die Spur Rechte ab.
  await befehl(page, STATUS_WEG, { pager: PAGER.statusWegErledigt, timeout: 60_000 });
  await expect(pager(page)).toContainText(PAGER.rechteSpur);

  // Die vor dem Eingriff gesicherten Belege zählen weiter; der Einsatzrahmen ist unversehrt.
  await waehleBelege(page, ['log-zeile', 'rechte-zeile', 'rechte-metadaten']);
  await flaeche(page, 'Ansicht');
  await expect(page.getByRole('region', { name: 'Einsatzrahmen' })).not.toContainText(
    'Einsatzrahmen verletzt.'
  );
  await erhebeVorwurf(page, 'Timo Kessler');
  await erwarteAbschluss(page);
  await expect(pager(page)).toContainText(PAGER.richtig);
  expect(await anzahlImPager(page, PAGER.richtig)).toBe(1);
});

test('ADR 0009: Neu laden startet Episode 1 frisch, Regel und Programm liegen wieder am Platz', async ({
  page,
}) => {
  await startEpisode(page);
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });
  await antworte(page, FRAGE_KENNUNG, 'RW-1042');
  await expect(pager(page)).toContainText(PAGER.kennungErledigt, { timeout: 30_000 });
  await befehl(page, REGEL_WEG);
  await befehl(page, STATUS_WEG);
  await befehl(page, 'ls /etc/sudoers.d ~/quarantaene');
  await expect(rows(page)).toContainText('rw-status');

  await page.reload();
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 120_000 });
  await expect(rows(page)).toContainText(/azubi@rw-srv01/, { timeout: 120_000 });
  await expect(pager(page)).toContainText(ANFANG, { timeout: 60_000 });
  expect(await anzahlImPager(page, PAGER.regelErledigt)).toBe(0);
  await expect(page.getByRole('heading', { level: 2, name: /^Episode 1/ })).toBeVisible();
  await flaeche(page, 'Ansicht');
  await expect(
    page.getByRole('button', { name: 'Rechte, 0 von 5 Schritten erledigt' })
  ).toBeVisible();

  // Frischer Zustand in der VM: Regel und Programm sind zurück, die Quarantäne ist leer.
  await befehl(page, 'ls /etc/sudoers.d /usr/local/bin; echo ZZ""Q$(ls ~/quarantaene | wc -l)Z');
  await expect(rows(page)).toContainText('rw-fernwartung');
  await expect(rows(page)).toContainText('ZZQ0Z');
  // Und die Episode ist wieder spielbar.
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });
});

test('T10-9: leere, fehlerhafte und geänderte Dateien in der Aktenwand', async ({ page }) => {
  await startEpisode(page);

  // Leere Aktenwand ist etwas anderes als ein Lesefehler.
  await oeffneAnsicht(page, 'Aktenwand');
  await expect(page.getByText('Noch keine Dateien in ~/belege/.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Ansicht konnte nicht gelesen werden')).toHaveCount(0);
  await shot(page, 't10-9-leer');

  // Fingerabdruck aller Dateien im Belegordner: Inhalt (sha256) sowie Name, mtime und Größe.
  const stand = async (): Promise<string> => {
    await befehl(
      page,
      'echo "ZZ""SUM$( (find ~/belege -type f -exec sha256sum {} + ; find ~/belege -exec stat -c \'%n %Y %s\' {} +) | sort | sha256sum | cut -c1-16)ZZ"'
    );
    const text = (await rows(page).textContent()) ?? '';
    const treffer = [...text.matchAll(/ZZSUM([0-9a-f]{16})ZZ/g)];
    expect(treffer.length).toBeGreaterThan(0);
    return treffer[treffer.length - 1][1];
  };

  // Leere Datei, falscher Inhalt unter Belegname, Symlink unter Belegname.
  await befehl(page, ': > ~/belege/leer.txt');
  await befehl(page, 'echo falsch > ~/belege/log-zeile.txt');
  await befehl(page, 'ln -s /etc/passwd ~/belege/rechte-zeile.txt');
  const vorher = await stand();
  await oeffneAnsicht(page, 'Aktenwand');
  await aktualisiere(page);
  await expect(page.getByText('leer.txt', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('0 Bytes').first()).toBeVisible();
  await expect(page.getByText('Keine Belegregel für diese Datei')).toHaveCount(1);
  await expect(page.getByText('Noch nicht als Beleg erkannt').first()).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await shot(page, 't10-9-fehlerhaft');

  // Aktualisieren und Ansichtswechsel schreiben nichts in die VM.
  for (let i = 0; i < 3; i++) await aktualisiere(page);
  await zeigeRaum(page);
  await oeffneAnsicht(page, 'Aktenwand');
  expect(await stand()).toBe(vorher);

  // Datei ändern: richtiger Inhalt wird beim nächsten Prompt erkannt, nie vorher als Geisterbeleg.
  await befehl(page, 'rm ~/belege/log-zeile.txt ~/belege/rechte-zeile.txt ~/belege/leer.txt');
  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await oeffneAnsicht(page, 'Aktenwand');
  await expect(async () => {
    await aktualisiere(page);
    await expect(belegBox(page, 'log-zeile')).toBeVisible({ timeout: 20_000 });
  }).toPass({ timeout: 90_000 });
  await expect(page.getByText('leer.txt', { exact: true })).toHaveCount(0);
  await expect(page.getByText(BELEG_DATEI['rechte-zeile'], { exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(1);
});

test('T10-9b: echter Lesefehler der Aktenwand ist kein leerer Ordner', async ({ page }) => {
  await startEpisode(page);
  await befehl(page, 'echo x > ~/belege/probe.txt');
  await befehl(page, 'chmod 000 ~/belege');
  await oeffneAnsicht(page, 'Aktenwand');
  await aktualisiere(page);
  // Fehler oder Teilhinweis der Oberfläche, nie die Leer-Meldung.
  await expect(
    page.getByText(/Ansicht konnte nicht gelesen werden|nicht vollständig gelesen/)
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Noch keine Dateien in ~/belege/.')).toHaveCount(0);
  await shot(page, 't10-9b-lesefehler');

  // Wieder lesbar: Die Datei erscheint, der Fehler verschwindet.
  await befehl(page, 'chmod 755 ~/belege');
  await aktualisiere(page);
  await expect(page.getByText('probe.txt', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(
    page.getByText(/Ansicht konnte nicht gelesen werden|nicht vollständig gelesen/)
  ).toHaveCount(0);
});

async function zeigeRaum(page: import('@playwright/test').Page): Promise<void> {
  await flaeche(page, 'Ansicht');
  await page.getByRole('button', { name: 'Serverschrank', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Schild am Rack', exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
