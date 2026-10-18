import { tools } from '../../lib/missions/glossar';
import type { V86Mission } from '../../lib/missions/missionTypes';
import { CHOWN_HOME, HELPERS, RESET_HOME } from './shared';

// Mission 00 lehrt die Bedienung, nicht Linux. Ob status, hint und flag schon benutzt wurden,
// steht als Marker /run/mission/used.<befehl> im Dateisystem; der Befehl `mission` legt ihn an.
const used = (command: string) => `[ -e /run/mission/used.${command} ]`;

export const ersterTag: V86Mission = {
  nr: '00',
  id: 'linux-erster-tag',
  track: 'linux',
  title: 'Erster Tag',
  difficulty: 'einstieg',
  durationMin: 3,
  countsTowardRun: false,
  setup: `${RESET_HOME}
rm -f /run/mission/used.*
cat > zettel-von-alex.txt <<'ZETTEL'
Moin!

Schön, dass du da bist. Ich bin im Urlaub, der Server gehört dir.
Bevor du loslegst, zeig ich dir kurz, wie du mit mir redest:

  mission status   was gerade dran ist
  mission hint     ein Tipp, wenn du hängst
  mission flag     deine Flagge, wenn alles erledigt ist

Was ein Befehl macht, sagt dir  erklaer <befehl>.

Alex
ZETTEL
${CHOWN_HOME}`,
  steps: [
    {
      id: 'status',
      title: 'Frag nach der Aufgabe',
      description:
        'Auf deinem Schreibtisch liegt `zettel-von-alex.txt`. Tipp im Terminal `mission status` und drück Enter. Das zeigt dir jederzeit, was gerade dran ist.',
      verify: used('status'),
      hints: [
        'Erst `mission`, dann ein Leerzeichen und das englische Wort für „Stand“.',
        'Alles klein schreiben, Linux unterscheidet Groß- und Kleinschreibung. Dann Enter.',
      ],
      solution: 'mission status',
      failMessage: 'Tipp `mission status` ins Terminal und drück Enter.',
    },
    {
      id: 'tipp',
      title: 'Hol dir einen Tipp',
      description:
        'Wenn du hängst, frag mich: `mission hint` gibt dir einen Tipp. Probier es jetzt einmal aus.',
      verify: used('hint'),
      hints: [
        'Genau so. Tipps kommen gestuft, erst grob, dann genauer.',
        'Den fertigen Befehl verrate ich in Tipps nie. Wer gar nicht weiterkommt, nimmt `mission solve`.',
      ],
      solution: 'mission hint',
      failMessage: 'Tipp `mission hint` ins Terminal.',
    },
    {
      id: 'bereit',
      title: 'Sag Bescheid, dass du bereit bist',
      description:
        'Leg die Datei `bereit.txt` an, in der nur das Wort `ja` steht. Danach musst du nichts weiter tun: Ich prüfe nach jedem Befehl selbst, ob es passt. Der Werkzeugkasten zeigt dir die Befehle.',
      verify: `${HELPERS}fileis bereit.txt ja`,
      tools: tools('echo', '>', 'cat'),
      target: 'bereit.txt',
      diagnose: `t=$(tr -d '[:space:]' < bereit.txt 2>/dev/null)
case $t in
  '') echo 'bereit.txt ist leer. Schreib das Wort ja hinein, zum Beispiel mit echo und >.' ;;
  [jJ][aA]) echo 'Fast. Linux unterscheidet Groß- und Kleinschreibung: Es muss ja heißen, klein.' ;;
  *) echo 'In bereit.txt steht noch etwas anderes als ja. Nur das eine Wort, sonst nichts.' ;;
esac`,
      hints: [
        '`echo` gibt Text aus, `>` schreibt die Ausgabe in eine Datei.',
        'Kombinier beides: erst `echo` mit dem Wort, dann `>` und der Dateiname.',
      ],
      solution: 'echo ja > bereit.txt',
      failMessage: 'In `bereit.txt` muss genau das Wort `ja` stehen.',
    },
    {
      id: 'flagge',
      title: 'Hol dir die Flagge',
      description:
        'Jede Mission endet mit einer Flagge `FLAG{…}`. Sie entsteht nur, wenn alles stimmt, und neben ihr steht deine Zeit seit dem Start der Mission. Wer `mission solve` benutzt, bekommt einen Lösungsweg, die Flagge zählt dann als „mit Lösung“. Hol dir jetzt deine erste Flagge mit `mission flag`.',
      verify: used('flag'),
      hints: [
        'Flagge heißt auf Englisch „flag“, der Rest ist wie bei `mission status`.',
        'Danach geht es mit `mission next` zur ersten echten Mission.',
      ],
      solution: 'mission flag',
      failMessage: 'Tipp `mission flag` ins Terminal.',
    },
  ],
  flag: `set -eo pipefail
printf 'FLAG{erster_tag_%s}\\n' "$(tr -d '[:space:]' < bereit.txt | md5sum | cut -c1-8)"`,
};
