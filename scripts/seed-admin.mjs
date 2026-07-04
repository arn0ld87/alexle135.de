// Idempotentes Admin-Seed für Better Auth (Issue #231).
//
// WICHTIG: Die Feld-Mappings unten (user/session/account/verification)
// müssen synchron mit src/lib/auth.ts bleiben. Bei Änderungen dort IMMER
// auch hier nachziehen.
//
// Nutzung (Prod-Container, E-Mail + Passwort per stdin):
//   printf '%s\n%s\n' "admin@example.com" "ein-sicheres-passwort" \
//     | docker exec -i alexle135-v2 node scripts/seed-admin.mjs
//
// Fallback ohne stdin: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD als Env-Vars.
// Läuft erneut ausgeführt idempotent (exists=<email>, keine Änderung).

import readline from 'node:readline';
import { betterAuth } from 'better-auth';
import pg from 'pg';

const { Pool } = pg;

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`Fehlender Pflicht-Env-Var: ${key}`);
    process.exit(1);
  }
  return value;
}

const databaseUrl = requireEnv('DATABASE_URL');
const authSecret = requireEnv('BETTER_AUTH_SECRET');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

async function readStdinLines(maxLines) {
  if (process.stdin.isTTY) {
    return [];
  }

  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const lines = [];
  for await (const line of rl) {
    lines.push(line.trim());
    if (lines.length >= maxLines) {
      break;
    }
  }
  rl.close();
  return lines;
}

async function resolveCredentials() {
  const [stdinEmail, stdinPassword] = await readStdinLines(2);
  const email = stdinEmail || process.env.SEED_ADMIN_EMAIL || '';
  const password = stdinPassword || process.env.SEED_ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.error(
      'E-Mail und Passwort fehlen. Per stdin (zwei Zeilen: E-Mail, Passwort) übergeben ' +
        'oder SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD setzen.'
    );
    process.exit(1);
  }

  if (!EMAIL_PATTERN.test(email)) {
    console.error('E-Mail-Adresse ist ungültig.');
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
    process.exit(1);
  }

  // Better Auth normalisiert E-Mails zu Lowercase; hier früh normalisieren,
  // damit SELECT, Idempotenz-Check und role-Update konsistent sind.
  return { email: email.trim().toLowerCase(), password };
}

const { email, password } = await resolveCredentials();

async function main() {
  let pool;
  let seedAuth;

  try {
    pool = new Pool({ connectionString: databaseUrl, max: 1 });

    // Eigene betterAuth-Instanz mit identischen Feld-Mappings zur Prod-Instanz
    // (src/lib/auth.ts), aber disableSignUp: false — die Prod-Instanz blockiert
    // Self-Signup bewusst, das Seed-Script braucht den Signup-Pfad einmalig.
    seedAuth = betterAuth({
      appName: 'alexle135.de Admin Seed',
      baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:4321',
      secret: authSecret,
      database: pool,
      emailAndPassword: {
        enabled: true,
        disableSignUp: false,
      },
      user: {
        fields: {
          emailVerified: 'email_verified',
          createdAt: 'created_at',
          updatedAt: 'updated_at',
        },
        additionalFields: {
          role: {
            type: 'string',
            required: false,
            defaultValue: 'user',
            input: false,
          },
        },
      },
      session: {
        fields: {
          userId: 'user_id',
          expiresAt: 'expires_at',
          ipAddress: 'ip_address',
          userAgent: 'user_agent',
          createdAt: 'created_at',
          updatedAt: 'updated_at',
        },
      },
      account: {
        fields: {
          userId: 'user_id',
          accountId: 'account_id',
          providerId: 'provider_id',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          accessTokenExpiresAt: 'access_token_expires_at',
          refreshTokenExpiresAt: 'refresh_token_expires_at',
          idToken: 'id_token',
          createdAt: 'created_at',
          updatedAt: 'updated_at',
        },
      },
      verification: {
        fields: {
          expiresAt: 'expires_at',
          createdAt: 'created_at',
          updatedAt: 'updated_at',
        },
      },
    });
    const existing = await pool.query('select 1 from "user" where email = $1', [email]);
    if (existing.rowCount > 0) {
      // Idempotenz inkl. Rolle: falls ein früherer Lauf zwischen Signup und
      // Role-Update abbrach, wird die Admin-Rolle hier nachgezogen.
      const ensured = await pool.query(
        `update "user" set role = 'admin' where email = $1 and role is distinct from 'admin'`,
        [email]
      );
      console.log(
        ensured.rowCount > 0 ? `exists=${email} role=admin (nachgezogen)` : `exists=${email}`
      );
      return 0;
    }

    await seedAuth.api.signUpEmail({
      body: { email, password, name: 'Admin' },
    });

    await pool.query('update "user" set role = $1 where email = $2', ['admin', email]);

    console.log(`created=${email} role=admin`);
    return 0;
  } catch (error) {
    console.error('Admin-Seed fehlgeschlagen:', error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await pool?.end();
  }
}

process.exitCode = await main();
