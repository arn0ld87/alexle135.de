#!/usr/bin/env node
/**
 * Interner Link-Checker für den Build-Output (dist/client).
 *
 * Prüft alle internen href-/src-/srcset-Referenzen in den prerenderten
 * HTML-Dateien gegen:
 *   1. existierende Dateien in dist/client (Assets + prerenderte Seiten),
 *   2. statische SSR-Routen aus src/pages (output: 'server' legt diese
 *      nicht als Dateien ab),
 *   3. dynamische SSR-Routen ([slug], [...slug]) als Pattern - außer sie
 *      sind prerendered, dann muss der Output in dist/client existieren.
 *
 * Externe Links werden bewusst NICHT geprüft (flaky, netzwerkabhängig).
 * Exit-Code 1, sobald mindestens ein interner Link ins Leere zeigt.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';

const DIST_CLIENT = resolve(process.cwd(), 'dist/client');
const PAGES_DIR = resolve(process.cwd(), 'src/pages');

function collectFiles(dir, filter) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...collectFiles(full, filter));
    } else if (filter(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Routen aus src/pages ableiten (Astro-Konvention). */
function buildRouteTable() {
  const exact = new Set(['/']);
  const patterns = [];

  const files = collectFiles(
    PAGES_DIR,
    (name) => (name.endsWith('.astro') || name.endsWith('.ts')) && !name.includes('.test.')
  );

  for (const file of files) {
    const rel = file.slice(PAGES_DIR.length).split(sep).join('/');
    let route = rel.replace(/\.astro$/, '').replace(/\.ts$/, '');
    route = route.replace(/\/index$/, '') || '/';

    if (route.includes('[')) {
      const prerendered = /export\s+const\s+prerender\s*=\s*true/.test(readFileSync(file, 'utf8'));
      if (prerendered) continue; // Output muss in dist/client liegen
      const pattern = route
        .split('/')
        .map((seg) =>
          seg.includes('[...')
            ? seg.replace(/\[\.\.\.[^\]]+\]/, '.+')
            : seg.replace(/\[[^\]]+\]/g, '[^/]+').replace(/\./g, '\\.')
        )
        .join('/');
      patterns.push(new RegExp(`^${pattern}$`));
    } else {
      exact.add(route === '/' ? '/' : route.replace(/\/$/, ''));
    }
  }

  return { exact, patterns };
}

function extractReferences(html) {
  const refs = [];
  for (const match of html.matchAll(/\b(?:href|src|poster)=["']([^"']+)["']/g)) {
    refs.push(match[1]);
  }
  for (const match of html.matchAll(/\bsrcset=["']([^"']+)["']/g)) {
    for (const candidate of match[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) refs.push(url);
    }
  }
  return refs;
}

function isInternal(url) {
  if (!url) return false;
  if (url.includes('${')) return false; // Template-Fragment aus Inline-Skripten
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false; // mailto:, tel:, https:, data:, ...
  if (url.startsWith('//')) return false; // protokoll-relativ = extern
  if (url.startsWith('#')) return false; // Anker auf derselben Seite
  return true;
}

function distFileExists(base) {
  const candidates = [base, join(base, 'index.html'), `${base.replace(/\/+$/, '')}.html`];
  return candidates.some((c) => {
    if (!existsSync(c)) return false;
    const stats = statSync(c);
    return stats.isFile() || (stats.isDirectory() && existsSync(join(c, 'index.html')));
  });
}

function targetExists(urlPath, pageDir, routes) {
  let clean = urlPath.split('#')[0].split('?')[0];
  if (clean === '') return true; // reiner Anker/Query auf derselben Seite
  try {
    clean = decodeURIComponent(clean);
  } catch {
    return false;
  }

  if (clean.startsWith('/')) {
    const normalized = clean === '/' ? '/' : clean.replace(/\/+$/, '');
    if (routes.exact.has(normalized)) return true;
    if (routes.patterns.some((p) => p.test(normalized))) return true;
    return distFileExists(join(DIST_CLIENT, clean));
  }

  return distFileExists(join(pageDir, clean));
}

function main() {
  if (!existsSync(DIST_CLIENT)) {
    console.error(`dist/client nicht gefunden (${DIST_CLIENT}) - erst \`pnpm build\` ausführen.`);
    process.exit(1);
  }

  const routes = buildRouteTable();
  const htmlFiles = collectFiles(DIST_CLIENT, (name) => name.endsWith('.html'));
  const broken = [];
  let checked = 0;

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const pageDir = dirname(file);
    const seen = new Set();

    for (const ref of extractReferences(html)) {
      if (!isInternal(ref) || seen.has(ref)) continue;
      seen.add(ref);
      checked += 1;
      if (!targetExists(ref, pageDir, routes)) {
        broken.push({ page: file.slice(DIST_CLIENT.length), ref });
      }
    }
  }

  console.log(
    `${htmlFiles.length} HTML-Dateien, ${checked} interne Referenzen geprüft ` +
      `(${routes.exact.size} statische Routen, ${routes.patterns.length} dynamische Patterns).`
  );

  if (broken.length > 0) {
    console.error(`\n${broken.length} kaputte interne Links:`);
    for (const { page, ref } of broken) {
      console.error(`  ${page} -> ${ref}`);
    }
    process.exit(1);
  }

  console.log('Alle internen Links OK.');
}

main();
