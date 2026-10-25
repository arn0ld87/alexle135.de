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
 * Schrittarten (ADR 0009): sichern, ablesen, reparieren. Die Liste gehört kaffee, die Gruppe azubi darf
 * sie beschreiben (nicht den Ordner); die Reparatur stellt sie aus der Sicherung wieder her. Weil sie
 * den Beweis ändert, prüfen die Belege gegen feste Werte der Zeitlinie statt gegen die Live-Datei.
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
const ZEILE_ALT = ZEILEN[GEAENDERT];
/** Soll-Inhalt der Liste nach der Reparatur: genau die Sicherung. */
const SOLL = [KOPF, ...ZEILEN].join('\n');

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
install -o kaffee -g azubi -m 0664 "$tmp/liste" ${sh(LISTE)}
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
# Gilt die nächtliche Änderung (feste Zeit) oder die aktuelle Zeit der Datei, etwa nach der Reparatur.
printf -v tag '%(%Y-%m-%d)T' "$zeit_c"
printf -v uhr '%(%b %e %H:%M)T' "$zeit_c"
printf -v jahr '%(%b %e  %Y)T' "$zeit_c"
has "$tag" || has "$uhr" || has "$jahr" || has ${sh(ZEIT_AENDERUNG.slice(0, 10))} || has ${sh('Apr 17 03:12')} || has ${sh('Apr 17  2026')}
`}`;

/** Die geänderte Zeile und ihr Original: feste Werte, denn die Reparatur macht die Liste wieder gleich. */
const FESTE_ZEILEN = String.raw`neu=${sh(ZEILE_NEU)}
alt=${sh(ZEILE_ALT)}
`;

/** Die geänderte Zeile aus der Liste und die Originalzeile aus der Sicherung in einem Beleg. */
const PRUEFE_KASSE_ZEILEN = `${belegAnfang('kasse-zeilen')}${String.raw`${FESTE_ZEILEN}{ IFS=: read -r eigner _ groesse; } < <(stat -c '%U:%G:%s' "$f")
${BELEG_GROESSE}has "$neu" && has "$alt"
`}`;

/** Liest die Liste (ohne Zeilenumbruch am Ende) und den Sollinhalt; `$1` ist der Exit-Code, falls sie fehlt. */
const listeLesen = (abbruch: number) => String.raw`q=${sh(LISTE)}
soll=${sh(SOLL)}
[ -f "$q" ] && [ ! -L "$q" ] && [ "$(stat -c %s "$q")" -le 4096 ] || exit ${abbruch}
liste=$(<"$q")
`;

/** Die Liste ist wieder genau die Sicherung. */
const PRUEFE_KASSE_ZURUECK = `export LC_ALL=C
${listeLesen(1)}[ "$liste" = "$soll" ]
`;

/** Nur eine der beiden Zeilen steht im Beleg: meist hat `>` die erste überschrieben. */
const DIAGNOSE_KASSE_ZEILEN = `${diagnoseBelegAnfang(`${BELEGE}/kasse-zeilen.txt`)}${String.raw`${FESTE_ZEILEN}`}${listeLesen(0)}${String.raw`if [ "$liste" = "$soll" ] && [[ $inhalt != *"$neu"* ]]; then
  printf '%s\n' ${sh('Die Liste ist schon repariert, die geänderte Zeile steht nicht mehr darin. Lade die Seite neu und sichere vor dem Reparieren.')}
elif [[ $inhalt == *"$neu"* && $inhalt != *"$alt"* ]]; then
  printf '%s\n' ${sh('Es fehlt noch die Zeile aus der Sicherung. Mit >> hängst du an, statt zu überschreiben.')}
elif [[ $inhalt == *"$alt"* && $inhalt != *"$neu"* ]]; then
  printf '%s\n' ${sh('Es fehlt noch die geänderte Zeile aus der Liste. Mit >> hängst du an, statt zu überschreiben.')}
fi
exit 0
`}`;

/** Die Liste ist verändert, aber noch nicht die Sicherung; unberührt bleibt sie stumm. */
const DIAGNOSE_KASSE_ZURUECK = `export LC_ALL=C
${listeLesen(0)}${String.raw`geaendert=${sh([KOPF, ...ZEILEN.map((z, i) => (i === GEAENDERT ? ZEILE_NEU : z))].join('\n'))}
{ [ "$liste" = "$soll" ] || [ "$liste" = "$geaendert" ]; } && exit 0
zeilen() { local n=0 z; while IFS= read -r z; do n=$((n + 1)); done <<< "$1"; echo "$n"; }
if [[ $liste == *${sh(ZEILE_NEU)}* ]]; then
  printf '%s\n' ${sh('Der falsche Betrag steht noch in der Liste. Der richtige steht in der Sicherung.')}
elif [ -z "$liste" ]; then
  printf '%s\n' ${sh('Die Liste ist leer. Hol den Inhalt der Sicherung zurück in die Liste.')}
elif [ "$(zeilen "$liste")" -gt "$(zeilen "$soll")" ]; then
  printf '%s\n' ${sh('Die Liste ist jetzt länger als die Sicherung. Hänge nichts an, ersetze den ganzen Inhalt.')}
elif [ "$(zeilen "$liste")" -lt "$(zeilen "$soll")" ]; then
  printf '%s\n' ${sh('In der Liste fehlen Zeilen. Sie soll wieder genau so aussehen wie die Sicherung.')}
else
  printf '%s\n' ${sh('Die Liste weicht noch von der Sicherung ab. Sie muss genau so aussehen wie die Sicherung.')}
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
    'Der Fall: In /srv/rechenwerk/uebung/ liegen die Kaffeekasse-Liste kaffeekasse.csv und ihre Sicherung kaffeekasse.bak vom Abend davor. In der Liste wurde nachts ein Betrag verändert. Wer war es?',
    'Die Regel für jeden Fall: erst Belege sichern, dann reparieren. Wer vorher repariert, löscht den Beweis.',
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
    'Schritt 3, zweite Spur: der Inhalt. Welcher Betrag wurde verändert?',
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

const schrittZurueck: ErmittlungsSchritt = {
  art: 'reparieren',
  id: 'kasse-zurueck',
  title: 'Stelle die Liste aus der Sicherung wieder her',
  pager: [
    'Schritt 4: Die Belege sind gesichert, jetzt wird repariert. Margit rechnet am Freitag die Kaffeekasse ab, und da muss der richtige Betrag stehen.',
    'Die Sicherung kaffeekasse.bak ist der Stand vom Abend, bevor sich etwas geändert hat. Bring die Liste kaffeekasse.csv wieder auf genau diesen Stand.',
    'Die Liste darfst du beschreiben, die Sicherung und den Ordner nicht. Geprüft wird die Liste selbst, nicht der Befehl, mit dem du sie zurückholst.',
  ],
  verify: PRUEFE_KASSE_ZURUECK,
  diagnose: DIAGNOSE_KASSE_ZURUECK,
  tipps: [
    'Die Sicherung zeigt, wie die Liste vor der Änderung aussah. Die Liste soll wieder genau so aussehen. Dein Beleg liegt schon sicher in ~/belege/.',
    'cp kopiert eine Datei und überschreibt dabei das Ziel. Du kannst den Inhalt auch mit cat und > umleiten oder in einem Editor wie nano von Hand korrigieren. Wichtig: Der Inhalt muss danach Zeile für Zeile stimmen.',
    `${LOESUNG}cp /srv/rechenwerk/uebung/kaffeekasse.bak /srv/rechenwerk/uebung/kaffeekasse.csv`,
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
    { id: 'inhalt', titel: 'Inhalt', schritte: [schrittZeilen, schrittZurueck] },
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
        beschreibung: 'In der Liste stand ein anderer Betrag als in der Sicherung.',
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
      'Die Kaffeekasse-Liste darfst du reparieren, die Sicherung bleibt unberührt. Erst Belege sichern, dann reparieren: Sonst ist der Beweis weg.',
      'Hier kann nichts kaputtgehen: Die Seite neu zu laden setzt den Fall zurück.',
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
    'Beleg, Besitzer, Zeitpunkt: mehr braucht es nicht für einen Vorwurf. Die Kasse stimmt wieder, und der Beweis liegt in der Akte. Das war der Probelauf.',
    'Im nächsten Fall liegt etwas an, das nicht in einen Übungsordner passt.',
  ],
};

/** Werkzeugkasten der Hilfe; Begriffe und Beispiele stammen aus dem gemeinsamen Glossar. */
export const episode0Werkzeuge = tools('ls -l', 'stat', 'cat', 'grep', '>', '>>', 'cp');
