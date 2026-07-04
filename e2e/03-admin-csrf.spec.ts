// Admin-Mutation-CSRF-E2E (Issue #296): src/middleware.ts prüft für jede
// state-changing /api/admin/*-Anfrage einen Double-Submit-Cookie
// (x-csrf-token-Header muss den csrf-token-Cookie spiegeln). Dieser Test
// fasst den echten Schutzmechanismus NICHT an — er verifiziert ihn:
// gültiges Token → Erfolg, fehlendes/falsches Token → Ablehnung.
//
// Setzt voraus, dass e2e/01-contact.spec.ts bereits eine Kontaktnachricht mit
// dem Namen CONTACT_SUCCESS_NAME angelegt hat (Dateipräfix 01- vor 03-, ein
// Worker, keine Parallelität — siehe playwright.config.ts). Ein zusätzlicher
// /api/contact-Request an dieser Stelle würde das Contact-Rate-Limit
// (max=3/10min, siehe 01-contact.spec.ts) überziehen.
import { expect, test } from '@playwright/test';
import { CONTACT_SUCCESS_NAME } from './fixtures';
import { getCsrfToken, loginAdminApi } from './helpers/adminAuth';

interface ContactMessageRow {
  id: string;
  name: string;
  status: 'open' | 'answered' | 'spam' | 'follow_up';
}

test.describe('Admin-Mutation CSRF-Schutz', () => {
  test('gültiges CSRF-Token erlaubt die Mutation, fehlendes/falsches Token wird abgelehnt', async ({
    request,
  }) => {
    await loginAdminApi(request);
    const csrfToken = await getCsrfToken(request);

    const listResponse = await request.get('/api/admin/messages');
    expect(listResponse.ok()).toBe(true);
    const { items } = (await listResponse.json()) as { items: ContactMessageRow[] };
    const fixture = items.find((item) => item.name === CONTACT_SUCCESS_NAME);
    expect(
      fixture,
      `Kontaktnachricht "${CONTACT_SUCCESS_NAME}" nicht gefunden — lief e2e/01-contact.spec.ts vorher?`
    ).toBeTruthy();
    const messageId = fixture!.id;

    // 1) Fehlendes CSRF-Token → 403, kein Durchschlüpfen am Schutzmechanismus.
    const withoutToken = await request.patch('/api/admin/messages', {
      data: { id: messageId, status: 'follow_up' },
    });
    expect(withoutToken.status()).toBe(403);

    // 2) Falsches CSRF-Token → ebenfalls 403.
    const wrongToken = await request.patch('/api/admin/messages', {
      headers: { 'x-csrf-token': `${csrfToken}-invalid` },
      data: { id: messageId, status: 'follow_up' },
    });
    expect(wrongToken.status()).toBe(403);

    // 3) Gültiges CSRF-Token → Mutation gelingt.
    const withToken = await request.patch('/api/admin/messages', {
      headers: { 'x-csrf-token': csrfToken },
      data: { id: messageId, status: 'follow_up' },
    });
    expect(withToken.ok()).toBe(true);

    const verifyResponse = await request.get('/api/admin/messages?status=follow_up');
    const { items: followUpItems } = (await verifyResponse.json()) as {
      items: ContactMessageRow[];
    };
    expect(followUpItems.some((item) => item.id === messageId)).toBe(true);
  });
});
