import { describe, it, expect, beforeEach } from 'vitest';
import { MockLinuxSystem } from '../MockLinuxSystem';

describe('MockLinuxSystem', () => {
  let system: MockLinuxSystem;

  beforeEach(() => {
    system = new MockLinuxSystem();
  });

  describe('initial state', () => {
    it('starts in the visitor home directory', () => {
      expect(system.getCwd()).toBe('/home/visitor');
    });

    it('renders a prompt with user, hostname and the home path shortened to ~', () => {
      const prompt = system.getPrompt();
      expect(prompt).toContain('visitor@alexle135.de');
      expect(prompt).toContain('~');
      expect(prompt).toContain('$');
    });

    it('shortens the prompt path after changing into a subdirectory', () => {
      system.processCommand('cd projekte');
      const prompt = system.getPrompt();
      expect(prompt).toContain('~/projekte');
    });
  });

  describe('getCompletions', () => {
    it('completes known top-level commands by prefix', () => {
      expect(system.getCompletions('who')).toEqual(['whoami']);
    });

    it('returns every command for an empty prefix', () => {
      const completions = system.getCompletions('');
      expect(completions).toContain('ls');
      expect(completions).toContain('cd');
      expect(completions.length).toBeGreaterThan(10);
    });

    it('completes filenames in the current directory for the second argument', () => {
      const completions = system.getCompletions('cat wel');
      expect(completions).toEqual(['welcome.txt']);
    });

    it('includes dotfiles plus . and .. when completing a dot-prefixed argument', () => {
      const completions = system.getCompletions('ls .');
      expect(completions).toEqual(expect.arrayContaining(['.secret', '.', '..']));
      expect(completions).not.toContain('welcome.txt');
    });

    it('returns no completions for an unmatched prefix', () => {
      expect(system.getCompletions('zzz')).toEqual([]);
    });
  });

  describe('processCommand: basics', () => {
    it('returns empty output for an empty command', () => {
      expect(system.processCommand('')).toEqual({ output: '' });
    });

    it('returns empty output for a whitespace-only command', () => {
      expect(system.processCommand('   ')).toEqual({ output: '' });
    });

    it('reports the current user for whoami', () => {
      expect(system.processCommand('whoami')).toEqual({ output: 'visitor\r\n' });
    });

    it('reports the working directory for pwd', () => {
      expect(system.processCommand('pwd')).toEqual({ output: '/home/visitor\r\n' });
    });

    it('echoes arguments joined by spaces', () => {
      expect(system.processCommand('echo hello world')).toEqual({ output: 'hello world\r\n' });
    });

    it('signals a clear on the clear command', () => {
      expect(system.processCommand('clear')).toEqual({ output: '', clear: true });
    });

    it('reports command not found for unknown commands', () => {
      expect(system.processCommand('frobnicate')).toEqual({
        output: 'bash: frobnicate: command not found\r\n',
      });
    });

    it('grants root access for the CTF backup binary via full path', () => {
      const result = system.processCommand('/usr/local/bin/backup');
      expect(result.output).toContain('Congratulations! You have obtained root access!');
    });

    it('grants root access for the CTF backup binary via relative path', () => {
      const result = system.processCommand('./backup');
      expect(result.output).toContain('Congratulations! You have obtained root access!');
    });

    it('reports uid/gid for id', () => {
      expect(system.processCommand('id')).toEqual({
        output: 'uid=1000(visitor) gid=1000(visitor) groups=1000(visitor)\r\n',
      });
    });

    it('reports the hostname', () => {
      expect(system.processCommand('hostname')).toEqual({ output: 'alexle135.de\r\n' });
    });

    it('returns a date string ending with CRLF', () => {
      const result = system.processCommand('date');
      expect(result.output.endsWith('\r\n')).toBe(true);
      expect(result.output.length).toBeGreaterThan(2);
    });

    it('returns a canned bash history', () => {
      const result = system.processCommand('history');
      expect(result.output).toContain('whoami');
      expect(result.output).toContain('history');
    });

    it('renders a man page referencing the requested command', () => {
      const result = system.processCommand('man ls');
      expect(result.output).toContain('LS(1)');
      expect(result.output).toContain('ls - simulated man page');
    });

    it('renders a generic man page without an argument', () => {
      const result = system.processCommand('man');
      expect(result.output).toContain('COMMAND(1)');
    });

    it('resolves which for a known command', () => {
      expect(system.processCommand('which ls')).toEqual({ output: '/bin/ls\r\n' });
    });

    it('returns empty output for which without an argument', () => {
      expect(system.processCommand('which')).toEqual({ output: '' });
    });

    it('lists environment variables for env', () => {
      const result = system.processCommand('env');
      expect(result.output).toContain('USER=visitor');
      expect(result.output).toContain('PWD=/home/visitor');
    });

    it('declares exported variables for export', () => {
      const result = system.processCommand('export');
      expect(result.output).toContain('declare -x USER="visitor"');
    });

    it('returns empty output for chmod and chown', () => {
      expect(system.processCommand('chmod +x file')).toEqual({ output: '' });
      expect(system.processCommand('chown user file')).toEqual({ output: '' });
    });
  });

  describe('uname', () => {
    it('handles -a', () => {
      expect(system.processCommand('uname -a').output).toContain('Linux alexle135.de');
    });

    it('handles -r', () => {
      expect(system.processCommand('uname -r')).toEqual({ output: '5.15.0-generic\r\n' });
    });

    it('handles -n', () => {
      expect(system.processCommand('uname -n')).toEqual({ output: 'alexle135.de\r\n' });
    });

    it('defaults to the kernel name', () => {
      expect(system.processCommand('uname')).toEqual({ output: 'Linux\r\n' });
    });
  });

  describe('ls', () => {
    it('lists visible entries of the home directory by default', () => {
      const result = system.processCommand('ls');
      expect(result.output).toContain('welcome.txt');
      expect(result.output).toContain('README.md');
      expect(result.output).toContain('projekte');
      expect(result.output).not.toContain('.secret');
    });

    it('shows hidden files with -a', () => {
      const result = system.processCommand('ls -a');
      expect(result.output).toContain('.secret');
    });

    it('shows a long listing with -l including permissions and size', () => {
      const result = system.processCommand('ls -l');
      expect(result.output).toContain('total');
      expect(result.output).toMatch(/-rw-r--r--/);
      expect(result.output).toMatch(/drwxr-xr-x/);
    });

    it('combines hidden and long listing with -la', () => {
      const result = system.processCommand('ls -la');
      expect(result.output).toContain('.secret');
      expect(result.output).toContain('total');
    });

    it('reports an empty directory as empty output', () => {
      expect(system.processCommand('ls projekte')).toEqual({ output: '' });
    });

    it('lists just the path when given a file', () => {
      expect(system.processCommand('ls welcome.txt')).toEqual({ output: 'welcome.txt\r\n' });
    });

    it('reports an error for a nonexistent path', () => {
      const result = system.processCommand('ls /nope');
      expect(result.output).toBe("ls: cannot access '/nope': No such file or directory\r\n");
    });
  });

  describe('cd', () => {
    it('resets to the home directory with no arguments', () => {
      system.processCommand('cd /var/log');
      const result = system.processCommand('cd');
      expect(result.output).toBe('');
      expect(system.getCwd()).toBe('/home/visitor');
    });

    it('changes into a relative subdirectory', () => {
      const result = system.processCommand('cd projekte');
      expect(result.newCwd).toBe('/home/visitor/projekte');
      expect(system.getCwd()).toBe('/home/visitor/projekte');
    });

    it('changes into an absolute directory', () => {
      system.processCommand('cd /var/log');
      expect(system.getCwd()).toBe('/var/log');
    });

    it('navigates up with ..', () => {
      system.processCommand('cd projekte');
      system.processCommand('cd ..');
      expect(system.getCwd()).toBe('/home/visitor');
    });

    it('resolves ~ to the home directory', () => {
      system.processCommand('cd /var/log');
      system.processCommand('cd ~');
      expect(system.getCwd()).toBe('/home/visitor');
    });

    it('resolves ~/subpath', () => {
      system.processCommand('cd /var/log');
      const result = system.processCommand('cd ~/projekte');
      expect(result.newCwd).toBe('/home/visitor/projekte');
    });

    it('reports an error and keeps cwd for a nonexistent directory', () => {
      const result = system.processCommand('cd /nope');
      expect(result.output).toBe('bash: cd: /nope: No such file or directory\r\n');
      expect(system.getCwd()).toBe('/home/visitor');
    });

    it('reports an error when trying to cd into a file', () => {
      const result = system.processCommand('cd welcome.txt');
      expect(result.output).toBe('bash: cd: welcome.txt: No such file or directory\r\n');
    });
  });

  describe('mkdir', () => {
    it('reports a missing operand with no arguments', () => {
      expect(system.processCommand('mkdir')).toEqual({ output: 'mkdir: missing operand\r\n' });
    });

    it('creates a new directory that can be entered afterwards', () => {
      const result = system.processCommand('mkdir newdir');
      expect(result.output).toBe('');
      const cd = system.processCommand('cd newdir');
      expect(cd.newCwd).toBe('/home/visitor/newdir');
    });

    it('reports an error when the directory already exists', () => {
      system.processCommand('mkdir dupdir');
      const result = system.processCommand('mkdir dupdir');
      expect(result.output).toBe("mkdir: cannot create directory 'dupdir': File exists\r\n");
    });

    it('reports an error when the parent directory does not exist', () => {
      const result = system.processCommand('mkdir /nope/child');
      expect(result.output).toBe(
        "mkdir: cannot create directory '/nope/child': No such file or directory\r\n"
      );
    });
  });

  describe('touch', () => {
    it('reports a missing file operand with no arguments', () => {
      expect(system.processCommand('touch')).toEqual({ output: 'touch: missing file operand\r\n' });
    });

    it('creates a new empty file readable via cat', () => {
      system.processCommand('touch newfile.txt');
      const result = system.processCommand('cat newfile.txt');
      expect(result.output).toBe('\r\n');
    });

    it('is a no-op success when the file already exists', () => {
      const result = system.processCommand('touch welcome.txt');
      expect(result.output).toBe('');
      const cat = system.processCommand('cat welcome.txt');
      expect(cat.output).toContain('Willkommen');
    });

    it('reports an error when the parent directory does not exist', () => {
      const result = system.processCommand('touch /nope/child.txt');
      expect(result.output).toBe(
        "touch: cannot touch '/nope/child.txt': No such file or directory\r\n"
      );
    });
  });

  describe('cat', () => {
    it('reports a missing operand with no arguments', () => {
      expect(system.processCommand('cat')).toEqual({ output: 'cat: missing operand\r\n' });
    });

    it('prints file contents', () => {
      const result = system.processCommand('cat README.md');
      expect(result.output).toBe('# README\nThis is a test file.\r\n');
    });

    it('reports an error for a nonexistent file', () => {
      const result = system.processCommand('cat nope.txt');
      expect(result.output).toBe('cat: nope.txt: No such file or directory\r\n');
    });

    it('reports an error when the target is a directory', () => {
      const result = system.processCommand('cat projekte');
      expect(result.output).toBe('cat: projekte: Is a directory\r\n');
    });
  });

  describe('grep', () => {
    it('filters auth.log lines by pattern', () => {
      const result = system.processCommand('grep Failed /var/log/auth.log');
      const lines = result.output.trim().split('\r\n');
      expect(lines).toHaveLength(3);
      expect(lines.every((l) => l.includes('Failed'))).toBe(true);
    });

    it('returns empty output for files other than auth.log', () => {
      expect(system.processCommand('grep Failed README.md')).toEqual({ output: '' });
    });

    it('returns empty output with fewer than two arguments', () => {
      expect(system.processCommand('grep Failed')).toEqual({ output: '' });
    });
  });

  describe('find', () => {
    it('reports SUID binaries for -perm -4000', () => {
      const result = system.processCommand('find / -perm -4000');
      expect(result.output).toBe('/usr/local/bin/backup\r\n/usr/bin/sudo\r\n');
    });

    it('returns empty output for unsupported find invocations', () => {
      expect(system.processCommand('find / -name foo')).toEqual({ output: '' });
    });
  });

  describe('head and tail', () => {
    it('head defaults to 10 lines', () => {
      const result = system.processCommand('head /var/log/auth.log');
      expect(result.output.split('\r\n').length).toBeLessThanOrEqual(11);
    });

    it('head respects -n', () => {
      const result = system.processCommand('head -n 1 /var/log/auth.log');
      expect(result.output).toBe(
        'Jan 28 14:32:45 server sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2\r\n'
      );
    });

    it('tail respects -n', () => {
      const result = system.processCommand('tail -n 1 /var/log/auth.log');
      expect(result.output).toBe(
        'Jan 28 14:33:12 server sshd[1235]: Accepted password for admin from 192.168.1.100 port 22 ssh2\r\n'
      );
    });

    it('head reports a missing file', () => {
      expect(system.processCommand('head')).toEqual({ output: 'head: missing file\r\n' });
    });

    it('tail reports a missing file', () => {
      expect(system.processCommand('tail')).toEqual({ output: 'tail: missing file\r\n' });
    });

    it('head reports an error for a nonexistent file', () => {
      const result = system.processCommand('head nope.txt');
      expect(result.output).toBe("head: cannot open 'nope.txt': No such file or directory\r\n");
    });

    it('tail reports an error for a directory', () => {
      const result = system.processCommand('tail projekte');
      expect(result.output).toBe('tail: projekte: Is a directory\r\n');
    });
  });

  describe('wc', () => {
    it('reports line, word and char counts by default', () => {
      const result = system.processCommand('wc README.md');
      expect(result.output).toBe('2 7 29 README.md\r\n');
    });

    it('reports only lines with -l', () => {
      expect(system.processCommand('wc -l README.md')).toEqual({ output: '2 README.md\r\n' });
    });

    it('reports only words with -w', () => {
      expect(system.processCommand('wc -w README.md')).toEqual({ output: '7 README.md\r\n' });
    });

    it('reports only chars with -c', () => {
      expect(system.processCommand('wc -c README.md')).toEqual({ output: '29 README.md\r\n' });
    });

    it('reports a missing file with no arguments', () => {
      expect(system.processCommand('wc')).toEqual({ output: 'wc: missing file\r\n' });
    });

    it('reports an error for a nonexistent file', () => {
      expect(system.processCommand('wc nope.txt')).toEqual({
        output: 'wc: nope.txt: No such file or directory\r\n',
      });
    });

    it('reports an error for a directory', () => {
      expect(system.processCommand('wc projekte')).toEqual({
        output: 'wc: projekte: Is a directory\r\n',
      });
    });
  });

  describe('cp, mv and rm', () => {
    it('cp reports a missing operand with fewer than two arguments', () => {
      expect(system.processCommand('cp onlyone')).toEqual({ output: 'cp: missing operand\r\n' });
    });

    it('cp copies file content to a new destination', () => {
      const result = system.processCommand('cp README.md copy.md');
      expect(result.output).toBe('');
      const cat = system.processCommand('cat copy.md');
      expect(cat.output).toBe('# README\nThis is a test file.\r\n');
    });

    it('cp reports an error for a nonexistent source', () => {
      const result = system.processCommand('cp nope.txt dest.txt');
      expect(result.output).toBe("cp: cannot stat 'nope.txt': No such file or directory\r\n");
    });

    it('cp refuses to copy a directory', () => {
      const result = system.processCommand('cp projekte destdir');
      expect(result.output).toBe("cp: cannot create 'destdir'\r\n");
    });

    it('mv moves a file, removing the source', () => {
      system.processCommand('mv README.md moved.md');
      expect(system.processCommand('cat README.md')).toEqual({
        output: 'cat: README.md: No such file or directory\r\n',
      });
      const cat = system.processCommand('cat moved.md');
      expect(cat.output).toBe('# README\nThis is a test file.\r\n');
    });

    it('mv reports a missing operand with fewer than two arguments', () => {
      expect(system.processCommand('mv onlyone')).toEqual({ output: 'mv: missing operand\r\n' });
    });

    it('mv surfaces the underlying cp error when the source is missing', () => {
      const result = system.processCommand('mv nope.txt dest.txt');
      expect(result.output).toBe("cp: cannot stat 'nope.txt': No such file or directory\r\n");
    });

    it('rm reports a missing operand with no arguments', () => {
      expect(system.processCommand('rm')).toEqual({ output: 'rm: missing operand\r\n' });
    });

    it('rm removes a file', () => {
      system.processCommand('rm welcome.txt');
      expect(system.processCommand('cat welcome.txt')).toEqual({
        output: 'cat: welcome.txt: No such file or directory\r\n',
      });
    });

    it('rm refuses to remove a directory without -r', () => {
      const result = system.processCommand('rm projekte');
      expect(result.output).toBe("rm: cannot remove 'projekte': Is a directory\r\n");
    });

    it('rm removes a directory recursively with -r', () => {
      const result = system.processCommand('rm -r projekte');
      expect(result.output).toBe('');
      expect(system.processCommand('ls projekte').output).toBe(
        "ls: cannot access 'projekte': No such file or directory\r\n"
      );
    });

    it('rm reports an error for a nonexistent target', () => {
      const result = system.processCommand('rm nope.txt');
      expect(result.output).toBe("rm: cannot remove 'nope.txt': No such file or directory\r\n");
    });
  });

  describe('docker', () => {
    it('reports the version', () => {
      expect(system.processCommand('docker --version').output).toContain('Docker version');
    });

    it('lists containers for ps', () => {
      expect(system.processCommand('docker ps').output).toContain('CONTAINER ID');
    });

    it('lists images for images', () => {
      expect(system.processCommand('docker images').output).toContain('REPOSITORY');
    });

    it('runs hello-world', () => {
      expect(system.processCommand('docker run hello-world').output).toContain(
        'Hello from Docker!'
      );
    });

    it('runs nginx and returns a container id', () => {
      expect(system.processCommand('docker run nginx')).toEqual({ output: 'a1b2c3d4e5f6\r\n' });
    });

    it('stops a container', () => {
      expect(system.processCommand('docker stop web-server')).toEqual({
        output: 'web-server\r\n',
      });
    });

    it('inspects a container', () => {
      expect(system.processCommand('docker inspect web-server').output).toContain('SECRET_KEY');
    });

    it('reports unsupported subcommands', () => {
      expect(system.processCommand('docker unsupported')).toEqual({
        output: 'docker: command not found or argument not supported in mock\r\n',
      });
    });
  });

  describe('docker-compose', () => {
    it('reports the version', () => {
      expect(system.processCommand('docker-compose --version')).toEqual({
        output: 'Docker Compose version v2.23.0\r\n',
      });
    });

    it('brings services up', () => {
      expect(system.processCommand('docker-compose up').output).toContain('Creating web');
    });

    it('shows logs', () => {
      expect(system.processCommand('docker-compose logs').output).toContain('Server started');
    });

    it('tears services down', () => {
      expect(system.processCommand('docker-compose down').output).toContain('Removing web');
    });

    it('returns empty output for unsupported subcommands', () => {
      expect(system.processCommand('docker-compose unsupported')).toEqual({ output: '' });
    });
  });

  describe('git', () => {
    it('reports the version', () => {
      expect(system.processCommand('git --version')).toEqual({ output: 'git version 2.40.1\r\n' });
    });

    it('reports status', () => {
      expect(system.processCommand('git status').output).toContain('On branch main');
    });

    it('initializes a repository in the current directory', () => {
      const result = system.processCommand('git init');
      expect(result.output).toBe('Initialized empty Git repository in /home/visitor/.git/\r\n');
    });

    it('stages files silently', () => {
      expect(system.processCommand('git add .')).toEqual({ output: '' });
    });

    it('commits changes', () => {
      expect(system.processCommand('git commit -m msg').output).toContain('Initial commit');
    });

    it('logs a generic history by default', () => {
      expect(system.processCommand('git log').output).toContain('Initial commit');
    });

    it('logs the .env-specific history when referenced', () => {
      const result = system.processCommand('git log .env');
      expect(result.output).toContain('Remove .env file');
      expect(result.output).toContain('Add .env file');
    });

    it('shows the current branch for a bare branch call', () => {
      expect(system.processCommand('git branch')).toEqual({ output: '* main\r\n' });
    });

    it('returns empty output when creating a branch', () => {
      expect(system.processCommand('git branch feature')).toEqual({ output: '' });
    });

    it('checks out .env with a canned restore message', () => {
      const result = system.processCommand('git checkout .env');
      expect(result.output).toBe('Updated 1 path from 1a2b3c4\r\n');
    });

    it('checks out a named branch', () => {
      expect(system.processCommand('git checkout main')).toEqual({
        output: "Switched to branch 'main'\r\n",
      });
    });

    it('merges branches', () => {
      expect(system.processCommand('git merge feature').output).toContain('Fast-forward');
    });

    it('returns empty output for unsupported subcommands', () => {
      expect(system.processCommand('git unsupported')).toEqual({ output: '' });
    });
  });

  describe('pipes', () => {
    it('decodes a base64-encoded secret piped through base64 -d', () => {
      const result = system.processCommand("echo 'U3VwZXJTZWNyZXQxMjM=' | base64 -d");
      expect(result.output).toBe('SuperSecret123\r\n');
    });

    it('reports invalid input for undecodable base64', () => {
      const result = system.processCommand("echo 'Q' | base64 -d");
      expect(result.output).toBe('base64: invalid input\r\n');
    });

    it('returns the canned Log Detective output for a Failed-password pipeline', () => {
      const result = system.processCommand(
        "grep Failed /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -nr | head -1"
      );
      expect(result.output).toBe('      3 192.168.1.100\r\n');
    });

    it('returns the canned Accepted-password pipeline output', () => {
      const result = system.processCommand("grep Accepted /var/log/auth.log | awk '{print $9}'");
      expect(result.output).toContain('Accepted password for admin');
    });

    it('filters a simple command output through grep', () => {
      const result = system.processCommand('ls -la | grep welcome');
      expect(result.output).toContain('welcome.txt');
      expect(result.output).not.toContain('README.md');
    });

    it('falls back to a generic pipeline message for unrecognized pipes', () => {
      const result = system.processCommand('foo | bar');
      expect(result.output).toBe('Pipeline executed (simplified mock mode).\r\n');
    });
  });
});
