import type { V86Mission } from '../../lib/missions/missionTypes';
import { RESET_HOME, CHOWN_HOME, HELPERS, GIT_IDENTITY } from './shared';

export const gitBasics: V86Mission = {
  nr: '06',
  id: 'git-basics-1',
  track: 'git',
  title: 'Git Grundlagen',
  difficulty: 'einstieg',
  durationMin: 12,
  setup: `${RESET_HOME}
${GIT_IDENTITY}
mkdir projekt
printf '# Projekt\\n' > projekt/README.md
printf 'Ideen sammeln\\n' > projekt/notizen.txt
printf -- '- Git lernen\\n' > projekt/todo.txt
${CHOWN_HOME}`,
  steps: [
    {
      id: 'version',
      title: 'Git-Version ermitteln',
      description:
        'Finde heraus, welche Git-Version installiert ist, und schreib die Versionsnummer in die Datei `version.txt`.',
      verify: `[ -f version.txt ] && v=$(git --version | sed 's/^git version //') && n=$(tr -d '[:space:]' < version.txt) && { [ "$n" = "$v" ] || [ "$n" = "gitversion$v" ]; }`,
      hints: [
        'Die meisten Programme verraten ihre Version über eine Option mit zwei Strichen.',
        'Leite die Ausgabe mit `>` in die Datei um. Die Nummer allein oder die ganze Zeile genügt.',
      ],
      solution: 'git --version > ~/version.txt',
      failMessage: 'In `version.txt` muss die Ausgabe von Git zur Version stehen.',
    },
    {
      id: 'init',
      title: 'Repository anlegen',
      description:
        'Im Verzeichnis `projekt` liegen drei Dateien, aber noch keine Versionsverwaltung. Mach `projekt` zu einem Git-Repository.',
      verify: '[ "$(git -C projekt rev-parse --show-toplevel 2>/dev/null)" = /home/azubi/projekt ]',
      hints: [
        'Git legt ein verstecktes Verzeichnis `.git` an, sobald du ein Repository initialisierst.',
        'Der Unterbefehl heißt `init`. Er wirkt im aktuellen Verzeichnis, wechsle also zuerst nach `projekt`.',
      ],
      solution: 'git -C ~/projekt init',
      failMessage: 'In `projekt` gibt es noch kein eigenes Repository (Ordner `.git`).',
    },
    {
      id: 'status',
      title: 'Status lesen',
      description:
        'Wie viele Dateien kennt Git noch nicht ("untracked")? Schreib die Zahl in `anzahl.txt` in deinem Home-Verzeichnis.',
      verify: `${HELPERS}fileis anzahl.txt 3`,
      hints: [
        'Ein Git-Unterbefehl zeigt, welche Dateien neu, geändert oder vorgemerkt sind.',
        'Der Unterbefehl heißt `status`. Zähle die Dateien unter "Untracked files".',
      ],
      solution: "git -C ~/projekt status --porcelain | grep -c '^??' > ~/anzahl.txt",
      failMessage: 'Zähle die Dateien unter "Untracked files" in `git status`.',
    },
    {
      id: 'add',
      title: 'Datei vormerken',
      description: 'Merke `README.md` für den nächsten Commit vor (Staging Area).',
      verify: 'git -C projekt ls-files --error-unmatch README.md >/dev/null 2>&1',
      hints: [
        'Vor dem Commit musst du Git sagen, welche Änderungen hineingehören.',
        'Der Unterbefehl heißt `add` und bekommt den Dateinamen.',
      ],
      solution: 'git -C ~/projekt add README.md',
      failMessage: '`README.md` ist noch nicht vorgemerkt. `git status` zeigt den Stand.',
    },
    {
      id: 'commit',
      title: 'Ersten Commit erstellen',
      description: 'Erstelle den ersten Commit mit einer kurzen Nachricht deiner Wahl.',
      verify: 'git -C projekt cat-file -e HEAD:README.md 2>/dev/null',
      hints: [
        'Ein Commit hält den vorgemerkten Stand mit einer Nachricht fest.',
        'Der Unterbefehl heißt `commit`. Die Option `-m` nimmt die Nachricht direkt entgegen, sonst öffnet sich ein Editor.',
      ],
      solution: 'git -C ~/projekt commit -m "Erster Commit"',
      failMessage: 'Es gibt noch keinen Commit, der `README.md` enthält.',
    },
    {
      id: 'aendern',
      title: 'Änderung committen',
      description:
        'Hänge an `projekt/README.md` die Zeile `Git ist Versionskontrolle` an und halte die Änderung in einem zweiten Commit fest.',
      verify: `[ "$(git -C projekt rev-list --count HEAD 2>/dev/null)" -ge 2 ] && git -C projekt show HEAD:README.md | grep -qxE '[[:space:]]*Git ist Versionskontrolle[[:space:]]*'`,
      hints: [
        'Erst die Datei ändern (Editor oder `>>`), dann vormerken und committen.',
        'Für bereits bekannte Dateien gibt es beim Commit eine Abkürzung-Option, die das Vormerken übernimmt.',
      ],
      solution:
        "echo 'Git ist Versionskontrolle' >> ~/projekt/README.md && git -C ~/projekt commit -am 'README erweitert'",
      failMessage: 'Der letzte Commit muss die neue Zeile in `README.md` enthalten.',
    },
    {
      id: 'log',
      title: 'Historie auswerten',
      description:
        'Wie viele Commits hat das Repository? Schreib die Zahl in `commits.txt` in deinem Home-Verzeichnis.',
      verify: `${HELPERS}fileis commits.txt "$(git -C projekt rev-list --count HEAD)"`,
      hints: [
        'Die Historie zeigt ein Unterbefehl, dessen Name an ein Logbuch erinnert.',
        '`git log --oneline` gibt pro Commit eine Zeile aus, die du zählen oder mit `wc -l` zählen lassen kannst.',
      ],
      solution: 'git -C ~/projekt log --oneline | wc -l > ~/commits.txt',
      failMessage: 'Die Zahl in `commits.txt` passt nicht zur Anzahl der Commits.',
    },
  ],
  flag: `set -eo pipefail
h=$(git -C projekt show HEAD:README.md | tr -d '[:space:]' | sha256sum | cut -c1-12)
printf 'FLAG{git-%s}\\n' "$h"`,
};
