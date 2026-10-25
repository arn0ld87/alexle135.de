import { expect, type Locator, type Page } from '@playwright/test';
import axe from 'axe-core';

// Browserhilfen für die Staffel-2-Abnahme (Ticket 10). Alle Befehle laufen als azubi durch die
// echte Terminaloberfläche; nichts setzt Erfolg oder Reducer direkt.

export const STAFFEL2_BASIS = '/projekte/terminal-missionen/app/staffel-2';
export const STAFFEL2 = `${STAFFEL2_BASIS}?episode=1`;
export const STAFFEL2_E0 = `${STAFFEL2_BASIS}?episode=0`;
export const ANFANG = 'Serverraum der Rechenwerk Ostwind GmbH';
export const ANFANG_E0 = 'Erster Einsatztag bei der Rechenwerk Ostwind GmbH';

// Geprüfte Lösungswege aus Episode 1 (identisch zu e2e/07).
export const LOG = 'grep sudoers.d /var/log/rechenwerk-audit.log > ~/belege/log-zeile.txt';
export const RECHTE_REGEL =
  'grep -B1 nadia /etc/sudoers.d/rw-fernwartung > ~/belege/rechte-zeile.txt';
export const RECHTE_METADATEN =
  'ls -l /etc/sudoers.d/rw-fernwartung $(find /usr/local -perm -4000 -type f) > ~/belege/rechte-metadaten.txt';
// Schritte 2, 4 und 5 der Spur Rechte (ADR 0009): ablesen, reparieren, ordnen.
export const FRAGE_KENNUNG = 'Unter welcher Änderungskennung wurde die Regel eingespielt?';
export const REGEL_WEG = 'sudo mv /etc/sudoers.d/rw-fernwartung ~/quarantaene/';
export const STATUS_WEG = 'sudo mv /usr/local/bin/rw-status ~/quarantaene/';
// Ausgeschlossener Zugriff: Der Einsatzrahmen erlaubt azubi genau diesen sudo-Aufruf und protokolliert ihn.
export const VERSTOSS = 'sudo /bin/cat /home/nadia/vertraulich.txt';

export const PAGER = {
  logErledigt: 'Erledigt: Sichere die passende Audit-Zeile',
  regelErledigt: 'Erledigt: Sichere die unerwartete sudo-Regel',
  metaErledigt: 'Erledigt: Sichere Besitzer, Rechte und Datum',
  kennungErledigt: 'Erledigt: Lies die Änderungskennung ab',
  regelWegErledigt: 'Erledigt: Nimm die fremde sudo-Regel aus dem Betrieb',
  statusWegErledigt: 'Erledigt: Stelle rw-status unter Quarantäne',
  rechteSpur: 'Spur abgeschlossen: Rechte',
  richtig: 'Das passt zusammen: Die Regel trägt die Kennung RW-1042',
  falschePerson: 'Diese Person passt nicht zu deinen Belegen.',
  zuWenig: 'Die Person könnte stimmen, aber die Begründung trägt noch nicht.',
  gesperrt: 'Der Vorwurf ist vorübergehend gesperrt.',
  belegWeg: 'Ein ausgewählter Beleg ist nicht mehr gültig. Aktualisiere die Aktenwand.',
  wieder: 'Der Vorwurf ist wieder möglich.',
  folge: 'Margit wird misstrauisch',
} as const;

export const BELEG_DATEI = {
  'log-zeile': 'log-zeile.txt',
  'rechte-zeile': 'rechte-zeile.txt',
  'rechte-metadaten': 'rechte-metadaten.txt',
  'kasse-meta': 'kasse-meta.txt',
  'kasse-zeilen': 'kasse-zeilen.txt',
} as const;
export type BelegId = keyof typeof BELEG_DATEI;

const marken = new WeakMap<Page, number>();

export const rows = (page: Page): Locator => page.locator('.xterm-rows').first();
export const pager = (page: Page): Locator => page.getByTestId('pager');

/** Wechselt auf schmalen Bildschirmen zwischen Ansicht und Terminal; auf breiten ohne Wirkung. */
export async function flaeche(page: Page, name: 'Ansicht' | 'Terminal'): Promise<void> {
  const knopf = page.getByRole('button', { name, exact: true });
  if ((await knopf.isVisible()) && (await knopf.getAttribute('aria-pressed')) !== 'true') {
    await knopf.click();
  }
}

/** Öffnet die Episode, wartet auf das gebootete Linux, den Prompt und den fertigen Auftrag. */
export async function startEpisode(
  page: Page,
  opts: { width?: number; height?: number; reducedMotion?: boolean; episode?: 0 | 1 } = {}
): Promise<void> {
  const { width = 1440, height = 1000, reducedMotion = true, episode = 1 } = opts;
  await page.setViewportSize({ width, height });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(episode === 0 ? STAFFEL2_E0 : STAFFEL2);
  const consent = page.locator('#cookie-banner');
  if (await consent.isVisible()) {
    await consent.getByRole('button', { name: 'Ablehnen', exact: true }).click();
  }
  await expect(page.getByTestId('v86-status')).toContainText('echtes Linux', { timeout: 120_000 });
  await expect(rows(page)).toContainText(/azubi@rw-srv01/, { timeout: 120_000 });
  // Erst nach dem Setup steht die Startauswahl fest.
  await expect(pager(page)).toContainText(episode === 0 ? ANFANG_E0 : ANFANG, {
    timeout: 60_000,
  });
}

/**
 * Sendet einen Befehl durch das Terminal. Mit `pager` wird der Befehl unverändert gesendet und auf
 * die zugehörige Pager-Meldung gewartet; sonst hängt die Hilfe eine Marke an, deren Ausgabe erst
 * nach der Ausführung im Terminal steht (die getippte Zeile enthält die Marke nicht zusammenhängend).
 */
export async function befehl(
  page: Page,
  text: string,
  opts: { pager?: string; timeout?: number } = {}
): Promise<void> {
  const { timeout = 30_000 } = opts;
  await flaeche(page, 'Terminal');
  await page.getByTestId('v86-terminal').click({ position: { x: 30, y: 30 } });
  if (opts.pager) {
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await expect(pager(page)).toContainText(opts.pager, { timeout });
    return;
  }
  const n = (marken.get(page) ?? 0) + 1;
  marken.set(page, n);
  await page.keyboard.type(`${text} ; echo ZZ""T10M${n}`);
  await page.keyboard.press('Enter');
  await expect(rows(page)).toContainText(`ZZT10M${n}`, { timeout });
}

export const ansichtKnopf = (page: Page, name: string): Locator =>
  page.getByRole('group', { name: 'Ansichten wählen' }).getByRole('button', { name, exact: true });

export async function oeffneAnsicht(
  page: Page,
  name: 'Aktenwand' | 'Serverschrank'
): Promise<void> {
  await flaeche(page, 'Ansicht');
  await ansichtKnopf(page, name).click();
  await expect(page.getByRole('heading', { level: 3, name, exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

export async function aktualisiere(page: Page): Promise<void> {
  await flaeche(page, 'Ansicht');
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
}

export const belegBox = (page: Page, id: BelegId): Locator =>
  page.getByRole('checkbox', { name: new RegExp(`${BELEG_DATEI[id].replace('.', '\\.')}$`) });

/** Wählt erkannte Belege in der Aktenwand; aktualisiert, bis der Beleg als erkannt dasteht. */
export async function waehleBelege(page: Page, ids: readonly BelegId[]): Promise<void> {
  await oeffneAnsicht(page, 'Aktenwand');
  for (const id of ids) {
    await expect(async () => {
      await aktualisiere(page);
      await expect(belegBox(page, id)).toBeVisible({ timeout: 20_000 });
    }).toPass({ timeout: 90_000 });
    await belegBox(page, id).check();
  }
}

/** Trägt eine Antwort in das Antwortfeld des aktuellen Ablesen-Schritts ein und sendet sie. */
export async function antworte(page: Page, frage: string, text: string): Promise<void> {
  await flaeche(page, 'Ansicht');
  await page.getByLabel(frage).fill(text);
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
}

export const dialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Vorwurf erheben', exact: true });

export const vorwurfKnopf = (page: Page): Locator =>
  page.getByRole('button', { name: 'Vorwurf erheben', exact: true });

/** Öffnet den Dialog aus der Aktenwand, wählt die Person und sendet ab (optional als Doppelklick). */
export async function erhebeVorwurf(
  page: Page,
  person: 'Timo Kessler' | 'Nadia Brem' | 'Margit Ostwind' | 'Kaffeeautomat',
  opts: { doppelklick?: boolean } = {}
): Promise<void> {
  await flaeche(page, 'Ansicht');
  await vorwurfKnopf(page).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  await d.getByRole('radio', { name: new RegExp(person) }).check();
  const senden = d.getByRole('button', { name: 'Absenden', exact: true });
  if (opts.doppelklick) await senden.dblclick();
  else await senden.click();
}

/** Zählt eine Pager-Meldung im Verlauf und in der aktuellen Meldung (jeweils einmal je Meldung). */
export async function anzahlImPager(page: Page, text: string): Promise<number> {
  return pager(page).evaluate((wurzel, suche) => {
    const quellen = [
      ...wurzel.querySelectorAll('p.sr-only'),
      ...wurzel.querySelectorAll('[data-testid="pager-verlauf"] > li'),
    ];
    return quellen.filter((knoten) =>
      (knoten.textContent ?? '').replace(/\s+/g, ' ').includes(suche)
    ).length;
  }, text);
}

/** Sichtbare Abschlussfläche: Überschrift, Beweisstück und Code der Episode. */
export async function erwarteAbschluss(page: Page): Promise<void> {
  const titel = page.getByRole('heading', { name: 'Fall gelöst' });
  await expect(titel).toBeVisible({ timeout: 45_000 });
  const bereich = page.getByRole('region', { name: 'Fall gelöst' });
  await expect(bereich).toContainText('Der Rechtefund');
  await expect(bereich).toContainText('Code: S2-E1-RECHTE');
}

/** Legt einen Screenshot im Artefaktordner ab (T10_SHOTS), damit er gesichtet werden kann. */
export async function shot(page: Page, name: string): Promise<void> {
  const ordner = process.env.T10_SHOTS ?? 'test-results/t10-shots';
  await page.screenshot({ path: `${ordner}/${name}.png`, fullPage: true });
}

export async function keinQuerscrollen(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

export interface AxeFund {
  id: string;
  impact: string | null | undefined;
  knoten: string[];
}

/**
 * Lässt die installierte axe-core-Version gegen die laufende Route laufen (WCAG 2.x A/AA).
 * Die Quelle wird über `evaluate` eingespielt, nicht als Script-Tag: Die CSP bleibt unangetastet.
 */
export async function axeLauf(page: Page): Promise<AxeFund[]> {
  await page.evaluate(axe.source);
  const ergebnis = await page.evaluate(async () => {
    const lauf = (window as unknown as { axe: typeof axe }).axe;
    return lauf.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
  });
  return ergebnis.violations.map((fund) => ({
    id: fund.id,
    impact: fund.impact,
    knoten: fund.nodes.slice(0, 5).map((knoten) => knoten.target.join(' ')),
  }));
}
