// Kontaktformular-E2E (Issue #296): Erfolg, Validierungsfehler, Honeypot.
//
// WICHTIG — Rate-Limit-Budget: src/lib/rateLimit.ts erlaubt für den
// "contact"-Bucket maximal 3 Requests / 10 Minuten pro Client-IP (siehe
// BUCKETS.contact). Alle Playwright-Requests in dieser CI-/Lokal-Umgebung
// laufen über dieselbe Loopback-IP, teilen sich also DIESES EINE Budget mit
// allen drei Tests unten (genau 3 Requests). Deshalb:
//   - retries: 0 in playwright.config.ts (ein Retry wäre der 4. Request → 429)
//   - serial mode: deterministische Reihenfolge, kein Test doppelt bei Fehlern
//   - kein weiterer Test in dieser Datei darf /api/contact aufrufen
// Der Origin-Check und der Honeypot werden dabei NICHT abgeschwächt: alle drei
// Requests laufen über den echten Browser-Origin http://localhost:4321, der
// exakt in der Allowlist steht (siehe e2e/fixtures.ts).
import { expect, test } from '@playwright/test';
import { CONTACT_SUCCESS_NAME } from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('Kontaktformular', () => {
  test('Erfolgsfall: gültige Eingabe wird gespeichert und leitet auf die Danke-Seite weiter', async ({
    page,
  }) => {
    await page.goto('/kontakt/');

    await page.locator('#name').fill(CONTACT_SUCCESS_NAME);
    await page.locator('#email').fill('e2e-contact@alexle135.test');
    await page
      .locator('#message')
      .fill('Dies ist eine Playwright-E2E-Testnachricht mit ausreichender Länge.');

    await page.locator('#contact-submit').click();

    await expect(page).toHaveURL(/\/kontakt\/danke\/?$/);
  });

  test('Validierungsfehler: zu kurze Nachricht wird vom Server abgelehnt', async ({ page }) => {
    await page.goto('/kontakt/');

    await page.locator('#name').fill('E2E Validation Case');
    await page.locator('#email').fill('e2e-validation@alexle135.test');
    // Das <form novalidate>-Attribut deaktiviert die native Constraint-
    // Validation (siehe kontakt.astro) — der Request geht wirklich zum
    // Server, der die Länge serverseitig prüft (src/pages/api/contact.ts).
    await page.locator('#message').fill('zu kurz');

    await page.locator('#contact-submit').click();

    const status = page.locator('#contact-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText('zwischen 10 und 5000 Zeichen');
    // Kein Redirect bei einem Validierungsfehler.
    await expect(page).toHaveURL(/\/kontakt\/?$/);
  });

  test('Honeypot: ausgefülltes Honeypot-Feld wird dem Absender gegenüber wie Erfolg behandelt', async ({
    page,
  }) => {
    await page.goto('/kontakt/');

    await page.locator('#name').fill('E2E Honeypot Bot');
    await page.locator('#email').fill('e2e-honeypot@alexle135.test');
    await page
      .locator('#message')
      .fill('Diese Nachricht sollte serverseitig als Bot-Traffic verworfen werden.');
    // Für Menschen unsichtbares Honeypot-Feld (sr-only, tabindex="-1") —
    // force:true, weil Playwright das Feld sonst als nicht interagierbar
    // ablehnt. Ein echter Bot füllt es blind über das DOM aus.
    await page.locator('#website').fill('https://spam.example/', { force: true });

    await page.locator('#contact-submit').click();

    // src/pages/api/contact.ts gibt bei erkanntem Honeypot bewusst dieselbe
    // Erfolgsantwort zurück wie bei einer echten Nachricht (silent success,
    // damit Bots keinen Rückschluss auf die Erkennung ziehen können) — der
    // Client leitet daher identisch auf die Danke-Seite weiter.
    await expect(page).toHaveURL(/\/kontakt\/danke\/?$/);
  });
});
