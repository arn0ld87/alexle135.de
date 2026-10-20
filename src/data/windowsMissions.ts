// Windows-Missionen (Simulation) im zustandsbasierten Format. Je Schritt entscheidet `verify`
// über den Zustand des MockWindowsSystem (Ordner, Datei, aktuelles Verzeichnis, Variablen,
// Datenträger ...), nie über den getippten Befehl; jeder Weg zum Ziel zählt. Reine
// Anzeige-Befehle (ver, ipconfig, netstat ...) prüft das Befehlsprotokoll des Mocks
// (`sys.ran`). Die Flagge entsteht aus dem Zielzustand (`flagSeed`, siehe deriveFlag).
import type {
  CommandLogEntry,
  MockWindowsSystem,
} from '../components/interactive/MockWindowsSystem';
import { PROCESSES, SERVICES } from '../components/interactive/mockWindowsData';
import type { WindowsMission } from '../lib/missions/windowsEngine';

const HOME = 'C:\\Users\\visitor';

const unquote = (value: string | undefined) => (value ?? '').replace(/^["']|["']$/g, '');

/** Kommt `value` (ohne Anführungszeichen, ohne Rücksicht auf Groß-/Kleinschreibung) als Argument vor? */
const hasArg = (entry: CommandLogEntry, value: string) =>
  entry.args.some((a) => unquote(a).toLowerCase() === value.toLowerCase());

const firstArg = (entry: CommandLogEntry) => unquote(entry.args[0]).toLowerCase();

const ranAny = (
  sys: MockWindowsSystem,
  names: string[],
  test?: (entry: CommandLogEntry) => boolean
) => names.some((name) => sys.ran(name, test));

/** Datei im aktuellen Ordner, auf D:\ oder im Benutzerordner (je nachdem, wo sie entstand). */
const findFile = (sys: MockWindowsSystem, name: string) =>
  [name, `D:\\${name}`, `${HOME}\\${name}`]
    .map((path) => sys.readFile(path))
    .find((content) => content !== null) ?? null;

const filled = (content: string | null) => (content ?? '').trim() !== '';

/** Die fünf Prozesse mit der höchsten CPU-Zeit, absteigend. */
const TOP_PROCESSES = [...PROCESSES.rows]
  .sort((a, b) => Number(b['CPU(s)']) - Number(a['CPU(s)']))
  .slice(0, 5);

const RUNNING_SERVICES = SERVICES.rows.filter((r) => r.Status === 'Running');

function isTopFive(entry: CommandLogEntry): boolean {
  const rows = entry.table?.rows ?? [];
  const key = rows[0] && 'ProcessName' in rows[0] ? 'ProcessName' : 'CPU(s)';
  return (
    rows.length === 5 &&
    rows.every((row, i) => row[key] === TOP_PROCESSES[i]?.[key]) &&
    rows.every((row) => key in row)
  );
}

function isRunningServices(entry: CommandLogEntry): boolean {
  const rows = entry.table?.rows ?? [];
  return (
    rows.length === RUNNING_SERVICES.length &&
    rows.every((row) => row.Status === 'Running') &&
    entry.pipeline.length > 0
  );
}

const cmdBasics: WindowsMission = {
  id: 'windows-basics-1',
  title: 'Windows CMD Grundlagen',
  description:
    'Erste Schritte in der Windows-Eingabeaufforderung: Navigation, Systeminfos und grundlegende Befehle.',
  difficulty: 'einstieg',
  durationMin: 7,
  steps: [
    {
      id: 'version',
      title: 'Willkommen in der CMD',
      description: 'Zeige die Windows-Version und Build-Nummer an.',
      verify: (sys) => sys.ran('ver'),
      hints: [
        'Gesucht ist ein sehr kurzer Befehl, der die Windows-Version ausgibt.',
        'Er besteht aus nur drei Buchstaben und beginnt mit „v“.',
      ],
      solution: 'ver',
    },
    {
      id: 'documents',
      title: 'In einen Ordner wechseln',
      description: 'Wechsle in den Ordner Documents, der in deinem Benutzerordner liegt.',
      verify: (sys) => sys.cwdIs(`${HOME}\\Documents`),
      hints: [
        'Das Wechseln des Verzeichnisses übernimmt ein Befehl aus zwei Buchstaben.',
        'Du kannst den vollständigen Pfad angeben oder, weil der Ordner direkt in deinem aktuellen Verzeichnis liegt, nur seinen Namen.',
      ],
      solution: 'cd Documents',
      failMessage: 'Du bist noch nicht in Documents. Der Prompt zeigt dein aktuelles Verzeichnis.',
    },
    {
      id: 'listing',
      title: 'Verzeichnis auflisten',
      description: 'Liste den Inhalt des aktuellen Ordners auf.',
      verify: (sys) => sys.ran('dir'),
      hints: [
        'Der Befehl für Verzeichnisinhalte hat drei Buchstaben und steht für „directory“.',
        'Er braucht in diesem Schritt keine Argumente.',
      ],
      solution: 'dir',
    },
    {
      id: 'workspace',
      title: 'Ordner erstellen',
      description: 'Erstelle in Documents einen neuen Ordner namens Workspace.',
      verify: (sys) => sys.isDir(`${HOME}\\Documents\\Workspace`),
      hints: [
        'Ordner legst du mit einem Befehl an, der „make directory“ abkürzt. Es gibt eine kurze und eine lange Schreibweise.',
        'Hinter dem Befehl steht nur der Name des neuen Ordners.',
      ],
      solution: 'mkdir Workspace',
      failMessage: 'Den Ordner Workspace gibt es in Documents noch nicht.',
    },
    {
      id: 'variable',
      title: 'Umgebungsvariable setzen',
      description: 'Lege die Umgebungsvariable MISSION mit dem Wert bereit an.',
      verify: (sys) => sys.getEnv('MISSION')?.toLowerCase() === 'bereit',
      hints: [
        'Umgebungsvariablen verwaltet der Befehl, der im Englischen „setzen“ heißt.',
        'Das Format lautet Name=Wert, ohne Leerzeichen um das Gleichheitszeichen.',
      ],
      solution: 'set MISSION=bereit',
      failMessage: 'MISSION hat noch nicht den Wert bereit.',
    },
    {
      id: 'clear',
      title: 'Bildschirm löschen',
      description: 'Räume das Terminal auf, indem du den Bildschirm löschst.',
      verify: (sys) => sys.ran('cls', (e) => !e.args.includes('/?')),
      hints: [
        'Der Befehl steht für „clear screen“.',
        'Er besteht aus drei Buchstaben und beginnt mit „c“.',
      ],
      solution: 'cls',
    },
    {
      id: 'ipconfig',
      title: 'IP-Konfiguration anzeigen',
      description: 'Zeige die Netzwerkkonfiguration deines Computers an.',
      verify: (sys) => sys.ran('ipconfig'),
      hints: [
        'Der Befehl hat mit der IP-Konfiguration zu tun, die Abkürzung für „configuration“ steckt im Namen.',
        'Er beginnt mit „ip“.',
      ],
      solution: 'ipconfig',
    },
  ],
  flagSeed: (sys) =>
    `workspace=${sys.isDir(`${HOME}\\Documents\\Workspace`)}|mission=${sys.getEnv('MISSION')?.toLowerCase()}`,
};

const cmdFiles: WindowsMission = {
  id: 'windows-files-1',
  title: 'Windows Dateiverwaltung',
  description:
    'Professioneller Umgang mit Dateien und Ordnern: Kopieren, Verschieben, Attribute ändern.',
  difficulty: 'einstieg',
  durationMin: 10,
  steps: [
    {
      id: 'project',
      title: 'Arbeitsordner erstellen',
      description: 'Erstelle den Ordner TestProject unter C:\\Temp.',
      verify: (sys) => sys.isDir('C:\\Temp\\TestProject'),
      hints: [
        'Ordner legst du mit dem Befehl an, der „make directory“ abkürzt (kurz oder lang geschrieben).',
        'Gib den vollständigen Pfad an oder wechsle erst nach C:\\Temp.',
      ],
      solution: 'mkdir C:\\Temp\\TestProject',
      failMessage: 'C:\\Temp\\TestProject existiert noch nicht.',
    },
    {
      id: 'enter',
      title: 'Zum Ordner navigieren',
      description: 'Wechsle in den neu erstellten Ordner.',
      verify: (sys) => sys.cwdIs('C:\\Temp\\TestProject'),
      hints: [
        'Zum Wechseln des Verzeichnisses brauchst du den Befehl mit den zwei Buchstaben.',
        'Der Prompt zeigt dir, ob du im richtigen Ordner bist.',
      ],
      solution: 'cd C:\\Temp\\TestProject',
      failMessage: 'Du bist noch nicht in C:\\Temp\\TestProject.',
    },
    {
      id: 'readme',
      title: 'Textdatei erstellen',
      description: 'Erstelle in TestProject die Textdatei README.txt mit beliebigem Inhalt.',
      verify: (sys) => filled(sys.readFile('C:\\Temp\\TestProject\\README.txt')),
      hints: [
        'Mit dem Befehl, der Text ausgibt, und einer Umleitung in eine Datei entsteht eine neue Datei.',
        'Die Umleitung schreibst du mit dem Zeichen „>“ und dem Dateinamen dahinter.',
      ],
      solution: 'echo Mein erstes Windows-Projekt > README.txt',
      failMessage: 'README.txt fehlt oder ist leer.',
    },
    {
      id: 'type',
      title: 'Dateiinhalt anzeigen',
      description: 'Zeige den Inhalt der Datei README.txt an.',
      verify: (sys) =>
        ranAny(sys, ['type', 'get-content', 'cat'], (e) =>
          e.args.some((a) => /readme\.txt/i.test(a))
        ),
      hints: [
        'Der Befehl zum Anzeigen von Textdateien heißt wie das Tippen auf einer Tastatur im Englischen.',
        'Hinter dem Befehl steht der Dateiname.',
      ],
      solution: 'type README.txt',
    },
    {
      id: 'copy',
      title: 'Datei kopieren',
      description: 'Kopiere README.txt nach BACKUP.txt.',
      verify: (sys) => {
        const backup = sys.readFile('C:\\Temp\\TestProject\\BACKUP.txt');
        const readme = sys.readFile('C:\\Temp\\TestProject\\README.txt');
        return filled(backup) && (readme === null || readme === backup);
      },
      hints: [
        'Zum Kopieren gibt es einen Befehl, der wie das englische Wort dafür heißt.',
        'Er erwartet erst die Quelle, dann das Ziel.',
      ],
      solution: 'copy README.txt BACKUP.txt',
      failMessage: 'BACKUP.txt gibt es noch nicht oder sie enthält etwas anderes als README.txt.',
    },
    {
      id: 'hide',
      title: 'Datei verstecken',
      description: 'Setze das Hidden-Attribut für BACKUP.txt.',
      verify: (sys) => sys.isHidden('C:\\Temp\\TestProject\\BACKUP.txt'),
      hints: [
        'Dateiattribute ändert der Befehl, der „attribute“ abkürzt.',
        'Ein Pluszeichen setzt ein Attribut; „h“ steht für hidden.',
      ],
      solution: 'attrib +h BACKUP.txt',
      failMessage: 'BACKUP.txt ist noch nicht versteckt.',
    },
    {
      id: 'delete',
      title: 'Original löschen',
      description: 'Lösche README.txt. BACKUP.txt bleibt erhalten.',
      verify: (sys) =>
        !sys.exists('C:\\Temp\\TestProject\\README.txt') &&
        sys.exists('C:\\Temp\\TestProject\\BACKUP.txt'),
      hints: [
        'Zum Löschen von Dateien gibt es einen Befehl mit drei Buchstaben, der „delete“ abkürzt.',
        'Achte darauf, nur die Datei README.txt zu löschen.',
      ],
      solution: 'del README.txt',
      failMessage: 'README.txt ist noch da, oder BACKUP.txt fehlt.',
    },
    {
      id: 'tree',
      title: 'Verzeichnisbaum anzeigen',
      description: 'Zeige die Ordnerstruktur grafisch an.',
      verify: (sys) => sys.ran('tree'),
      hints: [
        'Die Ordnerstruktur als Baum zeigt ein Befehl, der so heißt wie das englische Wort für Baum.',
        'Er braucht keine Argumente.',
      ],
      solution: 'tree',
    },
  ],
  flagSeed: (sys) =>
    `backup=${filled(sys.readFile('C:\\Temp\\TestProject\\BACKUP.txt'))}|hidden=${sys.isHidden('C:\\Temp\\TestProject\\BACKUP.txt')}|readme=${sys.exists('C:\\Temp\\TestProject\\README.txt')}`,
};

const networking: WindowsMission = {
  id: 'windows-networking-1',
  title: 'Windows Netzwerk-Diagnose',
  description: 'Netzwerkprobleme diagnostizieren und beheben mit CMD-Tools.',
  difficulty: 'fortgeschritten',
  durationMin: 12,
  steps: [
    {
      id: 'ipconfig-all',
      title: 'Detaillierte Netzwerkinfo',
      description: 'Zeige alle Netzwerkadapter mit allen Details an.',
      verify: (sys) => sys.ran('ipconfig', (e) => hasArg(e, '/all')),
      hints: [
        'Derselbe Befehl wie für die kurze IP-Übersicht, nur mit einer Option.',
        'Die Option für „alles“ beginnt mit einem Schrägstrich.',
      ],
      solution: 'ipconfig /all',
    },
    {
      id: 'flushdns',
      title: 'DNS-Cache leeren',
      description: 'Der Resolver-Cache enthält noch alte Einträge. Leere ihn.',
      verify: (sys) => sys.getDnsCache().length === 0,
      hints: [
        'Auch das DNS-Cache-Leeren erledigt der Befehl für die IP-Konfiguration.',
        'Die Option dafür besteht aus dem englischen Wort für „spülen“ und „dns“.',
      ],
      solution: 'ipconfig /flushdns',
      failMessage: 'Der DNS-Cache enthält noch Einträge.',
    },
    {
      id: 'ping',
      title: 'Ping-Test',
      description: 'Teste die Verbindung zu Google DNS (8.8.8.8).',
      verify: (sys) => sys.ran('ping', (e) => hasArg(e, '8.8.8.8')),
      hints: [
        'Erreichbarkeit prüft ein Befehl, der nach dem Geräusch eines Sonars benannt ist.',
        'Als Ziel gibst du die IP-Adresse an.',
      ],
      solution: 'ping 8.8.8.8',
    },
    {
      id: 'tracert',
      title: 'Traceroute',
      description: 'Verfolge den Weg zu google.com.',
      verify: (sys) => sys.ran('tracert', (e) => hasArg(e, 'google.com')),
      hints: [
        'Der Befehl für die Routenverfolgung ist die Kurzform von „trace route“.',
        'Er erwartet den Zielnamen als Argument.',
      ],
      solution: 'tracert google.com',
    },
    {
      id: 'netstat',
      title: 'Aktive Verbindungen',
      description: 'Zeige alle aktiven Verbindungen und lauschenden Ports an.',
      verify: (sys) => sys.ran('netstat', (e) => e.args.some((a) => /^-.*a/i.test(a))),
      hints: [
        'Netzwerkstatistiken zeigt ein Befehl, dessen Name mit „net“ beginnt.',
        'Mit der Option „a“ (alle) und „n“ (numerisch) bekommst du die vollständige Liste.',
      ],
      solution: 'netstat -an',
    },
    {
      id: 'route',
      title: 'Routing-Tabelle',
      description: 'Zeige die IP-Routing-Tabelle an.',
      verify: (sys) => sys.ran('route', (e) => firstArg(e) === 'print'),
      hints: [
        'Routen verwaltet der Befehl, der so heißt wie das englische Wort für Weg.',
        'Das Unterkommando zum Anzeigen heißt wie „drucken“ im Englischen.',
      ],
      solution: 'route print',
    },
    {
      id: 'arp',
      title: 'ARP-Cache anzeigen',
      description: 'Zeige die ARP-Tabelle (Zuordnung von IP- zu MAC-Adressen).',
      verify: (sys) => sys.ran('arp', (e) => firstArg(e) === '-a'),
      hints: [
        'Der Befehl besteht aus drei Buchstaben und steht für „Address Resolution Protocol“.',
        'Die Option „-a“ zeigt alle Einträge.',
      ],
      solution: 'arp -a',
    },
    {
      id: 'nslookup',
      title: 'NSLookup',
      description: 'Finde die IP-Adresse von alex-schneider.dev heraus.',
      verify: (sys) => sys.ran('nslookup', (e) => hasArg(e, 'alex-schneider.dev')),
      hints: [
        'Namen löst ein Befehl auf, der mit „ns“ für Nameserver beginnt.',
        'Hinter dem Befehl steht der Domainname.',
      ],
      solution: 'nslookup alex-schneider.dev',
    },
  ],
  flagSeed: (sys) =>
    `dns=${sys.getDnsCache().includes('alex-schneider.dev')}|flushed=${sys.ran('ipconfig', (e) => hasArg(e, '/flushdns'))}`,
};

const powershell: WindowsMission = {
  id: 'windows-powershell-1',
  title: 'PowerShell Grundlagen',
  description:
    'Moderne Windows-Administration mit PowerShell: Cmdlets, Pipeline, Objektverarbeitung.',
  difficulty: 'fortgeschritten',
  durationMin: 14,
  steps: [
    {
      id: 'start',
      title: 'PowerShell starten',
      description: 'Wechsle aus der Eingabeaufforderung in die PowerShell.',
      verify: (sys) => sys.getMode() === 'powershell',
      hints: [
        'Die zweite, modernere Shell von Windows startest du aus der Eingabeaufforderung.',
        'Der Befehl heißt wie das Programm selbst, ohne Endung.',
      ],
      solution: 'powershell',
      failMessage: 'Der Prompt beginnt noch nicht mit „PS“.',
    },
    {
      id: 'version',
      title: 'PowerShell-Version',
      description: 'Zeige die installierte Version an.',
      verify: (sys) => sys.ran('$psversiontable', undefined, 'powershell'),
      hints: [
        'Die Versionsinformationen stehen in einer automatischen Variable mit „PS“ im Namen.',
        'Variablen beginnen mit einem Dollarzeichen; diese hier endet auf „Table“.',
      ],
      solution: '$PSVersionTable',
    },
    {
      id: 'help',
      title: 'Get-Help',
      description: 'Hole die Hilfe zum Cmdlet Get-Process.',
      verify: (sys) => sys.ran('get-help', (e) => hasArg(e, 'get-process'), 'powershell'),
      hints: [
        'Die Dokumentation zu einem Cmdlet rufst du mit einem eigenen Cmdlet auf; sein Name beginnt mit „Get“.',
        'Als Argument übergibst du den Namen des Cmdlets, das du verstehen möchtest.',
      ],
      solution: 'Get-Help Get-Process',
    },
    {
      id: 'process',
      title: 'Prozesse auflisten',
      description: 'Zeige alle laufenden Prozesse an.',
      verify: (sys) => sys.ran('get-process', undefined, 'powershell'),
      hints: [
        'Cmdlets heißen Verb-Substantiv. Gesucht ist das Cmdlet, das Prozesse „holt“.',
        'Das Verb ist „Get“, das Substantiv der englische Begriff für Prozess.',
      ],
      solution: 'Get-Process',
    },
    {
      id: 'top5',
      title: 'Die fünf CPU-intensivsten Prozesse',
      description:
        'Finde die fünf Prozesse mit der höchsten CPU-Zeit: absteigend sortiert, nur die ersten fünf.',
      verify: (sys) => sys.ran('get-process', isTopFive, 'powershell'),
      hints: [
        'Die Ausgabe von Get-Process lässt sich mit dem Pipe-Zeichen an weitere Cmdlets übergeben.',
        'Ein Cmdlet sortiert nach einer Eigenschaft, ein anderes wählt die ersten Zeilen aus.',
        'Sortiere nach CPU absteigend und wähle dann mit „-First“ fünf Einträge.',
      ],
      solution: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5',
      failMessage:
        'Die Ausgabe zeigt noch nicht genau die fünf Prozesse mit der höchsten CPU-Zeit.',
    },
    {
      id: 'services',
      title: 'Laufende Dienste filtern',
      description: 'Zeige nur die Dienste an, deren Status Running ist.',
      verify: (sys) => sys.ran('get-service', isRunningServices, 'powershell'),
      hints: [
        'Hole zuerst alle Dienste und filtere sie dann über die Pipeline.',
        'Das Cmdlet zum Filtern heißt „Where-Object“ (oder kurz „where“).',
        'Der Filter vergleicht die Eigenschaft Status mit -eq und dem Wert Running.',
      ],
      solution: "Get-Service | Where-Object {$_.Status -eq 'Running'}",
      failMessage:
        'In der Ausgabe stehen noch Dienste, die nicht laufen, oder es fehlt der Filter.',
    },
    {
      id: 'folder',
      title: 'Ordner anlegen',
      description: 'Lege den Ordner C:\\Temp\\PSLab an.',
      verify: (sys) => sys.isDir('C:\\Temp\\PSLab'),
      hints: [
        'Ein Cmdlet erstellt neue Elemente; sein Name beginnt mit „New“. Das klassische mkdir funktioniert ebenfalls.',
        'Für New-Item gibst du mit -ItemType an, was entstehen soll, und mit -Path, wo.',
      ],
      solution: 'New-Item -ItemType Directory -Path C:\\Temp\\PSLab',
      failMessage: 'C:\\Temp\\PSLab gibt es noch nicht.',
    },
    {
      id: 'export',
      title: 'Prozessliste exportieren',
      description: 'Schreibe die Prozessliste in die Datei C:\\Temp\\PSLab\\prozesse.txt.',
      verify: (sys) => (sys.readFile('C:\\Temp\\PSLab\\prozesse.txt') ?? '').includes('chrome'),
      hints: [
        'Du kannst die Ausgabe umleiten oder in der Pipeline an ein Cmdlet zum Schreiben von Dateien übergeben.',
        'Das Cmdlet heißt „Out-File“, die Umleitung nutzt das Zeichen „>“.',
      ],
      solution: 'Get-Process | Out-File C:\\Temp\\PSLab\\prozesse.txt',
      failMessage: 'prozesse.txt fehlt oder enthält keine Prozessliste.',
    },
    {
      id: 'list',
      title: 'Ordnerinhalt anzeigen',
      description: 'Zeige den Inhalt von C:\\Temp\\PSLab an.',
      verify: (sys) =>
        ranAny(
          sys,
          ['get-childitem', 'gci', 'ls', 'dir'],
          (e) => e.mode === 'powershell' && e.args.some((a) => /pslab/i.test(a))
        ),
      hints: [
        'Ordnerinhalte listet ein Cmdlet auf, dessen Name mit „Get-Child“ beginnt; es gibt auch kurze Aliase.',
        'Gib den Pfad des Ordners als Argument an.',
      ],
      solution: 'Get-ChildItem C:\\Temp\\PSLab',
    },
    {
      id: 'cleanup',
      title: 'Aufräumen',
      description: 'Lösche den Ordner C:\\Temp\\PSLab samt Inhalt wieder.',
      verify: (sys) => !sys.exists('C:\\Temp\\PSLab'),
      hints: [
        'Zum Löschen gibt es ein Cmdlet, dessen Name mit „Remove“ beginnt.',
        'Ein Ordner mit Inhalt braucht den Schalter -Recurse.',
      ],
      solution: 'Remove-Item C:\\Temp\\PSLab -Recurse',
      failMessage: 'C:\\Temp\\PSLab existiert noch.',
    },
  ],
  flagSeed: (sys) =>
    `exported=${sys.ran('get-process', undefined, 'powershell')}|cleaned=${!sys.exists('C:\\Temp\\PSLab')}`,
};

const diskpart: WindowsMission = {
  id: 'windows-diskpart-1',
  title: 'Diskpart - Datenträgerverwaltung',
  description:
    'Fortgeschrittene Datenträgerverwaltung mit Diskpart: Datenträger und Volumes erkunden. Nur lesend, es wird nichts gelöscht.',
  difficulty: 'profi',
  durationMin: 15,
  steps: [
    {
      id: 'start',
      title: 'Diskpart starten',
      description: 'Starte das Diskpart-Dienstprogramm.',
      verify: (sys) => sys.getMode() === 'diskpart',
      hints: [
        'Das Programm startest du direkt aus der Eingabeaufforderung.',
        'Der Befehl setzt sich aus „disk“ und „part“ zusammen.',
      ],
      solution: 'diskpart',
      failMessage: 'Der Prompt lautet noch nicht DISKPART>.',
    },
    {
      id: 'list-disk',
      title: 'Datenträger auflisten',
      description: 'Liste alle physischen Datenträger auf.',
      verify: (sys) => sys.ran('list', (e) => firstArg(e) === 'disk', 'diskpart'),
      hints: [
        'Dinge auflisten kann Diskpart mit einem Befehl, der „Liste“ heißt.',
        'Als Argument sagst du, was du auflisten willst: die Festplatten.',
      ],
      solution: 'list disk',
    },
    {
      id: 'list-volume',
      title: 'Volumes anzeigen',
      description: 'Zeige alle Volumes mit ihren Laufwerksbuchstaben an.',
      verify: (sys) => sys.ran('list', (e) => firstArg(e) === 'volume', 'diskpart'),
      hints: [
        'Derselbe Befehl wie bei den Datenträgern, nur mit einem anderen Argument.',
        'Das Argument heißt „volume“ (nicht „partition“).',
      ],
      solution: 'list volume',
    },
    {
      id: 'select-disk',
      title: 'Datenträger auswählen',
      description:
        'Wähle Datenträger 1 aus. In einem echten System prüfst du vorher immer, welche Nummer welcher Datenträger hat.',
      verify: (sys) => sys.getSelectedDisk() === 1,
      hints: [
        'Mit einem Befehl, der „auswählen“ heißt, legst du fest, womit die folgenden Befehle arbeiten.',
        'Nenne die Art (disk) und danach die Nummer.',
      ],
      solution: 'select disk 1',
      failMessage: 'Datenträger 1 ist noch nicht ausgewählt (Sternchen in list disk).',
    },
    {
      id: 'detail-disk',
      title: 'Datenträger-Details',
      description: 'Zeige Details zum ausgewählten Datenträger.',
      verify: (sys) => sys.ran('detail', (e) => firstArg(e) === 'disk', 'diskpart'),
      hints: [
        'Details liefert ein Befehl, dessen Name das englische Wort dafür ist.',
        'Er arbeitet mit dem zuvor ausgewählten Datenträger; das Argument sagt, was du sehen willst.',
      ],
      solution: 'detail disk',
    },
    {
      id: 'list-partition',
      title: 'Partitionen auflisten',
      description: 'Liste die Partitionen des ausgewählten Datenträgers auf.',
      verify: (sys) => sys.ran('list', (e) => firstArg(e) === 'partition', 'diskpart'),
      hints: [
        'Wieder der Auflistungsbefehl, diesmal mit einem dritten Argument.',
        'Das Argument heißt „partition“.',
      ],
      solution: 'list partition',
    },
    {
      id: 'select-volume',
      title: 'Volume auswählen',
      description: 'Wähle das Volume D: aus. Du kannst den Buchstaben oder die Nummer verwenden.',
      verify: (sys) => sys.getSelectedVolume() === 2,
      hints: [
        'Auch Volumes wählst du mit dem Auswahlbefehl aus.',
        'Das Argument ist die Art (volume), dann Buchstabe oder Nummer; die Nummer steht in list volume.',
      ],
      solution: 'select volume D',
      failMessage: 'Das Volume D: ist noch nicht ausgewählt.',
    },
    {
      id: 'detail-volume',
      title: 'Volume-Informationen',
      description: 'Zeige Dateisystem, Größe und Status des ausgewählten Volumes.',
      verify: (sys) => sys.ran('detail', (e) => firstArg(e) === 'volume', 'diskpart'),
      hints: ['Derselbe Detailbefehl wie bei den Datenträgern.', 'Das Argument heißt „volume“.'],
      solution: 'detail volume',
    },
    {
      id: 'exit',
      title: 'Diskpart verlassen',
      description: 'Beende Diskpart und kehre zur Eingabeaufforderung zurück.',
      verify: (sys) => sys.getMode() === 'cmd',
      hints: [
        'Programme beendest du in der Konsole meist mit dem englischen Wort für „Ausgang“.',
        'Der Befehl hat vier Buchstaben.',
      ],
      solution: 'exit',
      failMessage: 'Du bist noch in Diskpart.',
    },
  ],
  flagSeed: (sys) =>
    `disk1=${sys.getDisk(1)?.sizeMB}|volumeD=${sys.getVolume('D')?.label}|${sys.getVolume('D')?.fs}`,
};

const video1: WindowsMission = {
  id: 'cmd-video-1',
  title: 'CMD Mission 1: Einführung',
  description:
    'Einführung in die Windows-Eingabeaufforderung: Starten, Version prüfen und Anpassung.',
  difficulty: 'einstieg',
  durationMin: 5,
  steps: [
    {
      id: 'ver',
      title: 'CMD starten',
      description:
        'Die Eingabeaufforderung ist geöffnet. Finde heraus, welche Windows-Version läuft.',
      verify: (sys) => sys.ran('ver'),
      hints: [
        'Gesucht ist ein sehr kurzer Befehl für die Windows-Version.',
        'Er hat drei Buchstaben und beginnt mit „v“.',
      ],
      solution: 'ver',
    },
    {
      id: 'color',
      title: 'Farben anpassen',
      description:
        'Der Hintergrund soll weiß und der Text schwarz sein. Die erste Ziffer steht für den Hintergrund, die zweite für den Text (F = Weiß, 0 = Schwarz).',
      verify: (sys) => sys.getColor() === 'f0',
      hints: [
        'Der Befehl für die Konsolenfarben ist das englische Wort für „Farbe“ (amerikanisch geschrieben).',
        'Dahinter steht ein Code aus zwei Hexziffern: zuerst Hintergrund, dann Text.',
      ],
      solution: 'color f0',
      failMessage: 'Die Farben sind noch nicht auf Weiß und Schwarz gestellt.',
    },
    {
      id: 'title',
      title: 'Fenstertitel ändern',
      description: 'Gib dem Fenster einen eigenen Namen, zum Beispiel MeinTerminal.',
      verify: (sys) => sys.getTitle().trim() !== '',
      hints: [
        'Der Befehl heißt wie das englische Wort für „Titel“.',
        'Hinter dem Befehl steht der gewünschte Text. Die Titelleiste des Terminals zeigt ihn an.',
      ],
      solution: 'title MeinTerminal',
      failMessage: 'Das Fenster hat noch keinen eigenen Titel.',
    },
    {
      id: 'start',
      title: 'Explorer öffnen',
      description: 'Öffne den aktuellen Ordner im Windows Explorer.',
      verify: (sys) => sys.getExplorerPath() !== null,
      hints: [
        'Programme und Ordner öffnet der Befehl, der „starten“ heißt.',
        'Der aktuelle Ordner wird mit einem einzelnen Punkt bezeichnet.',
      ],
      solution: 'start .',
      failMessage: 'Es wurde noch kein Ordner im Explorer geöffnet.',
    },
  ],
  flagSeed: (sys) =>
    `color=${sys.getColor()}|titled=${sys.getTitle().trim() !== ''}|explorer=${sys.getExplorerPath() !== null}`,
};

const video2: WindowsMission = {
  id: 'cmd-video-2',
  title: 'CMD Mission 2: Syntax & Operatoren',
  description: 'Grundlegende Befehle, Parameter, Optionen und Umleitungen (Piping).',
  difficulty: 'einstieg',
  durationMin: 10,
  steps: [
    {
      id: 'drive',
      title: 'Laufwerk wechseln',
      description: 'Wechsle auf das Laufwerk D:.',
      verify: (sys) => sys.getCwd().toUpperCase().startsWith('D:'),
      hints: [
        'Das Laufwerk wechselst du, indem du nur seinen Buchstaben eintippst.',
        'Hinter dem Buchstaben steht ein Doppelpunkt.',
      ],
      solution: 'd:',
      failMessage: 'Der Prompt zeigt noch nicht Laufwerk D:.',
    },
    {
      id: 'cls',
      title: 'Bildschirm leeren',
      description: 'Der Bildschirm ist voll. Mach ihn sauber.',
      verify: (sys) => sys.ran('cls', (e) => !e.args.includes('/?')),
      hints: ['Der Befehl steht für „clear screen“.', 'Er hat drei Buchstaben.'],
      solution: 'cls',
    },
    {
      id: 'help',
      title: 'Hilfe mit Parameter',
      description: 'Rufe die Hilfe für den Befehl cls auf.',
      verify: (sys) => sys.ran('help', (e) => hasArg(e, 'cls')),
      hints: [
        'Hilfe gibt es von einem Befehl, der so heißt wie das englische Wort dafür.',
        'Als Parameter übergibst du den Befehl, zu dem du Hilfe möchtest.',
      ],
      solution: 'help cls',
    },
    {
      id: 'option',
      title: 'Hilfe mit Option',
      description: 'Es geht auch kürzer: Frage den Befehl selbst nach seiner Hilfe.',
      verify: (sys) => sys.ran('cls', (e) => e.args.includes('/?')),
      hints: [
        'Fast jeder Befehl versteht eine Option, die mit einem Schrägstrich beginnt und aus einem Fragezeichen besteht.',
        'Sie wird an den Befehl selbst gehängt, hier also an den, dessen Hilfe du lesen willst.',
      ],
      solution: 'cls /?',
    },
    {
      id: 'pipe',
      title: 'Piping (Verkettung)',
      description:
        'Die Hilfe ist oft lang. Gib sie seitenweise aus, indem du die Ausgabe von help an den Befehl more weiterreichst.',
      verify: (sys) => sys.ran('help', (e) => e.pipeline[0] === 'more'),
      hints: [
        'Das Pipe-Zeichen „|“ reicht die Ausgabe eines Befehls an den nächsten weiter.',
        'Links vom Zeichen steht help, rechts der Befehl, der seitenweise anzeigt.',
      ],
      solution: 'help | more',
    },
    {
      id: 'redirect',
      title: 'Ausgabe umleiten',
      description: 'Speichere die Hilfe-Liste in der Datei befehle.txt.',
      verify: (sys) => (findFile(sys, 'befehle.txt') ?? '').includes('DIR'),
      hints: [
        'Mit dem Zeichen „>“ lenkst du die Ausgabe in eine Datei um, statt sie anzuzeigen.',
        'Links vom Zeichen steht der Befehl, rechts der Dateiname.',
      ],
      solution: 'help > befehle.txt',
      failMessage: 'befehle.txt fehlt oder enthält die Hilfe-Liste nicht.',
    },
    {
      id: 'type',
      title: 'Dateiinhalt prüfen',
      description: 'Lies den Inhalt der Datei befehle.txt.',
      verify: (sys) =>
        ranAny(sys, ['type', 'get-content', 'cat'], (e) =>
          e.args.some((a) => /befehle\.txt/i.test(a))
        ),
      hints: [
        'Textdateien zeigt der Befehl, der wie das englische Wort für „tippen“ heißt.',
        'Hinter dem Befehl steht der Dateiname.',
      ],
      solution: 'type befehle.txt',
    },
  ],
  flagSeed: (sys) => `befehle=${(findFile(sys, 'befehle.txt') ?? '').length}`,
};

const video3: WindowsMission = {
  id: 'cmd-video-3',
  title: 'CMD Mission 3: Datenträger',
  description: 'Verwaltung von Laufwerken: Prompt, Label, Vol und Format.',
  difficulty: 'fortgeschritten',
  durationMin: 12,
  steps: [
    {
      id: 'prompt-short',
      title: 'Prompt kürzen',
      description:
        'Der Prompt soll nur noch das Größer-Zeichen zeigen. Dafür steht der Platzhalter $G.',
      verify: (sys) => sys.getPromptFormat().toLowerCase() === '$g',
      hints: [
        'Den Prompt änderst du mit dem Befehl, der so heißt wie das englische Wort dafür.',
        'Dahinter steht der Platzhalter für das Größer-Zeichen.',
      ],
      solution: 'prompt $g',
      failMessage: 'Der Prompt zeigt noch mehr als das Größer-Zeichen.',
    },
    {
      id: 'prompt-path',
      title: 'Prompt wiederherstellen',
      description:
        'Zeige wieder den Pfad und das Größer-Zeichen an. Der Pfad hat den Platzhalter $P.',
      verify: (sys) => sys.getPromptFormat().toLowerCase() === '$p$g' && sys.ran('prompt'),
      hints: [
        'Wieder der Prompt-Befehl, nur mit zwei Platzhaltern hintereinander.',
        'Erst der Platzhalter für den Pfad, dann der für das Größer-Zeichen.',
      ],
      solution: 'prompt $p$g',
      failMessage: 'Der Prompt zeigt noch nicht Pfad und Größer-Zeichen.',
    },
    {
      id: 'vol',
      title: 'Volume-Info',
      description: 'Zeige die Informationen zum aktuellen Laufwerk an.',
      verify: (sys) => sys.ran('vol'),
      hints: ['Der Befehl ist die Abkürzung für „volume“.', 'Er hat drei Buchstaben.'],
      solution: 'vol',
    },
    {
      id: 'label',
      title: 'Bezeichnung ändern',
      description: 'Gib dem Laufwerk C: die Bezeichnung test.',
      verify: (sys) => sys.getVolume('C')?.label.toLowerCase() === 'test',
      hints: [
        'Die Bezeichnung eines Datenträgers setzt ein Befehl, der wie das englische Wort für „Etikett“ heißt.',
        'Hinter dem Befehl steht die neue Bezeichnung. Prüfe das Ergebnis danach mit dem Volume-Befehl.',
      ],
      solution: 'label test',
      failMessage: 'Laufwerk C: hat noch nicht die Bezeichnung test.',
    },
    {
      id: 'chkdsk',
      title: 'Datenträger prüfen',
      description: 'Prüfe das Laufwerk auf Fehler.',
      verify: (sys) => sys.ran('chkdsk'),
      hints: ['Der Name steht für „check disk“.', 'Er braucht hier keine Argumente.'],
      solution: 'chkdsk',
    },
    {
      id: 'format',
      title: 'Formatieren (Simulation)',
      description:
        'Der USB-Stick F: enthält noch Dateien. Formatiere ihn schnell mit dem Dateisystem exFAT.',
      verify: (sys) => sys.getVolume('F')?.fs === 'exFAT' && !sys.exists('F:\\urlaub.jpg'),
      hints: [
        'Formatieren übernimmt der Befehl, der wie das englische Wort dafür heißt; dahinter steht das Laufwerk.',
        'Die Option „/q“ steht für eine Schnellformatierung.',
        'Das Dateisystem gibst du mit der Option „/fs:“ und dem Namen an.',
      ],
      solution: 'format f: /q /fs:exfat',
      failMessage: 'Laufwerk F: ist noch nicht mit exFAT formatiert.',
    },
  ],
  flagSeed: (sys) => `C=${sys.getVolume('C')?.label.toLowerCase()}|F=${sys.getVolume('F')?.fs}`,
};

const video4: WindowsMission = {
  id: 'cmd-video-4',
  title: 'CMD Mission 4: Diskpart Master',
  description: 'Fortgeschrittene Partitionierung mit DISKPART (Video 4).',
  difficulty: 'profi',
  durationMin: 15,
  steps: [
    {
      id: 'start',
      title: 'Diskpart starten',
      description: 'Du willst partitionieren. Starte das Werkzeug.',
      verify: (sys) => sys.getMode() === 'diskpart',
      hints: [
        'Das Programm startest du direkt aus der Eingabeaufforderung.',
        'Der Befehl setzt sich aus „disk“ und „part“ zusammen.',
      ],
      solution: 'diskpart',
    },
    {
      id: 'list',
      title: 'Disks auflisten',
      description: 'Zeige alle Datenträger an.',
      verify: (sys) => sys.ran('list', (e) => firstArg(e) === 'disk', 'diskpart'),
      hints: [
        'Auflisten kann Diskpart mit dem Befehl, der „Liste“ heißt.',
        'Als Argument sagst du, was aufgelistet werden soll.',
      ],
      solution: 'list disk',
    },
    {
      id: 'select',
      title: 'Disk wählen',
      description: 'Du arbeitest mit Disk 2, dem USB-Stick. Wähle ihn aus.',
      verify: (sys) => sys.getSelectedDisk() === 2,
      hints: [
        'Mit dem Auswahlbefehl legst du fest, womit die nächsten Befehle arbeiten.',
        'Nenne die Art (disk) und die Nummer.',
      ],
      solution: 'select disk 2',
      failMessage: 'Disk 2 ist noch nicht ausgewählt (Sternchen in list disk).',
    },
    {
      id: 'clean',
      title: 'Disk bereinigen',
      description: 'Lösche alle Partitionen auf der ausgewählten Disk.',
      verify: (sys) => sys.getDisk(2)?.partitions.length === 0,
      hints: [
        'Der Befehl heißt wie das englische Wort für „sauber machen“.',
        'Er braucht keine Argumente und wirkt auf die ausgewählte Disk. Vorsicht: Im echten System ist alles darauf weg.',
      ],
      solution: 'clean',
      failMessage: 'Auf Disk 2 gibt es noch Partitionen.',
    },
    {
      id: 'convert',
      title: 'Zu GPT konvertieren',
      description: 'Konvertiere die Disk in den Partitionsstil GPT.',
      verify: (sys) => sys.getDisk(2)?.style === 'GPT',
      hints: [
        'Den Partitionsstil ändert ein Befehl, der wie das englische Wort für „umwandeln“ heißt.',
        'Das Argument ist der Name des Stils: GPT.',
      ],
      solution: 'convert gpt',
      failMessage: 'Disk 2 hat noch nicht den Stil GPT.',
    },
    {
      id: 'create',
      title: 'Partition erstellen',
      description: 'Erstelle eine primäre Partition, die den gesamten freien Platz belegt.',
      verify: (sys) => sys.getDisk(2)?.partitions.length === 1 && sys.getDisk(2)?.style === 'GPT',
      hints: [
        'Neue Dinge entstehen mit dem Befehl, der „erstellen“ heißt.',
        'Als Argumente nennst du erst, was (partition), dann die Art (primary).',
      ],
      solution: 'create partition primary',
      failMessage: 'Auf Disk 2 gibt es noch keine Partition.',
    },
    {
      id: 'format',
      title: 'Formatieren',
      description: 'Formatiere die Partition schnell mit NTFS und gib ihr die Bezeichnung MP3.',
      verify: (sys) => {
        const part = sys.getDisk(2)?.partitions[0];
        return part?.fs === 'NTFS' && part.label === 'MP3';
      },
      hints: [
        'Formatiert wird mit dem Befehl, der wie das englische Wort dafür heißt.',
        'Die Optionen heißen quick, fs= und label=; die Reihenfolge ist egal.',
      ],
      solution: 'format quick fs=ntfs label=MP3',
      failMessage: 'Die Partition ist noch nicht mit NTFS formatiert und als MP3 benannt.',
    },
    {
      id: 'assign',
      title: 'Buchstaben zuweisen',
      description: 'Gib der Partition den Laufwerksbuchstaben X.',
      verify: (sys) => sys.getVolume('X')?.label === 'MP3' && sys.isDir('X:\\'),
      hints: [
        'Buchstaben vergibt der Befehl, der „zuweisen“ heißt.',
        'Als Option nennst du den Buchstaben mit „letter“.',
      ],
      solution: 'assign letter x',
      failMessage: 'Es gibt noch kein Laufwerk X:.',
    },
    {
      id: 'exit',
      title: 'Beenden',
      description: 'Verlasse Diskpart wieder.',
      verify: (sys) => sys.getMode() === 'cmd',
      hints: [
        'Programme beendest du in der Konsole meist mit dem englischen Wort für „Ausgang“.',
        'Der Befehl hat vier Buchstaben.',
      ],
      solution: 'exit',
      failMessage: 'Du bist noch in Diskpart.',
    },
  ],
  flagSeed: (sys) =>
    `style=${sys.getDisk(2)?.style}|X=${sys.getVolume('X')?.fs}:${sys.getVolume('X')?.label}`,
};

const advanced: WindowsMission = {
  id: 'windows-advanced-1',
  title: 'Windows Expert Challenge',
  description:
    'Anspruchsvolle Aufgaben für Fortgeschrittene: WMIC, geplante Aufgaben, Registry, Firewall und Umleitungen.',
  difficulty: 'profi',
  durationMin: 20,
  steps: [
    {
      id: 'wmic-bios',
      title: 'WMIC: BIOS',
      description: 'Hole BIOS-Informationen mit WMIC.',
      verify: (sys) => sys.ran('wmic', (e) => firstArg(e) === 'bios'),
      hints: [
        'WMIC fragt Systeminformationen über Aliase ab; der Alias für das BIOS liegt auf der Hand.',
        'Nach dem Alias folgt das Wort „get“ und die gewünschten Eigenschaften.',
      ],
      solution: 'wmic bios get manufacturer,version',
    },
    {
      id: 'wmic-cpu',
      title: 'WMIC: Prozessor',
      description: 'Zeige Prozessor-Details mit WMIC an.',
      verify: (sys) => sys.ran('wmic', (e) => firstArg(e) === 'cpu'),
      hints: [
        'Gleiche Struktur wie beim BIOS, nur mit dem Alias für den Prozessor.',
        'Der Alias besteht aus drei Buchstaben.',
      ],
      solution: 'wmic cpu get name,numberofcores',
    },
    {
      id: 'sysinfo',
      title: 'Systeminformationen exportieren',
      description: 'Schreibe die Ausgabe von systeminfo in die Datei C:\\Temp\\sysinfo.txt.',
      verify: (sys) => (sys.readFile('C:\\Temp\\sysinfo.txt') ?? '').includes('Hostname'),
      hints: [
        'Der Befehl liefert eine lange Liste; mit dem Zeichen „>“ lenkst du sie in eine Datei um.',
        'Gib den vollständigen Pfad der Zieldatei an oder wechsle vorher nach C:\\Temp.',
      ],
      solution: 'systeminfo > C:\\Temp\\sysinfo.txt',
      failMessage: 'C:\\Temp\\sysinfo.txt fehlt oder enthält keine Systeminformationen.',
    },
    {
      id: 'schtasks-query',
      title: 'Geplante Aufgaben auflisten',
      description: 'Zeige alle geplanten Aufgaben an.',
      verify: (sys) => sys.ran('schtasks', (e) => hasArg(e, '/query')),
      hints: [
        'Geplante Aufgaben verwaltet ein Befehl, dessen Name aus „sch“ und „tasks“ besteht.',
        'Die Option zum Abfragen heißt wie das englische Wort für „Anfrage“.',
      ],
      solution: 'schtasks /query',
    },
    {
      id: 'schtasks-create',
      title: 'Aufgabe erstellen',
      description:
        'Erstelle die tägliche Aufgabe DailyBackup, die um 02:00 Uhr notepad.exe startet.',
      verify: (sys) => {
        const task = sys.getTask('DailyBackup');
        return (
          task !== undefined &&
          task.program.toLowerCase() === 'notepad.exe' &&
          task.schedule === 'DAILY' &&
          task.time === '02:00'
        );
      },
      hints: [
        'Derselbe Befehl wie beim Auflisten, nur mit der Option zum Erstellen.',
        'Name, Programm, Zeitplan und Startzeit gibst du mit /tn, /tr, /sc und /st an.',
      ],
      solution: 'schtasks /create /tn DailyBackup /tr notepad.exe /sc daily /st 02:00',
      failMessage: 'Die Aufgabe DailyBackup fehlt oder hat andere Werte.',
    },
    {
      id: 'reg-query',
      title: 'Registry abfragen',
      description:
        'Lies den ProductName aus HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion.',
      verify: (sys) =>
        sys.ran('reg', (e) => firstArg(e) === 'query' && e.output.includes('Windows 10 Pro')),
      hints: [
        'Die Registry bedienst du mit dem Befehl, der „registry“ abkürzt.',
        'Das Unterkommando zum Lesen heißt „query“; den Wertnamen gibst du mit /v an.',
      ],
      solution: 'reg query HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion /v ProductName',
      failMessage: 'Die Abfrage hat den ProductName noch nicht geliefert.',
    },
    {
      id: 'reg-add',
      title: 'Registry-Wert anlegen',
      description:
        'Lege unter HKCU\\Software\\AlexLab den Wert Level vom Typ REG_SZ mit den Daten Expert an.',
      verify: (sys) =>
        sys.getRegValue('HKCU\\Software\\AlexLab', 'Level')?.toLowerCase() === 'expert',
      hints: [
        'Dasselbe Programm wie beim Lesen, aber mit dem Unterkommando zum Hinzufügen.',
        'Name, Typ und Daten gibst du mit /v, /t und /d an.',
      ],
      solution: 'reg add HKCU\\Software\\AlexLab /v Level /t REG_SZ /d Expert',
      failMessage: 'Der Wert Level unter HKCU\\Software\\AlexLab fehlt oder hat andere Daten.',
    },
    {
      id: 'firewall',
      title: 'Firewall-Regel anlegen',
      description: 'Erlaube eingehenden TCP-Verkehr auf Port 8080 mit einer Regel namens AlexLab.',
      verify: (sys) => {
        const rule = sys.getFirewallRule('AlexLab');
        return (
          rule !== undefined &&
          rule.dir === 'in' &&
          rule.action === 'allow' &&
          rule.protocol === 'TCP' &&
          rule.localport === '8080'
        );
      },
      hints: [
        'Firewall-Regeln verwaltet der Befehl netsh im Kontext advfirewall firewall.',
        'Mit „add rule“ legst du eine Regel an; die Eigenschaften übergibst du als name=, dir=, action=, protocol= und localport=.',
      ],
      solution:
        'netsh advfirewall firewall add rule name="AlexLab" dir=in action=allow protocol=TCP localport=8080',
      failMessage: 'Die Regel AlexLab fehlt oder hat andere Eigenschaften.',
    },
    {
      id: 'reg-verify',
      title: 'Ergebnis prüfen',
      description: 'Lies den neuen Registry-Wert zurück, um zu sehen, dass er gespeichert wurde.',
      verify: (sys) =>
        sys.ran('reg', (e) => firstArg(e) === 'query' && e.output.includes('Expert')),
      hints: [
        'Genau wie beim ProductName, nur mit dem Schlüssel, den du gerade angelegt hast.',
        'Das Unterkommando ist wieder „query“.',
      ],
      solution: 'reg query HKCU\\Software\\AlexLab',
    },
  ],
  flagSeed: (sys) =>
    `task=${sys.getTask('DailyBackup')?.schedule}@${sys.getTask('DailyBackup')?.time}|reg=${sys.getRegValue('HKCU\\Software\\AlexLab', 'Level')?.toLowerCase()}|port=${sys.getFirewallRule('AlexLab')?.localport}`,
};

/** Reihenfolge der Liste: nach Schwierigkeit, innerhalb davon vom Einfachen zum Aufwendigen. */
export const windowsMissions: WindowsMission[] = [
  video1,
  cmdBasics,
  video2,
  cmdFiles,
  video3,
  networking,
  powershell,
  diskpart,
  video4,
  advanced,
];

export const getWindowsMissionById = (id: string): WindowsMission | undefined =>
  windowsMissions.find((m) => m.id === id);
