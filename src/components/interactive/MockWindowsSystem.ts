export interface FileSystemNode {
  type: 'file' | 'dir';
  content?: string;
  children?: Record<string, FileSystemNode>;
}

export interface ExecutionResult {
  output: string;
  newCwd?: string;
  clear?: boolean;
}

export class MockWindowsSystem {
  private fs: Record<string, FileSystemNode>;
  private cwd: string;
  private mode: 'cmd' | 'powershell' | 'diskpart';

  // Diskpart State
  private selectedDisk: number | null = null;
  private selectedVolume: string | null = null;

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
                      'Willkommen im interaktiven Terminal von alexle135.de!\r\nHier kannst du echte CMD-Befehle üben.',
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
    };
  }

  public getPrompt(): string {
    if (this.mode === 'diskpart') return 'DISKPART> ';
    if (this.mode === 'powershell') return `PS ${this.cwd}> `;
    return `${this.cwd}>`;
  }

  public getMode(): 'cmd' | 'powershell' | 'diskpart' {
    return this.mode;
  }

  public processCommand(cmd: string): ExecutionResult {
    const trimmed = cmd.trim();
    if (!trimmed) return { output: '' };

    // Handle Mode Switching
    if (this.mode === 'cmd' && trimmed.toLowerCase() === 'powershell') {
      this.mode = 'powershell';
      return {
        output:
          'Windows PowerShell\r\nCopyright (C) Microsoft Corporation. Alle Rechte vorbehalten.\r\n\r\n',
      };
    }
    if (this.mode === 'cmd' && trimmed.toLowerCase() === 'diskpart') {
      this.mode = 'diskpart';
      return {
        output:
          'Microsoft DiskPart-Version 10.0.19041.964\r\n\r\nCopyright (C) Microsoft Corporation.\r\nAuf Computer: ALEXLE135\r\n',
      };
    }
    if (this.mode === 'powershell' && trimmed.toLowerCase() === 'exit') {
      this.mode = 'cmd';
      return { output: '' };
    }
    if (this.mode === 'diskpart' && trimmed.toLowerCase() === 'exit') {
      this.mode = 'cmd';
      this.selectedDisk = null;
      this.selectedVolume = null;
      return { output: 'DiskPart wird beendet...\r\n' };
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (this.mode === 'diskpart') {
      return this.handleDiskpart(command, args);
    } else if (this.mode === 'powershell') {
      return this.handlePowerShell(command, args, trimmed);
    } else {
      return this.handleCmd(command, args, trimmed);
    }
  }

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

    const drive = parts[0].toUpperCase();
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

  // --- CMD Handler ---
  private handleCmd(command: string, args: string[], _fullCmd: string): ExecutionResult {
    // Drive Switch
    if (/^[a-zA-Z]:$/.test(command)) {
      const drive = command.toUpperCase();
      if (this.fs[drive]) {
        this.cwd = drive + '\\';
        return { output: '' };
      }
      return { output: 'Das System kann das angegebene Laufwerk nicht finden.\r\n' };
    }

    switch (command) {
      case 'cls':
        return { output: '', clear: true };
      case 'cd':
        return this.cmdCd(args);
      case 'dir':
        return this.cmdDir(args);
      case 'md':
      case 'mkdir':
        return this.cmdMkdir(args);
      case 'echo':
        return { output: args.join(' ') + '\r\n' };
      case 'type':
        return this.cmdType(args);
      case 'ver':
        return { output: 'Microsoft Windows [Version 10.0.19045.3693]\r\n' };
      case 'help':
        return this.cmdHelp();
      case 'ipconfig':
        return this.cmdIpconfig(args);
      case 'ping':
        return this.cmdPing(args);
      case 'whoami':
        return { output: 'alexle135\\visitor\r\n' };
      default:
        return {
          output: `'${command}' ist falsch geschrieben oder konnte nicht gefunden werden.\r\n`,
        };
    }
  }

  private cmdCd(args: string[]): ExecutionResult {
    if (args.length === 0) return { output: this.cwd + '\r\n' };
    const target = args.join(' ');
    const newPath = this.resolvePath(target);
    const node = this.getNode(newPath);
    if (node && node.type === 'dir') {
      this.cwd = newPath;
      return { output: '' };
    }
    return { output: 'Das System kann den angegebenen Pfad nicht finden.\r\n' };
  }

  private cmdDir(args: string[]): ExecutionResult {
    const target = args.length > 0 ? this.resolvePath(args.join(' ')) : this.cwd;
    const node = this.getNode(target);

    if (node && node.type === 'dir' && node.children) {
      let output = ` Verzeichnis von ${target}\r\n\r\n`;
      let count = 0;

      output += `25.11.2025  12:00    <DIR>          .\r\n`;
      output += `25.11.2025  12:00    <DIR>          ..\r\n`;

      for (const [name, child] of Object.entries(node.children)) {
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
    return { output: 'Datei nicht gefunden.\r\n' };
  }

  private cmdMkdir(args: string[]): ExecutionResult {
    if (args.length === 0) return { output: 'Syntaxfehler.\r\n' };
    const target = args.join(' ');
    const result = this.getParentNode(this.resolvePath(target));

    if (result && result.parent.children) {
      if (result.parent.children[result.name]) {
        return {
          output: 'Ein Unterverzeichnis oder eine Datei mit diesem Namen existiert bereits.\r\n',
        };
      }
      result.parent.children[result.name] = { type: 'dir', children: {} };
      return { output: '' };
    }
    return { output: 'Der Pfad wurde nicht gefunden.\r\n' };
  }

  private cmdType(args: string[]): ExecutionResult {
    if (args.length === 0) return { output: 'Syntaxfehler.\r\n' };
    const target = args.join(' ');
    const node = this.getNode(target);
    if (node && node.type === 'file') {
      return { output: (node.content || '') + '\r\n' };
    }
    return { output: 'Das System kann die angegebene Datei nicht finden.\r\n' };
  }

  private cmdHelp(): ExecutionResult {
    return {
      output:
        'Verfügbare Befehle: DIR, CD, MKDIR, TYPE, CLS, VER, HELP, IPCONFIG, PING, POWERSHELL, DISKPART\r\n',
    };
  }

  private cmdIpconfig(_args: string[]): ExecutionResult {
    return {
      output:
        '\r\nEthernet-Adapter Ethernet:\r\n\r\n   Verbindungsspezifisches DNS-Suffix: fritz.box\r\n   IPv4-Adresse  . . . . . . . . . . : 192.168.178.42\r\n   Subnetzmaske  . . . . . . . . . . : 255.255.255.0\r\n   Standardgateway . . . . . . . . . : 192.168.178.1\r\n',
    };
  }

  private cmdPing(args: string[]): ExecutionResult {
    if (args.length === 0) return { output: 'Syntaxfehler.\r\n' };
    const host = args[args.length - 1];
    return {
      output: `Ping wird ausgeführt für ${host} mit 32 Bytes Daten:\r\nAntwort von 8.8.8.8: Bytes=32 Zeit=12ms TTL=117\r\nAntwort von 8.8.8.8: Bytes=32 Zeit=12ms TTL=117\r\nAntwort von 8.8.8.8: Bytes=32 Zeit=12ms TTL=117\r\nAntwort von 8.8.8.8: Bytes=32 Zeit=12ms TTL=117\r\n`,
    };
  }

  // --- PowerShell Handler ---
  private handlePowerShell(command: string, args: string[], fullCmd: string): ExecutionResult {
    switch (command) {
      case 'cls':
      case 'clear':
        return { output: '', clear: true };
      case 'get-childitem':
      case 'dir':
      case 'ls':
      case 'gci':
        return this.psGetChildItem(args);
      case 'get-command':
        return {
          output:
            'Cmdlet          Get-ChildItem       3.1.0.0    Microsoft.PowerShell.Management\r\n',
        };
      case 'get-process':
        return {
          output:
            'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\r\n-------  ------    -----      -----     ------     --  -- -----------\r\n    456      23    12456      23456       1.23   1234   1 chrome\r\n    234      15     8765      15432       0.56   5678   1 powershell\r\n',
        };
      case 'get-service':
        return {
          output:
            'Status   Name               DisplayName\r\n------   ----               -----------\r\nRunning  Dhcp               DHCP Client\r\nRunning  Dnscache           DNS Client\r\n',
        };
      case 'get-content':
      case 'cat':
      case 'type':
        return this.cmdType(args); // Reuse CMD logic for simple reading
      case 'set-location':
      case 'cd':
        return this.cmdCd(args);
      case 'echo':
      case 'write-host':
      case 'write-output':
        return { output: args.join(' ') + '\r\n' };
      default:
        // Fallback to CMD commands if not a PS cmdlet
        return this.handleCmd(command, args, fullCmd);
    }
  }

  private psGetChildItem(args: string[]): ExecutionResult {
    const target = args.length > 0 ? this.resolvePath(args.join(' ')) : this.cwd;
    const node = this.getNode(target);
    if (node && node.type === 'dir' && node.children) {
      let output = `    Verzeichnis: ${target}\r\n\r\n`;
      output += 'Mode                 LastWriteTime         Length Name\r\n';
      output += '----                 -------------         ------ ----\r\n';
      for (const [name, child] of Object.entries(node.children)) {
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
    return { output: 'Get-ChildItem : Der Pfad wurde nicht gefunden.\r\n' };
  }

  // --- Diskpart Handler ---
  private handleDiskpart(command: string, args: string[]): ExecutionResult {
    switch (command) {
      case 'list':
        if (args[0] === 'disk') {
          return {
            output: `  Datenträger  Status      Größe    Frei     Dyn  GPT\r\n  -----------  ----------  -------  -------  ---  ---\r\n${this.selectedDisk === 0 ? '*' : ' '} Datenträger 0  Online       500 GB      0 B           *\r\n${this.selectedDisk === 1 ? '*' : ' '} Datenträger 1  Online       250 GB   100 GB          *\r\n`,
          };
        }
        return { output: 'DISKPART> list [disk|volume|partition]\r\n' };
      case 'select':
        if (args[0] === 'disk') {
          const num = parseInt(args[1]);
          if (!isNaN(num) && (num === 0 || num === 1)) {
            this.selectedDisk = num;
            return { output: `Datenträger ${num} ist jetzt der gewählte Datenträger.\r\n` };
          }
          return { output: 'Der Datenträger wurde nicht gefunden.\r\n' };
        }
        return { output: 'DISKPART> select disk <n>\r\n' };
      default:
        return { output: 'Befehl wird in dieser Simulation nicht unterstützt.\r\n' };
    }
  }
}
