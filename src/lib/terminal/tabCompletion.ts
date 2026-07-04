export function getCompletions(input: string, options: string[]): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  return options.filter((opt) => opt.toLowerCase().startsWith(trimmed.toLowerCase())).sort();
}

export function completeCommand(input: string, options: string[]): string {
  const completions = getCompletions(input, options);

  if (completions.length === 0) return input;
  if (completions.length === 1) return completions[0];

  // Find longest common prefix
  const sorted = completions.sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let i = 0;

  while (i < first.length && first[i] === last[i]) {
    i++;
  }

  return first.substring(0, i);
}

export function getCommonCommands(): string[] {
  return [
    'ls',
    'cd',
    'pwd',
    'mkdir',
    'rm',
    'cp',
    'mv',
    'cat',
    'touch',
    'clear',
    'whoami',
    'echo',
    'grep',
    'find',
    'chmod',
    'chown',
    'docker',
    'docker ps',
    'docker run',
    'docker stop',
    'docker images',
    'git',
    'git status',
    'git add',
    'git commit',
    'git push',
    'git pull',
    'npm',
    'npm install',
    'npm start',
    'npm test',
    'npm run build',
  ];
}
