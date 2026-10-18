import type { V86Mission } from '../../lib/missions/missionTypes';
import { RESET_HOME, CHOWN_HOME, HELPERS } from './shared';

export const linuxBasics: V86Mission = {
  nr: '01',
  id: 'linux-basics-1',
  track: 'linux',
  title: 'Linux Grundlagen',
  difficulty: 'einstieg',
  durationMin: 8,
  setup: `${RESET_HOME}
mkdir -p lager/akten lager/archiv lager/tmp
for i in 1 2 3 4 5 6 7 8; do printf 'Eintrag %s\\n' "$i" > "lager/datei-$i.txt"; done
printf 'Willkommen im Terminal!\\nDas Codewort lautet: pinguin42\\nViel Erfolg.\\n' > willkommen.txt
${CHOWN_HOME}`,
  steps: [
    {
      id: 'benutzer',
      title: 'Wer bin ich?',
      description:
        'Finde mit einem Befehl heraus, unter welchem Benutzernamen du angemeldet bist, und schreib ihn in die Datei `antwort.txt`.',
      verify: `${HELPERS}fileis antwort.txt azubi`,
      hints: [
        'Es gibt einen kurzen Befehl, der den aktuellen Benutzernamen ausgibt.',
        'Der Befehl heißt "who am i" ohne Leerzeichen zusammengeschrieben. Mit `>` leitest du die Ausgabe eines Befehls in eine Datei um.',
      ],
      solution: 'whoami > antwort.txt',
      failMessage: 'In `antwort.txt` muss genau dein Benutzername stehen.',
    },
    {
      id: 'verzeichnis',
      title: 'Wo bin ich?',
      description:
        'Finde heraus, in welchem Verzeichnis du gerade bist (absoluter Pfad), und schreib den Pfad in die Datei `ort.txt`. Du solltest noch in deinem Home-Verzeichnis sein.',
      verify: `${HELPERS}fileis ort.txt /home/azubi`,
      hints: [
        'Der Befehl heißt wie "print working directory".',
        'Die Abkürzung hat drei Buchstaben. Leite die Ausgabe wieder mit `>` in die Datei um.',
      ],
      solution: 'pwd > ort.txt',
      failMessage: 'In `ort.txt` muss der absolute Pfad deines Home-Verzeichnisses stehen.',
    },
    {
      id: 'zaehlen',
      title: 'Einträge zählen',
      description:
        'Im Verzeichnis `lager` liegen Dateien und Ordner. Wie viele sichtbare Einträge (Dateien und Ordner zusammen) enthält es? Schreib die Zahl in `anzahl.txt`.',
      verify: `${HELPERS}fileis anzahl.txt 11`,
      hints: [
        'Mit `ls` kannst du den Inhalt eines Verzeichnisses auflisten, auch eines anderen als des aktuellen.',
        'Du kannst die Zeilen von Hand zählen oder die Ausgabe über eine Pipe (`|`) an `wc -l` übergeben.',
      ],
      solution: 'ls lager | wc -l > anzahl.txt',
      failMessage: 'Zähle Dateien und Ordner in `lager`, versteckte gibt es dort nicht.',
    },
    {
      id: 'mkdir',
      title: 'Verzeichnis anlegen',
      description: 'Lege in deinem Home-Verzeichnis ein neues Verzeichnis `projekte` an.',
      verify: '[ -d projekte ]',
      hints: [
        'Ein Verzeichnis legt man mit einem Befehl an, der "make directory" abkürzt.',
        'Der Befehl hat fünf Buchstaben und bekommt den neuen Namen als Argument.',
      ],
      solution: 'mkdir projekte',
      failMessage: 'Es gibt noch kein Verzeichnis `projekte` in /home/azubi.',
    },
    {
      id: 'lesen',
      title: 'Datei lesen',
      description:
        'In `willkommen.txt` steht ein Codewort. Lies die Datei und schreib nur das Codewort in die Datei `projekte/codewort.txt`.',
      verify: `${HELPERS}fileis projekte/codewort.txt pinguin42`,
      hints: [
        'Mit `cat` gibst du den Inhalt einer Datei aus.',
        'Das Codewort steht in der zweiten Zeile. Schreib es mit `echo` und `>` oder mit einem Editor wie `nano` in die neue Datei.',
      ],
      solution: 'cat willkommen.txt; echo pinguin42 > projekte/codewort.txt',
      failMessage: 'In `projekte/codewort.txt` darf nur das Codewort stehen.',
    },
  ],
  flag: `set -eo pipefail
h=$(cat antwort.txt ort.txt anzahl.txt projekte/codewort.txt | tr -d '[:space:]' | sha256sum | cut -c1-12)
printf 'FLAG{basics-%s}\\n' "$h"`,
};
