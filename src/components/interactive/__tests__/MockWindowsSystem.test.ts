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

    it('select with an unknown object shows usage', () => {
      const result = sys.processCommand('select foo');
      expect(result.output).toBe('DISKPART> select disk <n>\r\n');
    });

    it('reports unsupported diskpart commands', () => {
      const result = sys.processCommand('shrink');
      expect(result.output).toContain('wird in dieser Simulation nicht unterstützt');
    });

    it('clean needs a selected disk', () => {
      expect(sys.processCommand('clean').output).toContain('kein Datenträger ausgewählt');
    });
  });

  describe('command log', () => {
    it('records successful commands with arguments, pipeline and mode', () => {
      sys.processCommand('ipconfig /all');
      sys.processCommand('help | more');
      expect(sys.ran('ipconfig', (e) => e.args.includes('/all'))).toBe(true);
      expect(sys.ran('help', (e) => e.pipeline[0] === 'more')).toBe(true);
      expect(sys.ran('ipconfig', (e) => e.args.includes('/flushdns'))).toBe(false);
    });

    it('does not record failed commands', () => {
      sys.processCommand('cd NoSuchDir');
      sys.processCommand('frobnicate');
      expect(sys.ran('cd')).toBe(false);
      expect(sys.ran('frobnicate')).toBe(false);
    });

    it('takes command and arguments from the first stage, also without spaces around operators', () => {
      sys.processCommand('help>befehle.txt');
      expect(sys.ran('help')).toBe(true);
    });
  });

  describe('cmd: files', () => {
    it('echo redirects into a file and >> appends', () => {
      expect(sys.processCommand('echo Hallo > a.txt').output).toBe('');
      expect(sys.readFile('a.txt')).toBe('Hallo');
      sys.processCommand('echo Welt >> a.txt');
      expect(sys.readFile('a.txt')).toBe('Hallo\r\nWelt');
    });

    it('copy duplicates a file, also into a directory', () => {
      sys.processCommand('copy welcome.txt kopie.txt');
      expect(sys.readFile('kopie.txt')).toBe(sys.readFile('welcome.txt'));
      sys.processCommand('copy welcome.txt Desktop');
      expect(sys.isFile('Desktop\\welcome.txt')).toBe(true);
    });

    it('copy errors for a missing source', () => {
      expect(sys.processCommand('copy nope.txt x.txt').output).toContain('nicht finden');
      expect(sys.ran('copy')).toBe(false);
    });

    it('del removes files but not directories', () => {
      sys.processCommand('del todo.txt');
      expect(sys.exists('todo.txt')).toBe(false);
      expect(sys.processCommand('del Desktop').output).toContain('nicht finden');
      expect(sys.isDir('Desktop')).toBe(true);
    });

    it('ren and move change names and locations', () => {
      sys.processCommand('ren todo.txt aufgaben.txt');
      expect(sys.exists('todo.txt')).toBe(false);
      expect(sys.isFile('aufgaben.txt')).toBe(true);
      sys.processCommand('move aufgaben.txt Documents');
      expect(sys.isFile('Documents\\aufgaben.txt')).toBe(true);
      expect(sys.exists('aufgaben.txt')).toBe(false);
    });

    it('ren refuses an existing name', () => {
      expect(sys.processCommand('ren todo.txt welcome.txt').output).toContain('existiert bereits');
    });

    it('rd removes only empty directories', () => {
      sys.processCommand('mkdir Leer');
      sys.processCommand('rd Leer');
      expect(sys.exists('Leer')).toBe(false);
      sys.processCommand('copy welcome.txt Desktop');
      expect(sys.processCommand('rd Desktop').output).toContain('nicht leer');
    });

    it('attrib +h hides a file from dir, dir /a shows it again', () => {
      sys.processCommand('attrib +h todo.txt');
      expect(sys.isHidden('todo.txt')).toBe(true);
      expect(sys.processCommand('dir').output).not.toContain('todo.txt');
      expect(sys.processCommand('dir /a').output).toContain('todo.txt');
      sys.processCommand('attrib -h todo.txt');
      expect(sys.isHidden('todo.txt')).toBe(false);
    });

    it('tree lists nested directories', () => {
      sys.processCommand('cd \\');
      expect(sys.processCommand('tree').output).toContain('Users');
    });

    it('type reads quoted paths', () => {
      expect(sys.processCommand('type "welcome.txt"').output).toContain('Willkommen');
    });
  });

  describe('cmd: pipes and help', () => {
    it('more passes the output through, find filters lines', () => {
      expect(sys.processCommand('help | more').output).toContain('Verfügbare Befehle');
      sys.processCommand('echo Hallo > a.txt');
      expect(sys.processCommand('type a.txt | find "Hal"').output).toContain('Hallo');
      expect(sys.processCommand('type a.txt | find "xyz"').output).toBe('');
    });

    it('rejects unknown pipe stages', () => {
      expect(sys.processCommand('help | grep x').output).toContain('nicht unterstützt');
      expect(sys.ran('help')).toBe(false);
    });

    it('help <command> and <command> /? print command help', () => {
      expect(sys.processCommand('help cls').output).toContain('Bildschirm');
      const result = sys.processCommand('cls /?');
      expect(result.clear).toBeUndefined();
      expect(result.output).toContain('Bildschirm');
    });
  });

  describe('cmd: environment, look and feel', () => {
    it('set shows, sets and removes variables', () => {
      expect(sys.processCommand('set').output).toContain('USERNAME=visitor');
      sys.processCommand('set MISSION=bereit');
      expect(sys.getEnv('mission')).toBe('bereit');
      expect(sys.processCommand('set MISSION').output).toContain('MISSION=bereit');
      sys.processCommand('set MISSION=');
      expect(sys.getEnv('MISSION')).toBeUndefined();
    });

    it('color validates and stores the code', () => {
      sys.processCommand('color F0');
      expect(sys.getColor()).toBe('f0');
      expect(sys.processCommand('color ff').output).toContain('Ungültige');
      expect(sys.getColor()).toBe('f0');
      sys.processCommand('color');
      expect(sys.getColor()).toBe('07');
    });

    it('title sets the window title', () => {
      sys.processCommand('title MeinTerminal');
      expect(sys.getTitle()).toBe('MeinTerminal');
    });

    it('prompt changes the prompt format', () => {
      sys.processCommand('prompt $g');
      expect(sys.getPrompt()).toBe('>');
      sys.processCommand('prompt Lernen$g');
      expect(sys.getPrompt()).toBe('Lernen>');
      sys.processCommand('prompt $p$g');
      expect(sys.getPrompt()).toBe('C:\\Users\\visitor>');
    });

    it('start opens a directory in the explorer', () => {
      expect(sys.getExplorerPath()).toBeNull();
      sys.processCommand('start .');
      expect(sys.getExplorerPath()).toBe('C:\\Users\\visitor');
      expect(sys.processCommand('start NoSuchThing').output).toContain('nicht finden');
    });
  });

  describe('cmd: drives', () => {
    it('vol and label read and change the volume label', () => {
      expect(sys.processCommand('vol').output).toContain('keine Bezeichnung');
      sys.processCommand('label test');
      expect(sys.getVolume('C')?.label).toBe('test');
      expect(sys.processCommand('vol').output).toContain('test');
    });

    it('format empties the drive and sets the file system', () => {
      expect(sys.isFile('F:\\urlaub.jpg')).toBe(true);
      sys.processCommand('format f: /q /fs:exfat');
      expect(sys.getVolume('F')?.fs).toBe('exFAT');
      expect(sys.exists('F:\\urlaub.jpg')).toBe(false);
    });

    it('format refuses the system drive and unknown drives', () => {
      expect(sys.processCommand('format c: /q').output).toContain('Zugriff verweigert');
      expect(sys.processCommand('format q: /q').output).toContain('nicht finden');
    });
  });

  describe('cmd: network and system tools', () => {
    it('ipconfig /flushdns empties the cache, nslookup and ping fill it', () => {
      expect(sys.getDnsCache().length).toBeGreaterThan(0);
      sys.processCommand('ipconfig /flushdns');
      expect(sys.getDnsCache()).toEqual([]);
      sys.processCommand('nslookup alex-schneider.dev');
      sys.processCommand('ping 8.8.8.8');
      expect(sys.getDnsCache()).toEqual(['alex-schneider.dev']);
      expect(sys.processCommand('ipconfig /displaydns').output).toContain('alex-schneider.dev');
    });

    it('ipconfig rejects unknown options', () => {
      expect(sys.processCommand('ipconfig /foo').output).toContain('Unbekannte Option');
    });

    it('prints canned output for tracert, netstat, route, arp, systeminfo and wmic', () => {
      expect(sys.processCommand('tracert google.com').output).toContain('google.com');
      expect(sys.processCommand('netstat -an').output).toContain('ABHÖREN');
      expect(sys.processCommand('route print').output).toContain('IPv4-Routentabelle');
      expect(sys.processCommand('arp -a').output).toContain('Internetadresse');
      expect(sys.processCommand('systeminfo').output).toContain('Hostname');
      expect(sys.processCommand('wmic cpu get name').output).toContain('Ryzen');
      expect(sys.processCommand('wmic foo get x').output).toContain('Alias nicht gefunden');
    });

    it('schtasks creates, queries and deletes tasks', () => {
      sys.processCommand('schtasks /create /tn DailyBackup /tr notepad.exe /sc daily /st 02:00');
      expect(sys.getTask('dailybackup')).toMatchObject({ program: 'notepad.exe', time: '02:00' });
      expect(sys.processCommand('schtasks /query').output).toContain('DailyBackup');
      expect(
        sys.processCommand('schtasks /create /tn DailyBackup /tr x /sc daily').output
      ).toContain('bereits vorhanden');
      sys.processCommand('schtasks /delete /tn DailyBackup /f');
      expect(sys.getTask('DailyBackup')).toBeUndefined();
    });

    it('reg queries, adds and deletes values', () => {
      expect(
        sys.processCommand(
          'reg query HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion /v ProductName'
        ).output
      ).toContain('Windows 10 Pro');
      sys.processCommand('reg add HKCU\\Software\\AlexLab /v Level /t REG_SZ /d Expert');
      expect(sys.getRegValue('HKCU\\Software\\AlexLab', 'Level')).toBe('Expert');
      expect(sys.processCommand('reg query HKCU\\Software\\AlexLab').output).toContain('Expert');
      sys.processCommand('reg delete HKCU\\Software\\AlexLab /v Level /f');
      expect(sys.processCommand('reg query HKCU\\Software\\AlexLab /v Level').output).toContain(
        'nicht finden'
      );
    });

    it('netsh adds and shows firewall rules', () => {
      sys.processCommand(
        'netsh advfirewall firewall add rule name="AlexLab" dir=in action=allow protocol=TCP localport=8080'
      );
      expect(sys.getFirewallRule('alexlab')).toMatchObject({
        dir: 'in',
        action: 'allow',
        protocol: 'TCP',
        localport: '8080',
      });
      expect(sys.processCommand('netsh advfirewall firewall show rule name=all').output).toContain(
        'AlexLab'
      );
    });
  });

  describe('powershell: objects, pipeline and files', () => {
    beforeEach(() => {
      sys.processCommand('powershell');
    });

    it('get-process | sort | select returns a table that the log keeps', () => {
      const result = sys.processCommand(
        'Get-Process | Sort-Object CPU -Descending | Select-Object -First 3'
      );
      expect(result.output).toContain('chrome');
      expect(result.output).not.toContain('notepad');
      const entry = sys.getLog().at(-1);
      expect(entry?.table?.rows.map((r) => r.ProcessName)).toEqual([
        'chrome',
        'explorer',
        'svchost',
      ]);
    });

    it('select-object accepts property lists', () => {
      sys.processCommand('Get-Process | Select-Object -First 2 Name, WS');
      expect(sys.getLog().at(-1)?.table?.columns).toEqual(['ProcessName', 'WS(K)']);
    });

    it('where-object filters in both syntaxes', () => {
      sys.processCommand("Get-Service | Where-Object {$_.Status -eq 'Running'}");
      const rows = sys.getLog().at(-1)?.table?.rows ?? [];
      expect(rows.length).toBe(4);
      expect(rows.every((r) => r.Status === 'Running')).toBe(true);
      sys.processCommand('Get-Service | where Status -eq Stopped');
      expect(sys.getLog().at(-1)?.table?.rows.length).toBe(2);
    });

    it('rejects unknown properties and stages', () => {
      expect(sys.processCommand('Get-Process | Sort-Object Foo').output).toContain(
        'nicht gefunden'
      );
      expect(sys.processCommand('Get-Process | Frob').output).toContain('nicht unterstützt');
      expect(sys.processCommand('echo hi | Sort-Object x').output).toContain('keine Objekte');
    });

    it('out-file and redirection write the listing to a file', () => {
      sys.processCommand('Get-Process | Out-File C:\\Temp\\a.txt');
      expect(sys.readFile('C:\\Temp\\a.txt')).toContain('chrome');
      sys.processCommand('Get-Process > C:\\Temp\\b.txt');
      expect(sys.readFile('C:\\Temp\\b.txt')).toContain('chrome');
    });

    it('new-item, set-content, add-content, copy, rename, remove', () => {
      sys.processCommand('New-Item -ItemType Directory -Path C:\\Temp\\PSLab');
      expect(sys.isDir('C:\\Temp\\PSLab')).toBe(true);
      expect(
        sys.processCommand('New-Item -ItemType Directory -Path C:\\Temp\\PSLab').output
      ).toContain('bereits vorhanden');
      sys.processCommand('Set-Content C:\\Temp\\PSLab\\n.txt "Hallo Welt"');
      sys.processCommand('Add-Content C:\\Temp\\PSLab\\n.txt Zeile2');
      expect(sys.readFile('C:\\Temp\\PSLab\\n.txt')).toBe('Hallo Welt\r\nZeile2');
      sys.processCommand('Copy-Item C:\\Temp\\PSLab\\n.txt C:\\Temp\\PSLab\\m.txt');
      sys.processCommand('Rename-Item C:\\Temp\\PSLab\\m.txt k.txt');
      expect(sys.isFile('C:\\Temp\\PSLab\\k.txt')).toBe(true);
      expect(sys.processCommand('Test-Path C:\\Temp\\PSLab\\k.txt').output).toBe('True\r\n');
      expect(sys.processCommand('Remove-Item C:\\Temp\\PSLab').output).toContain('nicht leer');
      sys.processCommand('Remove-Item C:\\Temp\\PSLab -Recurse');
      expect(sys.exists('C:\\Temp\\PSLab')).toBe(false);
    });

    it('get-help and $PSVersionTable print canned text', () => {
      expect(sys.processCommand('Get-Help Get-Process').output).toContain('Prozesse');
      expect(sys.processCommand('$PSVersionTable').output).toContain('PSVersion');
      expect(sys.ran('$psversiontable', undefined, 'powershell')).toBe(true);
    });
  });

  describe('diskpart: volumes and partitioning', () => {
    beforeEach(() => {
      sys.processCommand('diskpart');
    });

    it('lists volumes and selects them by letter or number', () => {
      expect(sys.processCommand('list volume').output).toContain('Daten');
      sys.processCommand('select volume D');
      expect(sys.getSelectedVolume()).toBe(2);
      sys.processCommand('select volume 3');
      expect(sys.getSelectedVolume()).toBe(3);
      expect(sys.processCommand('select volume Q').output).toContain('nicht gefunden');
    });

    it('detail disk and detail volume need a selection', () => {
      expect(sys.processCommand('detail disk').output).toContain('kein Datenträger ausgewählt');
      expect(sys.processCommand('detail volume').output).toContain('keine Partition ausgewählt');
      sys.processCommand('select disk 1');
      expect(sys.processCommand('detail disk').output).toContain('Datenträger 1');
      sys.processCommand('select volume D');
      expect(sys.processCommand('detail volume').output).toContain('NTFS');
      expect(sys.processCommand('list partition').output).toContain('Partition 1');
    });

    it('cleans, converts, partitions, formats and assigns a drive letter', () => {
      sys.processCommand('select disk 2');
      expect(sys.processCommand('convert gpt').output).toContain('Bereinigen Sie ihn zuerst');
      sys.processCommand('clean');
      expect(sys.getDisk(2)?.partitions).toHaveLength(0);
      expect(sys.exists('F:\\')).toBe(false);
      sys.processCommand('convert gpt');
      expect(sys.getDisk(2)?.style).toBe('GPT');
      sys.processCommand('create partition primary');
      expect(sys.getDisk(2)?.partitions).toHaveLength(1);
      sys.processCommand('format quick fs=ntfs label=MP3');
      sys.processCommand('assign letter x');
      expect(sys.getVolume('X')).toMatchObject({ fs: 'NTFS', label: 'MP3' });
      expect(sys.isDir('X:\\')).toBe(true);
      expect(sys.processCommand('assign letter c').output).toContain('bereits einen');
      sys.processCommand('exit');
      expect(sys.processCommand('x:').output).toBe('');
    });

    it('format and assign need a selected partition', () => {
      expect(sys.processCommand('format fs=ntfs').output).toContain('keine Partition ausgewählt');
      expect(sys.processCommand('assign letter x').output).toContain('keine Partition ausgewählt');
    });

    it('log entries carry the diskpart mode', () => {
      sys.processCommand('list disk');
      expect(sys.ran('list', (e) => e.args[0] === 'disk', 'diskpart')).toBe(true);
      expect(sys.ran('list', undefined, 'cmd')).toBe(false);
    });
  });
});
