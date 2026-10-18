// Feste Daten und Beispielausgaben der Windows-Simulation (MockWindowsSystem).
// Alles ist erfunden und deterministisch; es gibt kein Netzwerk und keine Uhr.

export type PsValue = string | number;
export type PsRow = Record<string, PsValue>;

/** Tabellarisches Ergebnis eines Cmdlets; die Pipeline reicht es von Stufe zu Stufe weiter. */
export interface PsTable {
  columns: string[];
  rows: PsRow[];
}

export const CMD_COMMAND_LIST =
  'CD, CHKDSK, CLS, COLOR, COPY, DEL, DIR, ECHO, FORMAT, HELP, IPCONFIG, LABEL, MD, MKDIR, MORE, MOVE, PING, PROMPT, RD, REN, SET, START, TITLE, TYPE, VER, VOL, WHOAMI, POWERSHELL, DISKPART';

export const HELP_TEXTS: Record<string, string> = {
  cls: 'Löscht den Bildschirm.\r\n\r\nCLS\r\n',
  cd: 'Zeigt den Namen des aktuellen Verzeichnisses an oder wechselt das Verzeichnis.\r\n\r\nCD [Pfad]\r\n',
  dir: 'Zeigt eine Liste der Dateien und Unterverzeichnisse eines Verzeichnisses an.\r\n\r\nDIR [Pfad]\r\n',
  md: 'Erstellt ein Verzeichnis.\r\n\r\nMD [Pfad]\r\n',
  mkdir: 'Erstellt ein Verzeichnis.\r\n\r\nMKDIR [Pfad]\r\n',
  rd: 'Entfernt ein leeres Verzeichnis.\r\n\r\nRD [Pfad]\r\n',
  copy: 'Kopiert eine Datei.\r\n\r\nCOPY Quelle Ziel\r\n',
  move: 'Verschiebt eine Datei.\r\n\r\nMOVE Quelle Ziel\r\n',
  del: 'Löscht eine Datei.\r\n\r\nDEL Datei\r\n',
  ren: 'Benennt eine Datei oder ein Verzeichnis um.\r\n\r\nREN Name NeuerName\r\n',
  type: 'Zeigt den Inhalt einer Textdatei an.\r\n\r\nTYPE Datei\r\n',
  echo: 'Gibt Text aus. Mit > lässt sich die Ausgabe in eine Datei umleiten.\r\n\r\nECHO Text\r\n',
  ver: 'Zeigt die Windows-Version an.\r\n\r\nVER\r\n',
  help: 'Zeigt Hilfe zu Befehlen an.\r\n\r\nHELP [Befehl]\r\n',
  set: 'Zeigt Umgebungsvariablen an oder setzt sie.\r\n\r\nSET [Name=Wert]\r\n',
  color:
    'Setzt die Farben der Konsole. Die erste Ziffer ist der Hintergrund, die zweite der Text.\r\n\r\nCOLOR [Hintergrund Text]\r\n',
  title: 'Setzt den Fenstertitel.\r\n\r\nTITLE [Text]\r\n',
  prompt:
    'Ändert die Eingabeaufforderung. $P steht für den Pfad, $G für das Zeichen >.\r\n\r\nPROMPT [Text]\r\n',
  vol: 'Zeigt die Bezeichnung des Datenträgers an.\r\n\r\nVOL [Laufwerk:]\r\n',
  label: 'Setzt die Bezeichnung eines Datenträgers.\r\n\r\nLABEL [Bezeichnung]\r\n',
  format: 'Formatiert ein Laufwerk.\r\n\r\nFORMAT Laufwerk: [/Q] [/FS:Dateisystem]\r\n',
  attrib: 'Zeigt Dateiattribute an oder ändert sie.\r\n\r\nATTRIB [+H | -H] [Datei]\r\n',
};

export const PS_HELP_TEXTS: Record<string, string> = {
  'get-process':
    'NAME\r\n    Get-Process\r\n\r\nÜBERSICHT\r\n    Ruft die auf dem Computer ausgeführten Prozesse ab.\r\n',
  'get-service':
    'NAME\r\n    Get-Service\r\n\r\nÜBERSICHT\r\n    Ruft die Dienste auf dem Computer ab.\r\n',
  'get-childitem':
    'NAME\r\n    Get-ChildItem\r\n\r\nÜBERSICHT\r\n    Ruft die Elemente eines Ordners ab.\r\n',
  'new-item':
    'NAME\r\n    New-Item\r\n\r\nÜBERSICHT\r\n    Erstellt ein neues Element, zum Beispiel einen Ordner oder eine Datei.\r\n',
};

export const PS_VERSION_TABLE =
  'Name                           Value\r\n----                           -----\r\nPSVersion                      5.1.19041.3693\r\nPSEdition                      Desktop\r\nBuildVersion                   10.0.19041.3693\r\nCLRVersion                     4.0.30319.42000\r\n';

export const PROCESSES: PsTable = {
  columns: ['Handles', 'NPM(K)', 'PM(K)', 'WS(K)', 'CPU(s)', 'Id', 'ProcessName'],
  rows: [
    {
      Handles: 456,
      'NPM(K)': 23,
      'PM(K)': 124560,
      'WS(K)': 234560,
      'CPU(s)': 91.4,
      Id: 1234,
      ProcessName: 'chrome',
    },
    {
      Handles: 234,
      'NPM(K)': 15,
      'PM(K)': 87650,
      'WS(K)': 154320,
      'CPU(s)': 12.6,
      Id: 5678,
      ProcessName: 'powershell',
    },
    {
      Handles: 890,
      'NPM(K)': 41,
      'PM(K)': 61200,
      'WS(K)': 98700,
      'CPU(s)': 55.2,
      Id: 2210,
      ProcessName: 'explorer',
    },
    {
      Handles: 310,
      'NPM(K)': 12,
      'PM(K)': 40100,
      'WS(K)': 70300,
      'CPU(s)': 7.9,
      Id: 3342,
      ProcessName: 'code',
    },
    {
      Handles: 128,
      'NPM(K)': 8,
      'PM(K)': 12400,
      'WS(K)': 25100,
      'CPU(s)': 2.3,
      Id: 4410,
      ProcessName: 'notepad',
    },
    {
      Handles: 540,
      'NPM(K)': 19,
      'PM(K)': 33200,
      'WS(K)': 51800,
      'CPU(s)': 30.8,
      Id: 988,
      ProcessName: 'svchost',
    },
    {
      Handles: 76,
      'NPM(K)': 5,
      'PM(K)': 3100,
      'WS(K)': 8200,
      'CPU(s)': 0.4,
      Id: 612,
      ProcessName: 'lsass',
    },
  ],
};

export const SERVICES: PsTable = {
  columns: ['Status', 'Name', 'DisplayName'],
  rows: [
    { Status: 'Running', Name: 'Dhcp', DisplayName: 'DHCP Client' },
    { Status: 'Running', Name: 'Dnscache', DisplayName: 'DNS Client' },
    { Status: 'Stopped', Name: 'Fax', DisplayName: 'Fax' },
    { Status: 'Running', Name: 'Spooler', DisplayName: 'Druckerwarteschlange' },
    { Status: 'Stopped', Name: 'TapiSrv', DisplayName: 'Telefonie' },
    { Status: 'Running', Name: 'W32Time', DisplayName: 'Windows-Zeitgeber' },
  ],
};

export const NETSTAT_OUTPUT =
  '\r\nAktive Verbindungen\r\n\r\n  Proto  Lokale Adresse         Remoteadresse          Status\r\n  TCP    0.0.0.0:135            0.0.0.0:0              ABHÖREN\r\n  TCP    0.0.0.0:445            0.0.0.0:0              ABHÖREN\r\n  TCP    192.168.178.42:50321   142.250.185.78:443     HERGESTELLT\r\n';

export const ROUTE_PRINT_OUTPUT =
  '===========================================================================\r\nIPv4-Routentabelle\r\n===========================================================================\r\nAktive Routen:\r\n  Netzwerkziel    Netzwerkmaske      Gateway   Schnittstelle  Metrik\r\n        0.0.0.0          0.0.0.0  192.168.178.1  192.168.178.42     25\r\n  192.168.178.0    255.255.255.0       Auf Verbindung  192.168.178.42    281\r\n';

export const ARP_OUTPUT =
  '\r\nSchnittstelle: 192.168.178.42 --- 0x4\r\n  Internetadresse       Physische Adresse     Typ\r\n  192.168.178.1         3c-a6-2f-12-ab-cd     dynamisch\r\n  192.168.178.255       ff-ff-ff-ff-ff-ff     statisch\r\n';

export const SYSTEMINFO_OUTPUT =
  'Hostname:                  ALEX-SCHNEIDER\r\nBetriebssystemname:        Microsoft Windows 10 Pro\r\nBetriebssystemversion:     10.0.19045 Build 19045\r\nSystemtyp:                 x64-based PC\r\nGesamter physischer Speicher: 16.384 MB\r\n';

export const CHKDSK_OUTPUT =
  'Der Dateisystemtyp ist NTFS.\r\n\r\nWindows hat das Dateisystem überprüft und keine Probleme gefunden.\r\nEs sind keine weiteren Aktionen erforderlich.\r\n';

export const WMIC_OUTPUT: Record<string, string> = {
  bios: 'Manufacturer  SerialNumber  Version\r\nAlexTech      A1B2C3D4      ALEX - 1072009\r\n',
  cpu: 'Name                              NumberOfCores  NumberOfLogicalProcessors\r\nAMD Ryzen 7 5800X 8-Core          8              16\r\n',
};

export function tracertOutput(host: string): string {
  return `Routenverfolgung zu ${host} über maximal 30 Hops:\r\n\r\n  1    <1 ms    <1 ms    <1 ms  fritz.box [192.168.178.1]\r\n  2     9 ms     8 ms     9 ms  p3e9bc001.dip0.t-ipconnect.de [62.155.240.1]\r\n  3    12 ms    11 ms    12 ms  ae1.berlin.example.net [80.81.192.10]\r\n  4    14 ms    13 ms    14 ms  ${host} [142.250.185.78]\r\n\r\nRoutenverfolgung beendet.\r\n`;
}

export function nslookupOutput(host: string, ip: string): string {
  return `Server:  fritz.box\r\nAddress:  192.168.178.1\r\n\r\nNicht-autorisierende Antwort:\r\nName:    ${host}\r\nAddress:  ${ip}\r\n`;
}

/** Feste Adresse je Hostname; unbekannte Namen bekommen eine abgeleitete Adresse. */
export function resolveHost(host: string): string {
  const known: Record<string, string> = {
    'alex-schneider.dev': '203.0.113.17',
    'google.com': '142.250.185.78',
  };
  const lower = host.toLowerCase();
  if (known[lower]) return known[lower];
  let sum = 0;
  for (const ch of lower) sum = (sum + ch.charCodeAt(0)) % 200;
  return `198.51.100.${sum + 10}`;
}
