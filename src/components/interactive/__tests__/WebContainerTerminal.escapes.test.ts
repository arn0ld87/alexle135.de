import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression: Im Komponentencode standen Escapes doppelt maskiert (`'\\x1b…'`). xterm zeigte sie
 * als Klartext, und `handleResize` schrieb eine OSC-Sequenz als Text in die Eingabe der Shell,
 * die sie als Befehl ausführte. Der Shell-Quelltext lebt in `missionShell.ts` und wird dort
 * durch `missionShell.test.ts` ausgeführt.
 */
const source = readFileSync(
  resolve(process.cwd(), 'src/components/interactive/WebContainerTerminal.tsx'),
  'utf8'
);
const runtimeCode = source;

describe('WebContainerTerminal: Steuerzeichen', () => {
  it('enthält keinen eingebetteten Shell-Quelltext', () => {
    expect(runtimeCode).not.toContain('readline');
  });

  it('maskiert außerhalb des Shell-Templates keine Escapes doppelt', () => {
    expect(runtimeCode).not.toMatch(/\\\\(x1b|x07|r|n|b|u007F)/);
  });

  it('schreibt beim Resize nichts in die Eingabe der Shell', () => {
    expect(runtimeCode).toContain('process.resize({ cols: terminal.cols, rows: terminal.rows })');
    expect(runtimeCode).not.toMatch(/input\.write\([^)]*\]0;/);
  });
});
