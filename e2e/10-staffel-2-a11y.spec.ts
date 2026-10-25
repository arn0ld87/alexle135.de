import { expect, test, type Page } from '@playwright/test';
import {
  LOG,
  PAGER,
  RECHTE_REGEL,
  aktualisiere,
  axeLauf,
  befehl,
  dialog,
  erwarteAbschluss,
  flaeche,
  keinQuerscrollen,
  oeffneAnsicht,
  loeseRechteRest,
  pager,
  rows,
  shot,
  startEpisode,
  vorwurfKnopf,
  waehleBelege,
} from './helpers/staffel2';

// Ticket 10: Tastatur, Fokus, Dialog, mobile Darstellung, reduzierte Bewegung und axe gegen die
// gerenderte SSR-Route mit echter VM. Kontrast und Fokusdarstellung belegen zusätzlich Screenshots,
// die gesichtet werden müssen; axe allein deckt das nicht ab.
// Ohne MISSION_VM laufen nur die übrigen E2E-Tests; eine übersprungene Probe ist kein Nachweis.
test.skip(!process.env.MISSION_VM, 'MISSION_VM ist nicht gesetzt.');
test.describe.configure({ mode: 'parallel' });
test.setTimeout(420_000);

/** Springt per Tab vorwärts und merkt sich Namen und sichtbaren Fokus jedes Halts. */
async function tabHalte(
  page: Page,
  max: number
): Promise<{ namen: string[]; ohneFokus: string[] }> {
  const namen: string[] = [];
  const ohneFokus: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const halt = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      if (el.closest('[data-testid="v86-terminal"]')) return { terminal: true };
      const stil = getComputedStyle(el);
      const sichtbar =
        (stil.outlineStyle !== 'none' && parseFloat(stil.outlineWidth) > 0) ||
        stil.boxShadow !== 'none';
      const name =
        el.getAttribute('aria-label') ||
        (el instanceof HTMLInputElement ? el.labels?.[0]?.textContent?.trim() : '') ||
        (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60) ||
        `${el.tagName.toLowerCase()}${el instanceof HTMLInputElement ? `[${el.type}]` : ''}`;
      return { terminal: false, name, sichtbar };
    });
    if (!halt) continue;
    if (halt.terminal) break;
    namen.push(halt.name!);
    if (!halt.sichtbar) ohneFokus.push(halt.name!);
  }
  return { namen, ohneFokus };
}

const hatLive = (page: Page, text: string) =>
  page.evaluate(
    (suche) =>
      [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')].filter((el) =>
        (el.textContent ?? '').includes(suche)
      ).length,
    text
  );

test('T10-10a Desktop 1440x1000: Tastatur, Dialog, Fokus, Abschluss und axe', async ({ page }) => {
  await startEpisode(page, { width: 1440, height: 1000 });
  await shot(page, 't10-10-desktop-start');
  const funde: Record<string, unknown> = {};
  funde.start = await axeLauf(page);

  // Raum-Ansicht per Tastatur: Einsatzrahmen, Spuren, Hilfe, Ansichten, Aktualisieren, Hotspots.
  await oeffneAnsicht(page, 'Serverschrank');
  await page.getByRole('button', { name: 'Schild am Rack', exact: true }).waitFor();
  await page.getByRole('link', { name: /Zur Projektseite/ }).focus();
  const raum = await tabHalte(page, 40);
  for (const erwartet of [
    /Einsatzrahmen/,
    /^Rechte, 0 von 5/,
    /^Log, 0 von 1/,
    /Werkzeugkasten/,
    /Ersten Tipp|Tipp/i,
    /^Serverschrank$/i,
    /^Aktenwand$/i,
    /^Aktualisieren$/i,
    /Schild am Rack/,
    /Verwaltungsterminal/,
    /Statusleuchte/,
  ]) {
    expect
      .soft(
        raum.namen.some((name) => erwartet.test(name)),
        `Tab erreicht ${erwartet}`
      )
      .toBe(true);
  }
  expect.soft(raum.ohneFokus, 'sichtbarer Fokus (Raum)').toEqual([]);

  // Hotspot per Tastatur öffnen.
  await page.getByRole('button', { name: 'Statusleuchte', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hotspot-detail')).toContainText('Laufzeit seit Neustart', {
    timeout: 30_000,
  });
  await shot(page, 't10-10-desktop-raumdetail');

  // Belege sichern, Aktenwand per Tastatur.
  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await befehl(page, RECHTE_REGEL, { pager: PAGER.regelErledigt });
  await waehleBelege(page, ['log-zeile', 'rechte-zeile']);
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).focus();
  const akte = await tabHalte(page, 14);
  for (const erwartet of [/^Vorwurf erheben$/i, /Vorschau/, /Beleg|Audit|Regel/]) {
    expect
      .soft(
        akte.namen.some((name) => erwartet.test(name)),
        `Tab erreicht ${erwartet}`
      )
      .toBe(true);
  }
  expect.soft(akte.ohneFokus, 'sichtbarer Fokus (Aktenwand)').toEqual([]);
  await page.getByRole('button', { name: 'Vorschau (bis 192 Bytes)' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('pre').first()).toBeVisible();
  await shot(page, 't10-10-desktop-aktenwand');
  funde.aktenwand = await axeLauf(page);

  // Dialog: Name, Fokus hinein, Fokusbegrenzung, Escape, Fokusrückgabe.
  await vorwurfKnopf(page).focus();
  await page.keyboard.press('Enter');
  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(d.getByRole('radio').first()).toBeFocused();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    // Am Dialogende wandert der Fokus kurz zur Browseroberfläche (activeElement = body), nie in die Seite dahinter.
    expect(
      await d.evaluate(
        (el) => document.activeElement === document.body || el.contains(document.activeElement)
      )
    ).toBe(true);
  }
  await shot(page, 't10-10-desktop-dialog');
  funde.dialog = await axeLauf(page);
  await page.keyboard.press('Escape');
  await expect(d).toBeHidden();
  await expect(vorwurfKnopf(page)).toBeFocused();

  // Vorwurf per Tastatur absenden; nach Erfolg liegt der Fokus auf dem Abschluss.
  await page.keyboard.press('Enter');
  await d.getByRole('radio', { name: /Timo Kessler/ }).focus();
  await page.keyboard.press('Space');
  await d.getByRole('button', { name: 'Absenden', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(pager(page)).toContainText(PAGER.vorwurfOffen, { timeout: 45_000 });
  await loeseRechteRest(page, 'kennung');
  await erwarteAbschluss(page);
  await expect(page.getByRole('heading', { name: 'Fall gelöst' })).toBeFocused();
  expect(await hatLive(page, PAGER.richtig)).toBeLessThanOrEqual(1);
  expect(await hatLive(page, 'Fall gelöst')).toBeLessThanOrEqual(1);
  await shot(page, 't10-10-desktop-abschluss');
  funde.abschluss = await axeLauf(page);

  console.log(`T10-10 axe-Funde: ${JSON.stringify(funde)}`);
  for (const [zustand, liste] of Object.entries(funde)) {
    expect.soft(liste, `axe ${zustand}`).toEqual([]);
  }
});

test('T10-10b Mobil 390x844: Terminal bleibt, kein Querscrollen, Dialog passt', async ({
  page,
}) => {
  await startEpisode(page, { width: 390, height: 844 });
  await shot(page, 't10-10-mobil-start');
  const terminal = await page.getByTestId('v86-terminal').elementHandle();
  await befehl(page, 'echo T10-MOBIL');
  await befehl(
    page,
    'touch ~/belege/dies-ist-ein-sehr-langer-dateiname-ohne-umbruchstellen-fuer-den-umbruchtest-1234567890.txt'
  );
  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await expect(pager(page)).toContainText('Spur abgeschlossen: Log', { timeout: 30_000 });
  const verlauf = () =>
    pager(page).evaluate((w) => w.querySelectorAll('[data-testid="pager-verlauf"] > li').length);
  const meldungenVorher = await verlauf();
  expect(await keinQuerscrollen(page)).toBe(true);

  await oeffneAnsicht(page, 'Serverschrank');
  await page.getByRole('button', { name: 'Schild am Rack', exact: true }).click();
  await expect(page.getByTestId('hotspot-detail')).toContainText('rw-srv01', { timeout: 30_000 });
  expect(await keinQuerscrollen(page)).toBe(true);
  await shot(page, 't10-10-mobil-raum');

  await waehleBelege(page, ['log-zeile']);
  await expect(
    page.getByRole('region', { name: 'Ansichten' }).getByText('dies-ist-ein-sehr-langer-dateiname')
  ).toBeVisible();
  expect(await keinQuerscrollen(page)).toBe(true);
  await shot(page, 't10-10-mobil-aktenwand');

  await vorwurfKnopf(page).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  const passt = await d.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth + 1;
  });
  expect(passt).toBe(true);
  expect(await keinQuerscrollen(page)).toBe(true);
  await shot(page, 't10-10-mobil-dialog');
  const axeMobil = await axeLauf(page);
  console.log(`T10-10 axe-Funde mobil: ${JSON.stringify(axeMobil)}`);
  expect.soft(axeMobil, 'axe mobil (Dialog)').toEqual([]);
  await d.getByRole('button', { name: 'Abbrechen', exact: true }).click();

  // Wechsel zurück: derselbe Terminal-Knoten, Ausgabe bleibt, kein neues Setup (keine neuen Meldungen).
  await flaeche(page, 'Terminal');
  await expect(page.getByTestId('v86-terminal')).toBeVisible();
  expect(await terminal!.evaluate((knoten) => knoten.isConnected)).toBe(true);
  await expect(rows(page)).toContainText('T10-MOBIL');
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux');
  await flaeche(page, 'Ansicht');
  await flaeche(page, 'Terminal');
  expect(await verlauf()).toBe(meldungenVorher);
  expect(await terminal!.evaluate((knoten) => knoten.isConnected)).toBe(true);
});

test('T10-10c 200 % Zoom (720x500 CSS-Pixel) und reduzierte Bewegung', async ({ page }) => {
  // Browser-Zoom ist nicht automatisierbar; 200 % auf 1440 Pixel entsprechen 720x500 CSS-Pixeln.
  await startEpisode(page, { width: 720, height: 500, reducedMotion: true });
  expect(await keinQuerscrollen(page)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true
  );
  await befehl(page, LOG, { pager: PAGER.logErledigt });
  await waehleBelege(page, ['log-zeile']);
  await vorwurfKnopf(page).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  const passt = await d.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth + 1;
  });
  expect(passt).toBe(true);
  expect(await keinQuerscrollen(page)).toBe(true);
  await d.getByRole('radio').first().focus();
  await shot(page, 't10-10-zoom-dialog');
  await d.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  // Keine selbsttätige Animation im Leerlauf.
  const laufend = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => a.id || a.constructor.name).length
  );
  expect(laufend).toBe(0);
  await aktualisiere(page);
});

test('T10-10d Tab bleibt im Terminal, Esc dann Tab verlässt es (Tastaturfalle, #151)', async ({
  page,
}) => {
  await startEpisode(page, { width: 1440, height: 1000 });
  const imTerminal = () =>
    page.evaluate(() => !!document.activeElement?.closest('[data-testid="v86-terminal"]'));
  await expect(page.getByTestId('v86-tab-hinweis')).toBeVisible();
  await expect(page.getByTestId('v86-tab-hinweis')).toHaveText('Tab verlassen: Esc, dann Tab');

  await page.getByTestId('v86-terminal').click({ position: { x: 30, y: 30 } });
  expect(await imTerminal()).toBe(true);
  // Nacktes Tab gehört der Shell (Vervollständigung): Der Fokus bleibt im Terminal.
  await page.keyboard.press('Tab');
  expect(await imTerminal()).toBe(true);
  // Esc, dann Tab: Der Fokus wandert auf das nächste fokussierbare Element außerhalb.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect.poll(imTerminal).toBe(false);
  expect(
    await page.evaluate(
      () => document.activeElement !== null && document.activeElement !== document.body
    )
  ).toBe(true);
});
