import { commonCommands, commandSyntax } from './hints';

interface HintContext {
  missionId: string;
  missionStep?: { title: string; description: string };
  errors: string[];
  attemptCount?: number;
}

export function getSmartHint(command: string, context: HintContext): string | null {
  const cmd = command.trim().toLowerCase();

  // 1. Typo detection (Levenshtein distance)
  const typoHint = detectTypo(cmd);
  if (typoHint) return typoHint;

  // 2. Syntax help
  const syntaxHint = getSyntaxHint(cmd);
  if (syntaxHint) return syntaxHint;

  // 3. Context-aware hint
  const contextHint = getContextHint(cmd, context);
  if (contextHint) return contextHint;

  return null;
}

function detectTypo(cmd: string): string | null {
  const similarCommands = commonCommands.filter(
    (c) => levenshteinDistance(cmd, c) <= 2 && cmd !== c
  );

  if (similarCommands.length === 1) {
    return `💡 Meintest du \`${similarCommands[0]}\`?`;
  }

  return null;
}

function getSyntaxHint(cmd: string): string | null {
  const baseCmd = cmd.split(' ')[0];
  const syntax = commandSyntax[baseCmd];

  if (syntax && cmd === baseCmd) {
    return `⚠️ Syntax: ${syntax}`;
  }

  return null;
}

function getContextHint(cmd: string, context: HintContext): string | null {
  if (!context.missionStep) return null;

  const stepTitle = context.missionStep.title.toLowerCase();
  const cmdBase = cmd.split(' ')[0];

  // Mission wants "create directory", user typed "ls"
  if (stepTitle.includes('erstellen') && cmdBase === 'ls') {
    return 'Fast! Du sollst etwas erstellen, nicht auflisten.';
  }

  if (stepTitle.includes('löschen') && cmdBase === 'ls') {
    return 'Fast! Du sollst etwas löschen, nicht auflisten.';
  }

  if (stepTitle.includes('lesen') && cmdBase === 'mkdir') {
    return 'Fast! Du sollst etwas lesen, nicht erstellen.';
  }

  return null;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
