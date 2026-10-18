// Durchläufe der Windows-Missionen über das MockWindowsSystem: je Schritt mindestens ein
// gültiger Weg, wo sinnvoll mehrere, und Fehlversuche, die den Schritt nicht erfüllen.
import { describe, expect, it } from 'vitest';
import { MockWindowsSystem } from '../../components/interactive/MockWindowsSystem';
import { WindowsMissionEngine } from '../../lib/missions/windowsEngine';
import { FLAG_PATTERN } from '../../lib/missions/missionTypes';
import { getWindowsMissionById, windowsMissions } from '../windowsMissions';

const EMOJI = /\p{Extended_Pictographic}/u;
const DIFFICULTIES = ['einstieg', 'fortgeschritten', 'profi'];

const EXPECTED_STEPS: Record<string, number> = {
  'cmd-video-1': 4,
  'windows-basics-1': 7,
  'cmd-video-2': 7,
  'windows-files-1': 8,
  'cmd-video-3': 6,
  'windows-networking-1': 8,
  'windows-powershell-1': 10,
  'windows-diskpart-1': 9,
  'cmd-video-4': 9,
  'windows-advanced-1': 9,
};

/** `ways`: gleichwertige Befehlsfolgen für den Schritt. `wrong`: Folgen, die ihn nicht erfüllen. */
interface StepCase {
  ways: string[][];
  wrong: string[][];
}

const step = (ways: string[][], wrong: string[][]): StepCase => ({ ways, wrong });

const CASES: Record<string, StepCase[]> = {
  'cmd-video-1': [
    step([['ver'], ['VER']], [['whoami']]),
    step([['color f0'], ['COLOR F0']], [['color 0f'], ['color 07']]),
    step([['title MeinTerminal'], ['title Mein Terminal']], [['echo title']]),
    step([['start .'], ['start C:\\Users\\visitor']], [['start NoSuch']]),
  ],
  'windows-basics-1': [
    step([['ver'], ['VER']], [['whoami']]),
    step(
      [
        ['cd Documents'],
        ['cd C:\\Users\\visitor\\Documents'],
        ['cd /d "C:\\Users\\visitor\\Documents"'],
      ],
      [['cd Desktop'], ['cd ..']]
    ),
    step([['dir'], ['dir C:\\']], [['echo dir']]),
    step(
      [['mkdir Workspace'], ['md Workspace'], ['md C:\\Users\\visitor\\Documents\\Workspace']],
      [['mkdir Falsch'], ['mkdir C:\\Workspace']]
    ),
    step(
      [['set MISSION=bereit'], ['set mission=BEREIT']],
      [['set MISSION=falsch'], ['set MISSION']]
    ),
    step([['cls']], [['cls /?']]),
    step([['ipconfig'], ['ipconfig /all']], [['ping 8.8.8.8']]),
  ],
  'cmd-video-2': [
    step([['d:'], ['cd /d D:\\'], ['D:']], [['c:']]),
    step([['cls'], ['CLS']], [['cls /?']]),
    step([['help cls'], ['HELP CLS']], [['help dir']]),
    step([['cls /?']], [['help cls'], ['dir /?']]),
    step([['help | more'], ['help|more']], [['help'], ['help | find "DIR"']]),
    step(
      [['help > befehle.txt'], ['help>befehle.txt'], ['help >> befehle.txt']],
      [['help > other.txt'], ['echo hallo > befehle.txt']]
    ),
    step([['type befehle.txt'], ['TYPE D:\\befehle.txt']], [['type nope.txt'], ['dir']]),
  ],
  'windows-files-1': [
    step(
      [['mkdir C:\\Temp\\TestProject'], ['cd C:\\Temp', 'md TestProject']],
      [['mkdir TestProject'], ['mkdir C:\\Temp\\Other']]
    ),
    step([['cd C:\\Temp\\TestProject'], ['cd C:\\Temp', 'cd TestProject']], [['cd ..']]),
    step(
      [
        ['echo Mein erstes Windows-Projekt > README.txt'],
        ['echo Hallo>README.txt'],
        ['echo Hallo > C:\\Temp\\TestProject\\README.txt'],
      ],
      [['echo Hallo'], ['echo Hallo > Other.txt'], ['echo > README.txt']]
    ),
    step([['type README.txt'], ['type C:\\Temp\\TestProject\\README.txt']], [['dir']]),
    step(
      [['copy README.txt BACKUP.txt'], ['copy README.txt C:\\Temp\\TestProject\\BACKUP.txt']],
      [['copy README.txt OTHER.txt']]
    ),
    step(
      [['attrib +h BACKUP.txt'], ['attrib +H "BACKUP.txt"']],
      [['attrib -h BACKUP.txt'], ['attrib +h README.txt']]
    ),
    step([['del README.txt'], ['del C:\\Temp\\TestProject\\README.txt']], [['del BACKUP.txt']]),
    step([['tree'], ['tree C:\\Temp']], [['dir']]),
  ],
  'cmd-video-3': [
    step([['prompt $g'], ['PROMPT $G']], [['prompt $p$g']]),
    step([['prompt $p$g'], ['prompt $P$G'], ['prompt']], [['prompt Lernen$g']]),
    step([['vol']], [['ver']]),
    step([['label test'], ['label C: test'], ['LABEL TEST']], [['label other'], ['label F: test']]),
    step([['chkdsk'], ['chkdsk C:']], [['vol']]),
    step(
      [['format f: /q /fs:exfat'], ['FORMAT F: /fs:exfat /q']],
      [['format f: /q /fs:ntfs'], ['format f: /q /fs:fat32']]
    ),
  ],
  'windows-networking-1': [
    step([['ipconfig /all'], ['IPCONFIG /ALL']], [['ipconfig']]),
    step([['ipconfig /flushdns'], ['ipconfig /FLUSHDNS']], [['ipconfig /displaydns']]),
    step([['ping 8.8.8.8'], ['ping -n 4 8.8.8.8']], [['ping 1.1.1.1']]),
    step([['tracert google.com'], ['TRACERT Google.com']], [['tracert example.org']]),
    step([['netstat -an'], ['netstat -a']], [['netstat']]),
    step([['route print'], ['ROUTE PRINT']], [['route']]),
    step([['arp -a']], [['arp']]),
    step([['nslookup alex-schneider.dev']], [['ping alex-schneider.dev']]),
  ],
  'windows-powershell-1': [
    step([['powershell'], ['POWERSHELL']], [['diskpart']]),
    step([['$PSVersionTable'], ['$psversiontable']], [['Get-Process']]),
    step([['Get-Help Get-Process']], [['Get-Help Get-Service']]),
    step([['Get-Process']], [['Get-Service']]),
    step(
      [
        ['Get-Process | Sort-Object CPU -Descending | Select-Object -First 5'],
        ['Get-Process | Sort CPU -Desc | Select -First 5'],
        ['Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First 5 Name, CPU'],
      ],
      [
        ['Get-Process | Sort-Object CPU -Descending | Select-Object -First 3'],
        ['Get-Process | Sort-Object CPU | Select-Object -First 5'],
        ['Get-Process | Select-Object -First 5'],
      ]
    ),
    step(
      [
        ["Get-Service | Where-Object {$_.Status -eq 'Running'}"],
        ['Get-Service | Where-Object Status -eq Running'],
        ['Get-Service | where Status -eq Running'],
      ],
      [['Get-Service'], ["Get-Service | Where-Object {$_.Status -eq 'Stopped'}"]]
    ),
    step(
      [
        ['New-Item -ItemType Directory -Path C:\\Temp\\PSLab'],
        ['mkdir C:\\Temp\\PSLab'],
        ['md C:\\Temp\\PSLab'],
      ],
      [['New-Item -ItemType Directory -Path C:\\Temp\\Other']]
    ),
    step(
      [
        ['Get-Process | Out-File C:\\Temp\\PSLab\\prozesse.txt'],
        ['Get-Process > C:\\Temp\\PSLab\\prozesse.txt'],
      ],
      [['Get-Service | Out-File C:\\Temp\\PSLab\\prozesse.txt']]
    ),
    step(
      [['Get-ChildItem C:\\Temp\\PSLab'], ['ls C:\\Temp\\PSLab'], ['dir C:\\Temp\\PSLab']],
      [['Get-ChildItem C:\\Temp']]
    ),
    step(
      [['Remove-Item C:\\Temp\\PSLab -Recurse'], ['rm C:\\Temp\\PSLab -Recurse']],
      [['Remove-Item C:\\Temp\\PSLab\\prozesse.txt']]
    ),
  ],
  'windows-diskpart-1': [
    step([['diskpart'], ['DISKPART']], [['powershell']]),
    step([['list disk'], ['LIST DISK']], [['list volume']]),
    step([['list volume']], [['list disk']]),
    step([['select disk 1']], [['select disk 0']]),
    step([['detail disk']], [['detail volume']]),
    step([['list partition']], [['list volume']]),
    step(
      [['select volume D'], ['select volume 2'], ['select volume d:']],
      [['select volume C'], ['select volume F']]
    ),
    step([['detail volume']], [['detail disk']]),
    step([['exit']], [['list disk']]),
  ],
  'cmd-video-4': [
    step([['diskpart']], [['powershell']]),
    step([['list disk']], [['list volume']]),
    step([['select disk 2']], [['select disk 1']]),
    step([['clean']], [['detail disk']]),
    step([['convert gpt'], ['CONVERT GPT']], [['convert mbr']]),
    step(
      [['create partition primary'], ['create partition primary size=16000']],
      [['list partition']]
    ),
    step(
      [
        ['format quick fs=ntfs label=MP3'],
        ['format fs=ntfs label=MP3 quick'],
        ['FORMAT QUICK FS=NTFS LABEL=MP3'],
      ],
      [['format quick fs=fat32 label=MP3'], ['format quick fs=ntfs label=USB']]
    ),
    step([['assign letter x'], ['assign letter=x'], ['assign letter=X']], [['assign letter y']]),
    step([['exit']], [['list volume']]),
  ],
  'windows-advanced-1': [
    step([['wmic bios get manufacturer,version'], ['WMIC BIOS GET']], [['wmic cpu get name']]),
    step([['wmic cpu get name,numberofcores'], ['wmic cpu get name']], [['wmic bios get']]),
    step(
      [['systeminfo > C:\\Temp\\sysinfo.txt'], ['cd C:\\Temp', 'systeminfo > sysinfo.txt']],
      [['systeminfo'], ['systeminfo > C:\\Temp\\other.txt']]
    ),
    step([['schtasks /query'], ['schtasks /query /fo LIST']], [['schtasks /query /tn Nope']]),
    step(
      [
        ['schtasks /create /tn DailyBackup /tr notepad.exe /sc daily /st 02:00'],
        ['schtasks /create /sc daily /st 02:00 /tn DailyBackup /tr notepad.exe'],
      ],
      [
        ['schtasks /create /tn DailyBackup /tr notepad.exe /sc weekly /st 02:00'],
        ['schtasks /create /tn DailyBackup /tr notepad.exe /sc daily /st 03:00'],
      ]
    ),
    step(
      [
        ['reg query HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion /v ProductName'],
        ['reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"'],
      ],
      [['reg query HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion /v Nope']]
    ),
    step(
      [
        ['reg add HKCU\\Software\\AlexLab /v Level /t REG_SZ /d Expert'],
        ['reg add HKCU\\Software\\AlexLab /d Expert /v Level /f'],
      ],
      [['reg add HKCU\\Software\\AlexLab /v Level /t REG_SZ /d Anfaenger']]
    ),
    step(
      [
        [
          'netsh advfirewall firewall add rule name="AlexLab" dir=in action=allow protocol=TCP localport=8080',
        ],
        [
          'netsh advfirewall firewall add rule name=AlexLab protocol=tcp dir=in localport=8080 action=allow',
        ],
      ],
      [
        [
          'netsh advfirewall firewall add rule name="AlexLab" dir=out action=allow protocol=TCP localport=8080',
        ],
        ['netsh advfirewall firewall show rule name=all'],
      ]
    ),
    step(
      [['reg query HKCU\\Software\\AlexLab'], ['reg query HKCU\\Software\\AlexLab /v Level']],
      [['reg query HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion']]
    ),
  ],
};

function newRun(missionId: string) {
  const mission = getWindowsMissionById(missionId)!;
  const sys = new MockWindowsSystem();
  const engine = new WindowsMissionEngine(mission, sys, { now: () => 0 });
  return { mission, sys, engine };
}

function type(run: ReturnType<typeof newRun>, commands: string[]) {
  for (const command of commands) {
    run.sys.processCommand(command);
    run.engine.afterCommand();
  }
}

/** Spielt die Schritte `0..upTo-1` mit dem Weg `variant` (oder dem ersten, falls es keinen gibt). */
function playSteps(
  run: ReturnType<typeof newRun>,
  cases: StepCase[],
  upTo: number,
  variant: number
) {
  cases.slice(0, upTo).forEach((c, i) => {
    type(run, c.ways[Math.min(variant, c.ways.length - 1)]);
    const snapshot = run.engine.snapshot();
    const label = `${run.mission.id} Schritt ${i + 1}`;
    if (i === cases.length - 1) {
      expect(snapshot.finishedAt, label).not.toBeNull();
    } else {
      expect(snapshot.stepIndex, label).toBe(i + 1);
    }
  });
}

describe('windowsMissions: Struktur', () => {
  it('enthält die erwarteten Missionen in dieser Reihenfolge, mit alten IDs', () => {
    expect(windowsMissions.map((m) => m.id)).toEqual(Object.keys(EXPECTED_STEPS));
  });

  it('hat die erwartete Schrittzahl und eine Testabdeckung je Schritt', () => {
    for (const mission of windowsMissions) {
      expect(mission.steps.length, mission.id).toBe(EXPECTED_STEPS[mission.id]);
      expect(CASES[mission.id]?.length, mission.id).toBe(mission.steps.length);
    }
  });

  it('hat eindeutige Mission- und Schritt-IDs', () => {
    const ids = windowsMissions.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const mission of windowsMissions) {
      const stepIds = mission.steps.map((s) => s.id);
      expect(new Set(stepIds).size, mission.id).toBe(stepIds.length);
    }
  });

  it('setzt gültige Schwierigkeit und Dauer', () => {
    for (const mission of windowsMissions) {
      expect(DIFFICULTIES).toContain(mission.difficulty);
      expect(Number.isInteger(mission.durationMin)).toBe(true);
      expect(mission.durationMin).toBeGreaterThan(0);
    }
  });

  describe.each(windowsMissions.map((m) => [m.id, m] as const))('%s', (_id, mission) => {
    it('gibt jedem Schritt Texte, verify, 2 bis 3 Tipps und eine Lösung', () => {
      expect(mission.title.trim()).not.toBe('');
      expect(mission.description.trim()).not.toBe('');
      for (const s of mission.steps) {
        const where = `${mission.id}/${s.id}`;
        expect(s.title.trim(), where).not.toBe('');
        expect(s.description.trim(), where).not.toBe('');
        expect(typeof s.verify, where).toBe('function');
        expect(s.solution.trim(), where).not.toBe('');
        expect(s.hints.length, where).toBeGreaterThanOrEqual(2);
        expect(s.hints.length, where).toBeLessThanOrEqual(3);
        for (const hint of s.hints) expect(hint.trim(), where).not.toBe('');
      }
    });

    it('verrät in keinem Tipp die vollständige Lösung', () => {
      for (const s of mission.steps) {
        const escaped = s.solution.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const whole = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
        for (const hint of s.hints) {
          expect(whole.test(hint), `${mission.id}/${s.id}: ${hint}`).toBe(false);
        }
      }
    });

    it('enthält keine Emojis in den Texten', () => {
      const texts = [
        mission.title,
        mission.description,
        ...mission.steps.flatMap((s) => [
          s.title,
          s.description,
          s.solution,
          s.failMessage ?? '',
          ...s.hints,
        ]),
      ];
      for (const text of texts) expect(EMOJI.test(text), text).toBe(false);
    });

    it('erfüllt im Ausgangszustand keinen Schritt', () => {
      const run = newRun(mission.id);
      expect(run.engine.afterCommand()).toBe('');
      expect(run.engine.snapshot().stepIndex).toBe(0);
    });
  });
});

describe('windowsMissions: Durchläufe', () => {
  describe.each(windowsMissions.map((m) => [m.id] as const))('%s', (id) => {
    const cases = CASES[id];
    const variants = Math.max(...cases.map((c) => c.ways.length));

    it.each(Array.from({ length: variants }, (_, v) => v))(
      'lässt sich auf Weg %i vollständig durchspielen',
      (variant) => {
        const run = newRun(id);
        playSteps(run, cases, cases.length, variant);
        const snapshot = run.engine.snapshot();
        expect(snapshot.flag).toMatch(FLAG_PATTERN);
        expect(snapshot.withSolution).toBe(false);
      }
    );

    it('liefert auf jedem Weg dieselbe Flagge', () => {
      const flags = Array.from({ length: variants }, (_, variant) => {
        const run = newRun(id);
        playSteps(run, cases, cases.length, variant);
        return run.engine.snapshot().flag;
      });
      expect(new Set(flags).size).toBe(1);
    });

    it.each(cases.map((_, i) => i))('besteht Schritt %i nicht mit falschem Zustand', (index) => {
      for (const wrong of cases[index].wrong) {
        const run = newRun(id);
        playSteps(run, cases, index, 0);
        type(run, wrong);
        const snapshot = run.engine.snapshot();
        expect(snapshot.finishedAt, wrong.join(' ; ')).toBeNull();
        expect(snapshot.stepIndex, wrong.join(' ; ')).toBe(index);
      }
    });
  });

  it('liefert für unterschiedliche Missionen unterschiedliche Flaggen', () => {
    const flags = windowsMissions.map((m) => {
      const run = newRun(m.id);
      playSteps(run, CASES[m.id], CASES[m.id].length, 0);
      return run.engine.snapshot().flag;
    });
    expect(new Set(flags).size).toBe(flags.length);
  });
});

describe('getWindowsMissionById', () => {
  it('findet jede Mission über ihre ID', () => {
    for (const mission of windowsMissions) expect(getWindowsMissionById(mission.id)).toBe(mission);
  });

  it('liefert für unbekannte IDs undefined', () => {
    expect(getWindowsMissionById('gibt-es-nicht')).toBeUndefined();
  });
});
