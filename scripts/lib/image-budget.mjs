// Bildbudget der Phase 2 (Plan 02-18, D-27): reine Funktionen für Rasterdateien, die
// Bildadressen im HTML der Startseite und die Prüfung gegen die Budgets aus
// bundlesize.config.json. Nur Module mit dem Präfix `node:`; kein DOM-Parser — die Attribute
// werden mit Mustern aus den Tags gelesen.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RASTER_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif']);
const KB = 1024;

/** Die Budget-Schlüssel, die `budgets.images` führen muss. */
export const IMAGE_BUDGET_KEYS = ['maxRasterFileKb', 'astroRasterTotalKb', 'homeRasterKb'];

/** Eigene Herkünfte, deren absolute Adressen als Pfad gelten. */
const SITE_ORIGINS = ['https://alex-schneider.dev'];

function extname(name) {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * Alle Rasterdateien unter `dir`, rekursiv, mit Größe in Byte.
 * Liefert [{ path, bytes }] mit `path` relativ zu `dir` und Schrägstrichen als Trenner.
 * SVG und Videos zählen nicht.
 */
export function collectRasterFiles(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, entry.name);
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (RASTER_EXT.has(extname(entry.name))) {
        out.push({ path: childRel, bytes: statSync(childAbs).size });
      }
    }
  };
  walk(dir, '');
  return out;
}

function hostOf(origin) {
  return String(origin)
    .replace(/^(?:https?:)?\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function stripQueryAndFragment(value) {
  const withoutFragment = value.split('#')[0];
  const query = withoutFragment.indexOf('?');
  return query === -1 ? withoutFragment : withoutFragment.slice(0, query);
}

function attributeOf(tag, name) {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const match = tag.match(pattern);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/**
 * Die Bildadressen eines HTML-Dokuments, getrennt nach eigener Site und fremden Hosts.
 * Liest img[src], img[srcset], source[srcset], video[poster] und link[rel=preload][as=image].
 * `data:`-Adressen entfallen, Query und Fragment werden abgeschnitten, absolute Adressen der
 * eigenen Site werden zum Pfad. JSON-LD, `og:image` und `link[rel=icon]` zählen nicht.
 * Liefert { own: string[], foreign: string[] }.
 */
export function extractImageUrls(html, options = {}) {
  const ownHosts = new Set(
    [...SITE_ORIGINS, ...(options.siteOrigins ?? []), ...(options.origin ? [options.origin] : [])]
      .map(hostOf)
      .filter((host) => host !== '')
  );
  const own = [];
  const foreign = [];
  const seenOwn = new Set();
  const seenForeign = new Set();

  const add = (raw) => {
    const value = String(raw ?? '').trim();
    if (value === '' || value.startsWith('data:')) return;
    const address = stripQueryAndFragment(value);
    if (address === '') return;
    const absolute = address.match(/^(?:https?:)?\/\/([^/]+)(\/.*)?$/i);
    if (absolute) {
      const host = absolute[1].toLowerCase();
      const path = absolute[2] ?? '/';
      if (ownHosts.has(host)) {
        if (!seenOwn.has(path)) {
          seenOwn.add(path);
          own.push(path);
        }
      } else if (!seenForeign.has(address)) {
        seenForeign.add(address);
        foreign.push(address);
      }
      return;
    }
    const path = address.startsWith('/') ? address : `/${address}`;
    if (!seenOwn.has(path)) {
      seenOwn.add(path);
      own.push(path);
    }
  };

  const addSrcset = (value) => {
    for (const part of value.split(',')) {
      const candidate = part.trim().split(/\s+/)[0];
      if (candidate !== '') add(candidate);
    }
  };

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attributeOf(tag, 'src');
    if (src !== null) add(src);
    const srcset = attributeOf(tag, 'srcset');
    if (srcset !== null) addSrcset(srcset);
  }
  for (const tag of html.match(/<source\b[^>]*>/gi) ?? []) {
    const srcset = attributeOf(tag, 'srcset');
    if (srcset !== null) addSrcset(srcset);
  }
  for (const tag of html.match(/<video\b[^>]*>/gi) ?? []) {
    const poster = attributeOf(tag, 'poster');
    if (poster !== null) add(poster);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\brel\s*=\s*["']?preload\b/i.test(tag)) continue;
    if (!/\bas\s*=\s*["']?image\b/i.test(tag)) continue;
    const href = attributeOf(tag, 'href');
    if (href !== null) add(href);
  }

  return { own, foreign };
}

const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

function formatLine(label, bytes, budgetKb, path) {
  const budgetBytes = typeof budgetKb === 'number' && budgetKb > 0 ? budgetKb * KB : null;
  const budgetText = budgetBytes === null ? 'kein Budget' : kb(budgetBytes);
  const percent = budgetBytes === null ? '—' : `${Math.round((bytes / budgetBytes) * 100)}%`;
  const suffix = path === null ? '' : `  [${path}]`;
  return `${label}: ${kb(bytes)} / Budget ${budgetText} (${percent})${suffix}`;
}

/**
 * Prüft die Rasterdateien des Builds und das Bildgewicht der Startseite gegen die Budgets.
 * `files`: [{ path, bytes }] unter dem Client-Verzeichnis. `homeUrls`: das Ergebnis von
 * `extractImageUrls` für die Startseite. Liefert { lines, violations }.
 */
export function evaluateImageBudget(input) {
  const files = input.files ?? [];
  const astroPrefix = input.astroPrefix ?? '_astro/';
  const homeUrls = input.homeUrls ?? { own: [], foreign: [] };
  const budgets = input.budgets ?? {};

  const lines = [];
  const violations = [];

  for (const key of IMAGE_BUDGET_KEYS) {
    const value = budgets[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      violations.push(`Budget budgets.images.${key} fehlt oder ist keine positive Zahl`);
    }
  }

  const raster = files.filter((file) => RASTER_EXT.has(extname(file.path)));
  const largest =
    raster.length === 0
      ? null
      : raster.reduce((best, file) => (file.bytes > best.bytes ? file : best));
  const astroBytes = raster
    .filter((file) => file.path.startsWith(astroPrefix))
    .reduce((sum, file) => sum + file.bytes, 0);

  const bytesOf = new Map(files.map((file) => [file.path, file.bytes]));
  let homeBytes = 0;
  for (const url of homeUrls.own) {
    const bytes = bytesOf.get(url.replace(/^\//, ''));
    if (bytes === undefined) {
      violations.push(`Bild der Startseite fehlt im Build: ${url}`);
      continue;
    }
    homeBytes += bytes;
  }
  for (const url of homeUrls.foreign) {
    violations.push(`Bild der Startseite von fremdem Host: ${url}`);
  }

  lines.push(
    formatLine(
      'Größte Rasterdatei',
      largest === null ? 0 : largest.bytes,
      budgets.maxRasterFileKb,
      largest === null ? null : largest.path
    )
  );
  lines.push(
    formatLine(`Raster unter ${astroPrefix}`, astroBytes, budgets.astroRasterTotalKb, null)
  );
  lines.push(formatLine('Startseite Bilder', homeBytes, budgets.homeRasterKb, null));

  if (
    budgets.maxRasterFileKb > 0 &&
    largest !== null &&
    largest.bytes > budgets.maxRasterFileKb * KB
  ) {
    violations.push(
      `Größte Rasterdatei ${largest.path} (${kb(largest.bytes)}) überschreitet Budget ${kb(budgets.maxRasterFileKb * KB)}`
    );
  }
  if (budgets.astroRasterTotalKb > 0 && astroBytes > budgets.astroRasterTotalKb * KB) {
    violations.push(
      `Rasterdateien unter ${astroPrefix} (${kb(astroBytes)}) überschreiten Budget ${kb(budgets.astroRasterTotalKb * KB)}`
    );
  }
  if (budgets.homeRasterKb > 0 && homeBytes > budgets.homeRasterKb * KB) {
    violations.push(
      `Bilder der Startseite (${kb(homeBytes)}) überschreiten Budget ${kb(budgets.homeRasterKb * KB)}`
    );
  }

  return { lines, violations };
}
