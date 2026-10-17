#!/usr/bin/env node
// PostToolUse-Hook: formatiert genau die Datei, die gerade geschrieben wurde --
// und ausschliesslich diese.
//
// Vorgeschichte: Der frueher inline in .claude/settings.json definierte Hook
// lautete sinngemaess
//
//     node -e '<guard liest stdin>' && npx prettier --write "$CLAUDE_FILE_PATHS"
//
// mit zwei Fehlern. Erstens verbrauchte der Guard stdin und warf den Dateipfad
// danach weg. Zweitens ist CLAUDE_FILE_PATHS in dieser Claude-Code-Version gar
// nicht gesetzt, sodass der Aufruf effektiv `prettier --write ""` war. Ein
// leeres Muster bedeutet fuer Prettier "das gesamte Arbeitsverzeichnis":
// jeder einzelne Datei-Edit formatierte also das ganze Repo neu, begrenzt nur
// durch .prettierignore. Sichtbar wurde das an pnpm-lock.yaml und an
// unbeteiligten Content-Dateien, die ohne Zutun im git status auftauchten.
//
// Dieser Hook liest stdin genau einmal, nimmt den Pfad aus dem Tool-Input und
// tut ohne konkreten Pfad nichts.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const FORMATTABLE = /\.(ts|tsx|js|jsx|astro|mjs|cjs|json|md|mdx|css)$/;

// Generierte Artefakte, die auch bei passender Endung nie formatiert werden.
// Doppelt gesichert: .prettierignore deckt dieselben Pfade ab.
const NEVER_FORMAT = [/^pnpm-lock\.yaml$/, /^package-lock\.json$/, /^yarn\.lock$/];

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function extractFilePath(raw) {
  if (!raw.trim()) return '';
  try {
    return JSON.parse(raw)?.tool_input?.file_path ?? '';
  } catch {
    return '';
  }
}

const filePath = extractFilePath(readStdin());

// Kein Pfad -> nichts tun. Das ist der Kern des Fixes: frueher lief hier ein
// Repo-weites Format.
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const resolved = path.resolve(projectDir, filePath);
const rel = path.relative(projectDir, resolved);

// Ausserhalb des Projekts (inkl. ".." und absoluter Fremdpfade): nicht anfassen.
if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) process.exit(0);
if (!FORMATTABLE.test(resolved)) process.exit(0);
if (NEVER_FORMAT.some((pattern) => pattern.test(rel))) process.exit(0);

try {
  execFileSync('npx', ['--no-install', 'prettier', '--write', resolved], {
    cwd: projectDir,
    stdio: 'ignore',
  });
} catch {
  // Formatierung ist best effort und darf den Tool-Call nie zum Scheitern
  // bringen -- etwa wenn prettier lokal nicht installiert ist.
}
