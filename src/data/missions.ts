export interface MissionStep {
  id: string;
  title: string;
  description: string;
  hint: string;
  requiredCommand?: string;
  validationRegex?: RegExp;
  expectedOutput?: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category: 'linux' | 'docker' | 'git' | 'devops' | 'windows';
  estimatedTime: number; // in minutes
  steps: MissionStep[];
  prerequisites?: string[]; // Mission IDs
  minStarsRequired?: number; // Total stars needed
  requiredBadges?: string[]; // Badge IDs
  tags?: string[]; // e.g., ['ctf', 'debugging']
}

// ========================================
// LINUX BASICS MISSIONS
// ========================================

export const linuxBasicsMission: Mission = {
  id: 'linux-basics-1',
  title: 'Linux Grundlagen',
  description:
    'Lerne die wichtigsten Linux-Befehle kennen: Navigation, Dateiverwaltung und Systeminfos.',
  difficulty: 'beginner',
  category: 'linux',
  estimatedTime: 5,
  steps: [
    {
      id: '1',
      title: 'Wer bin ich?',
      description:
        'Willkommen im Terminal! Lass uns zuerst herausfinden, wer wir sind. Führe den Befehl "whoami" aus.',
      hint: 'Tippe "whoami" und drücke Enter.',
      requiredCommand: 'whoami',
    },
    {
      id: '2',
      title: 'Aktuelles Verzeichnis',
      description: 'Finde heraus, in welchem Verzeichnis du dich befindest.',
      hint: 'Der Befehl "pwd" (print working directory) zeigt dir den aktuellen Pfad.',
      requiredCommand: 'pwd',
    },
    {
      id: '3',
      title: 'Dateien auflisten',
      description: 'Schau dir an, welche Dateien und Verzeichnisse hier vorhanden sind.',
      hint: 'Der Befehl "ls" listet den Verzeichnisinhalt auf.',
      requiredCommand: 'ls',
    },
    {
      id: '4',
      title: 'Verzeichnis erstellen',
      description: 'Erstelle ein neues Verzeichnis namens "projekte".',
      hint: 'Benutze den Befehl "mkdir projekte".',
      requiredCommand: 'mkdir projekte',
    },
    {
      id: '5',
      title: 'Datei lesen',
      description: 'Lies den Inhalt der Datei "welcome.txt".',
      hint: 'Der Befehl "cat" zeigt Dateiinhalte an: "cat welcome.txt".',
      requiredCommand: 'cat welcome.txt',
    },
    {
      id: '6',
      title: 'Aufräumen',
      description: 'Das Terminal ist voll. Mach es sauber!',
      hint: 'Der Befehl "clear" löscht den Bildschirm.',
      requiredCommand: 'clear',
    },
  ],
};

export const linuxFilesMission: Mission = {
  id: 'linux-files-1',
  title: 'Dateiverwaltung',
  description:
    'Arbeite mit Dateien und Verzeichnissen: Erstellen, Kopieren, Verschieben und Löschen.',
  difficulty: 'beginner',
  category: 'linux',
  estimatedTime: 8,
  steps: [
    {
      id: '1',
      title: 'Arbeitsverzeichnis erstellen',
      description: 'Erstelle ein Verzeichnis "workspace" für diese Mission.',
      hint: 'Nutze "mkdir workspace".',
      requiredCommand: 'mkdir workspace',
    },
    {
      id: '2',
      title: 'Ins Verzeichnis wechseln',
      description: 'Wechsle in das neu erstellte Verzeichnis.',
      hint: 'Der Befehl "cd workspace" bringt dich in das Verzeichnis.',
      requiredCommand: 'cd workspace',
    },
    {
      id: '3',
      title: 'Datei erstellen',
      description: 'Erstelle eine leere Datei "README.md".',
      hint: 'Der Befehl "touch README.md" erstellt eine leere Datei.',
      requiredCommand: 'touch readme.md',
    },
    {
      id: '4',
      title: 'Verzeichnis auflisten',
      description: 'Überprüfe, ob die Datei erstellt wurde.',
      hint: 'Nutze "ls", um den Verzeichnisinhalt anzuzeigen.',
      requiredCommand: 'ls',
    },
    {
      id: '5',
      title: 'Zurück zum Home',
      description: 'Gehe zurück zum Home-Verzeichnis.',
      hint: 'Mit "cd .." gehst du ein Verzeichnis nach oben oder "cd ~" bringt dich direkt nach Hause.',
      validationRegex: /^cd\s+(\.\.|~)$/,
    },
  ],
};

// ========================================
// DOCKER MISSIONS
// ========================================

export const dockerBasicsMission: Mission = {
  id: 'docker-basics-1',
  title: 'Docker Grundlagen',
  description: 'Erste Schritte mit Docker: Container starten, verwalten und stoppen.',
  difficulty: 'intermediate',
  category: 'docker',
  estimatedTime: 10,
  prerequisites: ['linux-basics-1'],
  steps: [
    {
      id: '1',
      title: 'Docker Version prüfen',
      description: 'Überprüfe, ob Docker installiert ist und welche Version läuft.',
      hint: 'Der Befehl "docker --version" zeigt die installierte Version.',
      requiredCommand: 'docker --version',
    },
    {
      id: '2',
      title: 'Erster Container',
      description: 'Starte einen einfachen Hello-World Container.',
      hint: 'Nutze "docker run hello-world".',
      requiredCommand: 'docker run hello-world',
    },
    {
      id: '3',
      title: 'Container auflisten',
      description: 'Zeige alle laufenden Container an.',
      hint: 'Der Befehl "docker ps" listet aktive Container auf.',
      requiredCommand: 'docker ps',
    },
    {
      id: '4',
      title: 'Nginx starten',
      description: 'Starte einen Nginx-Webserver im Hintergrund auf Port 8080.',
      hint: 'Nutze "docker run -d -p 8080:80 nginx". Das -d startet im Hintergrund, -p bindet den Port.',
      validationRegex: /^docker\s+run\s+(-d|-p\s+8080:80|\s)+nginx$/,
    },
    {
      id: '5',
      title: 'Images anzeigen',
      description: 'Zeige alle heruntergeladenen Docker-Images an.',
      hint: 'Mit "docker images" siehst du alle lokalen Images.',
      requiredCommand: 'docker images',
    },
    {
      id: '6',
      title: 'Container stoppen',
      description: 'Stoppe alle laufenden Container.',
      hint: 'Nutze "docker stop $(docker ps -q)" um alle Container gleichzeitig zu stoppen.',
      validationRegex: /^docker\s+stop/,
    },
  ],
};

export const dockerComposeMission: Mission = {
  id: 'docker-compose-1',
  title: 'Docker Compose',
  description: 'Multi-Container Anwendungen mit docker-compose verwalten.',
  difficulty: 'advanced',
  category: 'docker',
  estimatedTime: 15,
  prerequisites: ['docker-basics-1'],
  steps: [
    {
      id: '1',
      title: 'Compose Version',
      description: 'Prüfe die installierte docker-compose Version.',
      hint: 'Nutze "docker-compose --version".',
      requiredCommand: 'docker-compose --version',
    },
    {
      id: '2',
      title: 'Compose-Datei erstellen',
      description: 'Erstelle eine docker-compose.yml Datei.',
      hint: 'Nutze "touch docker-compose.yml".',
      requiredCommand: 'touch docker-compose.yml',
    },
    {
      id: '3',
      title: 'Stack starten',
      description: 'Starte die Services im Hintergrund.',
      hint: 'Der Befehl "docker-compose up -d" startet alle definierten Services.',
      requiredCommand: 'docker-compose up -d',
    },
    {
      id: '4',
      title: 'Logs anzeigen',
      description: 'Zeige die Logs der laufenden Container an.',
      hint: 'Mit "docker-compose logs" siehst du alle Logs.',
      requiredCommand: 'docker-compose logs',
    },
    {
      id: '5',
      title: 'Stack beenden',
      description: 'Stoppe und entferne alle Container des Stacks.',
      hint: 'Nutze "docker-compose down" zum sauberen Beenden.',
      requiredCommand: 'docker-compose down',
    },
  ],
};

// ========================================
// GIT MISSIONS
// ========================================

export const gitBasicsMission: Mission = {
  id: 'git-basics-1',
  title: 'Git Grundlagen',
  description: 'Versionskontrolle mit Git: Repository erstellen, Änderungen verfolgen, committen.',
  difficulty: 'beginner',
  category: 'git',
  estimatedTime: 12,
  steps: [
    {
      id: '1',
      title: 'Git Version',
      description: 'Prüfe, ob Git installiert ist.',
      hint: 'Nutze "git --version".',
      requiredCommand: 'git --version',
    },
    {
      id: '2',
      title: 'Repository initialisieren',
      description: 'Erstelle ein neues Git-Repository im aktuellen Verzeichnis.',
      hint: 'Der Befehl "git init" initialisiert ein neues Repository.',
      requiredCommand: 'git init',
    },
    {
      id: '3',
      title: 'Status prüfen',
      description: 'Zeige den aktuellen Status des Repositories an.',
      hint: 'Mit "git status" siehst du den Status aller Dateien.',
      requiredCommand: 'git status',
    },
    {
      id: '4',
      title: 'Datei zur Staging Area',
      description: 'Füge die README.md zur Staging Area hinzu.',
      hint: 'Nutze "git add README.md" oder "git add ." für alle Dateien.',
      validationRegex: /^git\s+add/,
    },
    {
      id: '5',
      title: 'Ersten Commit',
      description: 'Erstelle deinen ersten Commit mit einer aussagekräftigen Nachricht.',
      hint: 'Nutze "git commit -m \'Initial commit\'".',
      validationRegex: /^git\s+commit\s+-m/,
    },
    {
      id: '6',
      title: 'Commit-Historie',
      description: 'Zeige die Commit-Historie an.',
      hint: 'Der Befehl "git log" zeigt alle Commits.',
      requiredCommand: 'git log',
    },
  ],
};

export const gitBranchingMission: Mission = {
  id: 'git-branching-1',
  title: 'Git Branching',
  description: 'Arbeite mit Branches: Erstellen, Wechseln, Mergen.',
  difficulty: 'intermediate',
  category: 'git',
  estimatedTime: 10,
  prerequisites: ['git-basics-1'],
  steps: [
    {
      id: '1',
      title: 'Branches anzeigen',
      description: 'Zeige alle vorhandenen Branches an.',
      hint: 'Mit "git branch" siehst du alle Branches.',
      requiredCommand: 'git branch',
    },
    {
      id: '2',
      title: 'Neuen Branch erstellen',
      description: 'Erstelle einen neuen Branch namens "feature".',
      hint: 'Nutze "git branch feature".',
      requiredCommand: 'git branch feature',
    },
    {
      id: '3',
      title: 'Branch wechseln',
      description: 'Wechsle zum neuen Branch.',
      hint: 'Mit "git checkout feature" wechselst du den Branch.',
      requiredCommand: 'git checkout feature',
    },
    {
      id: '4',
      title: 'Zurück zum Main',
      description: 'Wechsle zurück zum Main-Branch.',
      hint: 'Nutze "git checkout main" oder "git checkout master".',
      validationRegex: /^git\s+checkout\s+(main|master)$/,
    },
    {
      id: '5',
      title: 'Branch mergen',
      description: 'Merge den feature-Branch in den Main-Branch.',
      hint: 'Mit "git merge feature" holst du die Änderungen.',
      requiredCommand: 'git merge feature',
    },
  ],
};

// ========================================
// WINDOWS CMD/POWERSHELL MISSIONS
// ========================================

export const windowsBasicsMission: Mission = {
  id: 'windows-basics-1',
  title: 'Windows CMD Grundlagen',
  description:
    'Erste Schritte in der Windows-Eingabeaufforderung: Navigation, Systeminfos und grundlegende Befehle.',
  difficulty: 'beginner',
  category: 'windows',
  estimatedTime: 7,
  steps: [
    {
      id: '1',
      title: 'Willkommen in der CMD',
      description: 'Zeige die Windows-Version und Build-Nummer an.',
      hint: 'Der Befehl "ver" zeigt die aktuelle Windows-Version.',
      requiredCommand: 'ver',
    },
    {
      id: '2',
      title: 'Aktuelles Verzeichnis',
      description: 'Zeige das aktuelle Arbeitsverzeichnis an.',
      hint: 'Der Befehl "cd" ohne Parameter zeigt das aktuelle Verzeichnis.',
      requiredCommand: 'cd',
    },
    {
      id: '3',
      title: 'Verzeichnis auflisten',
      description: 'Liste alle Dateien und Ordner im aktuellen Verzeichnis auf.',
      hint: 'Nutze "dir" um den Verzeichnisinhalt anzuzeigen.',
      requiredCommand: 'dir',
    },
    {
      id: '4',
      title: 'Ordner erstellen',
      description: 'Erstelle einen neuen Ordner namens "Workspace".',
      hint: 'Der Befehl "mkdir Workspace" (oder "md Workspace") erstellt einen neuen Ordner.',
      validationRegex: /^(mkdir|md)\s+Workspace$/i,
    },
    {
      id: '5',
      title: 'Umgebungsvariablen anzeigen',
      description: 'Zeige alle Umgebungsvariablen des Systems an.',
      hint: 'Mit "set" kannst du alle Umgebungsvariablen auflisten.',
      requiredCommand: 'set',
    },
    {
      id: '6',
      title: 'Bildschirm löschen',
      description: 'Räume das Terminal auf, indem du den Bildschirm löschst.',
      hint: 'Der Befehl "cls" (clear screen) löscht den Bildschirm.',
      requiredCommand: 'cls',
    },
    {
      id: '7',
      title: 'IP-Konfiguration anzeigen',
      description: 'Zeige die Netzwerkkonfiguration deines Computers an.',
      hint: 'Der Befehl "ipconfig" zeigt deine Netzwerkeinstellungen.',
      requiredCommand: 'ipconfig',
    },
  ],
};

export const windowsFileManagementMission: Mission = {
  id: 'windows-files-1',
  title: 'Windows Dateiverwaltung',
  description:
    'Professioneller Umgang mit Dateien und Ordnern: Kopieren, Verschieben, Attribute ändern.',
  difficulty: 'beginner',
  category: 'windows',
  estimatedTime: 10,
  steps: [
    {
      id: '1',
      title: 'Arbeitsordner erstellen',
      description: 'Erstelle einen Ordner "TestProject" unter C:\\Temp.',
      hint: 'Nutze "mkdir C:\\Temp\\TestProject".',
      requiredCommand: 'mkdir C:\\Temp\\TestProject',
    },
    {
      id: '2',
      title: 'Zum Ordner navigieren',
      description: 'Wechsle in den neu erstellten Ordner.',
      hint: 'Mit "cd C:\\Temp\\TestProject" wechselst du ins Verzeichnis.',
      requiredCommand: 'cd C:\\Temp\\TestProject',
    },
    {
      id: '3',
      title: 'Textdatei erstellen',
      description: 'Erstelle eine neue Textdatei "README.txt" mit Inhalt.',
      hint: 'Nutze "echo Mein erstes Windows-Projekt > README.txt".',
      validationRegex: /^echo\s+.+\s*>\s*README\.txt$/i,
    },
    {
      id: '4',
      title: 'Dateiinhalt anzeigen',
      description: 'Zeige den Inhalt der README.txt Datei an.',
      hint: 'Der Befehl "type README.txt" zeigt den Dateiinhalt.',
      requiredCommand: 'type README.txt',
    },
    {
      id: '5',
      title: 'Datei kopieren',
      description: 'Kopiere README.txt nach BACKUP.txt.',
      hint: 'Mit "copy README.txt BACKUP.txt" kopierst du die Datei.',
      requiredCommand: 'copy README.txt BACKUP.txt',
    },
    {
      id: '6',
      title: 'Dateiattribute anzeigen',
      description: 'Zeige die Attribute aller Dateien im aktuellen Verzeichnis an.',
      hint: 'Der Befehl "attrib" zeigt Dateiattribute (Read-only, Hidden, System, Archive).',
      requiredCommand: 'attrib',
    },
    {
      id: '7',
      title: 'Datei verstecken',
      description: 'Setze das Hidden-Attribut für BACKUP.txt.',
      hint: 'Nutze "attrib +h BACKUP.txt" um die Datei zu verstecken.',
      requiredCommand: 'attrib +h BACKUP.txt',
    },
    {
      id: '8',
      title: 'Verzeichnisbaum anzeigen',
      description: 'Zeige die Ordnerstruktur grafisch an.',
      hint: 'Der Befehl "tree" zeigt eine Baumansicht der Verzeichnisstruktur.',
      requiredCommand: 'tree',
    },
  ],
};

export const windowsNetworkingMission: Mission = {
  id: 'windows-networking-1',
  title: 'Windows Netzwerk-Diagnose',
  description: 'Netzwerkprobleme diagnostizieren und beheben mit CMD-Tools.',
  difficulty: 'intermediate',
  category: 'windows',
  estimatedTime: 12,
  prerequisites: ['windows-basics-1'],
  steps: [
    {
      id: '1',
      title: 'Detaillierte Netzwerkinfo',
      description: 'Zeige alle Netzwerkadapter mit allen Details an.',
      hint: 'Der Befehl "ipconfig /all" zeigt extended Netzwerkinformationen.',
      requiredCommand: 'ipconfig /all',
    },
    {
      id: '2',
      title: 'DNS-Cache leeren',
      description: 'Lösche den DNS-Resolver-Cache.',
      hint: 'Mit "ipconfig /flushdns" wird der DNS-Cache geleert.',
      requiredCommand: 'ipconfig /flushdns',
    },
    {
      id: '3',
      title: 'Ping Test',
      description: 'Teste die Verbindung zu Google DNS (8.8.8.8) mit 4 Paketen.',
      hint: 'Nutze "ping 8.8.8.8" oder "ping -n 4 8.8.8.8" für exakt 4 Pakete.',
      validationRegex: /^ping\s+(-n\s+4\s+)?8\.8\.8\.8$/i,
    },
    {
      id: '4',
      title: 'Traceroute',
      description: 'Verfolge den Weg zu google.com.',
      hint: 'Der Befehl "tracert google.com" zeigt alle Hops zum Ziel.',
      requiredCommand: 'tracert google.com',
    },
    {
      id: '5',
      title: 'Aktive Verbindungen',
      description: 'Zeige alle aktiven TCP-Verbindungen und lauschende Ports an.',
      hint: 'Mit "netstat -an" siehst du alle Verbindungen und Ports.',
      requiredCommand: 'netstat -an',
    },
    {
      id: '6',
      title: 'Routing-Tabelle',
      description: 'Zeige die IP-Routing-Tabelle an.',
      hint: 'Der Befehl "route print" zeigt die Routing-Tabelle.',
      requiredCommand: 'route print',
    },
    {
      id: '7',
      title: 'ARP-Cache anzeigen',
      description: 'Zeige die ARP-Tabelle (IP zu MAC-Adressen Zuordnung).',
      hint: 'Mit "arp -a" siehst du den ARP-Cache.',
      requiredCommand: 'arp -a',
    },
    {
      id: '8',
      title: 'NSLookup',
      description: 'Finde die IP-Adresse von alexle135.de.',
      hint: 'Der Befehl "nslookup alexle135.de" löst den Domainnamen auf.',
      requiredCommand: 'nslookup alexle135.de',
    },
  ],
};

export const windowsDiskpartMission: Mission = {
  id: 'windows-diskpart-1',
  title: 'Diskpart - Datenträgerverwaltung',
  description:
    'Fortgeschrittene Datenträgerverwaltung mit Diskpart: Partitionen erstellen, formatieren, verwalten.',
  difficulty: 'advanced',
  category: 'windows',
  estimatedTime: 15,
  prerequisites: ['windows-basics-1', 'windows-files-1'],
  steps: [
    {
      id: '1',
      title: 'Diskpart starten',
      description: 'Starte das Diskpart-Dienstprogramm.',
      hint: 'Tippe einfach "diskpart" um das Tool zu starten.',
      requiredCommand: 'diskpart',
    },
    {
      id: '2',
      title: 'Datenträger auflisten',
      description: 'Liste alle physischen Datenträger auf.',
      hint: 'Im Diskpart-Kontext: "list disk" zeigt alle Festplatten.',
      requiredCommand: 'list disk',
    },
    {
      id: '3',
      title: 'Volumes anzeigen',
      description: 'Zeige alle Volumes (Partitionen) an.',
      hint: 'Der Befehl "list volume" zeigt alle Volumes mit Laufwerksbuchstaben.',
      requiredCommand: 'list volume',
    },
    {
      id: '4',
      title: 'Datenträger auswählen',
      description: 'Wähle Datenträger 1 aus (ACHTUNG: Im echten System niemals blind auswählen!).',
      hint: 'Mit "select disk 1" wählst du den Datenträger. ⚠️ In der Realität vorher prüfen!',
      requiredCommand: 'select disk 1',
    },
    {
      id: '5',
      title: 'Datenträger-Details',
      description: 'Zeige detaillierte Informationen zum ausgewählten Datenträger.',
      hint: 'Der Befehl "detail disk" zeigt alle Details zum aktiven Datenträger.',
      requiredCommand: 'detail disk',
    },
    {
      id: '6',
      title: 'Partitionen auflisten',
      description: 'Liste alle Partitionen des ausgewählten Datenträgers.',
      hint: 'Mit "list partition" siehst du alle Partitionen.',
      requiredCommand: 'list partition',
    },
    {
      id: '7',
      title: 'Volume auswählen',
      description: 'Wähle Volume D: aus.',
      hint: 'Nutze "select volume D" oder die Volume-Nummer mit "select volume 2".',
      validationRegex: /^select\s+volume\s+(D|2)$/i,
    },
    {
      id: '8',
      title: 'Volume-Informationen',
      description: 'Zeige Details zum ausgewählten Volume.',
      hint: 'Der Befehl "detail volume" zeigt Filesystem, Größe, Status etc.',
      requiredCommand: 'detail volume',
    },
    {
      id: '9',
      title: 'Diskpart verlassen',
      description: 'Beende Diskpart sicher.',
      hint: 'Mit "exit" verlässt du Diskpart.',
      requiredCommand: 'exit',
    },
  ],
};

export const windowsPowerShellMission: Mission = {
  id: 'windows-powershell-1',
  title: 'PowerShell Grundlagen',
  description:
    'Moderne Windows-Administration mit PowerShell: Cmdlets, Pipeline, Objektverarbeitung.',
  difficulty: 'intermediate',
  category: 'windows',
  estimatedTime: 14,
  prerequisites: ['windows-basics-1'],
  steps: [
    {
      id: '1',
      title: 'PowerShell Version',
      description: 'Zeige die installierte PowerShell-Version an.',
      hint: 'Der Befehl "$PSVersionTable" zeigt alle Versionsinformationen.',
      requiredCommand: '$PSVersionTable',
    },
    {
      id: '2',
      title: 'Get-Command',
      description: 'Zeige alle verfügbaren Cmdlets an (Ausgabe wird gekürzt).',
      hint: 'Mit "Get-Command" listest du alle Cmdlets auf.',
      requiredCommand: 'Get-Command',
    },
    {
      id: '3',
      title: 'Get-Help',
      description: 'Hole Hilfe zum Get-Process Cmdlet.',
      hint: 'Nutze "Get-Help Get-Process" für die Dokumentation.',
      requiredCommand: 'Get-Help Get-Process',
    },
    {
      id: '4',
      title: 'Prozesse auflisten',
      description: 'Zeige alle laufenden Prozesse an.',
      hint: 'Der Befehl "Get-Process" listet alle aktiven Prozesse.',
      requiredCommand: 'Get-Process',
    },
    {
      id: '5',
      title: 'Top 5 CPU-intensive Prozesse',
      description: 'Finde die 5 Prozesse mit der höchsten CPU-Nutzung.',
      hint: 'Nutze "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5".',
      validationRegex:
        /^Get-Process\s*\|\s*Sort(-Object)?\s+CPU\s+-Desc(ending)?\s*\|\s*Select(-Object)?\s+-First\s+5$/i,
    },
    {
      id: '6',
      title: 'Dienste anzeigen',
      description: 'Liste alle Windows-Dienste auf.',
      hint: 'Mit "Get-Service" siehst du alle Dienste und deren Status.',
      requiredCommand: 'Get-Service',
    },
    {
      id: '7',
      title: 'Laufende Dienste filtern',
      description: 'Zeige nur die laufenden Dienste an.',
      hint: 'Nutze "Get-Service | Where-Object {$_.Status -eq \'Running\'}".',
      validationRegex: /^Get-Service\s*\|\s*Where(-Object)?\s+/i,
    },
    {
      id: '8',
      title: 'Eventlog lesen',
      description: 'Zeige die letzten 10 System-Ereignisse an.',
      hint: 'Der Befehl "Get-EventLog -LogName System -Newest 10" holt die neuesten Events.',
      validationRegex: /^Get-EventLog\s+-LogName\s+System\s+-Newest\s+10$/i,
    },
    {
      id: '9',
      title: 'Systeminfo abrufen',
      description: 'Hole detaillierte Computerinformationen.',
      hint: 'Mit "Get-ComputerInfo" erhältst du umfangreiche Systeminfos.',
      requiredCommand: 'Get-ComputerInfo',
    },
    {
      id: '10',
      title: 'Dateien rekursiv suchen',
      description: 'Finde alle .log-Dateien im C:\\Windows\\ Verzeichnis.',
      hint: 'Nutze "Get-ChildItem -Path C:\\Windows -Filter *.log -Recurse -ErrorAction SilentlyContinue".',
      validationRegex: /^Get-ChildItem\s+.*-Filter\s+\*\.log.*-Recurse/i,
    },
  ],
};

export const windowsAdvancedMission: Mission = {
  id: 'windows-advanced-1',
  title: 'Windows Expert Challenge',
  description:
    'Anspruchsvolle Aufgaben für Fortgeschrittene: WMIC, Scheduled Tasks, Registry, Systemoptimierung.',
  difficulty: 'advanced',
  category: 'windows',
  estimatedTime: 20,
  prerequisites: ['windows-networking-1', 'windows-powershell-1', 'windows-diskpart-1'],
  steps: [
    {
      id: '1',
      title: 'WMIC Systeminformationen',
      description: 'Hole BIOS-Informationen mit WMIC.',
      hint: 'Der Befehl "wmic bios get manufacturer,version,serialnumber" zeigt BIOS-Details.',
      validationRegex: /^wmic\s+bios\s+get/i,
    },
    {
      id: '2',
      title: 'CPU-Informationen',
      description: 'Zeige Prozessor-Details mit WMIC an.',
      hint: 'Nutze "wmic cpu get name,numberofcores,numberoflogicalprocessors".',
      validationRegex: /^wmic\s+cpu\s+get/i,
    },
    {
      id: '3',
      title: 'Installierte Software',
      description: 'Liste alle installierten Programme auf (Ausgabe wird lang!).',
      hint: 'Mit "wmic product get name,version" siehst du alle Programme.',
      requiredCommand: 'wmic product get name,version',
    },
    {
      id: '4',
      title: 'Scheduled Tasks auflisten',
      description: 'Zeige alle geplanten Aufgaben an.',
      hint: 'Der Befehl "schtasks /query /fo LIST" listet alle Tasks.',
      validationRegex: /^schtasks\s+\/query/i,
    },
    {
      id: '5',
      title: 'Task erstellen',
      description:
        'Erstelle einen täglichen Task "DailyBackup" der um 02:00 Uhr notepad.exe startet.',
      hint: 'Nutze "schtasks /create /tn DailyBackup /tr notepad.exe /sc daily /st 02:00".',
      validationRegex: /^schtasks\s+\/create\s+\/tn\s+DailyBackup/i,
    },
    {
      id: '6',
      title: 'Registry-Wert abfragen',
      description: 'Zeige den ProductName aus der Windows-Registry.',
      hint: 'Mit "reg query HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion /v ProductName" holst du den Wert.',
      validationRegex: /^reg\s+query\s+HKLM/i,
    },
    {
      id: '7',
      title: 'Systeminformationen exportieren',
      description: 'Exportiere Systeminfos in eine Textdatei.',
      hint: 'Nutze "systeminfo > C:\\Temp\\sysinfo.txt" um die Ausgabe umzuleiten.',
      validationRegex: /^systeminfo\s*>.*\.txt$/i,
    },
    {
      id: '8',
      title: 'Laufende Prozesse nach Speicher sortieren',
      description: 'Liste Prozesse nach Speichernutzung sortiert (PowerShell).',
      hint: 'Nutze "Get-Process | Sort-Object WS -Descending | Select-Object -First 10 Name, WS".',
      validationRegex: /^Get-Process.*Sort.*WS.*Desc/i,
    },
    {
      id: '9',
      title: 'Netzwerk-Adapter konfigurieren',
      description: 'Zeige alle Netzwerk-Adapter mit PowerShell.',
      hint: 'Der Befehl "Get-NetAdapter" zeigt alle Adapter.',
      requiredCommand: 'Get-NetAdapter',
    },
    {
      id: '10',
      title: 'Windows Update Status',
      description: 'Prüfe den Status von Windows Update (PowerShell).',
      hint: 'Mit "Get-WindowsUpdateLog" erzeugst du ein Update-Log.',
      requiredCommand: 'Get-WindowsUpdateLog',
    },
    {
      id: '11',
      title: 'Firewall-Regeln anzeigen',
      description: 'Liste alle aktiven Firewall-Regeln auf.',
      hint: 'Nutze "netsh advfirewall firewall show rule name=all".',
      validationRegex: /^netsh\s+advfirewall\s+firewall\s+show/i,
    },
    {
      id: '12',
      title: 'System-Performance',
      description: 'Zeige aktuelle Performance-Metriken.',
      hint: 'Mit "typeperf "\\Processor(_Total)\\% Processor Time" -sc 5" holst du CPU-Statistiken.',
      validationRegex: /^typeperf/i,
    },
  ],
};

// ========================================
// USER PROVIDED VIDEO MISSIONS
// ========================================

export const cmdVideo1Mission: Mission = {
  id: 'cmd-video-1',
  title: 'CMD Mission 1: Einführung',
  description:
    'Einführung in die Windows-Eingabeaufforderung: Starten, Version prüfen und Anpassung.',
  difficulty: 'beginner',
  category: 'windows',
  estimatedTime: 5,
  steps: [
    {
      id: '1',
      title: 'CMD Starten',
      description:
        'Die Eingabeaufforderung ist geöffnet. Wir wollen wissen, welche Version wir nutzen. Tippe "ver" ein.',
      hint: 'Der Befehl "ver" zeigt die Windows-Version an.',
      requiredCommand: 'ver',
    },
    {
      id: '2',
      title: 'Farben anpassen',
      description:
        'Der Hintergrund soll Weiß und der Text Schwarz sein. Ändere die Farben mit "color f0".',
      hint: 'Nutze "color f0" (F=Weiß, 0=Schwarz).',
      validationRegex: /^color\s+[fF]0$/i,
    },
    {
      id: '3',
      title: 'Fenstertitel ändern',
      description: 'Gib dem Fenster einen eigenen Namen. Tippe "title MeinTerminal" ein.',
      hint: 'Nutze "title MeinTerminal".',
      validationRegex: /^title\s+.+$/i,
    },
    {
      id: '4',
      title: 'Explorer öffnen',
      description: 'Öffne den aktuellen Ordner im Windows Explorer. Tippe "start ." ein.',
      hint: 'Der Befehl "start ." öffnet das aktuelle Verzeichnis im Explorer.',
      requiredCommand: 'start .',
    },
  ],
};

export const cmdVideo2Mission: Mission = {
  id: 'cmd-video-2',
  title: 'CMD Mission 2: Syntax & Operatoren',
  description: 'Grundlegende Befehle, Parameter, Optionen und Umleitungen (Piping).',
  difficulty: 'beginner',
  category: 'windows',
  estimatedTime: 10,
  steps: [
    {
      id: '1',
      title: 'Laufwerk wechseln',
      description: 'Wir wollen auf ein anderes Laufwerk wechseln. Tippe "d:" ein.',
      hint: 'Tippe einfach den Laufwerksbuchstaben mit Doppelpunkt: "d:"',
      validationRegex: /^[a-zA-Z]:$/,
    },
    {
      id: '2',
      title: 'Bildschirm leeren',
      description: 'Der Bildschirm ist voll. Mach ihn sauber mit "cls".',
      hint: 'Nutze "cls" (Clear Screen).',
      requiredCommand: 'cls',
    },
    {
      id: '3',
      title: 'Hilfe mit Parameter',
      description: 'Rufe die Hilfe für den Befehl "cls" auf. Tippe "help cls" ein.',
      hint: 'Nutze "help cls".',
      requiredCommand: 'help cls',
    },
    {
      id: '4',
      title: 'Hilfe mit Option',
      description: 'Es geht auch kürzer. Nutze die Option /? für Hilfe. Tippe "cls /?" ein.',
      hint: 'Versuche "cls /?".',
      requiredCommand: 'cls /?',
    },
    {
      id: '5',
      title: 'Piping (Verkettung)',
      description:
        'Die Hilfe ist oft lang. Nutze "more" um sie seitenweise anzuzeigen. Tippe "help | more" ein.',
      hint: 'Nutze das Pipe-Symbol: "help | more".',
      requiredCommand: 'help | more',
    },
    {
      id: '6',
      title: 'Ausgabe umleiten',
      description: 'Speichere die Hilfe-Liste in einer Datei. Tippe "help > befehle.txt" ein.',
      hint: 'Nutze das Größer-als-Zeichen: "help > befehle.txt".',
      validationRegex: /^help\s*>\s*befehle\.txt$/i,
    },
    {
      id: '7',
      title: 'Dateiinhalt prüfen',
      description:
        'Lies den Inhalt der Datei, die du gerade erstellt hast. Tippe "type befehle.txt" ein.',
      hint: 'Nutze "type befehle.txt".',
      requiredCommand: 'type befehle.txt',
    },
  ],
};

export const cmdVideo3Mission: Mission = {
  id: 'cmd-video-3',
  title: 'CMD Mission 3: Datenträger',
  description: 'Verwaltung von Laufwerken: Prompt, Label, Vol und Format.',
  difficulty: 'intermediate',
  category: 'windows',
  estimatedTime: 12,
  steps: [
    {
      id: '1',
      title: 'Prompt anpassen',
      description: 'Der Prompt soll den Pfad und ein > zeigen. Tippe "prompt $p$g" ein.',
      hint: 'Der Befehl ist "prompt $p$g".',
      requiredCommand: 'prompt $p$g',
    },
    {
      id: '2',
      title: 'Volume Info',
      description: 'Zeige Infos zum aktuellen Laufwerk an. Tippe "vol" ein.',
      hint: 'Nutze "vol".',
      requiredCommand: 'vol',
    },
    {
      id: '3',
      title: 'Label ändern',
      description: 'Gib dem Laufwerk den Namen "test". Tippe "label test" ein.',
      hint: 'Nutze "label test".',
      validationRegex: /^label\s+.+$/i,
    },
    {
      id: '4',
      title: 'Check Disk',
      description: 'Prüfe das Laufwerk auf Fehler. Tippe "chkdsk" ein.',
      hint: 'Nutze "chkdsk".',
      requiredCommand: 'chkdsk',
    },
    {
      id: '5',
      title: 'Formatieren (Simulation)',
      description:
        'Simuliere das Formatieren von Laufwerk F: mit exFAT. Tippe "format f: /q /fs:exfat" ein.',
      hint: 'Nutze "format f: /q /fs:exfat".',
      validationRegex: /^format\s+[a-z]:\s+\/q\s+\/fs:exfat$/i,
    },
  ],
};

export const cmdVideo4Mission: Mission = {
  id: 'cmd-video-4',
  title: 'CMD Mission 4: Diskpart Master',
  description: 'Fortgeschrittene Partitionierung mit DISKPART (Video 4).',
  difficulty: 'advanced',
  category: 'windows',
  estimatedTime: 15,
  steps: [
    {
      id: '1',
      title: 'Diskpart starten',
      description: 'Wir wollen partitionieren. Starte das Tool mit "diskpart".',
      hint: 'Tippe "diskpart".',
      requiredCommand: 'diskpart',
    },
    {
      id: '2',
      title: 'Disks auflisten',
      description: 'Zeige alle Datenträger an. Tippe "list disk" ein.',
      hint: 'Nutze "list disk".',
      requiredCommand: 'list disk',
    },
    {
      id: '3',
      title: 'Disk wählen',
      description: 'Wir arbeiten mit Disk 2. Tippe "select disk 2" ein.',
      hint: 'Nutze "select disk 2".',
      requiredCommand: 'select disk 2',
    },
    {
      id: '4',
      title: 'Disk bereinigen',
      description: 'Lösche alles auf der Disk. Tippe "clean" ein.',
      hint: 'Nutze "clean".',
      requiredCommand: 'clean',
    },
    {
      id: '5',
      title: 'Zu GPT konvertieren',
      description: 'Konvertiere die Disk zu GPT. Tippe "convert gpt" ein.',
      hint: 'Nutze "convert gpt".',
      requiredCommand: 'convert gpt',
    },
    {
      id: '6',
      title: 'Partition erstellen',
      description: 'Erstelle eine primäre Partition. Tippe "create partition primary" ein.',
      hint: 'Nutze "create partition primary".',
      requiredCommand: 'create partition primary',
    },
    {
      id: '7',
      title: 'Formatieren',
      description:
        'Formatiere sie mit NTFS und nenne sie MP3. Tippe "format quick fs=ntfs label=MP3" ein.',
      hint: 'Nutze "format quick fs=ntfs label=MP3".',
      validationRegex: /^format\s+(quick\s+)?fs=ntfs\s+(quick\s+)?label=MP3$/i,
    },
    {
      id: '8',
      title: 'Buchstabe zuweisen',
      description: 'Gib ihr den Buchstaben X. Tippe "assign letter x" ein.',
      hint: 'Nutze "assign letter x".',
      validationRegex: /^assign\s+letter\s*=?\s*x$/i,
    },
    {
      id: '9',
      title: 'Beenden',
      description: 'Verlasse Diskpart wieder. Tippe "exit" ein.',
      hint: 'Nutze "exit".',
      requiredCommand: 'exit',
    },
  ],
};

// ========================================
// NEW CTF MISSIONS
// ========================================

export const linuxCTFHiddenTreasure: Mission = {
  id: 'linux-ctf-hidden-treasure',
  title: 'Hidden Treasure Hunt',
  description:
    'Ein Admin hat ein Passwort versteckt. Finde es mit versteckten Dateien, grep und base64.',
  difficulty: 'intermediate',
  category: 'linux',
  estimatedTime: 15,
  tags: ['ctf', 'files', 'encoding'],
  prerequisites: ['linux-files-1'],
  steps: [
    {
      id: '1',
      title: 'Versteckte Dateien finden',
      description:
        'Ein vergesslicher Admin hat das Root-Passwort irgendwo versteckt. Finde alle versteckten Dateien im Home-Verzeichnis.',
      hint: 'Dateien mit . am Anfang sind versteckt. Nutze "ls -a" um sie zu sehen.',
      requiredCommand: 'ls -a',
    },
    {
      id: '2',
      title: 'Verdächtige Datei untersuchen',
      description: 'Eine Datei heißt ".secret" - sieh dir ihren Inhalt an.',
      hint: 'Der Befehl "cat" zeigt Dateiinhalte an.',
      requiredCommand: 'cat .secret',
    },
    {
      id: '3',
      title: 'Base64 dekodieren',
      description: 'Der Inhalt ist Base64-verschlüsselt. Dekodiere ihn!',
      hint: 'Nutze "echo \'<text>\' | base64 -d" um Base64 zu dekodieren.',
      validationRegex: /base64.*-d/,
    },
    {
      id: '4',
      title: 'Passwort gefunden!',
      description: 'Du hast das Passwort gefunden: "SuperSecret123". Mission erfüllt!',
      hint: 'Geschafft! Du hast gelernt wie man versteckte Dateien findet und Base64 dekodiert.',
      requiredCommand: 'echo SuperSecret123',
    },
  ],
};

export const linuxCTFLogDetective: Mission = {
  id: 'linux-ctf-log-detective',
  title: 'Log Detective',
  description: 'Ein Server wurde gehackt. Analysiere die Logs und finde den Angreifer.',
  difficulty: 'advanced',
  category: 'linux',
  estimatedTime: 20,
  tags: ['ctf', 'logs', 'forensics'],
  prerequisites: ['linux-ctf-hidden-treasure'],
  steps: [
    {
      id: '1',
      title: 'Logs durchsuchen',
      description: 'Suche nach fehlgeschlagenen Login-Versuchen in /var/log/auth.log.',
      hint: 'Nutze "grep Failed /var/log/auth.log" um Fehlversuche zu finden.',
      validationRegex: /grep.*Failed.*auth\.log/,
    },
    {
      id: '2',
      title: 'IP-Adressen extrahieren',
      description: 'Welche IP-Adresse hat die meisten Fehlversuche? Nutze awk und sort.',
      hint: "Kombiniere: grep | awk '{print $11}' | sort | uniq -c | sort -nr | head -1",
      validationRegex: /grep.*\|.*awk.*\|.*sort/,
    },
    {
      id: '3',
      title: 'Erfolgreicher Einbruch',
      description: 'Finde den einen erfolgreichen Login dieser IP-Adresse.',
      hint: 'Nutze grep mit der gefundenen IP und "Accepted".',
      validationRegex: /grep.*Accepted/,
    },
  ],
};

export const linuxCTFPrivEsc: Mission = {
  id: 'linux-ctf-privesc',
  title: 'Privilege Escalation Puzzle',
  description:
    'Du bist User "bob" ohne sudo. Erlange Root-Rechte durch Finden von SUID-Schwachstellen.',
  difficulty: 'expert',
  category: 'linux',
  estimatedTime: 25,
  tags: ['ctf', 'security', 'permissions'],
  prerequisites: ['linux-ctf-log-detective'],
  minStarsRequired: 10,
  steps: [
    {
      id: '1',
      title: 'SUID-Binaries finden',
      description: 'Finde alle Programme mit SUID-Bit (laufen als Root).',
      hint: 'Nutze "find / -perm -4000 2>/dev/null".',
      validationRegex: /find.*-perm.*4000/,
    },
    {
      id: '2',
      title: 'Verdächtiges Binary',
      description: '/usr/local/bin/backup hat SUID und ist beschreibbar! Prüfe es.',
      hint: 'Nutze "ls -la /usr/local/bin/backup" um Permissions zu sehen.',
      validationRegex: /ls.*-l.*backup/,
    },
    {
      id: '3',
      title: 'Exploit',
      description: 'Nutze das Binary um Root-Shell zu bekommen.',
      hint: 'In einer echten Umgebung würdest du das Binary durch einen Symlink zu /bin/bash ersetzen.',
      requiredCommand: '/usr/local/bin/backup',
    },
  ],
};

export const dockerCTFInspect: Mission = {
  id: 'docker-ctf-inspect',
  title: 'Container Forensics Challenge',
  description:
    'Ein Container verhält sich verdächtig. Finde heraus was darin läuft und welche Secrets er enthält.',
  difficulty: 'advanced',
  category: 'docker',
  estimatedTime: 20,
  tags: ['ctf', 'docker', 'security'],
  prerequisites: ['docker-basics-1'],
  steps: [
    {
      id: '1',
      title: 'Laufende Container finden',
      description: 'Liste alle aktuell laufenden Docker Container auf.',
      hint: 'Nutze "docker ps" um Container zu sehen.',
      requiredCommand: 'docker ps',
    },
    {
      id: '2',
      title: 'Container Image prüfen',
      description: 'Welches Image wird verwendet? Liste alle Images auf.',
      hint: 'Mit "docker images" siehst du alle heruntergeladenen Images.',
      requiredCommand: 'docker images',
    },
    {
      id: '3',
      title: 'Container Details inspizieren',
      description: 'Inspiziere den web-server Container für verdächtige ENV-Variablen.',
      hint: 'Nutze "docker inspect web-server" (in einer realen Umgebung).',
      validationRegex: /docker.*inspect/,
    },
    {
      id: '4',
      title: 'Container stoppen',
      description: 'Stoppe den verdächtigen Container.',
      hint: 'Mit "docker stop CONTAINER_ID" stoppst du einen Container.',
      validationRegex: /docker stop/,
    },
  ],
};

export const gitCTFRewind: Mission = {
  id: 'git-ctf-rewind',
  title: 'Git Time Machine CTF',
  description:
    'Ein Developer hat aus Versehen ein Secret committed und dann gelöscht. Finde es in der Git History!',
  difficulty: 'intermediate',
  category: 'git',
  estimatedTime: 15,
  tags: ['ctf', 'git', 'security'],
  prerequisites: ['git-basics-1'],
  steps: [
    {
      id: '1',
      title: 'Repository Status prüfen',
      description: 'Prüfe ob das Git Repository initialisiert ist.',
      hint: 'Nutze "git status" um den Repository-Status zu sehen.',
      requiredCommand: 'git status',
    },
    {
      id: '2',
      title: 'Commit History durchsuchen',
      description: 'Zeige alle Commits an - einer enthält das Secret!',
      hint: 'Mit "git log" siehst du alle Commits. Nutze "--oneline" für Übersicht.',
      validationRegex: /git log/,
    },
    {
      id: '3',
      title: 'Gelöschte Datei finden',
      description: 'Das Secret war in .env - nutze git log um zu sehen wann es gelöscht wurde.',
      hint: 'Nutze "git log --all --full-history -- .env" um History einer Datei zu sehen.',
      validationRegex: /git log.*\.env/,
    },
    {
      id: '4',
      title: 'Alten Commit auschecken',
      description: 'Checke den Commit aus, wo .env noch existierte.',
      hint: 'Mit "git checkout COMMIT_HASH -- .env" holst du eine Datei aus einem alten Commit zurück.',
      validationRegex: /git checkout.*\.env/,
    },
  ],
};

// ========================================
// MISSION REGISTRY
// ========================================

export const allMissions: Mission[] = [
  // Linux Missions
  linuxBasicsMission,
  linuxFilesMission,
  // Linux CTF Missions (New)
  linuxCTFHiddenTreasure,
  linuxCTFLogDetective,
  linuxCTFPrivEsc,
  // Docker Missions
  dockerBasicsMission,
  dockerComposeMission,
  // Docker CTF Missions (New)
  dockerCTFInspect,
  // Git Missions
  gitBasicsMission,
  gitBranchingMission,
  // Git CTF Missions (New)
  gitCTFRewind,
  // CMD Video Missions (New)
  cmdVideo1Mission,
  cmdVideo2Mission,
  cmdVideo3Mission,
  cmdVideo4Mission,
  // Windows Missions (Existing)
  windowsBasicsMission,
  windowsFileManagementMission,
  windowsNetworkingMission,
  windowsPowerShellMission,
  windowsDiskpartMission,
  windowsAdvancedMission,
];

export const getMissionById = (id: string): Mission | undefined => {
  return allMissions.find((m) => m.id === id);
};

export const getMissionsByCategory = (category: Mission['category']): Mission[] => {
  return allMissions.filter((m) => m.category === category);
};

export const getMissionsByDifficulty = (difficulty: Mission['difficulty']): Mission[] => {
  return allMissions.filter((m) => m.difficulty === difficulty);
};
