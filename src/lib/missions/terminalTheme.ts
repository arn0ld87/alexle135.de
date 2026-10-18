export type TerminalTheme = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
};

// xterm braucht feste Farbwerte; sie kommen aus den --terminal-*-Tokens auf :root.
// Signalorange (--accent) nur am Cursor.
export function readTerminalTheme(
  style: Pick<CSSStyleDeclaration, 'getPropertyValue'>
): TerminalTheme {
  const token = (name: string) => style.getPropertyValue(name).trim();
  const background = token('--terminal-bg');
  return {
    background,
    foreground: token('--terminal-fg'),
    cursor: token('--accent'),
    cursorAccent: background,
    selectionBackground: token('--terminal-border'),
  };
}
