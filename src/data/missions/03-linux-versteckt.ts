import type { V86Mission } from '../../lib/missions/missionTypes';
import { RESET_HOME, CHOWN_HOME, HELPERS } from './shared';

export const linuxCtfHiddenTreasure: V86Mission = {
  nr: '03',
  id: 'linux-ctf-hidden-treasure',
  track: 'linux',
  title: 'Hidden Treasure Hunt',
  difficulty: 'fortgeschritten',
  durationMin: 15,
  setup: `${RESET_HOME}
mkdir -p kiste insel/strand insel/wald insel/hoehle truhe
printf 'Hier ist nichts.\\n' > kiste/readme.txt
printf 'Die Karte steckt unterhalb von insel, in der einzigen Datei, die das Wort kompass enthaelt.\\n' > kiste/.schluessel
n=0
for d in strand wald hoehle; do
  for i in 1 2 3 4 5 6 7 8; do
    n=$((n + 1))
    printf 'Notiz %s vom Ort %s\\nMoewen, Wellen und Sand.\\nNichts Wichtiges hier.\\n' "$n" "$d" > "insel/$d/notiz-$i.txt"
  done
done
printf 'Wegweiser fuer Segler\\nDer kompass zeigt nach Norden.\\nSchatzcode (base64): %s\\n' "$(printf 'palme-kompass-4711' | base64)" > insel/wald/notiz-5.txt
printf 'Krone mit Edelsteinen\\nEdelsteine: 17\\n' > truhe/krone.txt
${CHOWN_HOME}
chmod 000 truhe`,
  steps: [
    {
      id: 'versteckt',
      title: 'Versteckte Datei finden',
      description:
        'Ein vergesslicher Admin hat einen Schatz versteckt. Im Verzeichnis `kiste` liegt eine versteckte Datei. Schreib ihren Namen in `fund1.txt`.',
      verify: `[ -f fund1.txt ] && [ "$(basename "$(tr -d '[:space:]' < fund1.txt)")" = .schluessel ]`,
      hints: [
        'Dateien, deren Name mit einem Punkt beginnt, zeigt `ls` normalerweise nicht an.',
        'Eine Option von `ls` (ein Buchstabe, "all") zeigt auch versteckte Einträge.',
      ],
      solution: 'ls -A kiste | grep "^\\." > fund1.txt',
      failMessage: 'In `fund1.txt` muss der Name der versteckten Datei in `kiste` stehen.',
    },
    {
      id: 'suchen',
      title: 'Die Karte finden',
      description:
        'Lies die versteckte Datei. Sie beschreibt, welche Datei unterhalb von `insel` du suchen musst. Schreib den Pfad dieser Datei in `fund2.txt`.',
      verify: `${HELPERS}pathis fund2.txt insel/wald/notiz-5.txt`,
      hints: [
        'Du musst den Inhalt aller Dateien in `insel` und den Unterverzeichnissen durchsuchen, nicht nur die Namen.',
        '`grep` kann rekursiv in einem Verzeichnis suchen. Eine weitere Option gibt nur die Dateinamen der Treffer aus.',
      ],
      solution: 'grep -rl kompass insel > fund2.txt',
      failMessage: 'In `fund2.txt` muss der Pfad der einzigen Datei mit dem Wort "kompass" stehen.',
    },
    {
      id: 'dekodieren',
      title: 'Schatzcode dekodieren',
      description:
        'Die gefundene Datei enthält einen Schatzcode, der mit base64 kodiert ist. Dekodiere ihn und schreib den Klartext in `schatz.txt`.',
      verify: `${HELPERS}fileis schatz.txt palme-kompass-4711`,
      hints: [
        'base64 ist keine Verschlüsselung, sondern eine Kodierung. Es gibt ein Programm dafür.',
        'Das Programm heißt `base64`, eine Option kehrt die Richtung um. Den Text gibst du per Pipe oder `echo` hinein.',
      ],
      solution: "tail -n1 insel/wald/notiz-5.txt | cut -d' ' -f3 | base64 -d > schatz.txt",
      failMessage: 'In `schatz.txt` muss der dekodierte Code stehen, ohne den Rest der Zeile.',
    },
    {
      id: 'truhe',
      title: 'Truhe öffnen',
      description:
        'Das Verzeichnis `truhe` ist verschlossen: Es hat keine Rechte mehr. Verschaffe dir als Besitzer wieder Zugriff, lies `krone.txt` und schreib die Anzahl der Edelsteine (nur die Zahl) in `edelsteine.txt`.',
      verify: `${HELPERS}fileis edelsteine.txt 17`,
      hints: [
        'Mit `ls -ld truhe` siehst du die Rechte. Als Besitzer darfst du sie ändern.',
        '`chmod` ändert Rechte. Für ein Verzeichnis brauchst du Lesen und Betreten (r und x) für dich als Besitzer (u).',
      ],
      solution:
        "chmod u+rx truhe && grep 'Edelsteine:' truhe/krone.txt | cut -d' ' -f2 > edelsteine.txt",
      failMessage: 'In `edelsteine.txt` muss die Zahl aus `truhe/krone.txt` stehen.',
    },
  ],
  flag: `set -eo pipefail
printf 'FLAG{%s-%s}\\n' "$(tr -d '[:space:]' < schatz.txt)" "$(tr -d '[:space:]' < edelsteine.txt)"`,
};
