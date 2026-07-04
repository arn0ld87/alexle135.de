import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const forbiddenPaths = [
  'playwright-report',
  'test-results',
  'coverage',
  'jules-scratch',
  'memory-bank',
  '.memory_bank',
  'lighthouse-report',
  'lhci_reports',
];

const allowedRootReports = new Set([]);

const problems = [];

for (const path of forbiddenPaths) {
  if (existsSync(path)) {
    problems.push(path);
  }
}

for (const entry of readdirSync('.')) {
  const fullPath = join('.', entry);
  if (!statSync(fullPath).isFile()) {
    continue;
  }

  if (/^[A-Za-z0-9._-]+-report\.md$/.test(entry) && !allowedRootReports.has(entry)) {
    problems.push(entry);
  }
}

if (problems.length > 0) {
  console.error('Forbidden generated or scratch artifacts found:');
  for (const problem of problems.sort()) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('Repo hygiene check passed.');
