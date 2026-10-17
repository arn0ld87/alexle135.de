import { describe, it, expect, beforeEach } from 'vitest';
import { MockWindowsSystem } from '../MockWindowsSystem';

describe('MockWindowsSystem', () => {
  let sys: MockWindowsSystem;

  beforeEach(() => {
    sys = new MockWindowsSystem();
  });

  describe('initial state', () => {
    it('starts in cmd mode with the visitor home as cwd', () => {
      expect(sys.getMode()).toBe('cmd');
      expect(sys.getPrompt()).toBe('C:\\Users\\visitor>');
    });

    it('processCommand ignores empty/whitespace-only input', () => {
      expect(sys.processCommand('')).toEqual({ output: '' });
      expect(sys.processCommand('    ')).toEqual({ output: '' });
    });
  });

  describe('mode switching', () => {
    it('switches from cmd to powershell (case-insensitive) and updates prompt', () => {
      const result = sys.processCommand('PowerShell');
      expect(result.output).toContain('Windows PowerShell');
      expect(sys.getMode()).toBe('powershell');
      expect(sys.getPrompt()).toBe('PS C:\\Users\\visitor> ');
    });

    it('switches from cmd to diskpart and updates prompt', () => {
      const result = sys.processCommand('diskpart');
      expect(result.output).toContain('Microsoft DiskPart-Version');
      expect(sys.getMode()).toBe('diskpart');
      expect(sys.getPrompt()).toBe('DISKPART> ');
    });

    it('exits powershell back to cmd', () => {
      sys.processCommand('powershell');
      const result = sys.processCommand('exit');
      expect(result.output).toBe('');
      expect(sys.getMode()).toBe('cmd');
    });

    it('exits diskpart back to cmd and resets selection state', () => {
      sys.processCommand('diskpart');
      sys.processCommand('select disk 1');
      const result = sys.processCommand('exit');
      expect(result.output).toContain('DiskPart wird beendet');
      expect(sys.getMode()).toBe('cmd');

      // Selection reset is observable: re-entering diskpart and listing disks
      // shows no leading selection marker anymore (the trailing '*' per line
      // is a fixed GPT-column marker, unrelated to selection).
      sys.processCommand('diskpart');
      const list = sys.processCommand('list disk');
      expect(list.output).not.toMatch(/^\* Datenträger/m);
    });
  });

  describe('cmd: drive switching', () => {
    it('switches to an existing drive via bare drive letter', () => {
      const result = sys.processCommand('D:');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('D:\\>');
    });

    it('errors on an unknown drive letter', () => {
      const result = sys.processCommand('X:');
      expect(result.output).toContain('kann das angegebene Laufwerk nicht finden');
    });
  });

  describe('cmd: cd / path resolution', () => {
    it('cd with no args prints the current directory', () => {
      const result = sys.processCommand('cd');
      expect(result.output).toBe('C:\\Users\\visitor\r\n');
    });

    it('cd into an existing relative subdirectory', () => {
      const result = sys.processCommand('cd Desktop');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('C:\\Users\\visitor\\Desktop>');
    });

    it('cd .. moves up one directory', () => {
      sys.processCommand('cd Desktop');
      const result = sys.processCommand('cd ..');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('C:\\Users\\visitor>');
    });

    it('cd .. at drive root stays at the root', () => {
      sys.processCommand('D:');
      const result = sys.processCommand('cd ..');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('D:\\>');
    });

    it('normalizes forward slashes within an already-backslash-rooted absolute path', () => {
      // resolvePath only recognizes an absolute path when the drive is
      // followed by a backslash (`C:\`); a bare `C:/...` is treated as
      // relative instead. Forward slashes further into an absolute path
      // are normalized to backslashes.
      const result = sys.processCommand('cd C:\\Users/visitor/Documents');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('C:\\Users\\visitor\\Documents>');
    });

    it('cd to another drive by absolute path', () => {
      const result = sys.processCommand('cd D:\\Backup');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('D:\\Backup>');
    });

    it('cd into a rooted path on the current drive (leading backslash)', () => {
      sys.processCommand('cd Desktop');
      const result = sys.processCommand('cd \\Users\\visitor\\Downloads');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('C:\\Users\\visitor\\Downloads>');
    });

    it('errors when cd target does not exist', () => {
      const result = sys.processCommand('cd DoesNotExist');
      expect(result.output).toContain('kann den angegebenen Pfad nicht finden');
    });

    it('errors when cd target is a file, not a directory', () => {
      const result = sys.processCommand('cd welcome.txt');
      expect(result.output).toContain('kann den angegebenen Pfad nicht finden');
    });

    it('is case-insensitive when resolving directory names', () => {
      // getNode() matches directory names case-insensitively, but the
      // resolved cwd retains the casing the user typed.
      const result = sys.processCommand('cd desktop');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('C:\\Users\\visitor\\desktop>');
    });
  });

  describe('cmd: cls', () => {
    it('clears the screen', () => {
      const result = sys.processCommand('cls');
      expect(result).toEqual({ output: '', clear: true });
    });
  });

  describe('cmd: dir', () => {
    it('lists the current directory with files and subdirectories', () => {
      const result = sys.processCommand('dir');
      expect(result.output).toContain('Verzeichnis von C:\\Users\\visitor');
      expect(result.output).toContain('<DIR>          Desktop');
      expect(result.output).toContain('welcome.txt');
      expect(result.output).toContain('5 Datei(en)');
    });

    it('lists an explicit target directory', () => {
      const result = sys.processCommand('dir D:\\');
      expect(result.output).toContain('Verzeichnis von D:\\');
      expect(result.output).toContain('Backup');
      expect(result.output).toContain('Images');
    });

    it('errors when target does not exist', () => {
      const result = sys.processCommand('dir NoSuchDir');
      expect(result.output).toBe('Datei nicht gefunden.\r\n');
    });

    it('errors when target is a file', () => {
      const result = sys.processCommand('dir welcome.txt');
      expect(result.output).toBe('Datei nicht gefunden.\r\n');
    });
  });

  describe('cmd: mkdir / md', () => {
    it('creates a new directory', () => {
      const result = sys.processCommand('mkdir NewFolder');
      expect(result.output).toBe('');
      const dirResult = sys.processCommand('dir');
      expect(dirResult.output).toContain('NewFolder');
    });

    it('md is an alias for mkdir', () => {
      const result = sys.processCommand('md AnotherFolder');
      expect(result.output).toBe('');
      expect(sys.processCommand('dir').output).toContain('AnotherFolder');
    });

    it('errors with no arguments', () => {
      const result = sys.processCommand('mkdir');
      expect(result.output).toBe('Syntaxfehler.\r\n');
    });

    it('errors when the directory already exists', () => {
      const result = sys.processCommand('mkdir Desktop');
      expect(result.output).toContain('existiert bereits');
    });

    it('errors when the parent path cannot be resolved', () => {
      const result = sys.processCommand('mkdir C:');
      expect(result.output).toBe('Der Pfad wurde nicht gefunden.\r\n');
    });
  });

  describe('cmd: echo', () => {
    it('echoes the given arguments', () => {
      const result = sys.processCommand('echo Hello World');
      expect(result.output).toBe('Hello World\r\n');
    });

    it('echoes nothing when called without arguments', () => {
      const result = sys.processCommand('echo');
      expect(result.output).toBe('\r\n');
    });
  });

  describe('cmd: type', () => {
    it('prints file contents', () => {
      const result = sys.processCommand('type welcome.txt');
      expect(result.output).toContain('Willkommen im interaktiven Terminal');
    });

    it('errors with no arguments', () => {
      const result = sys.processCommand('type');
      expect(result.output).toBe('Syntaxfehler.\r\n');
    });

    it('errors when the file does not exist', () => {
      const result = sys.processCommand('type nope.txt');
      expect(result.output).toContain('kann die angegebene Datei nicht finden');
    });

    it('errors when the target is a directory', () => {
      const result = sys.processCommand('type Desktop');
      expect(result.output).toContain('kann die angegebene Datei nicht finden');
    });
  });

  describe('cmd: misc info commands', () => {
    it('ver reports a fixed version string', () => {
      expect(sys.processCommand('ver').output).toContain('Microsoft Windows [Version');
    });

    it('help lists the available commands', () => {
      expect(sys.processCommand('help').output).toContain('Verfügbare Befehle');
    });

    it('ipconfig prints network configuration', () => {
      const result = sys.processCommand('ipconfig');
      expect(result.output).toContain('IPv4-Adresse');
      expect(result.output).toContain('192.168.178.42');
    });

    it('whoami prints the fake user', () => {
      expect(sys.processCommand('whoami').output).toBe('alex-schneider\\visitor\r\n');
    });

    it('ping with a host echoes replies', () => {
      const result = sys.processCommand('ping example.com');
      expect(result.output).toContain('Ping wird ausgeführt für example.com');
      expect(result.output).toContain('Antwort von 8.8.8.8');
    });

    it('ping uses the last argument as the host', () => {
      const result = sys.processCommand('ping -n 4 example.com');
      expect(result.output).toContain('für example.com');
    });

    it('ping errors with no arguments', () => {
      expect(sys.processCommand('ping').output).toBe('Syntaxfehler.\r\n');
    });
  });

  describe('cmd: unknown command', () => {
    it('reports an unknown command', () => {
      const result = sys.processCommand('frobnicate');
      expect(result.output).toContain("'frobnicate' ist falsch geschrieben");
    });
  });

  describe('powershell mode', () => {
    beforeEach(() => {
      sys.processCommand('powershell');
    });

    it('cls/clear clear the screen', () => {
      expect(sys.processCommand('cls')).toEqual({ output: '', clear: true });
      expect(sys.processCommand('clear')).toEqual({ output: '', clear: true });
    });

    it('get-childitem lists directory contents in PS format', () => {
      const result = sys.processCommand('get-childitem');
      expect(result.output).toContain('Verzeichnis: C:\\Users\\visitor');
      expect(result.output).toContain('Desktop');
      expect(result.output).toContain('welcome.txt');
    });

    it('ls/gci/dir are aliases for get-childitem', () => {
      expect(sys.processCommand('ls').output).toContain('Verzeichnis:');
      expect(sys.processCommand('gci').output).toContain('Verzeichnis:');
      expect(sys.processCommand('dir').output).toContain('Verzeichnis:');
    });

    it('get-childitem errors on a missing path', () => {
      const result = sys.processCommand('get-childitem NoSuchDir');
      expect(result.output).toContain('Get-ChildItem : Der Pfad wurde nicht gefunden');
    });

    it('get-command reports a fixed cmdlet listing', () => {
      expect(sys.processCommand('get-command').output).toContain('Get-ChildItem');
    });

    it('get-process reports fixed process listing', () => {
      expect(sys.processCommand('get-process').output).toContain('chrome');
    });

    it('get-service reports fixed service listing', () => {
      expect(sys.processCommand('get-service').output).toContain('DHCP Client');
    });

    it('get-content/cat/type reuse cmd type logic', () => {
      expect(sys.processCommand('get-content welcome.txt').output).toContain('Willkommen');
      expect(sys.processCommand('cat welcome.txt').output).toContain('Willkommen');
      expect(sys.processCommand('type welcome.txt').output).toContain('Willkommen');
    });

    it('set-location/cd change the working directory', () => {
      const result = sys.processCommand('set-location Desktop');
      expect(result.output).toBe('');
      expect(sys.getPrompt()).toBe('PS C:\\Users\\visitor\\Desktop> ');
    });

    it('echo/write-host/write-output print their arguments', () => {
      expect(sys.processCommand('echo hi').output).toBe('hi\r\n');
      expect(sys.processCommand('write-host hi').output).toBe('hi\r\n');
      expect(sys.processCommand('write-output hi').output).toBe('hi\r\n');
    });

    it('falls back to cmd commands for unrecognized cmdlets', () => {
      const result = sys.processCommand('ver');
      expect(result.output).toContain('Microsoft Windows [Version');
    });
  });

  describe('diskpart mode', () => {
    beforeEach(() => {
      sys.processCommand('diskpart');
    });

    it('list disk shows both disks with no leading selection marker', () => {
      const result = sys.processCommand('list disk');
      expect(result.output).toContain('Datenträger 0');
      expect(result.output).toContain('Datenträger 1');
      // The trailing '*' per line is a fixed GPT-column marker; only a
      // leading '*' indicates the currently selected disk.
      expect(result.output).not.toMatch(/^\* Datenträger/m);
    });

    it('list without "disk" shows usage', () => {
      const result = sys.processCommand('list');
      expect(result.output).toBe('DISKPART> list [disk|volume|partition]\r\n');
    });

    it('select disk marks the disk as selected in subsequent listings', () => {
      const selectResult = sys.processCommand('select disk 1');
      expect(selectResult.output).toContain('Datenträger 1 ist jetzt der gewählte Datenträger');

      const listResult = sys.processCommand('list disk');
      expect(listResult.output).toMatch(/^\* Datenträger 1/m);
      expect(listResult.output).not.toMatch(/^\* Datenträger 0/m);
    });

    it('select disk errors for an out-of-range disk number', () => {
      const result = sys.processCommand('select disk 5');
      expect(result.output).toContain('Der Datenträger wurde nicht gefunden');
    });

    it('select disk errors for a non-numeric disk number', () => {
      const result = sys.processCommand('select disk abc');
      expect(result.output).toContain('Der Datenträger wurde nicht gefunden');
    });

    it('select without "disk" shows usage', () => {
      const result = sys.processCommand('select volume C');
      expect(result.output).toBe('DISKPART> select disk <n>\r\n');
    });

    it('reports unsupported diskpart commands', () => {
      const result = sys.processCommand('clean');
      expect(result.output).toContain('wird in dieser Simulation nicht unterstützt');
    });
  });
});
