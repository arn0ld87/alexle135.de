import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MISSION_FILES, SHELL_PATH, buildCustomShell, createCommandTracker } from '../missionShell';
import {
  linuxBasicsMission,
  linuxCTFHiddenTreasure,
  linuxCTFLogDetective,
  linuxCTFPrivEsc,
  linuxFilesMission,
  type Mission,
} from '../../../data/missions';

type Tree = Record<string, { file: { contents: string } } | { directory: Tree }>;

function materialize(tree: Tree, dir: string) {
  mkdirSync(dir, { recursive: true });
  for (const [name, node] of Object.entries(tree)) {
    if ('directory' in node) materialize(node.directory, join(dir, name));
    else {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), node.file.contents);
    }
  }
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

let root: string;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'mission-shell-')));
  materialize(MISSION_FILES as Tree, root);
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Führt Zeilen in der Mission-Shell aus (Arbeitsverzeichnis = gemounteter Stand). */
function run(...lines: string[]) {
  const result = spawnSync('node', [join(root, SHELL_PATH)], {
    cwd: root,
    input: [...lines, 'exit', ''].join('\n'),
    encoding: 'utf8',
    timeout: 15_000,
  });
  // Ein abgebrochener Lauf darf nicht als Inhaltsfehler durchgehen: sonst sieht eine
  // abgeschnittene Ausgabe wie ein falsches Pipeline-Ergebnis aus.
  if (result.error || result.status !== 0 || result.signal) {
    throw new Error(
      `Mission-Shell brach ab (status=${result.status}, signal=${result.signal}, ` +
        `error=${result.error?.message ?? '-'})\n${result.stderr}`
    );
  }
  return { raw: result.stdout, text: stripAnsi(result.stdout), status: result.status };
}

/** Prüft mit der Validierung der Mission, dass `command` den Schritt `stepIndex` erfüllt. */
const accepts = (mission: Mission, stepIndex: number, command: string) => {
  const step = mission.steps[stepIndex];
  return (
    step.requiredCommand?.toLowerCase() === command.trim().toLowerCase() ||
    step.validationRegex?.test(command.trim().toLowerCase()) === true
  );
};

describe('missionShell: Befehle der Linux-Missionen', () => {
  it('whoami meldet visitor', () => {
    expect(run('whoami').text).toMatch(/^visitor$/m);
  });

  it('pwd gibt das Arbeitsverzeichnis aus', () => {
    expect(run('pwd').text).toMatch(/^\/home\/visitor$/m);
  });

  it('ls listet Missionsdateien, versteckte nur mit -a', () => {
    const plain = run('ls').text;
    expect(plain).toContain('welcome.txt');
    expect(plain).not.toContain('.secret');
    expect(run('ls -a').text).toContain('.secret');
    expect(run('ls -la').text).toMatch(/^-rw\S+ 1 visitor visitor\s+\d+ .* \.secret$/m);
  });

  it('cat liest welcome.txt, meldet fehlende Dateien', () => {
    expect(run('cat welcome.txt').text).toContain('Willkommen im interaktiven Terminal');
    expect(run('cat nope.txt').text).toContain('cat: nope.txt: No such file or directory');
  });

  it('mkdir, cd, touch, ls und cd .. arbeiten zusammen (Mission Dateiverwaltung)', () => {
    const out = run(
      'mkdir workspace',
      'cd workspace',
      'touch README.md',
      'ls',
      'pwd',
      'cd ..',
      'pwd'
    ).text;
    expect(out).toMatch(/^README\.md$/m);
    expect(out).toMatch(/^\/home\/visitor\/workspace$/m);
    expect(out).toMatch(/^\/home\/visitor$/m);
  });

  it('cd ~ und cd ohne Argument führen ins Startverzeichnis', () => {
    const out = run('mkdir sub', 'cd sub', 'cd ~', 'pwd', 'cd sub', 'cd', 'pwd').text;
    expect(out.match(/^\/home\/visitor$/gm)).toHaveLength(2);
  });

  it('cd in ein fehlendes Verzeichnis meldet einen Fehler und bleibt stehen', () => {
    const out = run('cd gibtsnicht', 'pwd').text;
    expect(out).toContain('cd: gibtsnicht: No such file or directory');
    expect(out).toMatch(/^\/home\/visitor$/m);
  });

  it('cp, mv und rm verändern Dateien', () => {
    const out = run(
      'mkdir t1',
      'cp welcome.txt t1/kopie.txt',
      'mv t1/kopie.txt t1/neu.txt',
      'ls t1',
      'rm t1/neu.txt',
      'ls t1',
      'rm t1',
      'rm -r t1',
      'ls'
    ).text;
    expect(out).toMatch(/^neu\.txt$/m);
    expect(out).toContain("rm: cannot remove 't1': Is a directory");
    expect(out).not.toMatch(/^t1$/m);
  });

  it('echo ersetzt $USER und kennt Anführungszeichen', () => {
    const out = run('echo hallo $USER', 'echo "a   b"').text;
    expect(out).toMatch(/^hallo visitor$/m);
    expect(out).toMatch(/^a {3}b$/m);
  });

  it('grep, find und chmod funktionieren auf den Missionsdateien', () => {
    const out = run(
      'grep Failed /var/log/auth.log',
      'grep -c Accepted /var/log/auth.log',
      'find / -name auth.log',
      'touch skript.sh',
      'chmod +x skript.sh',
      'chmod 600 skript.sh',
      'ls -l skript.sh'
    ).text;
    expect(out.match(/Failed password for root/g)).toHaveLength(3);
    expect(out).toMatch(/^1$/m);
    expect(out).toMatch(/^\/var\/log\/auth\.log$/m);
    expect(out).toMatch(/^-rw------- 1 visitor visitor/m);
    expect(out).not.toContain('chmod:');
  });

  it('Pipes, Umleitungen und Quoting', () => {
    const out = run(
      'echo "a | b" > pipe.txt',
      'cat pipe.txt',
      'echo eins >> pipe.txt',
      'cat pipe.txt | wc -l',
      "echo 'x y' | tr a-z A-Z",
      'cat gibtsnicht 2>/dev/null',
      'cat gibtsnicht 2> fehler.txt',
      'cat fehler.txt',
      'printf'
    ).text;
    expect(out).toMatch(/^a \| b$/m);
    expect(out).toMatch(/^2$/m);
    expect(out).toMatch(/^X Y$/m);
    expect(out).toContain('cat: gibtsnicht: No such file or directory');
    expect(out.match(/cat: gibtsnicht/g)).toHaveLength(1);
    expect(out).toContain('bash: printf: command not found');
  });

  it('sort, uniq, cut, awk und head arbeiten auf stdin', () => {
    const out = run(
      "echo 'b 2' > t.txt",
      "echo 'a 10' >> t.txt",
      "echo 'b 2' >> t.txt",
      'sort t.txt | uniq -c',
      'sort -k2 -n -r t.txt | head -1',
      "cut -d' ' -f2 t.txt",
      "awk -F' ' '{print $2, $NF}' t.txt | tail -n 1",
      'awk \'/a/ {print $1 "-" $2}\' t.txt'
    ).text;
    expect(out).toMatch(/^ {6}1 a 10$/m);
    expect(out).toMatch(/^ {6}2 b 2$/m);
    expect(out).toMatch(/^a 10$/m);
    expect(out).toMatch(/^10$/m);
    expect(out).toMatch(/^2 2$/m);
    expect(out).toMatch(/^a-10$/m);
  });

  it('unbekannte Befehle melden command not found', () => {
    expect(run('foobar').text).toContain('bash: foobar: command not found');
  });

  it('clear schreibt echte Steuerzeichen, Prompt und Farben sind keine Klartext-Escapes', () => {
    const { raw } = run('clear');
    expect(raw).toContain('\x1b[2J\x1b[H');
    expect(raw).toContain('\x1b[32mvisitor@linux\x1b[0m');
    expect(raw).not.toMatch(/\\x1b|\\\\/);
  });

  it('exit beendet die Shell mit Status 0', () => {
    expect(run().status).toBe(0);
  });

  it('der Quelltext der Shell ist gültiges JavaScript', () => {
    expect(() => new Function(buildCustomShell().replace(/^#!.*\n/, ''))).not.toThrow();
    expect(readFileSync(join(root, SHELL_PATH), 'utf8')).toContain('readline');
  });
});

describe('missionShell: CTF-Missionen', () => {
  const treasure = [
    'ls -a',
    'cat .secret',
    "echo 'U3VwZXJTZWNyZXQxMjM=' | base64 -d",
    'echo SuperSecret123',
  ];
  const detective = [
    'grep Failed /var/log/auth.log',
    "grep Failed /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -nr | head -1",
    'grep Accepted /var/log/auth.log',
  ];
  const privesc = [
    'find / -perm -4000 2>/dev/null',
    'ls -la /usr/local/bin/backup',
    '/usr/local/bin/backup',
  ];

  it('Hidden Treasure Hunt: versteckte Datei, Base64 ergibt das Passwort', () => {
    treasure.forEach((cmd, i) => expect(accepts(linuxCTFHiddenTreasure, i, cmd), cmd).toBe(true));
    const out = run(...treasure).text;
    expect(out).toMatch(/^\. +\.\. +\.secret /m);
    expect(out).toMatch(/^U3VwZXJTZWNyZXQxMjM=$/m);
    expect(out).toMatch(/^SuperSecret123$/m);
    expect(run('cat .secret | base64 -d').text).toMatch(/^SuperSecret123$/m);
    expect(run('base64 -d .secret').text).toMatch(/^SuperSecret123$/m);
    expect(run('echo -n SuperSecret123 | base64').text).toMatch(/^U3VwZXJTZWNyZXQxMjM=$/m);
    expect(run('echo !!! | base64 -d').text).toContain('base64: invalid input');
  });

  it('Log Detective: häufigste IP und erfolgreicher Login', () => {
    detective.forEach((cmd, i) => expect(accepts(linuxCTFLogDetective, i, cmd), cmd).toBe(true));
    const out = run(...detective).text;
    expect(out.match(/Failed password for root from 192\.168\.1\.100/g)).toHaveLength(3);
    expect(out).toMatch(/^ {6}3 192\.168\.1\.100$/m);
    expect(out).toMatch(
      /^Jan 28 14:33:12 server sshd\[1235\]: Accepted password for admin from 192\.168\.1\.100 port 22 ssh2$/m
    );
    // Auswertung nur mit der gefundenen IP
    expect(run('grep Accepted /var/log/auth.log | grep 192.168.1.100 | wc -l').text).toMatch(
      /^1$/m
    );
  });

  it('Pipelines berechnen Ergebnisse aus stdin statt aus eingebauten CTF-Antworten', () => {
    const out = run(
      "echo 'YW5kZXJlcyBQYXNzd29ydA==' | base64 -d",
      "echo 'Failed 10.0.0.2' > varied.log",
      "echo 'Accepted 10.0.0.9' >> varied.log",
      "echo 'Failed 10.0.0.1' >> varied.log",
      "echo 'Failed 10.0.0.2' >> varied.log",
      "grep Failed varied.log | awk '{print $2}' | sort | uniq -c | sort -nr | head -1",
      "grep Missing varied.log | awk '{print $2}' | sort | uniq -c | wc -l",
      "echo 'a | b' | grep 'a | b' | wc -l"
    ).text;
    expect(out).toMatch(/^anderes Passwort$/m);
    expect(out).toMatch(/^ {6}2 10\.0\.0\.2$/m);
    expect(out).toMatch(/^0$/m);
    expect(out).toMatch(/^1$/m);
    expect(out).not.toContain('command not found');
  });

  it('Privilege Escalation Puzzle: SUID-Binary finden, prüfen, ausnutzen', () => {
    privesc.forEach((cmd, i) => expect(accepts(linuxCTFPrivEsc, i, cmd), cmd).toBe(true));
    const out = run(...privesc, 'sudo -l', 'find / -perm -4000').text;
    expect(out).toMatch(/^\/usr\/local\/bin\/backup$/m);
    expect(out).toMatch(/^\/usr\/bin\/sudo$/m);
    expect(out).toMatch(/^-rwsrwxrwx 1 root root +\d+ .* \/usr\/local\/bin\/backup$/m);
    expect(out).toContain('Congratulations! You have obtained root access!');
    expect(out).toContain('Sorry, user visitor may not run sudo');
    expect(run('find / -perm -4000 2>/dev/null').text).not.toContain('.shell');
  });
});

describe('missionShell: Missionsprüfung (createCommandTracker)', () => {
  const collect = (...chunks: string[]) => {
    const seen: string[] = [];
    const tracker = createCommandTracker((c) => seen.push(c));
    chunks.forEach((chunk) => tracker.feed(chunk));
    return seen;
  };

  it('meldet erst bei Enter, nicht pro Tastendruck', () => {
    expect(collect('w', 'h', 'o', 'a', 'm', 'i')).toEqual([]);
    expect(collect('w', 'h', 'o', 'a', 'm', 'i', '\r')).toEqual(['whoami']);
  });

  it('berücksichtigt Rücktaste und ignoriert Pfeiltasten und leere Zeilen', () => {
    expect(collect('p', 'w', 'x', '\x7f', 'd', '\x1b[A', '\r', '\r')).toEqual(['pwd']);
  });

  it('verarbeitet eingefügten Text mit mehreren Zeilen', () => {
    expect(collect('ls\rpwd\r')).toEqual(['ls', 'pwd']);
  });

  it('Ctrl+C verwirft die laufende Eingabe', () => {
    expect(collect('rm', '\x03', 'ls', '\r')).toEqual(['ls']);
  });

  it('die Linux-Missionen sind mit den getrackten Befehlen erfüllbar', () => {
    for (const mission of [linuxBasicsMission, linuxFilesMission]) {
      for (const step of mission.steps) {
        const command =
          step.requiredCommand ?? (step.validationRegex?.test('cd ..') ? 'cd ..' : undefined);
        expect(command, `${mission.id}/${step.id}`).toBeDefined();
        const [reported] = collect(`${command}\r`);
        expect(reported?.toLowerCase()).toBe(command!.toLowerCase());
      }
    }
  });
});

describe('missionShell: Randfälle der Pipeline-Auswertung', () => {
  it('leere Eingabezeile meldet keinen Syntaxfehler', () => {
    const out = run('', '   ', 'whoami').text;
    expect(out).not.toContain('syntax error');
    expect(out).toMatch(/^visitor$/m);
  });

  it('eine unvollständige Pipeline führt keine Stufe aus', () => {
    const out = run('touch probe.txt', 'rm probe.txt |', 'ls -la').text;
    expect(out).toContain('syntax error');
    expect(out).toMatch(/\bprobe\.txt$/m);
  });

  it('fehlgeschlagene Eingabeumleitung bricht die Pipeline nicht ab', () => {
    const out = run('cat < gibtsnicht.txt | wc -l').text;
    expect(out).toContain('No such file or directory');
    expect(out).toMatch(/^0$/m);
  });

  it('1> gilt als Umleitung der Standardausgabe', () => {
    const out = run('echo hi 1> eins.txt', 'cat eins.txt').text;
    expect(out).toMatch(/^hi$/m);
    expect(out).not.toMatch(/^hi 1$/m);
  });
});
