// Gemeinsame Test-Fixtures für die Admin-Login-Integrationstests (#236).
// Fester Admin-Account, den global-setup.ts über das echte scripts/seed-admin.mjs
// gegen die Wegwerf-PostgreSQL anlegt. Absichtlich nicht dynamisch generiert,
// damit global-setup und die Testdatei denselben Wert ohne Umweg über
// process.env teilen (Worker-Prozesse bekommen sonst keine Laufzeit-Updates).
export const INTEGRATION_ADMIN_EMAIL = 'integration-admin@alexle135.test';
export const INTEGRATION_ADMIN_PASSWORD = 'Integration-Test-Passw0rd-1!';
