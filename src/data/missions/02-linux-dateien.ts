import type { V86Mission } from '../../lib/missions/missionTypes';
import { RESET_HOME, CHOWN_HOME } from './shared';

export const linuxFiles: V86Mission = {
  nr: '02',
  id: 'linux-files-1',
  track: 'linux',
  title: 'Dateiverwaltung',
  difficulty: 'einstieg',
  durationMin: 12,
  setup: `${RESET_HOME}
mkdir -p eingang/altlast
printf 'Quartalsbericht\\nUmsatz gestiegen.\\n' > eingang/bericht.txt
printf 'Rechnung 2024\\nBetrag offen.\\n' > eingang/rechnung-2024.txt
printf 'Notizen vom Montag\\n' > eingang/notizen.txt
printf 'Entwurf\\n' > eingang/entwurf.tmp
printf 'Zwischenspeicher\\n' > eingang/cache.tmp
printf 'alt\\n' > eingang/altlast/a.log
printf 'alt\\n' > eingang/altlast/b.log
${CHOWN_HOME}`,
  steps: [
    {
      id: 'struktur',
      title: 'Ordnerstruktur anlegen',
      description:
        'Lege das Verzeichnis `workspace` an, darin die beiden Unterverzeichnisse `docs` und `archiv`.',
      verify: '[ -d workspace/docs ] && [ -d workspace/archiv ]',
      hints: [
        'Mit `mkdir` legst du Verzeichnisse an, auch mehrere in einem Aufruf.',
        'Eine Option sorgt dafür, dass fehlende Elternverzeichnisse gleich mit angelegt werden. Du kannst die Verzeichnisse aber auch nacheinander anlegen.',
      ],
      solution: 'mkdir -p workspace/docs workspace/archiv',
      failMessage: 'Es fehlen `workspace/docs` und/oder `workspace/archiv`.',
    },
    {
      id: 'touch',
      title: 'Leere Datei anlegen',
      description: 'Lege in `workspace/docs` eine leere Datei `README.md` an.',
      verify: '[ -f workspace/docs/README.md ]',
      hints: [
        'Es gibt einen Befehl, der eine nicht vorhandene Datei leer anlegt.',
        'Er heißt `touch` und bekommt den Pfad der Datei als Argument.',
      ],
      solution: 'touch workspace/docs/README.md',
      failMessage: '`workspace/docs/README.md` gibt es noch nicht.',
    },
    {
      id: 'schreiben',
      title: 'In eine Datei schreiben',
      description:
        'Schreib die Zeile `Dateiverwaltung ist Handarbeit` in `workspace/docs/README.md`.',
      verify:
        "grep -qxE '[[:space:]]*Dateiverwaltung ist Handarbeit[[:space:]]*' workspace/docs/README.md",
      hints: [
        'Du kannst einen Editor wie `nano` benutzen oder die Ausgabe von `echo` umleiten.',
        'Mit `>` ersetzt du den Dateiinhalt, mit `>>` hängst du an. Der Text steht in Anführungszeichen.',
      ],
      solution: "echo 'Dateiverwaltung ist Handarbeit' > workspace/docs/README.md",
      failMessage: 'Die Datei muss eine Zeile genau mit diesem Text enthalten.',
    },
    {
      id: 'kopieren',
      title: 'Datei kopieren',
      description:
        'Kopiere `eingang/bericht.txt` nach `workspace/docs/`. Das Original bleibt in `eingang`.',
      verify:
        '[ -f eingang/bericht.txt ] && [ -f workspace/docs/bericht.txt ] && cmp -s eingang/bericht.txt workspace/docs/bericht.txt',
      hints: [
        'Zum Kopieren gibt es einen Befehl mit zwei Argumenten: Quelle und Ziel.',
        'Er heißt `cp`. Als Ziel genügt das Verzeichnis.',
      ],
      solution: 'cp eingang/bericht.txt workspace/docs/',
      failMessage: 'Die Kopie fehlt, oder das Original in `eingang` ist nicht mehr da.',
    },
    {
      id: 'verschieben',
      title: 'Datei verschieben',
      description:
        'Verschiebe `eingang/notizen.txt` nach `workspace/archiv/`. In `eingang` soll sie danach nicht mehr liegen.',
      verify: "[ ! -e eingang/notizen.txt ] && grep -rqs 'Notizen vom Montag' workspace/archiv",
      hints: [
        'Verschieben ist wie Kopieren, nur wird die Quelle entfernt.',
        'Der Befehl heißt `mv` und hat dieselbe Form wie `cp`.',
      ],
      solution: 'mv eingang/notizen.txt workspace/archiv/',
      failMessage: 'Die Notizen müssen in `workspace/archiv` liegen und nicht mehr in `eingang`.',
    },
    {
      id: 'umbenennen',
      title: 'Datei umbenennen',
      description: 'Benenne `workspace/archiv/notizen.txt` um in `notizen-alt.txt`.',
      verify: '[ -f workspace/archiv/notizen-alt.txt ] && [ ! -e workspace/archiv/notizen.txt ]',
      hints: [
        'Umbenennen ist in Linux ein Verschieben innerhalb desselben Verzeichnisses.',
        'Nutze `mv` mit dem alten und dem neuen Namen.',
      ],
      solution: 'mv workspace/archiv/notizen.txt workspace/archiv/notizen-alt.txt',
      failMessage: 'Im Archiv muss `notizen-alt.txt` liegen und `notizen.txt` fehlen.',
    },
    {
      id: 'loeschen',
      title: 'Temporäre Dateien löschen',
      description:
        'Lösche alle Dateien mit der Endung `.tmp` in `eingang`. `bericht.txt` und `rechnung-2024.txt` müssen bleiben.',
      verify:
        '[ -f eingang/bericht.txt ] && [ -f eingang/rechnung-2024.txt ] && [ -z "$(find eingang -name \'*.tmp\')" ]',
      hints: [
        'Zum Löschen dient `rm`. Es fragt nicht nach, ein gelöschter Eintrag ist weg.',
        'Mit einem Platzhalter (`*`) sprichst du mehrere Dateien an, die auf dasselbe Muster passen.',
      ],
      solution: 'rm eingang/*.tmp',
      failMessage: 'Es liegen noch `.tmp`-Dateien in `eingang`, oder du hast zu viel gelöscht.',
    },
    {
      id: 'rm-r',
      title: 'Verzeichnis löschen',
      description: 'Lösche das Verzeichnis `eingang/altlast` samt Inhalt.',
      verify: '[ ! -e eingang/altlast ] && [ -f eingang/bericht.txt ]',
      hints: [
        'Ein einfaches `rm` weigert sich bei Verzeichnissen.',
        'Eine Option macht `rm` rekursiv und löscht auch den Inhalt.',
      ],
      solution: 'rm -r eingang/altlast',
      failMessage: '`eingang/altlast` existiert noch.',
    },
  ],
  flag: `set -eo pipefail
h=$(cat workspace/archiv/notizen-alt.txt; grep -xE '[[:space:]]*Dateiverwaltung ist Handarbeit[[:space:]]*' workspace/docs/README.md | head -n1)
h=$(printf '%s' "$h" | tr -d '[:space:]' | sha256sum | cut -c1-12)
printf 'FLAG{dateien-%s}\\n' "$h"`,
};
