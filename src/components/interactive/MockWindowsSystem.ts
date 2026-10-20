import {
  ARP_OUTPUT,
  CHKDSK_OUTPUT,
  CMD_COMMAND_LIST,
  HELP_TEXTS,
  NETSTAT_OUTPUT,
  PROCESSES,
  PS_HELP_TEXTS,
  PS_VERSION_TABLE,
  ROUTE_PRINT_OUTPUT,
  SERVICES,
  SYSTEMINFO_OUTPUT,
  WMIC_OUTPUT,
  nslookupOutput,
  resolveHost,
  tracertOutput,
  type PsTable,
  type PsValue,
} from './mockWindowsData';

export type { PsTable } from './mockWindowsData';

export interface FileSystemNode {
  type: 'file' | 'dir';
  content?: string;
  children?: Record<string, FileSystemNode>;
  hidden?: boolean;
}

export interface ExecutionResult {
  output: string;
  newCwd?: string;
  clear?: boolean;
}

export type ShellMode = 'cmd' | 'powershell' | 'diskpart';

/** Ein erfolgreich ausgeführter Befehl; Missionen prüfen damit reine Anzeige-Befehle. */
export interface CommandLogEntry {
  mode: ShellMode;
  /** Erstes Wort in Kleinbuchstaben, z. B. `ipconfig`. */
  command: string;
  args: string[];
  /** Ganze Eingabe in Kleinbuchstaben, Leerraum zusammengezogen. */
  line: string;
  /** Namen der Pipeline-Stufen nach dem ersten Befehl (`more`, `sort-object` ...). */
  pipeline: string[];
  output: string;
  /** Ergebnistabelle bei Cmdlets wie Get-Process, nach allen Pipeline-Stufen. */
  table?: PsTable;
}

export interface Partition {
  volume: number;
  name: string;
  sizeMB: number;
  letter: string;
  label: string;
  fs: string;
}

export interface Disk {
  number: number;
  sizeMB: number;
  style: 'MBR' | 'GPT' | 'RAW';
  partitions: Partition[];
}

export interface ScheduledTask {
  name: string;
  program: string;
  schedule: string;
  time: string;
}

export interface FirewallRule {
  name: string;
  dir: string;
  action: string;
  protocol: string;
  localport: string;
}

interface RegValue {
  name: string;
  type: string;
  data: string;
}

interface RegKey {
  name: string;
  values: Record<string, RegValue>;
}

const TOKEN = /(?:[^\s"']+|"[^"]*"|'[^']*'|["'])+/g;

function tokenize(line: string): string[] {
  return line.match(TOKEN) ?? [];
}

function unq(value: string): string {
  return value.replace(/^(["'])(.*)\1$/, '$2');
}

function lastSegment(path: string): string {
  const parts = path.split('\\').filter((p) => p !== '');
  return parts[parts.length - 1] ?? '';
}

function joinPath(base: string, name: string): string {
  if (/^[a-zA-Z]:\\/.test(name)) return name;
  return (base.endsWith('\\') ? base : base + '\\') + name;
}

function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\\+$/, '');
}

function formatSize(mb: number): string {
  if (mb <= 0) return '0 B';
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;
}

function renderTable(table: PsTable): string {
  const cell = (v: PsValue | undefined) => String(v ?? '');
  const widths = table.columns.map((c) =>
    Math.max(c.length, ...table.rows.map((r) => cell(r[c]).length))
  );
  const numeric = table.columns.map(
    (c) => table.rows.length > 0 && table.rows.every((r) => typeof r[c] === 'number')
  );
  const format = (values: string[]) =>
    values
      .map((v, i) => (numeric[i] ? v.padStart(widths[i]) : v.padEnd(widths[i])))
      .join('  ')
      .trimEnd();
  const lines = [
    format(table.columns),
    format(widths.map((w) => '-'.repeat(w))),
    ...table.rows.map((r) => format(table.columns.map((c) => cell(r[c])))),
  ];
  return '\r\n' + lines.join('\r\n') + '\r\n\r\n';
}

function resolveColumn(table: PsTable, prop: string): string | undefined {
  const p = prop.toLowerCase();
  return (
    table.columns.find((c) => c.toLowerCase() === p) ??
    table.columns.find((c) => c.toLowerCase().startsWith(p + '(')) ??
    (p === 'name' ? table.columns.find((c) => c === 'ProcessName') : undefined)
  );
}

const PS_SWITCHES = new Set(['recurse', 'force', 'descending', 'append']);

function psParams(args: string[]): { named: Record<string, string>; positional: string[] } {
  const named: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('-') && arg.length > 1 && !/^-\d/.test(arg)) {
      const key = arg.slice(1).toLowerCase();
      if (PS_SWITCHES.has(key) || i + 1 >= args.length || args[i + 1].startsWith('-')) {
        named[key] = 'true';
      } else {
        named[key] = unq(args[++i]);
      }
    } else {
      positional.push(unq(arg));
    }
  }
  return { named, positional };
}

function optionValue(args: string[], option: string): string | undefined {
  const index = args.findIndex((a) => a.toLowerCase() === option);
  return index >= 0 && index + 1 < args.length ? unq(args[index + 1]) : undefined;
}

function keyValues(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of args) {
    const eq = arg.indexOf('=');
    if (eq > 0) result[arg.slice(0, eq).toLowerCase()] = unq(arg.slice(eq + 1));
  }
  return result;
}

function normalizeRegKey(key: string): string {
  return unq(key)
    .replace(/^hkey_local_machine/i, 'HKLM')
    .replace(/^hkey_current_user/i, 'HKCU')
    .replace(/\\+$/, '');
}

export class MockWindowsSystem {
  private fs: Record<string, FileSystemNode>;
  private cwd: string;
  private mode: ShellMode;

  private env = new Map<string, { name: string; value: string }>();
  private color = '07';
  private title = '';
  private promptFormat = '$P$G';
  private explorerPath: string | null = null;
  private dnsCache = ['fritz.box', 'www.microsoft.com'];
  private tasks: ScheduledTask[] = [
    {
      name: 'GoogleUpdateTaskMachine',
      program: 'GoogleUpdate.exe',
      schedule: 'DAILY',
      time: '09:00',
    },
  ];
  private registry: Record<string, RegKey> = {};
  private firewall: FirewallRule[] = [
    {
      name: 'Remotedesktop (TCP-In)',
      dir: 'in',
      action: 'block',
      protocol: 'TCP',
      localport: '3389',
    },
    {
      name: 'Core Networking - DNS (UDP-Out)',
      dir: 'out',
      action: 'allow',
      protocol: 'UDP',
      localport: 'any',
    },
  ];

  // Diskpart State
  private disks: Disk[];
  private nextVolume = 4;
  private selectedDisk: number | null = null;
  private selectedVolume: number | null = null;

  private log: CommandLogEntry[] = [];
  private failed = false;
  private pendingTable: PsTable | undefined;

  constructor() {
    this.cwd = 'C:\\Users\\visitor';
    this.mode = 'cmd';
    this.fs = {
      'C:': {
        type: 'dir',
        children: {
          Windows: {
            type: 'dir',
            children: {
              System32: { type: 'dir', children: { 'cmd.exe': { type: 'file', content: '' } } },
            },
          },
          Users: {
            type: 'dir',
            children: {
              visitor: {
                type: 'dir',
                children: {
                  Desktop: { type: 'dir', children: {} },
                  Documents: { type: 'dir', children: {} },
                  Downloads: { type: 'dir', children: {} },
                  'welcome.txt': {
                    type: 'file',
                    content:
                      'Willkommen im interaktiven Terminal von alex-schneider.dev!\r\nHier kannst du echte CMD-Befehle üben.',
                  },
                  'todo.txt': {
                    type: 'file',
                    content: '- Missionen abschließen\r\n- CMD lernen\r\n- Spaß haben',
                  },
                },
              },
            },
          },
          Temp: { type: 'dir', children: {} },
        },
      },
      'D:': {
        type: 'dir',
        children: {
          Backup: { type: 'dir', children: {} },
          Images: { type: 'dir', children: {} },
        },
      },
      'F:': {
        type: 'dir',
        children: {
          'urlaub.jpg': { type: 'file', content: 'JPEG' },
        },
      },
    };

    for (const [name, value] of [
      ['USERNAME', 'visitor'],
      ['COMPUTERNAME', 'ALEX-SCHNEIDER'],
      ['OS', 'Windows_NT'],
      ['USERPROFILE', 'C:\\Users\\visitor'],
      ['TEMP', 'C:\\Temp'],
      ['PATH', 'C:\\Windows\\System32;C:\\Windows'],
    ]) {
      this.env.set(name.toLowerCase(), { name, value });
    }

    this.registry['hklm\\software\\microsoft\\windows nt\\currentversion'] = {
      name: 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
      values: {
        productname: { name: 'ProductName', type: 'REG_SZ', data: 'Windows 10 Pro' },
        currentbuild: { name: 'CurrentBuild', type: 'REG_SZ', data: '19045' },
      },
    };

    this.disks = [
      {
        number: 0,
        sizeMB: 512000,
        style: 'GPT',
        partitions: [
          {
            volume: 1,
            name: 'Wiederherstellung',
            sizeMB: 500,
            letter: '',
            label: 'Wiederherst.',
            fs: 'NTFS',
          },
          { volume: 0, name: 'Primär', sizeMB: 511000, letter: 'C', label: '', fs: 'NTFS' },
        ],
      },
      {
        number: 1,
        sizeMB: 256000,
        style: 'GPT',
        partitions: [
          { volume: 2, name: 'Primär', sizeMB: 153600, letter: 'D', label: 'Daten', fs: 'NTFS' },
        ],
      },
      {
        number: 2,
        sizeMB: 16384,
        style: 'MBR',
        partitions: [
          {
            volume: 3,
            name: 'Primär',
            sizeMB: 16384,
            letter: 'F',
            label: 'USB-STICK',
            fs: 'FAT32',
          },
        ],
      },
    ];
  }

  // --- Öffentliche Abfragen (Missionen prüfen damit den Zustand) ---

  public getPrompt(): string {
    if (this.mode === 'diskpart') return 'DISKPART> ';
    if (this.mode === 'powershell') return `PS ${this.cwd}> `;
    return this.promptFormat.replace(/\$([a-z$_])/gi, (_m, code: string) => {
      switch (code.toLowerCase()) {
        case 'p':
          return this.cwd;
        case 'g':
          return '>';
        case 's':
          return ' ';
        case '$':
          return '$';
        default:
          return `$${code}`;
      }
    });
  }

  public getMode(): ShellMode {
    return this.mode;
  }

  public getCwd(): string {
    return this.cwd;
  }

  /** Ist das aktuelle Verzeichnis gleich `path` (Groß-/Kleinschreibung egal)? */
  public cwdIs(path: string): boolean {
    return normalizePath(this.cwd) === normalizePath(this.resolvePath(path));
  }

  public exists(path: string): boolean {
    return this.getNode(path) !== null;
  }

  public isDir(path: string): boolean {
    return this.getNode(path)?.type === 'dir';
  }

  public isFile(path: string): boolean {
    return this.getNode(path)?.type === 'file';
  }

  /** Dateiinhalt oder null, wenn es keine Datei ist. */
  public readFile(path: string): string | null {
    const node = this.getNode(path);
    return node && node.type === 'file' ? (node.content ?? '') : null;
  }

  public isHidden(path: string): boolean {
    return this.getNode(path)?.hidden === true;
  }

  public getEnv(name: string): string | undefined {
    return this.env.get(name.toLowerCase())?.value;
  }

  public getColor(): string {
    return this.color;
  }

  public getTitle(): string {
    return this.title;
  }

  public getPromptFormat(): string {
    return this.promptFormat;
  }

  public getExplorerPath(): string | null {
    return this.explorerPath;
  }

  public getDnsCache(): string[] {
    return [...this.dnsCache];
  }

  public getTask(name: string): ScheduledTask | undefined {
    return this.tasks.find((t) => t.name.toLowerCase() === name.toLowerCase());
  }

  public getRegValue(key: string, name: string): string | undefined {
    return this.registry[normalizeRegKey(key).toLowerCase()]?.values[name.toLowerCase()]?.data;
  }

  public getFirewallRule(name: string): FirewallRule | undefined {
    return this.firewall.find((r) => r.name.toLowerCase() === name.toLowerCase());
  }

  public getDisk(number: number): Readonly<Disk> | undefined {
    return this.disks.find((d) => d.number === number);
  }

  public getSelectedDisk(): number | null {
    return this.selectedDisk;
  }

  public getSelectedVolume(): number | null {
    return this.selectedVolume;
  }

  /** Datenträgerinformationen zu einem Laufwerksbuchstaben (`D`, `d:`), sonst null. */
  public getVolume(letter: string): Readonly<Partition> | null {
    return this.partitionByLetter(letter) ?? null;
  }

  public getLog(): readonly CommandLogEntry[] {
    return this.log;
  }

  /** Wurde der Befehl erfolgreich ausgeführt? `test` prüft Argumente, Pipeline oder Ergebnis. */
  public ran(
    command: string,
    test?: (entry: CommandLogEntry) => boolean,
    mode?: ShellMode
  ): boolean {
    const name = command.toLowerCase();
    return this.log.some(
      (e) => e.command === name && (!mode || e.mode === mode) && (!test || test(e))
    );
  }

  // --- Befehlsverarbeitung ---

  public processCommand(cmd: string): ExecutionResult {
    const trimmed = cmd.trim();
    if (!trimmed) return { output: '' };

    this.failed = false;
    this.pendingTable = undefined;
    const modeBefore = this.mode;
    const result = this.execute(trimmed);

    if (!this.failed) {
      // Befehl und Argumente der ersten Stufe, ohne Pipe und Umleitung.
      const tokens = tokenize(trimmed.split(/[|>]/)[0]);
      const stages = trimmed.split('|');
      this.log.push({
        mode: modeBefore,
        command: (tokens[0] ?? '').toLowerCase(),
        args: tokens.slice(1),
        line: trimmed.toLowerCase().replace(/\s+/g, ' '),
        pipeline: stages
          .slice(1)
          .map((s) => (s.trim().split(/\s+/)[0] ?? '').toLowerCase())
          .filter(Boolean),
        output: result.output,
        table: this.pendingTable,
      });
    }
    return result;
  }

  private fail(output: string): ExecutionResult {
    this.failed = true;
    return { output };
  }

  private execute(trimmed: string): ExecutionResult {
    const lower = trimmed.toLowerCase();

    // Handle Mode Switching
    if (this.mode === 'cmd' && lower === 'powershell') {
      this.mode = 'powershell';
      return {
        output:
          'Windows PowerShell\r\nCopyright (C) Microsoft Corporation. Alle Rechte vorbehalten.\r\n\r\n',
      };
    }
    if (this.mode === 'cmd' && lower === 'diskpart') {
      this.mode = 'diskpart';
      return {
        output:
          'Microsoft DiskPart-Version 10.0.19041.964\r\n\r\nCopyright (C) Microsoft Corporation.\r\nAuf Computer: ALEX-SCHNEIDER\r\n',
      };
    }
    if (this.mode === 'powershell' && lower === 'exit') {
      this.mode = 'cmd';
      return { output: '' };
    }
    if (this.mode === 'diskpart' && lower === 'exit') {
      this.mode = 'cmd';
      this.selectedDisk = null;
      this.selectedVolume = null;
      return { output: 'DiskPart wird beendet...\r\n' };
    }

    if (this.mode === 'diskpart') {
      const parts = tokenize(trimmed);
      return this.handleDiskpart((parts[0] ?? '').toLowerCase(), parts.slice(1));
    }

    // Umleitung (> und >>) und Pipeline (|) gelten in CMD und PowerShell.
    let line = trimmed;
    let redirect: { append: boolean; target: string } | null = null;
    if (!/^prompt(\s|$)/i.test(trimmed)) {
      const match = /^(.*?)\s*(>>?)\s*(\S.*)$/.exec(trimmed);
      if (match) {
        line = match[1];
        redirect = { append: match[2] === '>>', target: unq(match[3].trim()) };
      }
    }

    const stages = line.split('|').map((s) => s.trim());
    let result = this.runStage(stages[0]);
    let table = this.pendingTable;
    if (!this.failed) {
      for (const stage of stages.slice(1)) {
        const next =
          this.mode === 'powershell'
            ? this.psPipe(stage, result.output, table)
            : this.cmdPipe(stage, result.output);
        if (this.failed) return next.result;
        result = next.result;
        table = next.table;
      }
    }
    this.pendingTable = table;
    if (this.failed) return result;

    if (redirect) {
      const error = this.writeFile(
        redirect.target,
        result.output.replace(/\r\n$/, ''),
        redirect.append
      );
      if (error) return this.fail(error + '\r\n');
      this.pendingTable = undefined;
      return { output: '' };
    }
    return result;
  }

  private runStage(stage: string): ExecutionResult {
    const parts = tokenize(stage);
    const command = (parts[0] ?? '').toLowerCase();
    const args = parts.slice(1);
    return this.mode === 'powershell'
      ? this.handlePowerShell(command, args, stage)
      : this.handleCmd(command, args, stage);
  }

  private cmdPipe(stage: string, input: string): { result: ExecutionResult; table?: PsTable } {
    const parts = tokenize(stage);
    const name = (parts[0] ?? '').toLowerCase();
    if (name === 'more') return { result: { output: input } };
    if (name === 'find') {
      const ignoreCase = parts.some((p) => p.toLowerCase() === '/i');
      const needle = unq(parts.find((p, i) => i > 0 && !p.startsWith('/')) ?? '');
      const match = (l: string) =>
        ignoreCase ? l.toLowerCase().includes(needle.toLowerCase()) : l.includes(needle);
      const lines = input.split('\r\n').filter((l) => l !== '' && match(l));
      return { result: { output: lines.length ? lines.join('\r\n') + '\r\n' : '' } };
    }
    return {
      result: this.fail(
        'Diese Pipe-Stufe wird in der Simulation nicht unterstützt (MORE und FIND gehen).\r\n'
      ),
    };
  }

  private psPipe(
    stage: string,
    input: string,
    table: PsTable | undefined
  ): { result: ExecutionResult; table?: PsTable } {
    const name = (stage.split(/\s+/)[0] ?? '').toLowerCase();
    const rest = stage.replace(/^\S+\s*/, '');
    const needTable = () => {
      this.failed = true;
      return { result: { output: `${name} : Die Eingabe enthält keine Objekte.\r\n` } };
    };

    if (name === 'out-file') {
      const path = psParams(tokenize(rest));
      const target = path.named['filepath'] ?? path.named['path'] ?? path.positional[0];
      if (!target) return { result: this.fail('Out-File : Es wurde kein Pfad angegeben.\r\n') };
      const error = this.writeFile(
        target,
        input.replace(/^\r\n/, '').replace(/(\r\n)+$/, ''),
        false
      );
      return { result: error ? this.fail(error + '\r\n') : { output: '' } };
    }
    if (name === 'out-null') return { result: { output: '' } };
    if (!table) return needTable();

    const fail = (message: string) => ({ result: this.fail(`${name} : ${message}\r\n`) });
    const commit = (next: PsTable) => ({ result: { output: renderTable(next) }, table: next });

    if (name === 'sort-object' || name === 'sort') {
      const tokens = tokenize(rest);
      const descending = tokens.some((t) => /^-desc(ending)?$/i.test(t));
      const prop =
        tokens.filter((t) => !t.startsWith('-')).map(unq)[0] ??
        tokens.find((t, i) => i > 0 && tokens[i - 1].toLowerCase() === '-property');
      if (!prop) return fail('Es wurde keine Eigenschaft zum Sortieren angegeben.');
      const col = resolveColumn(table, prop);
      if (!col) return fail(`Die Eigenschaft "${prop}" wurde nicht gefunden.`);
      const rows = [...table.rows].sort((a, b) => {
        const x = a[col];
        const y = b[col];
        const order =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y));
        return descending ? -order : order;
      });
      return commit({ ...table, rows });
    }

    if (name === 'select-object' || name === 'select') {
      const tokens = tokenize(rest);
      let rows = table.rows;
      const propTokens: string[] = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i].toLowerCase();
        if (t === '-first' || t === '-last') {
          const n = parseInt(tokens[++i] ?? '', 10);
          if (Number.isNaN(n) || n < 0) return fail('Ungültige Anzahl.');
          rows = t === '-first' ? rows.slice(0, n) : rows.slice(Math.max(0, rows.length - n));
        } else if (t === '-property') {
          propTokens.push(tokens[++i] ?? '');
        } else if (!t.startsWith('-')) {
          propTokens.push(tokens[i]);
        }
      }
      const props = propTokens
        .join(' ')
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(unq);
      if (props.length === 0) return commit({ ...table, rows });
      const columns: string[] = [];
      for (const prop of props) {
        const col = resolveColumn(table, prop);
        if (!col) return fail(`Die Eigenschaft "${prop}" wurde nicht gefunden.`);
        columns.push(col);
      }
      return commit({
        columns,
        rows: rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]]))),
      });
    }

    if (name === 'where-object' || name === 'where' || name === '?') {
      const cleaned = rest.replace(/^\{\s*/, '').replace(/\s*\}$/, '');
      const match =
        /^\$_\.(\w+)\s+-(eq|ne|gt|lt|ge|le)\s+(.+)$/i.exec(cleaned) ??
        /^(\w+)\s+-(eq|ne|gt|lt|ge|le)\s+(.+)$/i.exec(cleaned);
      if (!match) return fail('Der Filterausdruck wird in der Simulation nicht unterstützt.');
      const col = resolveColumn(table, match[1]);
      if (!col) return fail(`Die Eigenschaft "${match[1]}" wurde nicht gefunden.`);
      const literal = unq(match[3].trim());
      const op = match[2].toLowerCase();
      const rows = table.rows.filter((r) => {
        const value = r[col];
        const numeric =
          typeof value === 'number' && literal !== '' && !Number.isNaN(Number(literal));
        const a = numeric ? (value as number) : String(value).toLowerCase();
        const b = numeric ? Number(literal) : literal.toLowerCase();
        switch (op) {
          case 'eq':
            return a === b;
          case 'ne':
            return a !== b;
          case 'gt':
            return a > b;
          case 'lt':
            return a < b;
          case 'ge':
            return a >= b;
          default:
            return a <= b;
        }
      });
      return commit({ ...table, rows });
    }

    return fail('Diese Pipeline-Stufe wird in der Simulation nicht unterstützt.');
  }

  // --- Pfade und Dateisystem ---

  private resolvePath(path: string): string {
    let newPath = path.trim();

    // Handle Drive Switch (e.g. "D:")
    if (/^[a-zA-Z]:$/.test(newPath)) {
      return newPath.toUpperCase() + '\\';
    }

    // Handle Absolute Path
    if (/^[a-zA-Z]:\\/.test(newPath)) {
      newPath = newPath.replace(/\//g, '\\');
    } else {
      // Relative Path
      const currentDrive = this.cwd.split(':')[0] + ':';
      if (newPath.startsWith('\\')) {
        newPath = currentDrive + newPath;
      } else {
        newPath = (this.cwd.endsWith('\\') ? this.cwd : this.cwd + '\\') + newPath;
      }
    }

    // Normalize
    const parts = newPath.split('\\');
    const stack: string[] = [];

    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') {
        if (stack.length > 1) stack.pop();
      } else {
        stack.push(part);
      }
    }

    let result = stack.join('\\');
    if (stack.length === 1 && stack[0].endsWith(':')) {
      result += '\\';
    }
    return result;
  }

  private getNode(path: string): FileSystemNode | null {
    const resolved = this.resolvePath(path);
    const parts = resolved.split('\\').filter((p) => p !== '');

    const drive = (parts[0] ?? '').toUpperCase();
    if (!this.fs[drive]) return null;

    let current = this.fs[drive];
    for (let i = 1; i < parts.length; i++) {
      if (current.type !== 'dir' || !current.children) return null;
      const nextPart = parts[i].toLowerCase();
      const key = Object.keys(current.children).find((k) => k.toLowerCase() === nextPart);
      if (!key) return null;
      current = current.children[key];
    }
    return current;
  }

  private getParentNode(path: string): { parent: FileSystemNode; name: string } | null {
    const resolved = this.resolvePath(path);
    const parts = resolved.split('\\').filter((p) => p !== '');

    if (parts.length < 2) return null; // Root has no parent here

    const fileName = parts[parts.length - 1];
    const parentPath =
      parts.slice(0, parts.length - 1).join('\\') + (parts.length === 2 ? '\\' : '');

    const parent = this.getNode(parentPath);
    if (parent && parent.type === 'dir') {
      return { parent, name: fileName };
    }
    return null;
  }

  /** Elternknoten, Name und vorhandener Schlüssel (Groß-/Kleinschreibung egal) eines Pfads. */
  private locate(
    path: string
  ): { parent: FileSystemNode; name: string; key: string | null } | null {
    const info = this.getParentNode(path);
    if (!info) return null;
    const key =
      Object.keys(info.parent.children ?? {}).find(
        (k) => k.toLowerCase() === info.name.toLowerCase()
      ) ?? null;
    return { ...info, key };
  }

  /** Schreibt (oder hängt an) eine Datei; liefert eine Fehlermeldung oder null. */
  private writeFile(path: string, content: string, append: boolean): string | null {
    const loc = this.locate(path);
    if (!loc || !loc.parent.children) return 'Das System kann den angegebenen Pfad nicht finden.';
    const existing = loc.key ? loc.parent.children[loc.key] : undefined;
    if (existing?.type === 'dir') return 'Zugriff verweigert.';
    const old = existing?.content ?? '';
    loc.parent.children[loc.key ?? loc.name] = {
      type: 'file',
      content: append && existing ? (old ? old + '\r\n' + content : content) : content,
      hidden: existing?.hidden,
    };
    return null;
  }

  private copyFile(src: string, dst: string): string | null {
    const node = this.getNode(src);
    if (!node || node.type !== 'file') return 'Das System kann die angegebene Datei nicht finden.';
    let target = this.resolvePath(dst);
    if (this.getNode(target)?.type === 'dir')
      target = joinPath(target, lastSegment(this.resolvePath(src)));
    return this.writeFile(target, node.content ?? '', false);
  }

  private moveNode(src: string, dst: string): string | null {
    const from = this.locate(src);
    const node = this.getNode(src);
    if (!from || !from.key || !node || !from.parent.children) {
      return 'Das System kann die angegebene Datei nicht finden.';
    }
    let target = this.resolvePath(dst);
    if (this.getNode(target)?.type === 'dir') target = joinPath(target, from.key);
    const to = this.locate(target);
    if (!to || !to.parent.children) return 'Das System kann den angegebenen Pfad nicht finden.';
    if (to.key && to.parent.children[to.key].type === 'dir') return 'Zugriff verweigert.';
    delete from.parent.children[from.key];
    if (to.key) delete to.parent.children[to.key];
    to.parent.children[to.name] = node;
    return null;
  }

  private deleteNode(path: string, recursive: boolean): string | null {
    const loc = this.locate(path);
    const node = this.getNode(path);
    if (!loc || !loc.key || !node || !loc.parent.children) {
      return 'Das System kann die angegebene Datei nicht finden.';
    }
    if (node.type === 'dir' && !recursive && Object.keys(node.children ?? {}).length > 0) {
      return 'Das Verzeichnis ist nicht leer.';
    }
    delete loc.parent.children[loc.key];
    return null;
  }

  private renameNode(path: string, newName: string): string | null {
    const loc = this.locate(path);
    if (!loc || !loc.key || !loc.parent.children) {
      return 'Das System kann die angegebene Datei nicht finden.';
    }
    if (/[\\/:]/.test(newName) || newName === '') {
      return 'Die Syntax für den Dateinamen, Verzeichnisnamen oder die Datenträgerbezeichnung ist falsch.';
    }
    const clash = Object.keys(loc.parent.children).find(
      (k) => k.toLowerCase() === newName.toLowerCase() && k !== loc.key
    );
    if (clash) {
      return 'Ein Unterverzeichnis oder eine Datei mit diesem Namen existiert bereits oder die Datei wurde nicht gefunden.';
    }
    loc.parent.children = Object.fromEntries(
      Object.entries(loc.parent.children).map(([k, v]) => [k === loc.key ? newName : k, v])
    );
    // `loc.parent` ist dasselbe Objekt wie im Baum; children wurde dort ersetzt.
    return null;
  }

  private partitionByLetter(letter: string): Partition | undefined {
    const wanted = letter.replace(':', '').toUpperCase();
    if (!wanted) return undefined;
    for (const disk of this.disks) {
      const found = disk.partitions.find((p) => p.letter === wanted);
      if (found) return found;
    }
    return undefined;
  }

  private visibleChildren(node: FileSystemNode, showHidden: boolean): [string, FileSystemNode][] {
    return Object.entries(node.children ?? {}).filter(([, child]) => showHidden || !child.hidden);
  }

  // --- CMD Handler ---

  private handleCmd(command: string, args: string[], fullCmd: string): ExecutionResult {
    const rest = fullCmd.replace(/^\S+\s*/, '');
    const target = unq(args.join(' '));

    // Drive Switch
    if (/^[a-zA-Z]:$/.test(command)) {
      const drive = command.toUpperCase();
      if (this.fs[drive]) {
        this.cwd = drive + '\\';
        return { output: '' };
      }
      return this.fail('Das System kann das angegebene Laufwerk nicht finden.\r\n');
    }

    if (args.some((a) => a === '/?') && HELP_TEXTS[command]) {
      return { output: HELP_TEXTS[command] };
    }

    switch (command) {
      case 'cls':
        return { output: '', clear: true };
      case 'cd':
      case 'chdir':
        return this.cmdCd(args);
      case 'dir':
        return this.cmdDir(args);
      case 'md':
      case 'mkdir':
        return this.cmdMkdir(args);
      case 'rd':
      case 'rmdir': {
        if (args.length === 0) return this.fail('Syntaxfehler.\r\n');
        const error = this.deleteNode(target, false);
        return error ? this.fail(error + '\r\n') : { output: '' };
      }
      case 'echo':
        return { output: rest + '\r\n' };
      case 'type':
        return this.cmdType(args);
      case 'copy':
      case 'move':
      case 'ren':
      case 'rename': {
        if (args.length < 2) return this.fail('Die Syntax des Befehls ist falsch.\r\n');
        const [src, dst] = [unq(args[0]), unq(args.slice(1).join(' '))];
        const error =
          command === 'copy'
            ? this.copyFile(src, dst)
            : command === 'move'
              ? this.moveNode(src, dst)
              : this.renameNode(src, dst);
        if (error) return this.fail(error + '\r\n');
        if (command === 'copy') return { output: '        1 Datei(en) kopiert.\r\n' };
        if (command === 'move') return { output: '        1 Datei(en) verschoben.\r\n' };
        return { output: '' };
      }
      case 'del':
      case 'erase': {
        const paths = args.filter((a) => !a.startsWith('/'));
        if (paths.length === 0) return this.fail('Die Syntax des Befehls ist falsch.\r\n');
        const node = this.getNode(unq(paths.join(' ')));
        if (node?.type === 'dir')
          return this.fail('Das System kann die angegebene Datei nicht finden.\r\n');
        const error = this.deleteNode(unq(paths.join(' ')), false);
        return error ? this.fail(error + '\r\n') : { output: '' };
      }
      case 'attrib':
        return this.cmdAttrib(args);
      case 'tree':
        return this.cmdTree(args);
      case 'ver':
        return { output: 'Microsoft Windows [Version 10.0.19045.3693]\r\n' };
      case 'help':
        return this.cmdHelp(args);
      case 'set':
        return this.cmdSet(rest);
      case 'color': {
        if (rest === '') {
          this.color = '07';
          return { output: '' };
        }
        if (!/^[0-9a-f]{2}$/i.test(rest) || rest[0].toLowerCase() === rest[1].toLowerCase()) {
          return this.fail(
            'Ungültige Farbangabe. Hintergrund und Text müssen zwei verschiedene Hexziffern sein.\r\n'
          );
        }
        this.color = rest.toLowerCase();
        return { output: '' };
      }
      case 'title':
        this.title = rest;
        return { output: '' };
      case 'prompt':
        this.promptFormat = rest === '' ? '$P$G' : rest;
        return { output: '' };
      case 'start':
        return this.cmdStart(target);
      case 'vol':
        return this.cmdVol(args);
      case 'label':
        return this.cmdLabel(args, rest);
      case 'chkdsk':
        return { output: CHKDSK_OUTPUT };
      case 'format':
        return this.cmdFormat(args);
      case 'ipconfig':
        return this.cmdIpconfig(args);
      case 'ping':
        return this.cmdPing(args);
      case 'tracert': {
        if (args.length === 0) return this.fail('Syntaxfehler.\r\n');
        return { output: tracertOutput(args[args.length - 1]) };
      }
      case 'netstat':
        return { output: NETSTAT_OUTPUT };
      case 'route':
        return args[0]?.toLowerCase() === 'print'
          ? { output: ROUTE_PRINT_OUTPUT }
          : this.fail('Syntaxfehler. Verwende: route print\r\n');
      case 'arp':
        return args[0]?.toLowerCase() === '-a'
          ? { output: ARP_OUTPUT }
          : this.fail('Syntaxfehler. Verwende: arp -a\r\n');
      case 'nslookup':
        return this.cmdNslookup(args);
      case 'whoami':
        return { output: 'alex-schneider\\visitor\r\n' };
      case 'systeminfo':
        return { output: SYSTEMINFO_OUTPUT };
      case 'wmic': {
        const alias = args[0]?.toLowerCase() ?? '';
        if (args[1]?.toLowerCase() !== 'get' || !WMIC_OUTPUT[alias]) {
          return this.fail(
            'Alias nicht gefunden oder Syntax falsch. Beispiel: wmic cpu get name\r\n'
          );
        }
        return { output: WMIC_OUTPUT[alias] };
      }
      case 'schtasks':
        return this.cmdSchtasks(args);
      case 'reg':
        return this.cmdReg(args);
      case 'netsh':
        return this.cmdNetsh(args);
      default:
        return this.fail(
          `'${command}' ist falsch geschrieben oder konnte nicht gefunden werden.\r\n`
        );
    }
  }

  private cmdCd(rawArgs: string[]): ExecutionResult {
    const args = rawArgs.filter((a) => a.toLowerCase() !== '/d');
    if (args.length === 0) return { output: this.cwd + '\r\n' };
    const target = unq(args.join(' '));
    const newPath = this.resolvePath(target);
    const node = this.getNode(newPath);
    if (node && node.type === 'dir') {
      this.cwd = newPath;
      return { output: '' };
    }
    return this.fail('Das System kann den angegebenen Pfad nicht finden.\r\n');
  }

  private cmdDir(args: string[]): ExecutionResult {
    const showHidden = args.some((a) => /^\/a/i.test(a));
    const pathArgs = args.filter((a) => !a.startsWith('/'));
    const target = pathArgs.length > 0 ? this.resolvePath(unq(pathArgs.join(' '))) : this.cwd;
    const node = this.getNode(target);

    if (node && node.type === 'dir' && node.children) {
      let output = ` Verzeichnis von ${target}\r\n\r\n`;
      let count = 0;

      output += `25.11.2025  12:00    <DIR>          .\r\n`;
      output += `25.11.2025  12:00    <DIR>          ..\r\n`;

      for (const [name, child] of this.visibleChildren(node, showHidden)) {
        const date = '25.11.2025  14:30';
        if (child.type === 'dir') {
          output += `${date}    <DIR>          ${name}\r\n`;
        } else {
          const size = child.content?.length || 0;
          output += `${date}             ${size.toString().padStart(6)} ${name}\r\n`;
        }
        count++;
      }
      output += `               ${count} Datei(en)\r\n`;
      return { output };
    }
    return this.fail('Datei nicht gefunden.\r\n');
  }

  private cmdMkdir(args: string[]): ExecutionResult {
    if (args.length === 0) return this.fail('Syntaxfehler.\r\n');
    const target = unq(args.join(' '));
    const loc = this.locate(target);

    if (loc && loc.parent.children) {
      if (loc.key) {
        return this.fail(
          'Ein Unterverzeichnis oder eine Datei mit diesem Namen existiert bereits.\r\n'
        );
      }
      loc.parent.children[loc.name] = { type: 'dir', children: {} };
      return { output: '' };
    }
    return this.fail('Der Pfad wurde nicht gefunden.\r\n');
  }

  private cmdType(args: string[]): ExecutionResult {
    if (args.length === 0) return this.fail('Syntaxfehler.\r\n');
    const target = unq(args.join(' '));
    const node = this.getNode(target);
    if (node && node.type === 'file') {
      return { output: (node.content || '') + '\r\n' };
    }
    return this.fail('Das System kann die angegebene Datei nicht finden.\r\n');
  }

  private cmdAttrib(args: string[]): ExecutionResult {
    const flag = args.find((a) => /^[+-]h$/i.test(a));
    const paths = args.filter((a) => a !== flag);
    if (!flag) {
      const dir = this.getNode(paths.length > 0 ? unq(paths.join(' ')) : this.cwd);
      if (!dir || dir.type !== 'dir') return this.fail('Datei nicht gefunden.\r\n');
      const base = paths.length > 0 ? this.resolvePath(unq(paths.join(' '))) : this.cwd;
      const lines = Object.entries(dir.children ?? {})
        .filter(([, c]) => c.type === 'file')
        .map(([name, c]) => `${c.hidden ? 'A  H' : 'A   '}        ${joinPath(base, name)}\r\n`);
      return { output: lines.join('') };
    }
    if (paths.length === 0) return this.fail('Syntaxfehler.\r\n');
    const path = unq(paths.join(' '));
    const node = this.getNode(path);
    if (!node) return this.fail(`Datei nicht gefunden - ${path}\r\n`);
    node.hidden = flag[0] === '+';
    return { output: '' };
  }

  private cmdTree(args: string[]): ExecutionResult {
    const pathArgs = args.filter((a) => !a.startsWith('/'));
    const path = pathArgs.length > 0 ? this.resolvePath(unq(pathArgs.join(' '))) : this.cwd;
    const node = this.getNode(path);
    if (!node || node.type !== 'dir') return this.fail('Ungültiger Pfad - ' + path + '\r\n');
    const lines: string[] = [];
    const walk = (dir: FileSystemNode, prefix: string) => {
      const dirs = this.visibleChildren(dir, false).filter(([, c]) => c.type === 'dir');
      dirs.forEach(([name, child], i) => {
        const last = i === dirs.length - 1;
        lines.push(prefix + (last ? '└───' : '├───') + name);
        walk(child, prefix + (last ? '    ' : '│   '));
      });
    };
    walk(node, '');
    return {
      output: `Ordnerstruktur\r\n${path}\r\n${lines.join('\r\n')}${lines.length ? '\r\n' : ''}`,
    };
  }

  private cmdHelp(args: string[]): ExecutionResult {
    if (args.length > 0) {
      const text = HELP_TEXTS[args[0].toLowerCase()];
      return text
        ? { output: text }
        : this.fail(`Dieser Befehl wird von der Hilfe nicht unterstützt: ${args[0]}\r\n`);
    }
    return { output: `Verfügbare Befehle: ${CMD_COMMAND_LIST}\r\n` };
  }

  private cmdSet(rest: string): ExecutionResult {
    if (rest === '') {
      const lines = [...this.env.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((v) => `${v.name}=${v.value}`);
      return { output: lines.join('\r\n') + '\r\n' };
    }
    const eq = rest.indexOf('=');
    if (eq === -1) {
      const hits = [...this.env.values()].filter((v) =>
        v.name.toLowerCase().startsWith(rest.toLowerCase())
      );
      return hits.length
        ? { output: hits.map((v) => `${v.name}=${v.value}`).join('\r\n') + '\r\n' }
        : this.fail(`Die Umgebungsvariable "${rest}" ist nicht definiert.\r\n`);
    }
    const name = rest.slice(0, eq).trim();
    const value = rest.slice(eq + 1);
    if (name === '') return this.fail('Syntaxfehler.\r\n');
    if (value === '') this.env.delete(name.toLowerCase());
    else this.env.set(name.toLowerCase(), { name, value });
    return { output: '' };
  }

  private cmdStart(target: string): ExecutionResult {
    if (target === '') return this.fail('Syntaxfehler.\r\n');
    const node = this.getNode(target);
    if (node?.type === 'dir') {
      this.explorerPath = this.resolvePath(target);
      return { output: '' };
    }
    if (node?.type === 'file' || /^(notepad|explorer|calc|mspaint)(\.exe)?$/i.test(target)) {
      return { output: '' };
    }
    return this.fail(`Das System kann die Datei ${target} nicht finden.\r\n`);
  }

  private cmdVol(args: string[]): ExecutionResult {
    const letter = args[0] ?? this.cwd.slice(0, 2);
    const part = this.partitionByLetter(letter);
    if (!part) return this.fail('Das System kann das angegebene Laufwerk nicht finden.\r\n');
    const label = part.label ? `hat die Bezeichnung ${part.label}.` : 'hat keine Bezeichnung.';
    return {
      output: ` Das Laufwerk ${part.letter}: ${label}\r\n Volumeseriennummer: 4A2B-91CF\r\n`,
    };
  }

  private cmdLabel(args: string[], rest: string): ExecutionResult {
    if (rest === '') return this.fail('Syntaxfehler.\r\n');
    const driveArg = /^[a-zA-Z]:$/.test(args[0] ?? '') ? args[0] : undefined;
    const part = this.partitionByLetter(driveArg ?? this.cwd.slice(0, 2));
    if (!part) return this.fail('Das System kann das angegebene Laufwerk nicht finden.\r\n');
    const name = driveArg ? rest.slice(driveArg.length).trim() : rest;
    if (name.length > 32)
      return this.fail('Die Bezeichnung ist zu lang (höchstens 32 Zeichen).\r\n');
    part.label = name;
    return { output: '' };
  }

  private cmdFormat(args: string[]): ExecutionResult {
    const drive = args[0];
    if (!drive || !/^[a-zA-Z]:$/.test(drive))
      return this.fail('Syntaxfehler. Beispiel: format f: /q /fs:exfat\r\n');
    const part = this.partitionByLetter(drive);
    if (!part) return this.fail('Das System kann das angegebene Laufwerk nicht finden.\r\n');
    if (part.letter === 'C') {
      return this.fail('Zugriff verweigert. Das Systemlaufwerk kann nicht formatiert werden.\r\n');
    }
    const fsArg = args.find((a) => /^\/fs:/i.test(a));
    const fs = this.normalizeFs(fsArg ? fsArg.slice(4) : 'ntfs');
    if (!fs)
      return this.fail(
        'Das angegebene Dateisystem wird nicht unterstützt (NTFS, FAT32, exFAT).\r\n'
      );
    const labelArg = args.find((a) => /^\/v:/i.test(a));
    const old = part.fs;
    part.fs = fs;
    part.label = labelArg ? labelArg.slice(3) : '';
    this.fs[part.letter + ':'] = { type: 'dir', children: {} };
    if (this.cwd.toUpperCase().startsWith(part.letter + ':')) this.cwd = part.letter + ':\\';
    return {
      output: `Der Typ des Dateisystems ist ${old}.\r\nSchnellformatierung wird ausgeführt...\r\nFormat abgeschlossen.\r\nDas neue Dateisystem ist ${fs}.\r\n`,
    };
  }

  private normalizeFs(value: string): string | null {
    switch (value.toLowerCase()) {
      case 'ntfs':
        return 'NTFS';
      case 'fat32':
        return 'FAT32';
      case 'exfat':
        return 'exFAT';
      default:
        return null;
    }
  }

  private cmdIpconfig(args: string[]): ExecutionResult {
    const option = (args[0] ?? '').toLowerCase();
    const base =
      '\r\nEthernet-Adapter Ethernet:\r\n\r\n   Verbindungsspezifisches DNS-Suffix: fritz.box\r\n   IPv4-Adresse  . . . . . . . . . . : 192.168.178.42\r\n   Subnetzmaske  . . . . . . . . . . : 255.255.255.0\r\n   Standardgateway . . . . . . . . . : 192.168.178.1\r\n';
    switch (option) {
      case '':
        return { output: base };
      case '/all':
        return {
          output:
            '\r\nWindows-IP-Konfiguration\r\n\r\n   Hostname  . . . . . . . . . . . . : ALEX-SCHNEIDER\r\n' +
            base +
            '   Physische Adresse . . . . . . . . : 3C-A6-2F-00-11-22\r\n   DHCP aktiviert  . . . . . . . . . : Ja\r\n   DNS-Server  . . . . . . . . . . . : 192.168.178.1\r\n',
        };
      case '/flushdns':
        this.dnsCache = [];
        return {
          output: '\r\nWindows-IP-Konfiguration\r\n\r\nDer DNS-Auflösungscache wurde geleert.\r\n',
        };
      case '/displaydns':
        return {
          output:
            '\r\nWindows-IP-Konfiguration\r\n\r\n' +
            (this.dnsCache.length
              ? this.dnsCache.map((h) => `    ${h}\r\n`).join('')
              : '    Der DNS-Cache ist leer.\r\n'),
        };
      default:
        return this.fail(`Fehler: Unbekannte Option ${args[0]}\r\n`);
    }
  }

  private rememberHost(host: string) {
    const name = host.toLowerCase();
    if (/[a-z]/.test(name) && !this.dnsCache.includes(name)) this.dnsCache.push(name);
  }

  private cmdPing(args: string[]): ExecutionResult {
    if (args.length === 0) return this.fail('Syntaxfehler.\r\n');
    const host = args[args.length - 1];
    this.rememberHost(host);
    return {
      output: `Ping wird ausgeführt für ${host} mit 32 Bytes Daten:\r\nAntwort von 8.8.8.8: Bytes=32 Zeit=12ms TTL=117\r\nAntwort von 8.8.8.8: Bytes=32 Zeit=12ms TTL=117\r\nAntwort von 8.8.8.8: Bytes=32 Zeit=12ms TTL=117\r\nAntwort von 8.8.8.8: Bytes=32 Zeit=12ms TTL=117\r\n`,
    };
  }

  private cmdNslookup(args: string[]): ExecutionResult {
    const host = args[0];
    if (!host) {
      return this.fail(
        'Der interaktive Modus wird in dieser Simulation nicht unterstützt. Gib einen Namen an.\r\n'
      );
    }
    this.rememberHost(host);
    return { output: nslookupOutput(host, resolveHost(host)) };
  }

  private cmdSchtasks(args: string[]): ExecutionResult {
    const action = (args[0] ?? '').toLowerCase();
    const name = optionValue(args, '/tn');
    if (action === '/query') {
      const list = name
        ? this.tasks.filter((t) => t.name.toLowerCase() === name.toLowerCase())
        : this.tasks;
      if (name && list.length === 0) {
        return this.fail('FEHLER: Das System kann die angegebene Datei nicht finden.\r\n');
      }
      const rows = list.map((t) => `${t.name.padEnd(28)}${t.schedule.padEnd(10)}${t.time}\r\n`);
      return {
        output: `\r\nAufgabenname                Zeitplan  Zeit\r\n===========================================\r\n${rows.join('')}`,
      };
    }
    if (action === '/create') {
      const program = optionValue(args, '/tr');
      const schedule = optionValue(args, '/sc');
      if (!name || !program || !schedule) {
        return this.fail('FEHLER: Ungültige Syntax. /tn, /tr und /sc sind erforderlich.\r\n');
      }
      if (this.getTask(name)) return this.fail('FEHLER: Die Aufgabe ist bereits vorhanden.\r\n');
      this.tasks.push({
        name,
        program,
        schedule: schedule.toUpperCase(),
        time: optionValue(args, '/st') ?? '00:00',
      });
      return {
        output: `ERFOLGREICH: Die geplante Aufgabe "${name}" wurde erfolgreich erstellt.\r\n`,
      };
    }
    if (action === '/delete') {
      if (!name || !this.getTask(name)) {
        return this.fail('FEHLER: Das System kann die angegebene Datei nicht finden.\r\n');
      }
      this.tasks = this.tasks.filter((t) => t.name.toLowerCase() !== name.toLowerCase());
      return { output: `ERFOLGREICH: Die geplante Aufgabe "${name}" wurde gelöscht.\r\n` };
    }
    return this.fail('FEHLER: Ungültige Syntax. Verwende /query, /create oder /delete.\r\n');
  }

  private cmdReg(args: string[]): ExecutionResult {
    const action = (args[0] ?? '').toLowerCase();
    const keyTokens: string[] = [];
    for (const a of args.slice(1)) {
      if (a.startsWith('/')) break;
      keyTokens.push(a);
    }
    if (keyTokens.length === 0) return this.fail('FEHLER: Ungültige Syntax.\r\n');
    const keyName = normalizeRegKey(keyTokens.join(' '));
    const keyId = keyName.toLowerCase();
    const valueName = optionValue(args, '/v');
    const notFound =
      'FEHLER: Das System kann den angegebenen Registrierungsschlüssel oder -wert nicht finden.\r\n';
    const show = (v: RegValue) => `    ${v.name}    ${v.type}    ${v.data}\r\n`;

    if (action === 'query') {
      const key = this.registry[keyId];
      if (!key) return this.fail(notFound);
      if (valueName) {
        const value = key.values[valueName.toLowerCase()];
        return value ? { output: `\r\n${key.name}\r\n${show(value)}` } : this.fail(notFound);
      }
      return { output: `\r\n${key.name}\r\n${Object.values(key.values).map(show).join('')}` };
    }
    if (action === 'add') {
      const type = (optionValue(args, '/t') ?? 'REG_SZ').toUpperCase();
      const data = optionValue(args, '/d') ?? '';
      if (!valueName) return this.fail('FEHLER: Ungültige Syntax. /v ist erforderlich.\r\n');
      if (!keyName.startsWith('HKLM') && !keyName.startsWith('HKCU')) {
        return this.fail('FEHLER: Ungültiger Schlüsselname.\r\n');
      }
      const key = (this.registry[keyId] ??= { name: keyName, values: {} });
      key.values[valueName.toLowerCase()] = { name: valueName, type, data };
      return { output: 'Der Vorgang wurde erfolgreich beendet.\r\n' };
    }
    if (action === 'delete') {
      const key = this.registry[keyId];
      if (!key) return this.fail(notFound);
      if (valueName) {
        if (!key.values[valueName.toLowerCase()]) return this.fail(notFound);
        delete key.values[valueName.toLowerCase()];
      } else {
        delete this.registry[keyId];
      }
      return { output: 'Der Vorgang wurde erfolgreich beendet.\r\n' };
    }
    return this.fail('FEHLER: Ungültige Syntax. Verwende query, add oder delete.\r\n');
  }

  private cmdNetsh(args: string[]): ExecutionResult {
    const lower = args.map((a) => a.toLowerCase());
    if (lower[0] !== 'advfirewall' || lower[1] !== 'firewall' || lower[3] !== 'rule') {
      return this.fail(
        'Der Befehl wurde nicht gefunden. Unterstützt: netsh advfirewall firewall show|add|delete rule\r\n'
      );
    }
    const verb = lower[2];
    const kv = keyValues(args.slice(4));
    const name = kv['name'];
    if (!name) return this.fail('Ungültige Syntax: name= fehlt.\r\n');

    if (verb === 'show') {
      const rules =
        name.toLowerCase() === 'all'
          ? this.firewall
          : this.firewall.filter((r) => r.name.toLowerCase() === name.toLowerCase());
      if (rules.length === 0)
        return this.fail('Es stimmt keine Regel mit den angegebenen Kriterien überein.\r\n');
      return {
        output: rules
          .map(
            (r) =>
              `\r\nRegelname:     ${r.name}\r\n----------------------------------\r\nRichtung:      ${r.dir}\r\nAktion:        ${r.action}\r\nProtokoll:     ${r.protocol}\r\nLokaler Port:  ${r.localport}\r\n`
          )
          .join(''),
      };
    }
    if (verb === 'add') {
      if (!kv['dir'] || !kv['action'])
        return this.fail('Ungültige Syntax: dir= und action= sind erforderlich.\r\n');
      if (this.getFirewallRule(name))
        return this.fail('Eine Regel mit diesem Namen existiert bereits.\r\n');
      this.firewall.push({
        name,
        dir: kv['dir'].toLowerCase(),
        action: kv['action'].toLowerCase(),
        protocol: (kv['protocol'] ?? 'any').toUpperCase(),
        localport: kv['localport'] ?? 'any',
      });
      return { output: 'OK.\r\n' };
    }
    if (verb === 'delete') {
      if (!this.getFirewallRule(name))
        return this.fail('Es stimmt keine Regel mit den angegebenen Kriterien überein.\r\n');
      this.firewall = this.firewall.filter((r) => r.name.toLowerCase() !== name.toLowerCase());
      return { output: '1 Regel(n) gelöscht.\r\nOK.\r\n' };
    }
    return this.fail('Ungültige Syntax. Verwende show, add oder delete.\r\n');
  }

  // --- PowerShell Handler ---

  private handlePowerShell(command: string, args: string[], fullCmd: string): ExecutionResult {
    const rest = fullCmd.replace(/^\S+\s*/, '');
    const { named, positional } = psParams(args);
    const path = named['path'] ?? named['literalpath'] ?? positional[0];

    switch (command) {
      case 'cls':
      case 'clear':
        return { output: '', clear: true };
      case 'get-childitem':
      case 'dir':
      case 'ls':
      case 'gci':
        return this.psGetChildItem(path, named['force'] === 'true');
      case 'get-command':
        return {
          output:
            'Cmdlet          Get-ChildItem       3.1.0.0    Microsoft.PowerShell.Management\r\n',
        };
      case 'get-process':
        this.pendingTable = PROCESSES;
        return { output: renderTable(PROCESSES) };
      case 'get-service':
        this.pendingTable = SERVICES;
        return { output: renderTable(SERVICES) };
      case 'get-help': {
        const text = PS_HELP_TEXTS[(positional[0] ?? '').toLowerCase()];
        return text
          ? { output: text }
          : this.fail(`Get-Help : Es wurde keine Hilfe für "${positional[0] ?? ''}" gefunden.\r\n`);
      }
      case '$psversiontable':
        return { output: PS_VERSION_TABLE };
      case 'get-content':
      case 'cat':
      case 'type':
        return path ? this.cmdType([path]) : this.fail('Syntaxfehler.\r\n');
      case 'set-location':
      case 'sl':
      case 'cd':
        return this.cmdCd(path ? [path] : []);
      case 'get-location':
      case 'pwd':
        return { output: `\r\nPath\r\n----\r\n${this.cwd}\r\n\r\n` };
      case 'test-path':
        return { output: this.exists(path ?? '') ? 'True\r\n' : 'False\r\n' };
      case 'echo':
      case 'write-host':
      case 'write-output':
        return { output: rest + '\r\n' };
      case 'new-item':
        return this.psNewItem(named, positional);
      case 'set-content':
      case 'add-content': {
        const value = named['value'] ?? positional.slice(1).join(' ');
        if (!path) return this.fail(`${command} : Es wurde kein Pfad angegeben.\r\n`);
        const error = this.writeFile(path, value, command === 'add-content');
        return error ? this.fail(error + '\r\n') : { output: '' };
      }
      case 'copy-item':
      case 'cp':
      case 'move-item':
      case 'mv': {
        const dst = named['destination'] ?? positional[1];
        if (!path || !dst) return this.fail(`${command} : Quelle und Ziel sind erforderlich.\r\n`);
        const error =
          command.startsWith('copy') || command === 'cp'
            ? this.copyFile(path, dst)
            : this.moveNode(path, dst);
        return error ? this.fail(error + '\r\n') : { output: '' };
      }
      case 'remove-item':
      case 'ri':
      case 'rm':
      case 'del': {
        if (!path) return this.fail(`${command} : Es wurde kein Pfad angegeben.\r\n`);
        const error = this.deleteNode(path, named['recurse'] === 'true');
        return error ? this.fail(error + '\r\n') : { output: '' };
      }
      case 'rename-item':
      case 'rni': {
        const newName = named['newname'] ?? positional[1];
        if (!path || !newName)
          return this.fail('Rename-Item : Pfad und neuer Name sind erforderlich.\r\n');
        const error = this.renameNode(path, newName);
        return error ? this.fail(error + '\r\n') : { output: '' };
      }
      default:
        // Fallback to CMD commands if not a PS cmdlet
        return this.handleCmd(command, args, fullCmd);
    }
  }

  private psNewItem(named: Record<string, string>, positional: string[]): ExecutionResult {
    const base = named['path'] ?? positional[0];
    const name = named['name'];
    const type = (named['itemtype'] ?? '').toLowerCase();
    const target = name ? joinPath(base ?? this.cwd, name) : base;
    if (!target) return this.fail('New-Item : Es wurde kein Pfad angegeben.\r\n');
    if (type !== 'directory' && type !== 'file') {
      return this.fail(
        'New-Item : Mit -ItemType Directory oder File wird angegeben, was erstellt werden soll.\r\n'
      );
    }
    const loc = this.locate(target);
    if (!loc || !loc.parent.children)
      return this.fail('New-Item : Der Pfad wurde nicht gefunden.\r\n');
    if (loc.key)
      return this.fail(
        'New-Item : Ein Element mit dem angegebenen Namen ist bereits vorhanden.\r\n'
      );
    loc.parent.children[loc.name] =
      type === 'directory'
        ? { type: 'dir', children: {} }
        : { type: 'file', content: named['value'] ?? '' };
    return {
      output: `\r\n    Verzeichnis: ${this.resolvePath(joinPath(this.resolvePath(target), '..'))}\r\n\r\nMode   Name\r\n----   ----\r\n${type === 'directory' ? 'd-----' : '-a----'} ${loc.name}\r\n\r\n`,
    };
  }

  private psGetChildItem(pathArg: string | undefined, showHidden: boolean): ExecutionResult {
    const target = pathArg ? this.resolvePath(pathArg) : this.cwd;
    const node = this.getNode(target);
    if (node && node.type === 'dir' && node.children) {
      let output = `    Verzeichnis: ${target}\r\n\r\n`;
      output += 'Mode                 LastWriteTime         Length Name\r\n';
      output += '----                 -------------         ------ ----\r\n';
      for (const [name, child] of this.visibleChildren(node, showHidden)) {
        const date = '25.11.2025  14:30';
        if (child.type === 'dir') {
          output += `d-----          ${date}                ${name}\r\n`;
        } else {
          const size = child.content?.length || 0;
          output += `-a----          ${date}       ${size.toString().padEnd(6)} ${name}\r\n`;
        }
      }
      return { output: output + '\r\n' };
    }
    return this.fail('Get-ChildItem : Der Pfad wurde nicht gefunden.\r\n');
  }

  // --- Diskpart Handler ---

  private diskFree(disk: Disk): number {
    return disk.sizeMB - disk.partitions.reduce((sum, p) => sum + p.sizeMB, 0);
  }

  private allVolumes(): { disk: Disk; part: Partition }[] {
    return this.disks
      .flatMap((disk) => disk.partitions.map((part) => ({ disk, part })))
      .sort((a, b) => a.part.volume - b.part.volume);
  }

  private currentDisk(): Disk | null {
    return this.disks.find((d) => d.number === this.selectedDisk) ?? null;
  }

  private currentVolume(): { disk: Disk; part: Partition } | null {
    return this.allVolumes().find((v) => v.part.volume === this.selectedVolume) ?? null;
  }

  private noDisk(): ExecutionResult {
    return this.fail(
      'Es ist kein Datenträger ausgewählt.\r\nWählen Sie einen Datenträger, und wiederholen Sie den Vorgang.\r\n'
    );
  }

  private noVolume(): ExecutionResult {
    return this.fail(
      'Es ist keine Partition ausgewählt.\r\nWählen Sie eine Partition, und wiederholen Sie den Vorgang.\r\n'
    );
  }

  private handleDiskpart(command: string, args: string[]): ExecutionResult {
    const sub = (args[0] ?? '').toLowerCase();
    switch (command) {
      case 'list':
        return this.dpList(sub);
      case 'select':
        return this.dpSelect(sub, args[1] ?? '');
      case 'detail':
        return this.dpDetail(sub);
      case 'clean': {
        const disk = this.currentDisk();
        if (!disk) return this.noDisk();
        for (const part of disk.partitions) {
          if (part.letter) delete this.fs[part.letter + ':'];
          if (part.letter && this.cwd.toUpperCase().startsWith(part.letter + ':'))
            this.cwd = 'C:\\';
        }
        disk.partitions = [];
        disk.style = 'RAW';
        this.selectedVolume = null;
        return { output: '\r\nDiskPart hat den Datenträger erfolgreich bereinigt.\r\n' };
      }
      case 'convert': {
        const disk = this.currentDisk();
        if (!disk) return this.noDisk();
        if (sub !== 'gpt' && sub !== 'mbr') return this.fail('DISKPART> convert gpt|mbr\r\n');
        if (disk.partitions.length > 0) {
          return this.fail(
            'Der Datenträger enthält Partitionen. Bereinigen Sie ihn zuerst mit clean.\r\n'
          );
        }
        disk.style = sub === 'gpt' ? 'GPT' : 'MBR';
        return {
          output: `\r\nDiskPart hat den ausgewählten Datenträger erfolgreich in das ${disk.style}-Format konvertiert.\r\n`,
        };
      }
      case 'create': {
        const disk = this.currentDisk();
        if (!disk) return this.noDisk();
        if (sub !== 'partition' || (args[1] ?? '').toLowerCase() !== 'primary') {
          return this.fail('Diese Simulation unterstützt nur: create partition primary\r\n');
        }
        const free = this.diskFree(disk);
        const wanted = parseInt(keyValues(args.slice(2))['size'] ?? '', 10);
        const size = Number.isNaN(wanted) ? free : Math.min(wanted, free);
        if (size <= 0)
          return this.fail('Auf dem Datenträger ist nicht genügend Speicherplatz frei.\r\n');
        if (disk.style === 'RAW') disk.style = 'MBR';
        const part: Partition = {
          volume: this.nextVolume++,
          name: 'Primär',
          sizeMB: size,
          letter: '',
          label: '',
          fs: 'RAW',
        };
        disk.partitions.push(part);
        this.selectedVolume = part.volume;
        return { output: '\r\nDiskPart hat die angegebene Partition erfolgreich erstellt.\r\n' };
      }
      case 'format': {
        const target = this.currentVolume();
        if (!target) return this.noVolume();
        const kv = keyValues(args);
        const fs = this.normalizeFs(kv['fs'] ?? 'ntfs');
        if (!fs)
          return this.fail(
            'Das angegebene Dateisystem wird nicht unterstützt (NTFS, FAT32, exFAT).\r\n'
          );
        target.part.fs = fs;
        target.part.label = kv['label'] ?? '';
        if (target.part.letter) this.fs[target.part.letter + ':'] = { type: 'dir', children: {} };
        return {
          output:
            '\r\n  100 Prozent bearbeitet\r\n\r\nDiskPart hat das Volume erfolgreich formatiert.\r\n',
        };
      }
      case 'assign': {
        const target = this.currentVolume();
        if (!target) return this.noVolume();
        if (target.part.letter)
          return this.fail('Das Volume hat bereits einen Laufwerkbuchstaben.\r\n');
        const match = /letter=?([a-z])/i.exec(args.join(''));
        const letter =
          match?.[1].toUpperCase() ??
          'EFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => !this.fs[l + ':']);
        if (!letter || this.fs[letter + ':']) {
          return this.fail('Der angegebene Laufwerkbuchstabe ist nicht frei.\r\n');
        }
        target.part.letter = letter;
        this.fs[letter + ':'] = { type: 'dir', children: {} };
        return {
          output:
            '\r\nDiskPart hat den Laufwerkbuchstaben oder den Bereitstellungspunkt erfolgreich zugewiesen.\r\n',
        };
      }
      default:
        return this.fail('Befehl wird in dieser Simulation nicht unterstützt.\r\n');
    }
  }

  private dpList(sub: string): ExecutionResult {
    if (sub === 'disk') {
      const header =
        '  Datenträger  Status      Größe    Frei     Dyn  GPT\r\n  -----------  ----------  -------  -------  ---  ---\r\n';
      const rows = this.disks.map(
        (d) =>
          `${this.selectedDisk === d.number ? '*' : ' '} Datenträger ${d.number}  Online  ${formatSize(d.sizeMB).padStart(8)}  ${formatSize(this.diskFree(d)).padStart(8)}      ${d.style === 'GPT' ? '*' : ' '}\r\n`
      );
      return { output: header + rows.join('') };
    }
    if (sub === 'volume') {
      const header =
        '  Volume ###  Bez  Bezeichnung   FS     Größe\r\n  ----------  ---  ------------  -----  -------\r\n';
      const rows = this.allVolumes().map(
        ({ part }) =>
          `${this.selectedVolume === part.volume ? '*' : ' '} Volume ${part.volume}     ${(part.letter || ' ').padEnd(3)}  ${part.label.padEnd(12)}  ${part.fs.padEnd(5)}  ${formatSize(part.sizeMB).padStart(7)}\r\n`
      );
      return { output: header + rows.join('') };
    }
    if (sub === 'partition') {
      const disk = this.currentDisk();
      if (!disk) return this.noDisk();
      const header =
        '  Partition ###  Typ          Größe\r\n  -------------  -----------  -------\r\n';
      const rows = disk.partitions.map(
        (p, i) =>
          `  Partition ${i + 1}      ${p.name.padEnd(11)}  ${formatSize(p.sizeMB).padStart(7)}\r\n`
      );
      return { output: header + (rows.join('') || '  Keine Partitionen vorhanden.\r\n') };
    }
    return this.fail('DISKPART> list [disk|volume|partition]\r\n');
  }

  private dpSelect(sub: string, value: string): ExecutionResult {
    if (sub === 'disk') {
      const num = parseInt(value);
      if (!isNaN(num) && this.disks.some((d) => d.number === num)) {
        this.selectedDisk = num;
        return { output: `Datenträger ${num} ist jetzt der gewählte Datenträger.\r\n` };
      }
      return this.fail('Der Datenträger wurde nicht gefunden.\r\n');
    }
    if (sub === 'volume') {
      const wanted = value.replace(':', '').toUpperCase();
      const found = this.allVolumes().find(
        ({ part }) =>
          String(part.volume) === wanted || (part.letter !== '' && part.letter === wanted)
      );
      if (!found) return this.fail('Das angegebene Volume wurde nicht gefunden.\r\n');
      this.selectedVolume = found.part.volume;
      return { output: `Volume ${found.part.volume} ist das gewählte Volume.\r\n` };
    }
    return this.fail('DISKPART> select disk <n>\r\n');
  }

  private dpDetail(sub: string): ExecutionResult {
    if (sub === 'disk') {
      const disk = this.currentDisk();
      if (!disk) return this.noDisk();
      const volumes = this.allVolumes().filter((v) => v.disk === disk);
      return {
        output: `\r\nDatenträger ${disk.number}\r\nStatus: Online\r\nGröße: ${formatSize(disk.sizeMB)}\r\nFrei: ${formatSize(this.diskFree(disk))}\r\nPartitionsstil: ${disk.style}\r\n\r\n${volumes.map(({ part }) => `  Volume ${part.volume}  ${part.letter || '-'}  ${part.label || '-'}  ${part.fs}`).join('\r\n')}\r\n`,
      };
    }
    if (sub === 'volume') {
      const target = this.currentVolume();
      if (!target) return this.noVolume();
      const { part, disk } = target;
      return {
        output: `\r\nVolume ${part.volume}\r\nLaufwerkbuchstabe: ${part.letter || '-'}\r\nBezeichnung: ${part.label || '-'}\r\nDateisystem: ${part.fs}\r\nGröße: ${formatSize(part.sizeMB)}\r\nDatenträger: ${disk.number}\r\nStatus: Gesund\r\n`,
      };
    }
    return this.fail('DISKPART> detail disk|volume\r\n');
  }
}
