// Build-Angaben für die Betriebszeile im Footer (Plan 02-04, D-21, D-46).
//
// Beide Werte entstehen beim Build und nicht beim Request:
// - PUBLIC_BUILD_SHA kommt als optionales Docker-Build-Arg aus dem Deploy
//   (Kurz-SHA, kein Geheimnis). Ohne Arg (lokaler Build, CI-Docker-Build) fehlt er.
// - PUBLIC_BUILD_DATE setzt astro.config.mjs über vite.define.
//
// Das Modul gibt ausschließlich Kurz-SHA und Datum weiter, nie Hostname, Branch,
// Pfad oder andere Umgebungswerte. Es liest bewusst keine Uhr (kein new Date()):
// ein Datum zur Laufzeit wäre das Datum des Requests, nicht des Builds.

export type BuildInfo = {
  /** Die ersten 7 Zeichen des Commits oder null, wenn der Wert fehlt oder ungültig ist. */
  sha: string | null;
  /** Build-Datum als JJJJ-MM-TT oder null. */
  date: string | null;
  /** Build-Datum als TT.MM.JJJJ oder null. */
  dateDisplay: string | null;
};

const SHA_PATTERN = /^[0-9a-f]{7,40}$/;
const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const SHA_DISPLAY_LENGTH = 7;

function parseSha(value: unknown): string | null {
  if (typeof value !== 'string' || !SHA_PATTERN.test(value)) return null;
  return value.slice(0, SHA_DISPLAY_LENGTH);
}

function parseDate(value: unknown): { date: string; display: string } | null {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return { date: value, display: `${day}.${month}.${year}` };
}

// Die Zugriffe stehen einzeln und wörtlich da: Vite ersetzt nur die Schreibweise
// import.meta.env.NAME zuverlässig durch den Build-Wert.
function readBuildEnv(): Record<string, unknown> {
  return {
    PUBLIC_BUILD_SHA: import.meta.env.PUBLIC_BUILD_SHA,
    PUBLIC_BUILD_DATE: import.meta.env.PUBLIC_BUILD_DATE,
  };
}

export function getBuildInfo(env: Record<string, unknown> = readBuildEnv()): BuildInfo {
  const parsedDate = parseDate(env.PUBLIC_BUILD_DATE);
  return {
    sha: parseSha(env.PUBLIC_BUILD_SHA),
    date: parsedDate?.date ?? null,
    dateDisplay: parsedDate?.display ?? null,
  };
}

/** Klartext der Betriebszeile: „Build 0123abc · 13.10.2026“, „Build 13.10.2026“ oder leer. */
export function formatBuildLine(info: BuildInfo): string {
  if (info.sha && info.dateDisplay) return `Build ${info.sha} · ${info.dateDisplay}`;
  if (info.dateDisplay) return `Build ${info.dateDisplay}`;
  if (info.sha) return `Build ${info.sha}`;
  return '';
}
