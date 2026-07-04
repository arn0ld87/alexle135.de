import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { optionalEnv, requireEnv } from './env';

const betterAuthUrl = optionalEnv('BETTER_AUTH_URL');
const trustedOrigins = [
  'https://alexle135.de',
  'https://www.alexle135.de',
  'http://localhost:4321',
  // Staging-/Preview-Deployments sonst blockiert Better Auth deren Origin.
  ...(betterAuthUrl ? [betterAuthUrl] : []),
];

const missingRuntimeDatabaseUrl = 'postgres://missing:missing@127.0.0.1:5432/missing';
const missingRuntimeSecret =
  'insecure-runtime-fallback-secret-REPLACE-ME-please-set-BETTER_AUTH_SECRET-via-runtime-env';

export function requireAuthRuntimeEnv(): void {
  requireEnv('DATABASE_URL');
  requireEnv('BETTER_AUTH_SECRET');
}

export const auth = betterAuth({
  appName: 'alexle135.de Admin',
  baseURL: optionalEnv('BETTER_AUTH_URL') ?? 'http://localhost:4321',
  secret: optionalEnv('BETTER_AUTH_SECRET') ?? missingRuntimeSecret,
  database: new Pool({
    connectionString: optionalEnv('DATABASE_URL') ?? missingRuntimeDatabaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  trustedOrigins,
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
