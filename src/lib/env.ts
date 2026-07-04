/**
 * Runtime guard for required server env vars.
 */

function lookup(key: string): string | undefined {
  return process.env[key];
}

export function requireEnv(key: string): string {
  const value = lookup(key);
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export function optionalEnv(key: string): string | undefined {
  const value = lookup(key);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
