/// <reference types="astro/client" />

import type { AdminSession } from './lib/adminSession';

// declare global nötig: durch das `import type` oben ist diese Datei ein
// Modul; ein nacktes `declare namespace App` würde nur lokal gelten und das
// globale App.Locals (Astro) nicht augmentieren → ts(2339) auf locals.*.
declare global {
  namespace App {
    interface Locals {
      user: AdminSession['user'];
    }
  }
}

interface ImportMetaEnv {
  /** Server-only PostgreSQL connection string for app data and Better Auth. */
  readonly DATABASE_URL: string;
  /** Server-only Better Auth secret. */
  readonly BETTER_AUTH_SECRET: string;
  /** Public base URL used by Better Auth callbacks and cookies. */
  readonly BETTER_AUTH_URL?: string;
  /** Comma-separated admin e-mail fallback allowlist. */
  readonly ADMIN_EMAILS?: string;
  /** Server-only Google Gemini API key, used by /api/ai-tutor and /api/analyze. */
  readonly GEMINI_API_KEY: string;
  /** Server-only salt used when hashing client IPs for /api/contact audit data. */
  readonly CONTACT_IP_SALT?: string;
  /** Google Analytics 4 Measurement ID, injected into client bundle. */
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
  /** Kurz-SHA des Deploys, optionales Docker-Build-Arg (kein Geheimnis); Footer-Betriebszeile. */
  readonly PUBLIC_BUILD_SHA?: string;
  /** Inhalts-Hash der Missions-Assets (VERSION aus scripts/mission-image/build.sh, #388). */
  readonly PUBLIC_MISSION_ASSETS_VERSION?: string;
  /** Inhalts-Hash des Bildschirm-Images (VERSION aus scripts/mission-image-gui/build.sh). */
  readonly PUBLIC_MISSION_BILDSCHIRM_VERSION?: string;
  /** Build-Datum (JJJJ-MM-TT), zur Build-Zeit über vite.define aus astro.config.mjs gesetzt. */
  readonly PUBLIC_BUILD_DATE?: string;
  /** Build-Zeitpunkt (ISO 8601), über vite.define gesetzt; Veröffentlichungsgrenze in utils/content.ts. */
  readonly PUBLIC_BUILD_TIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  function gtag(...args: unknown[]): void;
  interface Window {
    gtag: typeof gtag;
    dataLayer: unknown[];
  }
}
