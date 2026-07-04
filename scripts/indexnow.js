#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';

const BLOCKED_PAGE_ROUTES = new Set(['404', 'design-system', 'kontakt/danke', 'status']);

function normalizeFilePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function toAbsoluteUrl(routePath, siteUrl) {
  return new URL(routePath, siteUrl).toString();
}

export function mapFilePathToUrl(filePath, siteUrl) {
  const normalized = normalizeFilePath(filePath);

  if (normalized.startsWith('src/content/blog/')) {
    const slug = normalized.replace(/^src\/content\/blog\//, '').replace(/\.(md|mdx)$/, '');
    return toAbsoluteUrl(`/blog/${slug}/`, siteUrl);
  }

  if (normalized.startsWith('src/content/projects/')) {
    const slug = normalized.replace(/^src\/content\/projects\//, '').replace(/\.(md|mdx)$/, '');
    return toAbsoluteUrl(`/projekte/${slug}/`, siteUrl);
  }

  if (!normalized.startsWith('src/pages/')) {
    return null;
  }

  if (
    normalized.startsWith('src/pages/api/') ||
    normalized.startsWith('src/pages/admin/') ||
    /\[[^\]]+\]/.test(normalized)
  ) {
    return null;
  }

  let route = normalized.replace(/^src\/pages\//, '').replace(/\.(astro|md|mdx|js|ts)$/, '');

  if (route === 'index') {
    return toAbsoluteUrl('/', siteUrl);
  }

  route = route.replace(/\/index$/, '');

  if (!route || BLOCKED_PAGE_ROUTES.has(route)) {
    return route ? null : toAbsoluteUrl('/', siteUrl);
  }

  return toAbsoluteUrl(`/${route}/`, siteUrl);
}

export function collectChangedUrls(filePaths, siteUrl) {
  const urls = new Set();
  let blogChanged = false;
  let projectsChanged = false;

  for (const filePath of filePaths) {
    const normalized = normalizeFilePath(filePath);
    const url = mapFilePathToUrl(normalized, siteUrl);

    if (normalized.startsWith('src/content/blog/')) blogChanged = true;
    if (normalized.startsWith('src/content/projects/')) projectsChanged = true;
    if (url) urls.add(url);
  }

  if (blogChanged) urls.add(toAbsoluteUrl('/blog/', siteUrl));
  if (projectsChanged) urls.add(toAbsoluteUrl('/projekte/', siteUrl));

  return [...urls].sort((a, b) => a.localeCompare(b));
}

export async function submitIndexNow({
  endpoint = 'https://api.indexnow.org/indexnow',
  key,
  keyLocation,
  siteUrl,
  urlList,
  fetchImpl = fetch,
}) {
  const host = new URL(siteUrl).host;
  const payload = { host, key, keyLocation, urlList };

  return fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const siteUrl = env.INDEXNOW_SITE_URL || env.SITE_URL || 'https://alexle135.de';
  const key = env.INDEXNOW_KEY;

  if (!key) {
    console.log('IndexNow übersprungen: INDEXNOW_KEY ist nicht gesetzt.');
    return 0;
  }

  const keyLocation = env.INDEXNOW_KEY_LOCATION || toAbsoluteUrl(`/${key}.txt`, siteUrl);
  const urlList = collectChangedUrls(argv, siteUrl);

  if (!urlList.length) {
    console.log('IndexNow übersprungen: keine indexierbaren URL-Änderungen erkannt.');
    return 0;
  }

  console.log(`IndexNow: ${urlList.length} URL(s) erkannt.`);

  if (env.INDEXNOW_DRY_RUN === '1') {
    console.log(
      JSON.stringify(
        {
          host: new URL(siteUrl).host,
          key,
          keyLocation,
          urlList,
        },
        null,
        2
      )
    );
    return 0;
  }

  const response = await submitIndexNow({ key, keyLocation, siteUrl, urlList });

  if (![200, 202].includes(response.status)) {
    const responseBody = await response.text();
    throw new Error(`IndexNow Fehler ${response.status}: ${responseBody}`);
  }

  console.log(`IndexNow erfolgreich: HTTP ${response.status}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  );
}
