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

export class MockLinuxSystem {
  private fs: Record<string, FileSystemNode>;
  private cwd: string;
  private user: string;
  private hostname: string;

  constructor() {
    this.user = 'visitor';
    this.hostname = 'alex-schneider.dev';
    this.cwd = '/home/visitor';
    this.fs = {
      '/': {
        type: 'dir',
        children: {
          home: {
            type: 'dir',
            children: {
              visitor: {
                type: 'dir',
                children: {
                  'welcome.txt': {
                    type: 'file',
                    content:
                      'Willkommen im interaktiven Terminal von alex-schneider.dev!\nHier kannst du echte Linux-Befehle üben.',
                  },
                  '.secret': { type: 'file', content: 'U3VwZXJTZWNyZXQxMjM=' },
                  'README.md': { type: 'file', content: '# README\nThis is a test file.' },
                  projekte: { type: 'dir', children: {} },
                },
              },
            },
          },
          var: {
            type: 'dir',
            children: {
              log: {
                type: 'dir',
                children: {
                  'auth.log': {
                    type: 'file',
                    content:
                      'Jan 28 14:32:45 server sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2\nJan 28 14:32:48 server sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2\nJan 28 14:32:51 server sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2\nJan 28 14:33:12 server sshd[1235]: Accepted password for admin from 192.168.1.100 port 22 ssh2',
                  },
                },
              },
            },
          },
          usr: {
            type: 'dir',
            children: {
              local: {
                type: 'dir',
                children: {
                  bin: {
                    type: 'dir',
                    children: {
                      backup: { type: 'file', content: 'BINARY_DATA' },
                    },
                  },
                },
              },
              bin: {
                type: 'dir',
                children: {
                  sudo: { type: 'file', content: 'BINARY_DATA' },
                },
              },
            },
          },
        },
      },
    };
  }

  public getPrompt(): string {
    const path = this.cwd.replace('/home/visitor', '~');
    return `\x1b[1;32m${this.user}@${this.hostname}\x1b[0m:\x1b[1;34m${path}\x1b[0m$ `;
  }

  public getCwd(): string {
    return this.cwd;
  }

  public getCompletions(input: string): string[] {
    const parts = input.split(' ');
    const lastPart = parts[parts.length - 1];

    if (parts.length === 1) {
      const commands = [
        'whoami',
        'pwd',
        'ls',
        'cd',
        'mkdir',
        'touch',
        'cat',
        'echo',
        'clear',
        'grep',
        'find',
        'head',
        'tail',
        'wc',
        'sort',
        'uniq',
        'awk',
        'base64',
        'cp',
        'mv',
        'rm',
        'chmod',
        'chown',
        'id',
        'hostname',
        'uname',
        'date',
        'history',
        'man',
        'which',
        'env',
        'export',
        'docker',
        'docker-compose',
        'git',
      ];
      return commands.filter((c) => c.startsWith(lastPart));
    } else {
      const node = this.getNode(this.cwd);
      if (node && node.children) {
        const candidates = Object.keys(node.children);
        if (lastPart.startsWith('.')) {
          candidates.push('.');
          candidates.push('..');
        }
        return candidates.filter((f) => f.startsWith(lastPart));
      }
    }
    return [];
  }

  private resolvePath(path: string): string {
    if (path.startsWith('/')) return path;
    if (path === '~') return '/home/visitor';
    if (path.startsWith('~/')) return '/home/visitor' + path.slice(1);

    const parts = path.split('/');
    const currentParts = this.cwd.split('/').filter((p) => p);

    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        if (currentParts.length > 0) currentParts.pop();
      } else {
        currentParts.push(part);
      }
    }

    return '/' + currentParts.join('/');
  }

  private getNode(path: string): FileSystemNode | null {
    const resolvedPath = this.resolvePath(path);
    if (resolvedPath === '/') return this.fs['/'];

    const parts = resolvedPath.split('/').filter((p) => p);
    let current: FileSystemNode = this.fs['/'];

    for (const part of parts) {
      if (current.type !== 'dir' || !current.children || !current.children[part]) {
        return null;
      }
      current = current.children[part];
    }
    return current;
  }

  private getParentNode(path: string): { node: FileSystemNode; name: string } | null {
    const resolvedPath = this.resolvePath(path);
    const parts = resolvedPath.split('/').filter((p) => p);

    if (parts.length === 0) return null;

    const name = parts[parts.length - 1];
    const parentPath = '/' + parts.slice(0, parts.length - 1).join('/');
    const parentNode = this.getNode(parentPath);

    if (parentNode && parentNode.type === 'dir') {
      return { node: parentNode, name };
    }
    return null;
  }

  public processCommand(cmd: string): ExecutionResult {
    const trimmed = cmd.trim();
    if (!trimmed) return { output: '' };

    if (trimmed.includes('|')) {
      return this.handlePipe(trimmed);
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Handle explicit binary execution for CTF
    if (command === '/usr/local/bin/backup' || command === './backup') {
      return {
        output:
          'root@alex-schneider.dev:/# \r\nCongratulations! You have obtained root access!\r\n',
      };
    }

    switch (command) {
      case 'whoami':
        return { output: this.user + '\r\n' };
      case 'pwd':
        return { output: this.cwd + '\r\n' };
      case 'ls':
        return this.handleLs(args);
      case 'cd':
        return this.handleCd(args);
      case 'mkdir':
        return this.handleMkdir(args);
      case 'touch':
        return this.handleTouch(args);
      case 'cat':
        return this.handleCat(args);
      case 'echo':
        return { output: args.join(' ') + '\r\n' };
      case 'clear':
        return { output: '', clear: true };
      case 'grep':
        return this.handleGrep(args);
      case 'find':
        return this.handleFind(args);
      case 'head':
        return this.handleHead(args);
      case 'tail':
        return this.handleTail(args);
      case 'wc':
        return this.handleWc(args);
      case 'cp':
        return this.handleCp(args);
      case 'mv':
        return this.handleMv(args);
      case 'rm':
        return this.handleRm(args);
      case 'chmod':
        return { output: '' };
      case 'chown':
        return { output: '' };
      case 'id':
        return { output: 'uid=1000(visitor) gid=1000(visitor) groups=1000(visitor)\r\n' };
      case 'hostname':
        return { output: this.hostname + '\r\n' };
      case 'uname':
        return this.handleUname(args);
      case 'date':
        return { output: new Date().toString() + '\r\n' };
      case 'history':
        return { output: '    1  whoami\r\n    2  pwd\r\n    3  ls -la\r\n    4  history\r\n' };
      case 'man':
        return {
          output: `\r\n${args[0]?.toUpperCase() || 'COMMAND'}(1)     User Commands\r\n\r\nNAME\r\n       ${args[0] || 'command'} - simulated man page\r\n\r\nFor real documentation: https://linux.die.net/man/1/${args[0] || 'bash'}\r\n`,
        };
      case 'which':
        return { output: args[0] ? `/bin/${args[0]}\r\n` : '' };
      case 'env':
        return {
          output: `USER=${this.user}\r\nHOME=/home/${this.user}\r\nSHELL=/bin/bash\r\nPATH=/bin:/usr/bin:/usr/local/bin\r\nPWD=${this.cwd}\r\nLANG=de_DE.UTF-8\r\n`,
        };
      case 'export':
        return {
          output:
            'declare -x HOME="/home/visitor"\r\ndeclare -x PATH="/bin:/usr/bin:/usr/local/bin"\r\ndeclare -x USER="visitor"\r\n',
        };
      case 'docker':
        return this.handleDocker(args);
      case 'docker-compose':
        return this.handleDockerCompose(args);
      case 'git':
        return this.handleGit(args);
      default:
        return { output: `bash: ${command}: command not found\r\n` };
    }
  }

  private handlePipe(fullCmd: string): ExecutionResult {
    // Handle: echo 'text' | base64 -d
    if (fullCmd.includes('base64 -d') || fullCmd.includes('base64 --decode')) {
      const match = fullCmd.match(
        /echo\s+['"]?([A-Za-z0-9+/=]+)['"]?\s*\|\s*base64\s+(-d|--decode)/
      );
      if (match) {
        try {
          return { output: atob(match[1]) + '\r\n' };
        } catch {
          return { output: 'base64: invalid input\r\n' };
        }
      }
    }

    // Handle: grep pattern file | awk '{print $N}' | sort | uniq -c | sort -nr | head -1
    if (
      fullCmd.includes('grep') &&
      (fullCmd.includes('awk') || fullCmd.includes('sort') || fullCmd.includes('uniq'))
    ) {
      if (fullCmd.includes('Failed') && fullCmd.includes('auth.log')) {
        // Simulated output for Log Detective CTF mission
        return { output: '      3 192.168.1.100\r\n' };
      }
      if (fullCmd.includes('Accepted') && fullCmd.includes('auth.log')) {
        return {
          output:
            'Jan 28 14:33:12 server sshd[1235]: Accepted password for admin from 192.168.1.100 port 22 ssh2\r\n',
        };
      }
    }

    // Handle simple: command | grep pattern
    if (fullCmd.includes('|') && fullCmd.includes('grep')) {
      const parts = fullCmd.split('|').map((p) => p.trim());
      // Execute first command
      const result = this.processCommand(parts[0]);

      // Find grep pattern
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('grep')) {
          const grepParts = parts[i].split(/\s+/);
          const pattern = grepParts[1] || '';
          const lines = result.output.split('\r\n').filter((l) => l.includes(pattern));
          return { output: lines.join('\r\n') + '\r\n' };
        }
      }
    }

    return { output: 'Pipeline executed (simplified mock mode).\r\n' };
  }

  private handleLs(args: string[]): ExecutionResult {
    const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
    const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');

    let targetPath = '.';
    const pathArg = args.find((arg) => !arg.startsWith('-'));
    if (pathArg) targetPath = pathArg;

    const node = this.getNode(targetPath);

    if (!node) {
      return { output: `ls: cannot access '${targetPath}': No such file or directory\r\n` };
    }

    if (node.type === 'file') {
      return { output: targetPath + '\r\n' };
    }

    if (node.children) {
      const entries = Object.keys(node.children);
      const filtered = entries.filter((e) => showHidden || !e.startsWith('.'));

      if (filtered.length === 0) return { output: '' };

      if (showLong) {
        let output = 'total ' + filtered.length + '\r\n';
        for (const entry of filtered) {
          const isDir = node.children[entry].type === 'dir';
          const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
          const size = isDir ? 4096 : node.children[entry].content?.length || 0;
          const date = 'Jan 28 12:00';
          output += `${perms} 1 ${this.user} ${this.user} ${size} ${date} ${entry}\r\n`;
        }
        return { output };
      } else {
        return { output: filtered.join('  ') + '\r\n' };
      }
    }

    return { output: '' };
  }

  private handleCd(args: string[]): ExecutionResult {
    if (args.length === 0) {
      this.cwd = '/home/visitor';
      return { output: '' };
    }

    const target = args[0];
    const newPath = this.resolvePath(target);
    const node = this.getNode(newPath);

    if (node && node.type === 'dir') {
      this.cwd = newPath;
      return { output: '', newCwd: newPath };
    }

    return { output: `bash: cd: ${target}: No such file or directory\r\n` };
  }

  private handleMkdir(args: string[]): ExecutionResult {
    if (args.length === 0) return { output: 'mkdir: missing operand\r\n' };
    const target = args[0];
    const result = this.getParentNode(target);
    if (result) {
      const { node, name } = result;
      if (node.children) {
        if (node.children[name]) {
          return { output: `mkdir: cannot create directory '${target}': File exists\r\n` };
        }
        node.children[name] = { type: 'dir', children: {} };
        return { output: '' };
      }
    }
    return { output: `mkdir: cannot create directory '${target}': No such file or directory\r\n` };
  }

  private handleTouch(args: string[]): ExecutionResult {
    if (args.length === 0) return { output: 'touch: missing file operand\r\n' };
    const target = args[0];
    const result = this.getParentNode(target);
    if (result) {
      const { node, name } = result;
      if (node.children) {
        if (!node.children[name]) {
          node.children[name] = { type: 'file', content: '' };
        }
        return { output: '' };
      }
    }
    return { output: `touch: cannot touch '${target}': No such file or directory\r\n` };
  }

  private handleCat(args: string[]): ExecutionResult {
    if (args.length === 0) return { output: 'cat: missing operand\r\n' };
    const target = args[0];
    const node = this.getNode(target);
    if (!node) return { output: `cat: ${target}: No such file or directory\r\n` };
    if (node.type === 'dir') return { output: `cat: ${target}: Is a directory\r\n` };
    return { output: (node.content || '') + '\r\n' };
  }

  private handleGrep(args: string[]): ExecutionResult {
    if (args.length >= 2) {
      const pattern = args[0];
      const file = args[1];
      if (file.includes('auth.log')) {
        const node = this.getNode('/var/log/auth.log');
        if (node && node.content) {
          const lines = node.content.split('\n');
          const matches = lines.filter((l) => l.includes(pattern));
          return { output: matches.join('\r\n') + '\r\n' };
        }
      }
    }
    return { output: '' };
  }

  private handleFind(args: string[]): ExecutionResult {
    if (args.includes('-perm') && args.includes('-4000')) {
      return { output: '/usr/local/bin/backup\r\n/usr/bin/sudo\r\n' };
    }
    return { output: '' };
  }

  private handleDocker(args: string[]): ExecutionResult {
    if (args.includes('--version') || args.includes('-v')) {
      return { output: 'Docker version 24.0.5, build ced0996\r\n' };
    }
    const cmd = args[0];
    if (cmd === 'ps')
      return {
        output:
          'CONTAINER ID   IMAGE         COMMAND                  CREATED          STATUS          PORTS                  NAMES\r\na1b2c3d4e5f6   nginx         "/docker-entrypoint.…"   2 minutes ago    Up 2 minutes    0.0.0.0:8080->80/tcp   web-server\r\n',
      };
    if (cmd === 'images')
      return {
        output:
          'REPOSITORY    TAG       IMAGE ID       CREATED        SIZE\r\nnginx         latest    a1b2c3d4e5f6   2 weeks ago    187MB\r\nhello-world   latest    9c7a54a9a43c   4 months ago   13.3kB\r\n',
      };
    if (cmd === 'run') {
      if (args.includes('hello-world'))
        return {
          output:
            '\r\nHello from Docker!\r\nThis message shows that your installation appears to be working correctly.\r\n\r\n',
        };
      if (args.includes('nginx')) return { output: 'a1b2c3d4e5f6\r\n' };
    }
    if (cmd === 'stop') return { output: 'web-server\r\n' };
    if (cmd === 'inspect')
      return {
        output:
          '[\r\n    {\r\n        "Id": "a1b2c3d4e5f6",\r\n        "Name": "web-server",\r\n        "Config": {\r\n            "Env": [\r\n                "SECRET_KEY=SuperSecret123"\r\n            ]\r\n        }\r\n    }\r\n]\r\n',
      };
    return { output: 'docker: command not found or argument not supported in mock\r\n' };
  }

  private handleDockerCompose(args: string[]): ExecutionResult {
    if (args.includes('--version')) return { output: 'Docker Compose version v2.23.0\r\n' };
    const cmd = args[0];
    if (cmd === 'up')
      return {
        output:
          'Creating network "default" with the default driver\r\nCreating web ... done\r\nCreating db  ... done\r\n',
      };
    if (cmd === 'logs')
      return {
        output:
          'web    | Server started on port 3000\r\ndb     | Database ready for connections\r\n',
      };
    if (cmd === 'down')
      return {
        output:
          'Stopping web ... done\r\nStopping db  ... done\r\nRemoving web ... done\r\nRemoving db  ... done\r\n',
      };
    return { output: '' };
  }

  private handleGit(args: string[]): ExecutionResult {
    if (args.includes('--version')) return { output: 'git version 2.40.1\r\n' };
    const cmd = args[0];
    if (cmd === 'status')
      return { output: 'On branch main\r\nnothing to commit, working tree clean\r\n' };
    if (cmd === 'init')
      return { output: `Initialized empty Git repository in ${this.cwd}/.git/\r\n` };
    if (cmd === 'add') return { output: '' };
    if (cmd === 'commit')
      return { output: '[main 1a2b3c4] Initial commit\r\n 1 file changed, 1 insertion(+)\r\n' };
    if (cmd === 'log') {
      if (args.includes('.env'))
        return {
          output:
            'commit 5d6e7f8 (HEAD -> main)\r\nAuthor: visitor <visitor@alex-schneider.dev>\r\nDate:   Jan 28 14:00:00 2024\r\n\r\n    Remove .env file\r\n\r\ncommit 1a2b3c4\r\nAuthor: visitor <visitor@alex-schneider.dev>\r\nDate:   Jan 28 13:00:00 2024\r\n\r\n    Add .env file\r\n',
        };
      return {
        output:
          'commit 1a2b3c4 (HEAD -> main)\r\nAuthor: visitor <visitor@alex-schneider.dev>\r\nDate:   Jan 28 12:00:00 2024\r\n\r\n    Initial commit\r\n',
      };
    }
    if (cmd === 'branch') {
      if (args.length === 1) return { output: '* main\r\n' };
      return { output: '' };
    }
    if (cmd === 'checkout') {
      if (args.includes('.env')) return { output: 'Updated 1 path from 1a2b3c4\r\n' };
      return { output: `Switched to branch '${args[1]}'\r\n` };
    }
    if (cmd === 'merge') return { output: 'Updating 1a2b3c4..5d6e7f8\r\nFast-forward\r\n' };
    return { output: '' };
  }

  private handleHead(args: string[]): ExecutionResult {
    let lines = 10;
    let file = args[0];
    if (args[0] === '-n' && args[1]) {
      lines = parseInt(args[1]);
      file = args[2];
    }
    if (!file) return { output: 'head: missing file\r\n' };

    const node = this.getNode(file);
    if (!node) return { output: `head: cannot open '${file}': No such file or directory\r\n` };
    if (node.type === 'dir') return { output: `head: ${file}: Is a directory\r\n` };

    const content = (node.content || '').split('\n').slice(0, lines);
    return { output: content.join('\r\n') + '\r\n' };
  }

  private handleTail(args: string[]): ExecutionResult {
    let lines = 10;
    let file = args[0];
    if (args[0] === '-n' && args[1]) {
      lines = parseInt(args[1]);
      file = args[2];
    }
    if (!file) return { output: 'tail: missing file\r\n' };

    const node = this.getNode(file);
    if (!node) return { output: `tail: cannot open '${file}': No such file or directory\r\n` };
    if (node.type === 'dir') return { output: `tail: ${file}: Is a directory\r\n` };

    const content = (node.content || '').split('\n').slice(-lines);
    return { output: content.join('\r\n') + '\r\n' };
  }

  private handleWc(args: string[]): ExecutionResult {
    const file = args.find((a) => !a.startsWith('-'));
    if (!file) return { output: 'wc: missing file\r\n' };

    const node = this.getNode(file);
    if (!node) return { output: `wc: ${file}: No such file or directory\r\n` };
    if (node.type === 'dir') return { output: `wc: ${file}: Is a directory\r\n` };

    const content = node.content || '';
    const lineCount = content.split('\n').length;
    const wordCount = content.split(/\s+/).filter((w) => w).length;
    const charCount = content.length;

    if (args.includes('-l')) return { output: `${lineCount} ${file}\r\n` };
    if (args.includes('-w')) return { output: `${wordCount} ${file}\r\n` };
    if (args.includes('-c')) return { output: `${charCount} ${file}\r\n` };
    return { output: `${lineCount} ${wordCount} ${charCount} ${file}\r\n` };
  }

  private handleCp(args: string[]): ExecutionResult {
    const nonFlags = args.filter((a) => !a.startsWith('-'));
    if (nonFlags.length < 2) return { output: 'cp: missing operand\r\n' };

    const source = nonFlags[0];
    const dest = nonFlags[1];

    const sourceNode = this.getNode(source);
    if (!sourceNode)
      return { output: `cp: cannot stat '${source}': No such file or directory\r\n` };

    const destResult = this.getParentNode(dest);
    if (destResult && sourceNode.type === 'file') {
      destResult.node.children![destResult.name] = { type: 'file', content: sourceNode.content };
      return { output: '' };
    }
    return { output: `cp: cannot create '${dest}'\r\n` };
  }

  private handleMv(args: string[]): ExecutionResult {
    if (args.length < 2) return { output: 'mv: missing operand\r\n' };

    // First copy, then remove source
    const cpResult = this.handleCp(args);
    if (cpResult.output === '') {
      const rmResult = this.handleRm([args[0]]);
      return rmResult;
    }
    return cpResult;
  }

  private handleRm(args: string[]): ExecutionResult {
    const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr');
    const target = args.find((a) => !a.startsWith('-'));

    if (!target) return { output: 'rm: missing operand\r\n' };

    const parentResult = this.getParentNode(target);
    if (!parentResult)
      return { output: `rm: cannot remove '${target}': No such file or directory\r\n` };

    const { node: parentNode, name } = parentResult;
    if (!parentNode.children || !parentNode.children[name]) {
      return { output: `rm: cannot remove '${target}': No such file or directory\r\n` };
    }

    const targetNode = parentNode.children[name];
    if (targetNode.type === 'dir' && !recursive) {
      return { output: `rm: cannot remove '${target}': Is a directory\r\n` };
    }

    delete parentNode.children[name];
    return { output: '' };
  }

  private handleUname(args: string[]): ExecutionResult {
    if (args.includes('-a')) {
      return { output: 'Linux alex-schneider.dev 5.15.0-generic #1 SMP x86_64 GNU/Linux\r\n' };
    }
    if (args.includes('-r')) return { output: '5.15.0-generic\r\n' };
    if (args.includes('-n')) return { output: 'alex-schneider.dev\r\n' };
    return { output: 'Linux\r\n' };
  }
}
