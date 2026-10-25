import kaffeeBild from '../../../assets/missions/staffel-2/kaffee.webp';
import nadiaBild from '../../../assets/missions/staffel-2/nadia.webp';
import timoBild from '../../../assets/missions/staffel-2/timo.webp';
import { AKTENWAND_ABFRAGE } from '../../../lib/missions/aktenwand';
import type { Ermittlung, ErmittlungsSchritt } from '../../../lib/missions/ermittlungTypes';
import {
  diagnoseBelegAnfang,
  diagnoseZweiDateien,
} from '../../../lib/missions/ermittlungsDiagnose';
import { tools } from '../../../lib/missions/glossar';
import { LOESUNG } from './episode-1';

/**
 * Episode 0 „Probelauf“ von Staffel 2: kleiner Übungsfall am ersten Einsatztag bei der Rechenwerk
 * Ostwind GmbH. In /srv/rechenwerk/uebung/ liegt die Kaffeekasse-Liste samt Sicherung; ein Betrag wurde in der
 * Nacht verändert, und zwar vom Konto `kaffee` (dem Kaffeeautomaten). Alle Daten sind fiktiv.
 * Setup, verify und Diagnosen laufen als root; die Belege liegen als `<id>.txt` unter ~/belege/.
 * `${...}` in den Skripten sind nur die Konstanten unten.
 */

/** Astro liefert beim Bildimport Metadaten mit `src`, reines Vite (Vitest) den Pfad selbst. */
const bildUrl = (bild: string | { src: string }): string =>
  typeof bild === 'string' ? bild : bild.src;

const BELEGE = '/home/azubi/belege';
const UEBUNG = '/srv/rechenwerk/uebung';
const LISTE = `${UEBUNG}/kaffeekasse.csv`;
const SICHERUNG = `${UEBUNG}/kaffeekasse.bak`;
/** Feste Zeitlinie: Die Sicherung entsteht abends, die Änderung der Liste nachts. */
const ZEIT_SICHERUNG = '2026-04-16 22:05:00 UTC';
const ZEIT_AENDERUNG = '2026-04-17 03:12:00 UTC';
const KOPF = 'datum,name,betrag';
const ZEILEN = [
  '2026-04-13,Timo,5.00',
  '2026-04-14,Nadia,5.00',
  '2026-04-15,Timo,2.50',
  '2026-04-16,Nadia,7.00',
  '2026-04-17,Timo,3.50',
];
const GEAENDERT = 2;
const ZEILE_NEU = '2026-04-15,Timo,0.50';

/** Belegdateien dieser Episode; das Setup entfernt nur genau diese, nichts rekursiv. */
const BELEG_IDS = ['kasse-meta', 'kasse-zeilen'] as const;

const sh = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** Bash als root: legt den fiktiven Ausgangszustand an; jeder Fehler beendet das Skript mit Exit 1. */
const SETUP = String.raw`set -eu
export LC_ALL=C
fehler() { echo "Staffel 2, Episode 0: $1" >&2; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ ! -d ${sh(BELEGE)} ] || [ -L ${sh(BELEGE)} ]; then fehler 'Der Belegordner fehlt.'; fi
for p in /srv/rechenwerk ${sh(UEBUNG)}; do
  if [ -L "$p" ] || { [ -e "$p" ] && [ ! -d "$p" ]; }; then fehler 'Der Übungsordner ist belegt.'; fi
done
for id in ${BELEG_IDS.join(' ')}; do
  rm -f -- "${BELEGE}/$id.txt"
  if [ -e "${BELEGE}/$id.txt" ] || [ -L "${BELEGE}/$id.txt" ]; then fehler "$id.txt ist belegt."; fi
done
if ! id kaffee >/dev/null 2>&1; then
  adduser -D -H -u 1104 -h /home/kaffee -s /sbin/nologin -g Kaffeeautomat kaffee
fi
install -d -o root -g root -m 0755 /srv/rechenwerk ${sh(UEBUNG)}
rm -f -- ${sh(LISTE)} ${sh(SICHERUNG)}
printf '%s\n' ${sh(KOPF)} ${ZEILEN.map(sh).join(' ')} > "$tmp/sicherung"
printf '%s\n' ${sh(KOPF)} ${ZEILEN.map((z, i) => sh(i === GEAENDERT ? ZEILE_NEU : z)).join(' ')} > "$tmp/liste"
install -o root -g root -m 0644 "$tmp/sicherung" ${sh(SICHERUNG)}
touch -d ${sh(ZEIT_SICHERUNG)} ${sh(SICHERUNG)}
install -o kaffee -g kaffee -m 0644 "$tmp/liste" ${sh(LISTE)}
touch -d ${sh(ZEIT_AENDERUNG)} ${sh(LISTE)}
[ "$(stat -c %U ${sh(LISTE)})" = kaffee ] || fehler 'Die Liste hat den falschen Besitzer.'
[ "$(stat -c %y ${sh(LISTE)} | cut -c1-19)" = '2026-04-17 03:12:00' ] || fehler 'Die Zeit der Liste stimmt nicht.'
[ "$(stat -c %U ${sh(SICHERUNG)})" = root ] || fehler 'Die Sicherung hat den falschen Besitzer.'
exit 0
`;

/** Gemeinsamer Anfang jeder Belegprüfung: ein echtes, nicht leeres Beleg-File im Belegordner. */
const belegAnfang = (id: string) => String.raw`export LC_ALL=C
set -f
d=${sh(BELEGE)}
f="$d/${id}.txt"
[ -d "$d" ] && [ ! -L "$d" ] && [ -f "$f" ] && [ ! -L "$f" ] && [ -s "$f" ] || exit 1
has() { [[ $inhalt == *"$1"* ]]; }
`;

/** Beleg mit eigenem Besitzer und höchstens 64 KiB; `stat` hat die erste Zeile dafür geliefert. */
const BELEG_GROESSE = String.raw`[ "$eigner" = azubi ] && [ "$groesse" -le 65536 ] || exit 1
IFS= read -r -d '' inhalt < "$f"
`;

/** Besitzer, Rechte und Datum beider Dateien als echte Ausgabe von ls -l (oder stat) in einem Beleg. */
const PRUEFE_KASSE_META = `${belegAnfang('kasse-meta')}${String.raw`c=${sh(LISTE)}
b=${sh(SICHERUNG)}
[ -f "$c" ] && [ ! -L "$c" ] && [ -f "$b" ] && [ ! -L "$b" ] || exit 1
{ IFS=':|' read -r eigner _ groesse _; IFS=':|' read -r cu _ _ sym_c zeit_c; IFS=':|' read -r _ _ _ sym_b _; } < <(stat -c '%U:%G:%s|%A|%Y' "$f" "$c" "$b")
${BELEG_GROESSE}has kaffeekasse.csv && has kaffeekasse.bak && has "$sym_c" && has "$sym_b" || exit 1
# Der Besitzer steht als eigenes Wort im Beleg (kaffee steckt auch in kaffeekasse).
re_u="(^|[^[:alnum:]_.-])$cu([^[:alnum:]_.-]|\$)"
[[ $inhalt =~ $re_u ]] || exit 1
# ls zeigt je nach Alter der Datei Uhrzeit oder Jahr, stat und ls --full-time das volle Datum.
printf -v tag '%(%Y-%m-%d)T' "$zeit_c"
printf -v uhr '%(%b %e %H:%M)T' "$zeit_c"
printf -v jahr '%(%b %e  %Y)T' "$zeit_c"
has "$tag" || has "$uhr" || has "$jahr"
`}`;

/** Bestimmt die einzige Zeile, die in Liste und Sicherung abweicht (neu in der Liste, alt in der Sicherung). */
const ABWEICHUNG = String.raw`q=${sh(LISTE)}
a=${sh(SICHERUNG)}
[ -f "$q" ] && [ ! -L "$q" ] && [ -f "$a" ] && [ ! -L "$a" ] || exit 1
IFS= read -r -d '' liste < "$q"
IFS= read -r -d '' sicherung < "$a"
liste=$'\n'$liste$'\n'
sicherung=$'\n'$sicherung$'\n'
neu=; alt=; n=0; m=0
while IFS= read -r z; do
  [[ -n $z && $sicherung != *$'\n'"$z"$'\n'* ]] && { neu=$z; n=$((n + 1)); }
done <<< "$liste"
while IFS= read -r z; do
  [[ -n $z && $liste != *$'\n'"$z"$'\n'* ]] && { alt=$z; m=$((m + 1)); }
done <<< "$sicherung"
`;

/** Die geänderte Zeile aus der Liste und die Originalzeile aus der Sicherung in einem Beleg. */
const PRUEFE_KASSE_ZEILEN = `${belegAnfang('kasse-zeilen')}${String.raw`${ABWEICHUNG}[ "$n" = 1 ] && [ "$m" = 1 ] || exit 1
{ IFS=: read -r eigner _ groesse; } < <(stat -c '%U:%G:%s' "$f")
${BELEG_GROESSE}has "$neu" && has "$alt"
`}`;

/** Nur eine der beiden Zeilen steht im Beleg: meist hat `>` die erste überschrieben. */
const DIAGNOSE_KASSE_ZEILEN = `${diagnoseBelegAnfang(`${BELEGE}/kasse-zeilen.txt`)}${String.raw`${ABWEICHUNG}[ "$n" = 1 ] && [ "$m" = 1 ] || exit 0
if [[ $inhalt == *"$neu"* && $inhalt != *"$alt"* ]]; then
  printf '%s\n' ${sh('Es fehlt noch die Zeile aus der Sicherung. Mit >> hängst du an, statt zu überschreiben.')}
elif [[ $inhalt == *"$alt"* && $inhalt != *"$neu"* ]]; then
  printf '%s\n' ${sh('Es fehlt noch die geänderte Zeile aus der Liste. Mit >> hängst du an, statt zu überschreiben.')}
fi
exit 0
`}`;

const DIAGNOSE_KASSE_META = diagnoseZweiDateien(
  `${BELEGE}/kasse-meta.txt`,
  'kaffeekasse.bak',
  'kaffeekasse.csv'
);

const schrittMeta: ErmittlungsSchritt = {
  art: 'sichern',
  id: 'kasse-meta',
  title: 'Sichere Besitzer, Rechte und Datum der Dateien',
  pager: [
    'Erster Einsatztag bei der Rechenwerk Ostwind GmbH. Bevor es ernst wird, ein Probelauf. Hier kann nichts kaputtgehen.',
    'Du bist das Testkonto azubi. Ein Beleg ist die echte Ausgabe eines Befehls, in eine Textdatei in ~/belege/ umgeleitet. Abgetippter Text zählt nicht.',
    'Geprüft wird beim nächsten Shell-Prompt. Wenn du in nano arbeitest, erst speichern und nano verlassen.',
    'Tipps gibt es auf Abruf in der Hilfe. Nutz sie ruhig.',
    'Der Fall: In /srv/rechenwerk/uebung/ liegen die Kaffeekasse-Liste kaffeekasse.csv und ihre Sicherung kaffeekasse.bak. In der Liste wurde ein Betrag verändert. Wer war es?',
    'Schritt 1: Halte Besitzer, Rechte und Datum beider Dateien in einem Beleg fest, als echte Ausgabe von ls -l: ~/belege/kasse-meta.txt.',
  ],
  verify: PRUEFE_KASSE_META,
  diagnose: DIAGNOSE_KASSE_META,
  tipps: [
    'Besitzer, Rechte und Datum einer Datei zeigt ein einziger Befehl. Du brauchst die Angaben zu beiden Dateien aus /srv/rechenwerk/uebung/.',
    'ls -l zeigt Besitzer, Rechte und Datum. Du kannst ihm zwei Dateien auf einmal geben. Mit > schreibst du die Ausgabe in eine Datei.',
    `${LOESUNG}ls -l /srv/rechenwerk/uebung/kaffeekasse.csv /srv/rechenwerk/uebung/kaffeekasse.bak > ~/belege/kasse-meta.txt`,
  ],
};

const schrittBesitzer: ErmittlungsSchritt = {
  art: 'ablesen',
  id: 'besitzer',
  title: 'Lies den Besitzer der Liste ab',
  pager: [
    'Schritt 2: Schau in deinen Beleg. Die dritte Spalte von ls -l nennt den Besitzer einer Datei.',
    'Trag unten ein, wem die geänderte Liste gehört.',
  ],
  verify: 'false',
  antwort: {
    frage: 'Wem gehört die geänderte Liste? (Benutzername)',
    format: 'Ein Benutzername, kleingeschrieben',
    pruefung: `[ "$ANTWORT" = "$(stat -c %U ${LISTE})" ]`,
  },
  tipps: [
    'Die Antwort steht schon in deinem Beleg. Such die Zeile der Liste kaffeekasse.csv.',
    'Bei ls -l steht vor dem Dateinamen erst die Rechte-Spalte, dann die Zahl der Links, danach der Besitzer.',
    `${LOESUNG}ls -l /srv/rechenwerk/uebung/kaffeekasse.csv zeigt den Besitzer in der dritten Spalte.`,
  ],
};

const schrittZeilen: ErmittlungsSchritt = {
  art: 'sichern',
  id: 'kasse-zeilen',
  title: 'Sichere die geänderte Zeile und ihr Original',
  pager: [
    'Zweite Spur: der Inhalt. Welcher Betrag wurde verändert?',
    'Vergleiche Liste und Sicherung. Halte die geänderte Zeile aus der Liste und die Originalzeile aus der Sicherung gemeinsam in ~/belege/kasse-zeilen.txt fest.',
    'Beide Zeilen gehören in denselben Beleg: Das erste > beginnt die Datei, das zweite muss >> sein, sonst überschreibt es die erste Zeile.',
  ],
  verify: PRUEFE_KASSE_ZEILEN,
  diagnose: DIAGNOSE_KASSE_ZEILEN,
  tipps: [
    'Liste und Sicherung sind fast gleich. Lies beide Dateien und such die Zeile, die nicht übereinstimmt.',
    'cat zeigt den Inhalt einer Datei, grep sucht Zeilen mit einem bestimmten Text, etwa einem Datum. Mit > beginnt eine Datei neu, mit >> hängst du hinten an.',
    `${LOESUNG}grep 2026-04-15 /srv/rechenwerk/uebung/kaffeekasse.csv > ~/belege/kasse-zeilen.txt && grep 2026-04-15 /srv/rechenwerk/uebung/kaffeekasse.bak >> ~/belege/kasse-zeilen.txt`,
  ],
};

export const episode0: Ermittlung = {
  nr: 0,
  id: 'probelauf',
  titel: 'Probelauf',
  hostname: 'rw-srv01',
  setup: SETUP,
  ansichten: [
    {
      id: 'aktenwand',
      art: 'aktenwand',
      titel: 'Aktenwand',
      abfrage: AKTENWAND_ABFRAGE,
    },
  ],
  spuren: [
    { id: 'akte', titel: 'Akte', schritte: [schrittMeta, schrittBesitzer] },
    { id: 'inhalt', titel: 'Inhalt', schritte: [schrittZeilen] },
  ],
  vorwurf: {
    verdaechtige: [
      {
        id: 'timo',
        name: 'Timo Kessler',
        rolle: 'Systemadministrator, trinkt den meisten Kaffee',
        portraet: bildUrl(timoBild),
      },
      {
        id: 'nadia',
        name: 'Nadia Brem',
        rolle: 'Datenbankverwaltung, führt die Kaffeekasse',
        portraet: bildUrl(nadiaBild),
      },
      {
        id: 'kaffee',
        name: 'Kaffeeautomat (Konto kaffee)',
        rolle: 'Dienstkonto, gleicht nachts die Kasse ab',
        portraet: bildUrl(kaffeeBild),
      },
    ],
    taeterId: 'kaffee',
    // Reihenfolge wie in der Aktenwand (nach Dateiname), damit der Vorwurf-Dialog gleich sortiert.
    belege: [
      {
        id: 'kasse-meta',
        beschreibung: 'Die geänderte Liste gehört dem Konto kaffee und wurde nachts geändert.',
        spurId: 'akte',
        stuetzt: 'kaffee',
        verify: PRUEFE_KASSE_META,
      },
      {
        id: 'kasse-zeilen',
        beschreibung: 'In der Liste steht ein anderer Betrag als in der Sicherung.',
        spurId: 'inhalt',
        stuetzt: 'kaffee',
        verify: PRUEFE_KASSE_ZEILEN,
      },
    ],
    mindestBelege: 2,
    jedeSpur: true,
    // Übungsfall: Ein falscher Vorwurf sperrt nichts.
    ohneSperre: true,
    antworten: {
      richtig: [
        'Das passt zusammen: Die Liste gehört dem Konto kaffee und wurde nachts geändert. Der Kaffeeautomat gleicht nachts die Kasse ab und hat dabei einen Betrag verändert.',
        'Probelauf bestanden. Jetzt wird es ernst.',
      ],
      falschePerson: [
        'Diese Person passt nicht zu deinen Belegen. Schau, wem die geänderte Liste gehört und wann sie geändert wurde.',
        'Kein Problem, das ist nur ein Probelauf. Versuch es noch einmal.',
      ],
      zuWenigBelege: [
        'Die Person könnte stimmen, aber die Begründung trägt noch nicht.',
        'Nimm je einen Beleg aus beiden Spuren: Akte und Inhalt.',
      ],
      gesperrt: [
        'Der Vorwurf ist kurz gesperrt. Ein weiterer erkannter Beleg hilft, spätestens drei vollständige Prüfungen öffnen ihn wieder.',
      ],
    },
  },
  einsatzrahmen: {
    text: [
      'Das ist ein Probelauf bei der Rechenwerk Ostwind GmbH, mit dem Testkonto azubi.',
      'Nur der Ordner /srv/rechenwerk/uebung/ ist Thema. Eigene Belege legst du in ~/belege/ an.',
      'Hier kann nichts kaputtgehen.',
    ],
    verstoss: 'false',
    folge: ['Im Probelauf hat das keine Folgen.'],
  },
  beweisstueck: {
    id: 'kaffeekasse',
    titel: 'Die Kaffeekasse',
    beschreibung:
      'Besitzer und Änderungszeit der Liste sowie die geänderte Zeile führen zum Konto kaffee.',
    code: 'S2-E0-KASSE',
  },
  szene: [
    'Alex nickt zufrieden. „Der Automat gleicht nachts die Kasse ab und hat sich dabei einen Betrag zurechtgerundet. So sieht Ermitteln aus.“',
    'Beleg, Besitzer, Zeitpunkt: mehr braucht es nicht für einen Vorwurf. Das war der Probelauf.',
    'Im nächsten Fall liegt etwas an, das nicht in einen Übungsordner passt.',
  ],
};

/** Werkzeugkasten der Hilfe; Begriffe und Beispiele stammen aus dem gemeinsamen Glossar. */
export const episode0Werkzeuge = tools('ls -l', 'stat', 'cat', 'grep', '>', '>>');
