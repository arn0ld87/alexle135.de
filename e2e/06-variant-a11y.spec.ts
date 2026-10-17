// Kontrast und Variantenmechanik im echten Browser (Phase 2, Plan 02-04, D-36).
//
// Warum ein Browser-Spec: `pnpm check:a11y` läuft mit jsdom über die prerenderten
// HTML-Dateien, schaltet `color-contrast` deshalb ab und sieht SSR-Seiten gar nicht.
// Der Kontrast beider Varianten (Papier und Bauplan) lässt sich nur mit echtem Layout
// und berechneten Farben prüfen. `axe-core` läuft hier mit genau einer Regel,
// `color-contrast`, ohne Ausnahme und ohne ausgeschlossene Elemente: Findet axe einen
// Verstoß, wird die Ursache an Tokens oder Aliasen behoben, nicht die Regel gelockert.
//
// Zusätzlich: Persistenz der Variante über ClientRouter-Seitenwechsel, die Grenze
// der Navigation bei 1024 px und ein manipulierter Speicherwert.
//
// Die Startseite steht seit Plan 02-08 in PAGES (Kontrast in beiden Varianten).
//
// Abschnitt „Arbeiten“ der Startseite (Plan 02-07): Agora-Schema ohne Überlappung, Vorschau-Dialog
// mit Escape und Fokusrückkehr, Verhalten ohne JavaScript, `nested-interactive` (kein Button im Link).
//
// Abschnitt „Logbuch“ (Plan 02-08): Suche ohne Netzwerkanfrage und ohne Adressänderung, Leerzustand
// mit Zurücksetzen, Verhalten ohne JavaScript, kein horizontaler Überlauf des ganzen Dokuments.
//
// Apps-Seiten und Missions-Apps (Plan 02-12): APP_PAGES ergänzt sechs Pfade; auf den beiden
// Missions-Apps nimmt der Lauf die Terminal-Insel aus, deren ANSI- und Zustandsfarben D-45
// unverändert lässt.
//
// Admin-Bereich (Plan 02-12.1): ADMIN_PAGES ergänzt die vier geschützten Seiten und
// `/admin/login`; die vier geschützten Seiten prüfen denselben Lauf nach einer Anmeldung.
//
// Lokal braucht der Lauf DATABASE_URL und BETTER_AUTH_SECRET (globalSetup der Suite);
// ohne beide gilt der CI-Job „E2E“ als Nachweis.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loginAdminApi } from './helpers/adminAuth';

// Alphabetisch erster Beitrag mit eingezäuntem Code-Block: an ihm prüft der Kontrastlauf,
// ob die Shiki-Farben auf der Code-Fläche in beiden Varianten lesbar bleiben (D-14).
const CODE_POST = 'astro-pm2-deploy';

/** Pfad, den es nicht gibt: prüft die 404-Seite mit ihrem erwarteten Status. */
const NOT_FOUND_PATH = '/gibt-es-nicht/';

/** Erwarteter HTTP-Status je Pfad; nur die 404-Probe liefert 404. */
function expectedStatus(path: string): number {
  return path === NOT_FOUND_PATH ? 404 : 200;
}

const PAGES = [
  '/',
  '/blog/',
  `/blog/${CODE_POST}/`,
  '/design-system/',
  '/projekte/',
  '/projekte/compose-builder/',
  '/ueber-mich/',
  '/leistungen/',
  '/kompetenzen/',
  '/certifications/',
  '/fisi/',
  '/ai/',
  '/ki-agenten-lab/',
  '/kontakt/',
  '/status/',
  '/changelog/',
  '/legal/impressum/',
  '/legal/datenschutz/',
  NOT_FOUND_PATH,
];
// Apps-Seiten und Missions-Apps (Plan 02-12, D-45, DSGN-01). Auf den beiden Missions-Apps
// läuft die Prüfung nur außerhalb der Terminal-Insel: dort stehen die ANSI- und Zustandsfarben
// der Ausgabe, die D-45 unverändert lässt (siehe TERMINAL_ISLAND in
// src/tests/no-legacy-palette.test.ts).
const APP_PAGES = [
  '/apps/',
  '/apps/compose-builder/',
  '/apps/ihk-radar/',
  '/apps/roi-rechner/',
  '/projekte/terminal-missionen/app',
  '/projekte/windows-terminal-missionen/app',
];

// Admin-Bereich (Plan 02-12.1, D-18, D-45): die vier geschützten Seiten erben die Palette
// und werden nicht gestaltet, müssen aber in beiden Ansichten lesbar und bedienbar bleiben.
// Die Anmeldung läuft über den API-Helfer; `request` und `page` teilen keine Cookies, deshalb
// wandern sie einmal in den Browserkontext. `/admin/login` prüft derselbe Lauf ohne Anmeldung.
const ADMIN_PAGES = ['/admin/dashboard', '/admin/posts', '/admin/projects', '/admin/messages'];
const ADMIN_LOGIN_PATH = '/admin/login';

type AdminCookies = Awaited<ReturnType<APIRequestContext['storageState']>>['cookies'];
let adminCookies: AdminCookies | null = null;

/**
 * Meldet die Browserseite über die echte Login-API an (Cookies aus dem Request-Kontext).
 * Die Anmeldung läuft nur einmal je Worker; die Cookies werden für die weiteren Seiten
 * wiederverwendet. Der Login-Endpunkt erlaubt 10 Versuche je 15 Minuten und Adresse, und die
 * ganze Suite teilt sich diese Grenze (Rate-Limit nicht abschwächen).
 */
async function loginAdminPage(page: Page, request: APIRequestContext): Promise<void> {
  if (!adminCookies) {
    await loginAdminApi(request);
    adminCookies = (await request.storageState()).cookies;
  }
  await page.context().addCookies(adminCookies);
}

/** Element, das auf den Missions-Apps von der Kontrastprüfung ausgenommen wird. */
const TERMINAL_ISLAND_SELECTOR = 'astro-island';

function isIslandPage(path: string): boolean {
  return path.includes('-missionen/app');
}

const VARIANTS = ['papier', 'bauplan'] as const;
const STORAGE_KEY = 'systemwerk-variant';

const AXE_SOURCE = readFileSync(
  fileURLToPath(new URL('../node_modules/axe-core/axe.min.js', import.meta.url)),
  'utf8'
);

type AxeViolation = {
  id: string;
  impact?: string | null;
  nodes: { target: unknown[]; failureSummary?: string }[];
};

async function seedVariant(page: Page, value: string): Promise<void> {
  await page.addInitScript(
    ([key, stored]) => {
      try {
        window.localStorage.setItem(key, stored);
      } catch {
        // blockierter Speicher: Papier gilt, der Test prüft dann Papier
      }
    },
    [STORAGE_KEY, value]
  );
}

function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return errors;
}

async function hasVariantAttribute(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.hasAttribute('data-variant'));
}

async function waitForReady(page: Page): Promise<void> {
  await expect(page.locator('header [data-variant-toggle]')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
}

async function axeRuleViolations(
  page: Page,
  rules: string[],
  exclude: string[][] = []
): Promise<AxeViolation[]> {
  // evaluate mit Zeichenkette läuft über das Protokoll und unterliegt nicht der CSP der Seite.
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(
    async ([ruleIds, excluded]) => {
      const axe = (
        window as unknown as {
          axe: {
            run: (ctx: Document | object, opts: object) => Promise<{ violations: AxeViolation[] }>;
          };
        }
      ).axe;
      // `exclude` gehört in das erste Argument (Kontext), nicht in die Optionen.
      const context = excluded.length > 0 ? { include: [['html']], exclude: excluded } : document;
      const result = await axe.run(context, {
        runOnly: { type: 'rule', values: ruleIds },
      });
      return result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      }));
    },
    [rules, exclude] as [string[], string[][]]
  );
}

async function contrastViolations(page: Page, exclude: string[][] = []): Promise<AxeViolation[]> {
  return axeRuleViolations(page, ['color-contrast'], exclude);
}

test.describe('Kontrast je Seite und Variante (color-contrast)', () => {
  for (const path of [...PAGES, ...APP_PAGES]) {
    for (const variant of VARIANTS) {
      test(`${path} in ${variant}: kein Kontrastverstoß`, async ({ page }) => {
        const pageErrors = collectPageErrors(page);
        await seedVariant(page, variant);
        const response = await page.goto(path);
        expect(response?.status(), `Status für ${path}`).toBe(expectedStatus(path));
        await waitForReady(page);

        if (variant === 'bauplan') {
          await expect(page.locator('html')).toHaveAttribute('data-variant', 'bauplan');
        } else {
          expect(await hasVariantAttribute(page)).toBe(false);
        }

        const exclude: string[][] = isIslandPage(path) ? [[TERMINAL_ISLAND_SELECTOR]] : [];
        const violations = await contrastViolations(page, exclude);
        expect(
          violations,
          `color-contrast auf ${path} (${variant}):\n${JSON.stringify(violations, null, 2)}`
        ).toEqual([]);
        expect(
          pageErrors,
          `Browser-Fehler: ${pageErrors.map((e) => e.message).join(', ')}`
        ).toHaveLength(0);
      });
    }
  }
});

test.describe('Admin-Bereich je Seite und Variante (color-contrast)', () => {
  for (const path of [...ADMIN_PAGES, ADMIN_LOGIN_PATH]) {
    for (const variant of VARIANTS) {
      test(`${path} in ${variant}: kein Kontrastverstoß, Überschrift und Navigation sichtbar`, async ({
        page,
        request,
      }) => {
        const pageErrors = collectPageErrors(page);
        await seedVariant(page, variant);
        // `/admin/login` ist der einzige Pfad ohne Anmeldung; die vier anderen
        // liegen hinter src/middleware.ts und würden sonst zur Anmeldung umleiten.
        if (path !== ADMIN_LOGIN_PATH) await loginAdminPage(page, request);
        const response = await page.goto(path);
        expect(response?.status(), `Status für ${path}`).toBe(200);
        await waitForReady(page);

        if (variant === 'bauplan') {
          await expect(page.locator('html')).toHaveAttribute('data-variant', 'bauplan');
        } else {
          expect(await hasVariantAttribute(page)).toBe(false);
        }

        // Der Bereich ist wirklich offen (nicht die Anmeldeseite) und trägt sein Grundgerüst.
        if (path !== ADMIN_LOGIN_PATH) {
          await expect(page.locator('#login-form'), `Anmeldeseite statt ${path}`).toHaveCount(0);
        }
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('nav:visible').first()).toBeVisible();

        const violations = await contrastViolations(page);
        expect(
          violations,
          `color-contrast auf ${path} (${variant}):\n${JSON.stringify(violations, null, 2)}`
        ).toEqual([]);
        expect(
          pageErrors,
          `Browser-Fehler: ${pageErrors.map((e) => e.message).join(', ')}`
        ).toHaveLength(0);
      });
    }
  }
});

test.describe('Variante unter dem ClientRouter', () => {
  test('bleibt über Seitenwechsel erhalten, ein Klick schaltet genau einmal zurück', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const html = page.locator('html');
    const toggle = page.locator('header [data-variant-toggle]');

    await page.goto('/blog/');
    await waitForReady(page);
    expect(await hasVariantAttribute(page)).toBe(false);

    await toggle.click();
    await expect(html).toHaveAttribute('data-variant', 'bauplan');

    // Seitenwechsel 1 über einen Header-Link (ClientRouter, kein Neuladen).
    await page.locator('nav[aria-label="Hauptnavigation"] a[href="/kontakt/"]').click();
    await page.waitForURL('**/kontakt/');
    await waitForReady(page);
    await expect(html).toHaveAttribute('data-variant', 'bauplan');

    // Seitenwechsel 2.
    await page.locator('nav[aria-label="Hauptnavigation"] a[href="/projekte/"]').click();
    await page.waitForURL('**/projekte/');
    await waitForReady(page);
    await expect(html).toHaveAttribute('data-variant', 'bauplan');

    // Idempotenz: nach zwei Seitenwechseln schaltet ein einzelner Klick genau einmal um.
    await toggle.click();
    await expect.poll(() => hasVariantAttribute(page)).toBe(false);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Die Wahl ist gespeichert: nach dem Neuladen bleibt es Papier.
    await page.reload();
    await waitForReady(page);
    expect(await hasVariantAttribute(page)).toBe(false);

    expect(
      pageErrors,
      `Browser-Fehler: ${pageErrors.map((e) => e.message).join(', ')}`
    ).toHaveLength(0);
  });
});

test.describe('Navigation an der Grenze von 1024 px', () => {
  test('bei 1023 px Menü statt Leiste, bei 1024 px Leiste statt Menü, Schalter in beiden', async ({
    page,
  }) => {
    const desktopNav = page.locator('nav[aria-label="Hauptnavigation"]');
    const mobileMenu = page.locator('#mobile-menu');
    const toggle = page.locator('header [data-variant-toggle]');

    await page.setViewportSize({ width: 1023, height: 800 });
    await page.goto('/blog/');
    await waitForReady(page);
    await expect(desktopNav).toBeHidden();
    await expect(mobileMenu).toBeVisible();
    await expect(toggle).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(desktopNav).toBeVisible();
    await expect(mobileMenu).toBeHidden();
    await expect(toggle).toBeVisible();
  });
});

// Bildmarke der Startseite (Plan 02-18.1, D-48, D-49): Überlauf, Standbild im HTML ohne
// JavaScript und bei reduzierter Bewegung, Drehung aus dem nachgeladenen Modul, Ziehen mit
// dem Zeiger, Schalter „Drehung anhalten“, Pause außer Sicht, Farben beider Ansichten. Das
// Drehmodul heißt im Build `rotate.<Hash>.js` (dynamischer Import, eigener Chunk).
const ROTATE_CHUNK = /\/_astro\/rotate\.[^/]+\.js(\?|$)/;

function trackRotateRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (ROTATE_CHUNK.test(request.url())) requested.push(request.url());
  });
  return requested;
}

/** Liest eine generierte Zeichenfolgen-Konstante aus `src/lib/ascii-mark/mark.ts`. */
function readMarkRows(name: 'BODY' | 'WEDGE'): string[] {
  const source = readFileSync(
    fileURLToPath(new URL('../src/lib/ascii-mark/mark.ts', import.meta.url)),
    'utf8'
  );
  const block = source.match(new RegExp(`export const ${name}[^=]*= \\[([\\s\\S]*?)\\];`));
  expect(block, `${name} steht nicht in mark.ts`).not.toBeNull();
  return [...block![1].matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

const STILL_BODY = readMarkRows('BODY').join('\n');
const STILL_WEDGE = readMarkRows('WEDGE').join('\n');

/** Text einer Ebene als Zeichenfolge, ohne Normalisierung der Leerzeichen. */
async function layerText(page: Page, layer: 'body' | 'wedge'): Promise<string> {
  return page
    .locator(`[data-ascii-layer="${layer}"]`)
    .evaluate((element) => element.textContent ?? '');
}

/** `#rrggbb` in die Schreibweise, die `getComputedStyle` für eine Farbe ausgibt. */
function hexToRgb(value: string): string {
  const hex = value.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;
  const channels = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
  return `rgb(${channels.join(', ')})`;
}

/** Sammelt die Summe der Layout-Verschiebungen, bevor die Seite Skripte ausführt. */
function collectLayoutShift(): void {
  const state = window as unknown as { __clsShift: number };
  state.__clsShift = 0;
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as unknown as { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) state.__clsShift += shift.value;
    }
  });
  observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
}

test.describe('Hero der Startseite', () => {
  test('bei 320 px und 390 px: kein horizontaler Überlauf, die H1 läuft nicht über', async ({
    page,
  }) => {
    for (const size of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);

      // Dieser Test misst den Hero; das ganze Dokument misst „Logbuch: kein horizontaler
      // Überlauf der ganzen Startseite“ weiter unten (Plan 02-08).
      const metrics = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const hero = document.querySelector('.home-hero');
        let heroRight = 0;
        hero?.querySelectorAll('*').forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0) heroRight = Math.max(heroRight, rect.right);
        });
        return {
          heroRight,
          heroScroll: hero?.scrollWidth ?? -1,
          heroClient: hero?.clientWidth ?? -1,
          innerWidth: window.innerWidth,
          h1Scroll: h1?.scrollWidth ?? -1,
          h1Client: h1?.clientWidth ?? -1,
        };
      });
      expect(metrics.heroClient).toBeGreaterThan(0);
      expect(
        metrics.heroRight,
        `Hero ragt bei ${size.width} px aus dem Fenster`
      ).toBeLessThanOrEqual(metrics.innerWidth);
      expect(metrics.heroScroll, `Hero läuft über bei ${size.width} px`).toBeLessThanOrEqual(
        metrics.heroClient
      );
      expect(metrics.h1Client).toBeGreaterThan(0);
      expect(metrics.h1Scroll, `H1 läuft über bei ${size.width} px`).toBeLessThanOrEqual(
        metrics.h1Client
      );
    }
  });

  test.describe('ohne JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('bei 390 px: Standbild beider Ebenen, Status „STANDBILD“, Schalter verborgen', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');

      expect(await layerText(page, 'body')).toBe(STILL_BODY);
      expect(await layerText(page, 'wedge')).toBe(STILL_WEDGE);
      await expect(page.locator('[data-ascii-status]')).toHaveText('STANDBILD');
      await expect(page.locator('[data-ascii-pause]')).toBeHidden();
      await expect(page.locator('[data-ascii-layer="body"]')).toBeVisible();
    });
  });

  test('bei 390 px: lädt das Drehmodul, dreht ohne Layoutsprung und ohne Fehler', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const rotateRequests = trackRotateRequests(page);
    await page.addInitScript(collectLayoutShift);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const surface = page.locator('[data-ascii-mark] .ascii__surface');
    const before = await surface.boundingBox();

    await expect(page.locator('[data-ascii-mark]')).toHaveAttribute('data-state', 'running');
    await expect.poll(() => layerText(page, 'body'), { timeout: 3000 }).not.toBe(STILL_BODY);
    expect(rotateRequests.length).toBeGreaterThan(0);

    const after = await surface.boundingBox();
    expect(after?.width, 'Breite der Fläche nach dem Start').toBeCloseTo(before?.width ?? -1, 1);
    expect(after?.height, 'Höhe der Fläche nach dem Start').toBeCloseTo(before?.height ?? -1, 1);

    const shift = await page.evaluate(
      () => (window as unknown as { __clsShift: number }).__clsShift
    );
    expect(shift, 'Summe der Layout-Verschiebungen').toBeLessThan(0.01);
    expect(
      pageErrors,
      `Browser-Fehler: ${pageErrors.map((error) => error.message).join(', ')}`
    ).toHaveLength(0);
  });

  test('bei 1280 px: der Schalter hält an, zeigt das Standbild und setzt fort', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const pause = page.locator('[data-ascii-pause]');
    await expect(pause).toBeVisible();
    await expect(pause).toHaveText(/Drehung anhalten/);
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => layerText(page, 'body'), { timeout: 3000 }).not.toBe(STILL_BODY);

    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-ascii-status]')).toHaveText('ANGEHALTEN');
    expect(await layerText(page, 'body')).toBe(STILL_BODY);
    expect(await layerText(page, 'wedge')).toBe(STILL_WEDGE);

    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-ascii-status]')).toHaveText('DREHUNG');
    expect(
      pageErrors,
      `Browser-Fehler: ${pageErrors.map((error) => error.message).join(', ')}`
    ).toHaveLength(0);
  });

  test('bei 1280 px und reduzierter Bewegung: Standbild, Schalter sichtbar, kein Drehmodul', async ({
    page,
  }) => {
    const rotateRequests = trackRotateRequests(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-ascii-status]')).toHaveText('STANDBILD');
    // Der Schalter gehört allen: er ist sichtbar und lädt das Drehmodul erst auf Klick nach.
    const pause = page.locator('[data-ascii-pause]');
    await expect(pause).toBeVisible();
    await expect(pause).toHaveText(/Drehung starten/);
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    expect(rotateRequests, 'Drehmodul trotz reduzierter Bewegung angefordert').toEqual([]);
    expect(await layerText(page, 'body')).toBe(STILL_BODY);
  });

  test('bei 1280 px: das Ziehen dreht die Marke von Hand und hält die eigene Drehung an', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('[data-ascii-mark]')).toHaveAttribute('data-state', 'running');
    await expect.poll(() => layerText(page, 'body'), { timeout: 3000 }).not.toBe(STILL_BODY);

    const surface = page.locator('[data-ascii-surface]');
    const box = await surface.boundingBox();
    const middle = {
      x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
      y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
    };

    await page.mouse.move(middle.x, middle.y);
    await page.mouse.down();
    await page.mouse.move(middle.x + 160, middle.y, { steps: 8 });
    await page.waitForTimeout(200);
    const dragged = await layerText(page, 'body');
    expect(dragged, 'das Ziehen hat den Winkel verschoben').not.toBe(STILL_BODY);

    // Solange der Zeiger greift, steht der Winkel: die eigene Drehung ist angehalten.
    await page.waitForTimeout(400);
    expect(await layerText(page, 'body'), 'während des Ziehens').toBe(dragged);

    await page.mouse.up();
    expect(await surface.evaluate((element) => element.classList.contains('is-dragging'))).toBe(
      false
    );
    expect(
      pageErrors,
      `Browser-Fehler: ${pageErrors.map((error) => error.message).join(', ')}`
    ).toHaveLength(0);
  });

  test('bei 390 px: außer Sicht hält die Drehung an', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect.poll(() => layerText(page, 'body'), { timeout: 3000 }).not.toBe(STILL_BODY);

    await page.locator('footer').scrollIntoViewIfNeeded();
    const frozen = await layerText(page, 'body');
    await page.waitForTimeout(1000);
    expect(await layerText(page, 'body'), 'Text außer Sicht').toBe(frozen);
  });

  test('in Papier und Bauplan bei 390 und 1440 px: Farben aus Tokens, kein Überlauf', async ({
    page,
  }) => {
    for (const variant of VARIANTS) {
      for (const width of [390, 1440]) {
        await seedVariant(page, variant);
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);

        const measured = await page.evaluate(() => {
          const root = getComputedStyle(document.documentElement);
          const body = document.querySelector('[data-ascii-layer="body"]');
          const wedge = document.querySelector('[data-ascii-layer="wedge"]');
          return {
            ink: root.getPropertyValue('--ink'),
            accent: root.getPropertyValue('--accent'),
            accentStrong: root.getPropertyValue('--accent-strong'),
            bodyColor: body ? getComputedStyle(body).color : '',
            wedgeColor: wedge ? getComputedStyle(wedge).color : '',
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        });

        expect(measured.bodyColor, `Körper in ${variant} bei ${width} px`).toBe(
          hexToRgb(measured.ink)
        );
        expect(
          [hexToRgb(measured.accent), hexToRgb(measured.accentStrong)],
          `Keil in ${variant} bei ${width} px`
        ).toContain(measured.wedgeColor);
        expect(measured.overflow, `Überlauf in ${variant} bei ${width} px`).toBeLessThanOrEqual(0);
      }
    }
  });
});

// Abschnitt „Arbeiten“ (Plan 02-07, D-08, D-09, D-11).
test.describe('Arbeiten: Agora-Schema', () => {
  test('bei 320, 390 und 768 px: die fünf Knoten überlappen sich nicht, Beschriftungen bleiben lesbar', async ({
    page,
  }) => {
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);

      const nodes = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-schema-node]')].map((node) => {
          const rect = node.getBoundingClientRect();
          const label = node.lastElementChild as HTMLElement | null;
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            labelClipped: label ? label.scrollWidth > label.clientWidth + 1 : true,
            labelVisible: label ? label.getClientRects().length > 0 : false,
          };
        })
      );

      expect(nodes, `Knoten bei ${width} px`).toHaveLength(5);
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        expect(a.width, `Knoten ${i + 1} bei ${width} px: Breite`).toBeGreaterThanOrEqual(44);
        expect(a.height, `Knoten ${i + 1} bei ${width} px: Höhe`).toBeGreaterThanOrEqual(44);
        expect(a.labelVisible, `Beschriftung ${i + 1} bei ${width} px sichtbar`).toBe(true);
        expect(a.labelClipped, `Beschriftung ${i + 1} bei ${width} px abgeschnitten`).toBe(false);
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const overlap =
            a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          expect(overlap, `Knoten ${i + 1} und ${j + 1} überlappen bei ${width} px`).toBe(false);
        }
      }
    }
  });
});

test.describe('Arbeiten: Vorschau-Dialog', () => {
  test('öffnet per Klick, Escape schließt, der Fokus kehrt zum Button zurück', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const button = page.locator('[data-preview-open]:visible').first();
    await expect(button).toBeVisible();
    const dialog = page.locator('dialog[data-preview-dialog]');

    await button.click();
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog.locator('[data-preview-close]').first()).toBeFocused();
    await expect(dialog.locator('[data-preview-body] h2')).not.toBeEmpty();
    // Der Dialog ist höchstens 88dvh hoch.
    const height = await dialog.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(900 * 0.88 + 1);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toHaveAttribute('open', '');
    await expect(button).toBeFocused();

    expect(
      pageErrors,
      `Browser-Fehler: ${pageErrors.map((e) => e.message).join(', ')}`
    ).toHaveLength(0);
  });
});

test.describe('Arbeiten: ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('kein Vorschau-Button, keine Chip-Gruppe; Zeilen sind Links, das Schema steht als Liste', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('[data-preview-open]:visible')).toHaveCount(0);
    await expect(page.locator('[aria-label="Projekte filtern"]:visible')).toHaveCount(0);

    const href = await page.locator('[data-filter-item] a').first().getAttribute('href');
    expect(href).toMatch(/^\/projekte\/[^/]+\/$/);

    await expect(page.locator('[data-schema-list] li:visible')).toHaveCount(5);
    await expect(page.locator('[data-schema-detail]:visible')).toHaveCount(0);
    await expect(page.locator('[data-schema-node]:not([disabled])')).toHaveCount(0);
  });
});

test.describe('Arbeiten: Zugänglichkeit', () => {
  test('axe-Regel nested-interactive meldet auf / keinen Verstoß', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-preview-open]:visible').first()).toBeVisible();

    const violations = await axeRuleViolations(page, ['nested-interactive']);
    expect(violations, `nested-interactive auf /:\n${JSON.stringify(violations, null, 2)}`).toEqual(
      []
    );
  });
});

// Abschnitt „Logbuch“ (Plan 02-08, D-10, D-11).
test.describe('Logbuch', () => {
  test('Suche löst keine Netzwerkanfrage aus und ändert die Adresse nicht', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const search = page.locator('#logbuch input[type="search"]');
    await expect(search).toBeVisible();
    await expect(page.locator('#logbuch [data-filter-item]')).toHaveCount(8);

    const url = page.url();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await search.fill('docker');
    await expect(page.locator('#logbuch [data-filter-status]')).not.toHaveText('8 Notizen');
    await page.waitForTimeout(300);

    expect(requests, `Anfragen nach der Eingabe: ${requests.join(', ')}`).toEqual([]);
    expect(page.url()).toBe(url);
    expect(pageErrors).toHaveLength(0);
  });

  test('ein Suchtext ohne Treffer zeigt den Leerzustand, „Filter zurücksetzen“ stellt acht Zeilen her', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const search = page.locator('#logbuch input[type="search"]');
    const rows = page.locator('#logbuch [data-filter-item]:visible');
    await expect(rows).toHaveCount(8);

    await search.fill('c++ [a-');
    await expect(rows).toHaveCount(0);
    await expect(page.getByText('Keine passende Notiz.')).toBeVisible();
    await expect(page.locator('#logbuch [data-filter-status]')).toHaveText('0 von 8 Notizen');
    await expect(page.getByRole('link', { name: 'Alle Beiträge im Blog' })).toBeVisible();

    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
    await expect(rows).toHaveCount(8);
    await expect(search).toHaveValue('');
    await expect(page.locator('#logbuch [data-filter-status]')).toHaveText('8 Notizen');
  });

  test.describe('ohne JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('Suchfeld und Chip-Gruppe sind verborgen, acht Zeilen bleiben Links auf /blog/', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');

      await expect(page.locator('#logbuch input[type="search"]:visible')).toHaveCount(0);
      await expect(
        page.locator('#logbuch [aria-label="Logbuch nach Thema filtern"]:visible')
      ).toHaveCount(0);
      await expect(page.locator('#logbuch [data-preview-open]:visible')).toHaveCount(0);

      const hrefs = await page
        .locator('#logbuch [data-filter-item] a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(hrefs).toHaveLength(8);
      for (const href of hrefs) expect(href).toMatch(/^\/blog\/[^/]+\/$/);
    });
  });

  test('bei 320 und 390 px: kein horizontaler Überlauf der ganzen Startseite', async ({ page }) => {
    for (const size of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);

      const metrics = await page.evaluate(() => {
        const width = window.innerWidth;
        const offenders: string[] = [];
        document.querySelectorAll('body *').forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.right > width + 0.5) {
            offenders.push(`${element.tagName.toLowerCase()}.${String(element.className)}`);
          }
        });
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: width,
          offenders: offenders.slice(0, 5),
        };
      });
      expect(
        metrics.scrollWidth,
        `Startseite läuft bei ${size.width} px über (${metrics.offenders.join(', ')})`
      ).toBeLessThanOrEqual(metrics.innerWidth);
    }
  });
});

// PERF-02 / D-41: Die Startseite bleibt SSR und fordert kein Rasterbild an. Bildvarianten gibt es
// nur aus dem Build; ein Aufruf der Startseite darf keine Transformation zur Laufzeit auslösen.
const RASTER_EXTENSION = /\.(png|jpe?g|webp|avif)$/i;
const FAVICON_PATH = /^\/(icons\/|favicon)/;

test.describe('Startseite ohne Rasterbild', () => {
  test('Startseite lädt kein Rasterbild', async ({ page }) => {
    const requests: { url: string; type: string }[] = [];
    page.on('request', (request) => {
      requests.push({ url: request.url(), type: request.resourceType() });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const rasterImages = requests.filter(({ url, type }) => {
      const { pathname } = new URL(url);
      return type === 'image' && RASTER_EXTENSION.test(pathname) && !FAVICON_PATH.test(pathname);
    });
    expect(
      rasterImages.map(({ url }) => url),
      'Rasterbild auf der Startseite angefordert'
    ).toEqual([]);

    const runtimeEndpoint = requests.filter(({ url }) =>
      new URL(url).pathname.startsWith('/_image')
    );
    expect(
      runtimeEndpoint.map(({ url }) => url),
      'Bildendpunkt der Laufzeit auf der Startseite angefordert'
    ).toEqual([]);
  });
});

test.describe('Manipulierter Speicher', () => {
  test('ein Markup-Wert führt zur Papieransicht ohne Fehler', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await seedVariant(page, '<img src=x>');
    await page.goto('/blog/');
    await waitForReady(page);

    expect(await hasVariantAttribute(page)).toBe(false);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(
      pageErrors,
      `Browser-Fehler: ${pageErrors.map((e) => e.message).join(', ')}`
    ).toHaveLength(0);
  });
});
