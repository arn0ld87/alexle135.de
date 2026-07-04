// Admin-Login-E2E (Issue #296): Zugriffsschutz, erfolgreicher Login, Logout.
// Läuft komplett über die echte UI (src/pages/admin/login.astro) gegen den
// echten Login-/Logout-Endpunkt — kein Mocking von adminSession/Better Auth.
import { expect, type Page, test } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './fixtures';

async function loginViaUi(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.locator('#email').fill(E2E_ADMIN_EMAIL);
  await page.locator('#password').fill(E2E_ADMIN_PASSWORD);
  await page.locator('#submit-btn').click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/?$/);
}

test.describe('Admin-Login', () => {
  test('Zugriffsschutz: /admin/dashboard ohne Session redirected auf /admin/login', async ({
    page,
  }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login\/?$/);
  });

  test('Login: gültige Zugangsdaten führen zum Dashboard', async ({ page }) => {
    await loginViaUi(page);
    await expect(page.getByText(`Angemeldet als ${E2E_ADMIN_EMAIL}`)).toBeVisible();
  });

  test('Login: falsches Passwort zeigt eine Fehlermeldung und bleibt auf der Login-Seite', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await page.locator('#email').fill(E2E_ADMIN_EMAIL);
    await page.locator('#password').fill('definitiv-falsches-passwort');
    await page.locator('#submit-btn').click();

    await expect(page.locator('#error-message')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login\/?$/);
  });

  test('Logout: beendet die Session, Zugriffsschutz greift danach wieder', async ({ page }) => {
    await loginViaUi(page);

    await page.locator('#logout-btn').click();
    await expect(page).toHaveURL(/\/admin\/login\/?$/);

    // Session-Cookie ist wirklich weg, nicht nur ein Client-Redirect.
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login\/?$/);
  });
});
