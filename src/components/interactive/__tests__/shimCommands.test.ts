import { describe, it, expect } from 'vitest';
import { SHIM_COMMANDS } from '../shimCommands';

describe('shimCommands', () => {
  describe('SHIM_COMMANDS', () => {
    it('should export all expected Linux commands', () => {
      const expectedCommands = [
        'whoami',
        'pwd',
        'ls',
        'cat',
        'mkdir',
        'touch',
        'rm',
        'cp',
        'mv',
        'echo',
        'clear',
        'date',
        'uptime',
        'hostname',
        'uname',
        'node',
        'npm',
        'npx',
        'python3',
        'pip3',
        'curl',
        'wget',
        'ps',
        'kill',
        'top',
        'free',
        'df',
        'du',
        'find',
        'grep',
        'head',
        'tail',
        'wc',
        'sort',
        'uniq',
        'cut',
        'awk',
        'sed',
        'chmod',
        'chown',
        'ln',
        'readlink',
        'basename',
        'dirname',
        'realpath',
        'file',
        'which',
        'env',
        'export',
      ];

      expectedCommands.forEach((cmd) => {
        expect(SHIM_COMMANDS).toHaveProperty(cmd);
      });
    });

    it('should have 49 commands total', () => {
      expect(Object.keys(SHIM_COMMANDS).length).toBe(49);
    });

    it('should have valid structure for each command', () => {
      Object.entries(SHIM_COMMANDS).forEach(([_name, shim]) => {
        expect(shim).toHaveProperty('file');
        expect(shim.file).toHaveProperty('contents');
        expect(typeof shim.file.contents).toBe('string');
        expect(shim.file.contents.length).toBeGreaterThan(0);
      });
    });

    it('should have shebang in all commands', () => {
      Object.entries(SHIM_COMMANDS).forEach(([_name, shim]) => {
        expect(shim.file.contents).toMatch(/^#!\/usr\/bin\/env node/);
      });
    });

    it('should have basic commands with simple output', () => {
      expect(SHIM_COMMANDS.whoami.file.contents).toContain("console.log('visitor')");
      expect(SHIM_COMMANDS.pwd.file.contents).toContain('console.log(process.cwd())');
      expect(SHIM_COMMANDS.hostname.file.contents).toContain("console.log('linux')");
    });

    it('should have ls command with fs operations', () => {
      expect(SHIM_COMMANDS.ls.file.contents).toContain("const fs = require('fs')");
      expect(SHIM_COMMANDS.ls.file.contents).toContain('fs.readdirSync');
    });

    it('should have file manipulation commands', () => {
      expect(SHIM_COMMANDS.cp.file.contents).toContain('fs.copyFileSync');
      expect(SHIM_COMMANDS.mv.file.contents).toContain('fs.renameSync');
      expect(SHIM_COMMANDS.rm.file.contents).toContain('fs.rmSync');
    });

    it('should have network commands', () => {
      expect(SHIM_COMMANDS.curl.file.contents).toContain("require('https')");
      expect(SHIM_COMMANDS.wget.file.contents).toContain('fs.createWriteStream');
    });

    it('should have text processing commands', () => {
      expect(SHIM_COMMANDS.grep.file.contents).toContain('RegExp');
      expect(SHIM_COMMANDS.sort.file.contents).toContain('.sort()');
      expect(SHIM_COMMANDS.wc.file.contents).toContain('.split(');
    });

    it('should have path manipulation commands', () => {
      expect(SHIM_COMMANDS.basename.file.contents).toContain("require('path')");
      expect(SHIM_COMMANDS.dirname.file.contents).toContain('path.dirname');
      expect(SHIM_COMMANDS.realpath.file.contents).toContain('path.resolve');
    });

    it('should have process management commands', () => {
      expect(SHIM_COMMANDS.ps.file.contents).toContain('PID TTY');
      expect(SHIM_COMMANDS.kill.file.contents).toContain('simulated');
      expect(SHIM_COMMANDS.top.file.contents).toContain('load average');
    });

    it('should have system info commands', () => {
      expect(SHIM_COMMANDS.free.file.contents).toContain('Mem:');
      expect(SHIM_COMMANDS.df.file.contents).toContain('Filesystem');
      expect(SHIM_COMMANDS.uname.file.contents).toContain('Linux');
    });

    it('should have environment commands', () => {
      expect(SHIM_COMMANDS.env.file.contents).toContain('USER=visitor');
      expect(SHIM_COMMANDS.env.file.contents).toContain('HOME=/home/visitor');
      expect(SHIM_COMMANDS.export.file.contents).toContain('declare -x');
    });

    it('should have package manager commands', () => {
      expect(SHIM_COMMANDS.npm.file.contents).toContain("execSync('npm '");
      expect(SHIM_COMMANDS.npx.file.contents).toContain("execSync('npx '");
      expect(SHIM_COMMANDS.python3.file.contents).toContain("execSync('python3 '");
    });
  });

  describe('Command categories', () => {
    it('should have file system commands', () => {
      const fsCommands = ['ls', 'cat', 'mkdir', 'touch', 'rm', 'cp', 'mv'];
      fsCommands.forEach((cmd) => {
        expect(SHIM_COMMANDS[cmd as keyof typeof SHIM_COMMANDS]).toBeDefined();
      });
    });

    it('should have text processing commands', () => {
      const textCommands = ['grep', 'head', 'tail', 'wc', 'sort', 'uniq', 'cut'];
      textCommands.forEach((cmd) => {
        expect(SHIM_COMMANDS[cmd as keyof typeof SHIM_COMMANDS]).toBeDefined();
      });
    });

    it('should have network commands', () => {
      const networkCommands = ['curl', 'wget'];
      networkCommands.forEach((cmd) => {
        expect(SHIM_COMMANDS[cmd as keyof typeof SHIM_COMMANDS]).toBeDefined();
      });
    });

    it('should have system commands', () => {
      const systemCommands = ['ps', 'kill', 'top', 'free', 'df', 'du', 'uname'];
      systemCommands.forEach((cmd) => {
        expect(SHIM_COMMANDS[cmd as keyof typeof SHIM_COMMANDS]).toBeDefined();
      });
    });

    it('should have path commands', () => {
      const pathCommands = ['basename', 'dirname', 'realpath', 'readlink', 'ln'];
      pathCommands.forEach((cmd) => {
        expect(SHIM_COMMANDS[cmd as keyof typeof SHIM_COMMANDS]).toBeDefined();
      });
    });
  });

  describe('Command script validation', () => {
    it('should have error handling in file operations', () => {
      const fsCommands = ['ls', 'cat', 'mkdir', 'rm', 'cp', 'mv'];
      fsCommands.forEach((cmd) => {
        const script = SHIM_COMMANDS[cmd as keyof typeof SHIM_COMMANDS].file.contents;
        expect(script).toMatch(/try\s*\{|catch\s*\(.*\)\s*\{/);
      });
    });

    it('should have argument parsing in commands', () => {
      const commandsWithArgs = ['ls', 'cat', 'mkdir', 'rm', 'grep', 'head', 'tail'];
      commandsWithArgs.forEach((cmd) => {
        const script = SHIM_COMMANDS[cmd as keyof typeof SHIM_COMMANDS].file.contents;
        expect(script).toContain('process.argv.slice');
      });
    });

    it('should have proper exit codes in error cases', () => {
      const commandsWithExit = ['ls', 'cat', 'mkdir', 'rm', 'grep'];
      commandsWithExit.forEach((cmd) => {
        const script = SHIM_COMMANDS[cmd as keyof typeof SHIM_COMMANDS].file.contents;
        expect(script).toContain('process.exit(1)');
      });
    });
  });
});
