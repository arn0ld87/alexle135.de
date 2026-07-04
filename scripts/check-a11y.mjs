#!/usr/bin/env node
/**
 * A11y-Regressionscheck: axe-core über die prerenderten HTML-Dateien
 * in dist/client, gerendert mit jsdom (kein Browser nötig).
 *
 * Layout-abhängige Regeln (z. B. color-contrast) sind deaktiviert, weil
 * jsdom kein Rendering macht - dafür bleibt Prod-Lighthouse zuständig.
 *
 * Exit-Code 1 bei mindestens einer Violation.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

const DIST_CLIENT = resolve(process.cwd(), 'dist/client');

// Regeln, die echtes Layout/Rendering brauchen und in jsdom
// falsch-positiv oder instabil sind.
const DISABLED_RULES = ['color-contrast', 'color-contrast-enhanced', 'scrollable-region-focusable'];

function collectHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

async function runAxe(file) {
  const html = readFileSync(file, 'utf8');
  const dom = new JSDOM(html, { url: 'https://alexle135.de/', runScripts: 'outside-only' });

  const { window } = dom;
  // axe-core erwartet ein globales window/document im Ausführungskontext.
  const axeSource = axe.source;
  window.eval(axeSource);

  try {
    const results = await window.axe.run(window.document, {
      rules: Object.fromEntries(DISABLED_RULES.map((id) => [id, { enabled: false }])),
      resultTypes: ['violations'],
    });
    return results.violations;
  } finally {
    window.close();
  }
}

async function main() {
  if (!existsSync(DIST_CLIENT)) {
    console.error(`dist/client nicht gefunden (${DIST_CLIENT}) - erst \`pnpm build\` ausführen.`);
    process.exit(1);
  }

  const htmlFiles = collectHtmlFiles(DIST_CLIENT);
  let totalViolations = 0;

  for (const file of htmlFiles) {
    const rel = file.slice(DIST_CLIENT.length);
    let violations;
    try {
      violations = await runAxe(file);
    } catch (error) {
      console.error(`  ${rel}: axe-Lauf fehlgeschlagen - ${error.message}`);
      totalViolations += 1;
      continue;
    }

    for (const v of violations) {
      totalViolations += 1;
      console.error(`  ${rel}: [${v.impact}] ${v.id} - ${v.help}`);
      for (const node of v.nodes.slice(0, 3)) {
        console.error(`      ${node.target.join(' ')}`);
      }
    }
  }

  console.log(`${htmlFiles.length} HTML-Dateien mit axe-core geprüft.`);

  if (totalViolations > 0) {
    console.error(`\n${totalViolations} A11y-Violations gefunden.`);
    process.exit(1);
  }

  console.log('Keine A11y-Violations.');
}

main();
