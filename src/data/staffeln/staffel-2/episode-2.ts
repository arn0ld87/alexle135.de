import margitBild from '../../../assets/missions/staffel-2/margit.webp';
import nadiaBild from '../../../assets/missions/staffel-2/nadia.webp';
import timoBild from '../../../assets/missions/staffel-2/timo.webp';
import { AKTENWAND_ABFRAGE } from '../../../lib/missions/aktenwand';
import { EINSATZRAHMEN_VERSTOSS } from '../../../lib/missions/einsatzrahmenSetup';
import type { Ermittlung, ErmittlungsSchritt } from '../../../lib/missions/ermittlungTypes';
import { diagnoseBelegAnfang } from '../../../lib/missions/ermittlungsDiagnose';
import { tools } from '../../../lib/missions/glossar';
import { LOESUNG } from './episode-1';

/**
 * Episode 2 „Der Prozess, der nicht stirbt“ von Staffel 2, die erste Episode mit Bildschirm
 * (ADR 0008): Auf rw-srv01 läuft rw-abgleich als Dienstkonto `abgleich` und kommt nach jedem
 * Beenden wieder, weil eine Cron-Zeile ihn jede Minute neu startet. Wer die Zeile eingetragen hat,
 * steht nicht im Terminal: Das Wartungsjournal führt mehrere Cron-Änderungen verschiedener Personen,
 * und nur der Zettel auf dem Foto (Bildbeleg, nur Pixel) nennt die Kennung des Wächters. Alle
 * Daten sind fiktiv. Setup, verify und Diagnosen laufen als root; die Belege liegen als `<id>.txt`
 * direkt unter ~/belege/. `${...}` in den Skripten sind nur die Konstanten unten.
 */

/** Astro liefert beim Bildimport Metadaten mit `src`, reines Vite (Vitest) den Pfad selbst. */
const bildUrl = (bild: string | { src: string }): string =>
  typeof bild === 'string' ? bild : bild.src;

const BELEGE = '/home/azubi/belege';
const FOTOS = '/home/azubi/fotos';
/** Neutraler Dateiname wie von einer Handykamera; der Text steht nur als Pixel im Bild. */
const ZETTEL = `${FOTOS}/IMG_0417.png`;
const DIENST = 'abgleich';
const PROZESS = 'rw-abgleich';
const SKRIPT = `/usr/local/sbin/${PROZESS}`;
const CRONTAB = `/etc/crontabs/${DIENST}`;
const JOURNAL = '/var/log/rechenwerk-wartung.log';
/** Die Änderung, die den Wächter eingetragen hat; nur der Zettel nennt sie, das Journal führt mehrere. */
const KENNUNG = 'RW-2122';
const ZAHL = KENNUNG.slice(3);
/** Die Cron-Datei wurde nachts neu geschrieben: Ihr Datum verrät keine Journalzeile. */
const ZEIT_CRON = '2026-04-21 00:00:00 UTC';
const ZEIT_JOURNAL = '2026-04-20 10:05:00 UTC';
/** Prüft die eigene Cron-Datei mit: Eine Änderung greift sofort, auch wenn crond seine Liste noch nicht neu gelesen hat. */
const CRON_ZEILE = `* * * * * [ -e ${CRONTAB} ] && ! pgrep -x ${PROZESS} >/dev/null && ${SKRIPT}`;

const JOURNAL_ZEILEN = [
  '2026-04-20T07:55:31Z margit login result=ok',
  `2026-04-20T08:20:14Z timo edit-cron change=RW-2117 target=${CRONTAB}`,
  `2026-04-20T08:47:52Z nadia edit-cron change=${KENNUNG} target=${CRONTAB}`,
  `2026-04-20T09:05:03Z timo edit-cron change=RW-2124 target=${CRONTAB}`,
  `2026-04-20T09:31:40Z margit edit-cron change=RW-2129 target=${CRONTAB}`,
  '2026-04-20T09:44:10Z timo restart-service change=RW-2130 target=crond',
  '2026-04-20T10:02:18Z nadia login result=ok',
];

/** Text des Bildbelegs, Zeile für Zeile; steht nirgends sonst als Text im Gast. */
const ZETTEL_TEXT = [
  'Wartung rw-srv01',
  `${PROZESS}: Wächter-Zeile im Cron,`,
  'läuft jede Minute neu.',
  'NICHT löschen!',
  '',
  `Änderung: ${KENNUNG}`,
];

/** Genau die sudo-Aufrufe des Einsatzrahmens: Cron-Liste des Dienstkontos ansehen und löschen, Prozess beenden. */
export const SUDO_BEFEHLE = [
  `/usr/bin/crontab -u ${DIENST} -l`,
  `/usr/bin/crontab -u ${DIENST} -r`,
  `/usr/bin/pkill -x ${PROZESS}`,
  `/usr/bin/pkill -u ${DIENST}`,
];

/** Belegdateien dieser Episode; das Setup entfernt nur genau diese, nichts rekursiv. */
const BELEG_IDS = ['prozess-zeile', 'wartung-zeile'] as const;

const sh = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** Fiktive Konten sind gesperrt (`adduser -D`) und ohne Login-Shell; bestehende bleiben, wie sie sind. */
const KONTEN = [
  { uid: 1101, name: 'timo', klartext: 'Timo Kessler' },
  { uid: 1102, name: 'nadia', klartext: 'Nadia Brem' },
  { uid: 1103, name: 'margit', klartext: 'Margit Ostwind' },
  { uid: 1105, name: DIENST, klartext: 'Abgleich-Dienst' },
] as const;

/** Bash als root: legt den fiktiven Ausgangszustand an; jeder Fehler beendet das Skript mit Exit 1. */
const SETUP = String.raw`set -eu
export LC_ALL=C
fehler() { echo "Staffel 2, Episode 2: $1" >&2; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ ! -d ${sh(BELEGE)} ] || [ -L ${sh(BELEGE)} ]; then fehler 'Der Belegordner fehlt.'; fi
if [ -L ${sh(FOTOS)} ] || { [ -e ${sh(FOTOS)} ] && [ ! -d ${sh(FOTOS)} ]; }; then fehler 'Der Fotoordner ist belegt.'; fi
for id in ${BELEG_IDS.join(' ')}; do
  rm -f -- "${BELEGE}/$id.txt"
  if [ -e "${BELEGE}/$id.txt" ] || [ -L "${BELEGE}/$id.txt" ]; then fehler "$id.txt ist belegt."; fi
done
konto() {
  if id "$2" >/dev/null 2>&1; then return 0; fi
  adduser -D -H -u "$1" -h "/home/$2" -s /sbin/nologin -g "$3" "$2"
}
${KONTEN.map((k) => `konto ${k.uid} ${k.name} ${sh(k.klartext)}`).join('\n')}
# Ein früherer Lauf: Prozess und Cron-Liste weg, bevor der Ausgangszustand neu entsteht.
crontab -u ${DIENST} -r 2>/dev/null || true
pkill -x ${PROZESS} || true
for _ in 1 2 3 4 5 6 7 8 9 10; do pgrep -x ${PROZESS} >/dev/null || break; sleep 0.5; done
printf '%s\n' '#!/bin/sh' ${sh('# Abgleich der Lagerliste mit der Buchhaltung (fiktive Uebungsdaten)')} 'while :; do sleep 30; done' > "$tmp/abgleich"
install -d -o root -g root -m 0755 /usr/local/sbin
install -o root -g root -m 0755 "$tmp/abgleich" ${sh(SKRIPT)}
printf '%s\n' ${sh(CRON_ZEILE)} > "$tmp/cron"
crontab -u ${DIENST} - < "$tmp/cron"
touch -d ${sh(ZEIT_CRON)} ${sh(CRONTAB)}
printf '%s\n' ${JOURNAL_ZEILEN.map(sh).join(' ')} > "$tmp/journal"
install -o root -g root -m 0644 "$tmp/journal" ${sh(JOURNAL)}
touch -d ${sh(ZEIT_JOURNAL)} ${sh(JOURNAL)}
# Prozesse vor dem Foto: bildbeleg lädt im Browser beim ersten Mal Schriften und Bibliotheken nach
# und braucht dafür Minuten. Wer gleich mit ps anfängt, soll den Wiedergänger schon sehen.
pgrep -x crond >/dev/null || crond -c /etc/crontabs
for _ in 1 2 3 4 5 6 7 8 9 10; do pgrep -x crond >/dev/null && break; sleep 0.5; done
pgrep -x crond >/dev/null || fehler 'crond startet nicht.'
setsid su -s /bin/sh ${DIENST} -c ${sh(SKRIPT)} </dev/null >/dev/null 2>&1 &
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do pgrep -x ${PROZESS} >/dev/null && break; sleep 0.5; done
pgrep -x ${PROZESS} >/dev/null || fehler 'Der Prozess läuft nicht.'
install -d -o azubi -g azubi -m 0755 ${sh(FOTOS)}
rm -f -- ${sh(ZETTEL)}
LC_ALL=C.UTF-8 bildbeleg ${sh(ZETTEL)} <<'EOF'
${ZETTEL_TEXT.join('\n')}
EOF
chown azubi:azubi ${sh(ZETTEL)}
chmod 0644 ${sh(ZETTEL)}
[ "$(stat -c '%U:%G:%a' ${sh(CRONTAB)})" = root:root:600 ] || fehler 'Die Cron-Liste hat falsche Rechte.'
[ "$(stat -c '%U:%G:%a' ${sh(JOURNAL)})" = root:root:644 ] || fehler 'Das Journal hat falsche Rechte.'
[ "$(stat -c '%U:%G:%a' ${sh(ZETTEL)})" = azubi:azubi:644 ] || fehler 'Das Foto hat falsche Rechte.'
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

/** Beleg mit eigenem Besitzer und höchstens 64 KiB. */
const BELEG_GROESSE = String.raw`{ IFS=: read -r eigner _ groesse; } < <(stat -c '%U:%G:%s' "$f")
[ "$eigner" = azubi ] && [ "$groesse" -le 65536 ] || exit 1
IFS= read -r -d '' inhalt < "$f"
`;

/** Eine Zeile aus ps: Prozess-Zeile und Zeile von crond, ohne die Zeile des grep selbst. */
const PS_ZEILEN = String.raw`zeile=; cron=
re_pid='^[[:space:]]*[0-9]+[[:space:]]'
re_dienst='[[:space:]]${DIENST}[[:space:]]'
re_crond='[[:space:]](/usr/sbin/)?crond([[:space:]]|$)'
while IFS= read -r z; do
  [[ $z =~ $re_pid && $z != *grep* ]] || continue
  [[ $z == *${PROZESS}* && $z =~ $re_dienst ]] && zeile=1
  [[ $z =~ $re_crond ]] && cron=1
done <<< "$inhalt"
`;

/** Echte ps-Zeilen des Prozesses (Dienstkonto) und von crond, dem Starter, in einem Beleg. */
const PRUEFE_PROZESS_ZEILE = `${belegAnfang('prozess-zeile')}${BELEG_GROESSE}${PS_ZEILEN}[ -n "$zeile" ] && [ -n "$cron" ]
`;

/** Der Prozess läuft nicht (nur Builtins, über /proc). */
const OHNE_PROZESS = String.raw`laeuft=
set +f
re_zombie='\) Z '
for p in /proc/[0-9]*/comm; do
  read -r n < "$p" 2>/dev/null || continue
  [ "$n" = ${PROZESS} ] || continue
  # Ein beendeter Prozess, der noch auf sein Einsammeln wartet (Zombie), läuft nicht mehr.
  IFS=/ read -r _ _ pid _ <<< "$p"
  read -r st < /proc/$pid/stat 2>/dev/null || continue
  [[ $st =~ $re_zombie ]] && continue
  laeuft=1; break
done
`;

/** Die Cron-Liste des Dienstkontos nennt den Prozess nicht mehr (oder es gibt sie nicht). */
const OHNE_CRON = String.raw`c=${sh(CRONTAB)}
cron=
if [ -e "$c" ] || [ -L "$c" ]; then
  [ -f "$c" ] && [ ! -L "$c" ] || exit 1
  IFS= read -r -d '' inhalt < "$c" || true
  [[ $inhalt == *${PROZESS}* ]] && cron=1
fi
`;

/** Zustand statt Befehl: Prozess weg und keine Cron-Zeile mehr, die ihn zurückholt. */
const PRUEFE_EINGRIFF = `export LC_ALL=C
set -f
${OHNE_CRON}${OHNE_PROZESS}[ -z "$cron" ] && [ -z "$laeuft" ]
`;

/** Die Journalzeile zur Kennung vom Zettel; keine andere Cron-Änderung steht im Beleg. */
const PRUEFE_WARTUNG_ZEILE = `${belegAnfang('wartung-zeile')}${String.raw`j=${sh(JOURNAL)}
[ -f "$j" ] && [ ! -L "$j" ] || exit 1
{ IFS=: read -r eigner _ groesse; IFS=: read -r ju jg _; } < <(stat -c '%U:%G:%s' "$f" "$j")
[ "$ju:$jg" = root:root ] || exit 1
[ "$eigner" = azubi ] && [ "$groesse" -le 65536 ] || exit 1
IFS= read -r -d '' inhalt < "$f"
ziel=; n=0
while IFS= read -r z; do
  set -- $z
  if [ "$2" = nadia ] && [ "$3" = edit-cron ] && [ "$4" = change=${KENNUNG} ]; then
    ziel=$z; n=$((n + 1))
  fi
done < "$j"
[ "$n" = 1 ] && has "$ziel" || exit 1
while IFS= read -r z; do
  set -- $z
  [ "$3" = edit-cron ] && [ "$z" != "$ziel" ] && has "$z" && exit 1
done < "$j"
exit 0
`}`;

/** Der Prozess ist schon weg, deshalb zeigt kein ps ihn mehr: Der Beleg lässt sich nicht mehr erzeugen. */
const DIAGNOSE_PROZESS_ZEILE = `${diagnoseBelegAnfang(`${BELEGE}/prozess-zeile.txt`)}${String.raw`${PS_ZEILEN}if [ -z "$zeile" ] && [ -z "$cron" ]; then
  printf '%s\n' ${sh('In deinem Beleg fehlen die Zeile von rw-abgleich und die von crond. Gib sie als echte Ausgabe von ps aus.')}
elif [ -z "$zeile" ]; then
  printf '%s\n' ${sh('In deinem Beleg fehlt die Zeile von rw-abgleich mit dem Konto abgleich.')}
elif [ -z "$cron" ]; then
  printf '%s\n' ${sh('In deinem Beleg fehlt die Zeile von crond, dem Dienst, der zeitgesteuert Prozesse startet.')}
fi
exit 0
`}`;

const DIAGNOSE_EINGRIFF = String.raw`export LC_ALL=C
set -f
${OHNE_CRON}${OHNE_PROZESS}if [ -n "$cron" ] && [ -z "$laeuft" ]; then
  printf '%s\n' ${sh('Der Prozess ist beendet, aber ein Cron-Eintrag startet ihn gleich wieder. Beenden allein reicht nicht.')}
elif [ -z "$cron" ] && [ -n "$laeuft" ]; then
  printf '%s\n' ${sh('Der Cron-Eintrag ist weg, aber der Prozess läuft noch. Beende ihn auch.')}
fi
exit 0
`;

const DIAGNOSE_WARTUNG_ZEILE = `${diagnoseBelegAnfang(`${BELEGE}/wartung-zeile.txt`)}${String.raw`j=${sh(JOURNAL)}
[ -f "$j" ] && [ ! -L "$j" ] || exit 0
alle=0; hier=0
while IFS= read -r z; do
  set -- $z
  if [ "$3" = edit-cron ]; then
    if [[ $inhalt == *"$z"* ]]; then
      alle=$((alle + 1))
      [ "$4" = change=${KENNUNG} ] && hier=1
    fi
  fi
done < "$j"
if [ "$alle" -ge 2 ]; then
  printf '%s\n' ${sh('Im Beleg stehen mehrere Cron-Änderungen. Gesucht ist nur die Zeile zur Kennung vom Zettel.')}
elif [ "$alle" = 1 ] && [ "$hier" = 0 ]; then
  printf '%s\n' ${sh('Diese Zeile gehört zu einer anderen Änderung als der Kennung auf dem Zettel.')}
elif [ "$alle" = 0 ]; then
  printf '%s\n' ${sh('Im Beleg fehlt die Journalzeile zur Kennung vom Zettel.')}
fi
exit 0
`}`;

/** Raumansicht „Serverschrank“: nur lesend, feste Schlüssel, begrenzte Ausgabe, ohne Hilfsprogramme. */
const ABFRAGE_RAUM = String.raw`read -r host < /proc/sys/kernel/hostname
printf 'host\t%s\n' "$host"
n=0
while IFS=: read -r name _ uid _ klartext _; do
  [[ $uid =~ ^[0-9]+$ ]] && [ "$uid" -ge 1000 ] && [ "$uid" -lt 60000 ] || continue
  if [ -n "$klartext" ]; then
    printf 'konten\t%s (UID %s), %s\n' "$name" "$uid" "$klartext"
  else
    printf 'konten\t%s (UID %s)\n' "$name" "$uid"
  fi
  n=$((n + 1))
  [ "$n" -lt 12 ] || break
done < /etc/passwd
IFS=. read -r s _ < /proc/uptime
printf 'laufzeit\tLaufzeit seit Neustart: %d Std. %d Min.\n' $((s / 3600)) $((s % 3600 / 60))
`;

const schrittProzessZeile: ErmittlungsSchritt = {
  art: 'sichern',
  id: 'prozess-zeile',
  title: 'Sichere die Prozesszeile und ihren Starter',
  pager: [
    'Serverraum der Rechenwerk Ostwind GmbH: Auf rw-srv01 läuft ein Prozess namens rw-abgleich. Wer ihn beendet, sieht ihn kurz darauf wieder, ein Wiedergänger.',
    'Du bist das Testkonto azubi. Belege legst du als Textdatei in ~/belege/ ab, als echte Ausgabe eines Befehls. Geprüft wird beim nächsten Shell-Prompt; auf dem Bildschirm nach „Stand prüfen“.',
    'Der Fall ist gelöst, wenn dein Vorwurf stimmt und alle Spuren erledigt sind: Der Wiedergänger muss endgültig weg sein.',
    'Schritt 1: Sichere die Zeile des Prozesses rw-abgleich und die Zeile des Dienstes, der Prozesse zeitgesteuert startet, als ~/belege/prozess-zeile.txt. Tu das, bevor du eingreifst: Danach ist der Prozess weg.',
  ],
  verify: PRUEFE_PROZESS_ZEILE,
  diagnose: DIAGNOSE_PROZESS_ZEILE,
  tipps: [
    'Laufende Prozesse listet ein einziger Befehl. Zeitgesteuerte Aufgaben erledigt der Dienst cron; sein Prozess heißt crond.',
    'ps zeigt die Prozesse mit Nummer, Konto und Befehl. Mit grep -E suchst du nach zwei Namen auf einmal, getrennt durch einen senkrechten Strich, und > schreibt das Ergebnis in eine Datei.',
    `${LOESUNG}ps | grep -E 'rw-abgleich|crond' > ~/belege/prozess-zeile.txt`,
  ],
};

const schrittEingriff: ErmittlungsSchritt = {
  art: 'eingreifen',
  id: 'wiedergaenger',
  title: 'Beende den Wiedergänger endgültig',
  pager: [
    'Schritt 2: rw-abgleich läuft als Dienstkonto abgleich, das gehört dir nicht. Der Einsatzrahmen erlaubt dir dafür genau diese sudo-Befehle: crontab -u abgleich -l, crontab -u abgleich -r, pkill -x rw-abgleich und pkill -u abgleich.',
    'Sorge dafür, dass rw-abgleich nicht mehr läuft und auch nicht wiederkommt. Geprüft wird der Zustand, nicht der Weg.',
  ],
  verify: PRUEFE_EINGRIFF,
  diagnose: DIAGNOSE_EINGRIFF,
  tipps: [
    'Wer den Prozess immer wieder startet, steht in der Cron-Liste des Dienstkontos. Ohne sudo kommst du an sie nicht heran.',
    'sudo crontab -u abgleich -l zeigt die Liste, mit -r wird sie gelöscht. Prozesse beendet pkill, nach Name mit -x oder nach Konto mit -u.',
    `${LOESUNG}sudo crontab -u abgleich -r && sudo pkill -x rw-abgleich`,
  ],
};

const schrittKennung: ErmittlungsSchritt = {
  art: 'ablesen',
  id: 'kennung',
  title: 'Lies die Kennung vom Zettel ab',
  pager: [
    'Zweite Spur: Wer hat den Wächter eingetragen? Im Terminal steht es nicht. Im Ordner ~/fotos liegt ein Foto vom Wartungszettel am Rack.',
    'Das Foto siehst du nur auf dem Bildschirm. Starte ihn im Terminal mit dem Befehl bildschirm, wechsle oben auf den Reiter „Bildschirm“ und öffne das Foto mit einem Programm dort.',
    'Trag unten die Änderungskennung ein, die auf dem Zettel steht.',
  ],
  verify: 'false',
  antwort: {
    frage: 'Welche Änderungskennung steht auf dem Zettel? (RW-…)',
    format: 'RW- und vier Ziffern',
    pruefung: String.raw`a=$(printf %s "$ANTWORT" | tr -d ' ' | tr a-z A-Z)
case $a in ${ZAHL}|${KENNUNG}) ;; *) exit 1 ;; esac
j=${sh(JOURNAL)}
[ -f "$j" ] && [ ! -L "$j" ] || exit 1
IFS= read -r -d '' inhalt < "$j" || true
[[ $inhalt == *"change=${KENNUNG} "* ]]
`,
  },
  tipps: [
    'Das Foto liegt in ~/fotos. Ein Bild öffnet sich nur auf dem Bildschirm, nicht im Terminal.',
    'Auf dem Bildschirm öffnet der Dateimanager (Rechtsklick auf den Hintergrund) den Ordner ~/fotos; ein Doppelklick öffnet das Foto im Bildbetrachter. Du kannst auch im Terminal ein Programm aufrufen, zum Beispiel den Bildbetrachter feh mit dem Pfad des Fotos.',
    `${LOESUNG}Im Terminal bildschirm eingeben, auf den Reiter „Bildschirm“ wechseln und dort im Dateimanager ~/fotos öffnen; ein Doppelklick auf das Foto zeigt den Zettel.`,
  ],
};

const schrittWartungZeile: ErmittlungsSchritt = {
  art: 'sichern',
  id: 'wartung-zeile',
  title: 'Sichere die Journalzeile zur Kennung',
  pager: [
    'Das Wartungsjournal /var/log/rechenwerk-wartung.log führt Buch über Änderungen am Server, auch am Cron.',
    'Sichere genau die Zeile, die zur Kennung vom Zettel gehört, als ~/belege/wartung-zeile.txt. Andere Cron-Änderungen gehören nicht in den Beleg.',
  ],
  verify: PRUEFE_WARTUNG_ZEILE,
  diagnose: DIAGNOSE_WARTUNG_ZEILE,
  tipps: [
    'Das Journal ist eine Textdatei. Jede Zeile nennt Zeit, Person, Aktion, Änderungskennung (change=) und Ziel (target=).',
    'grep sucht Zeilen mit einem bestimmten Text, etwa der Kennung. Leite das Ergebnis mit > in eine Datei um.',
    `${LOESUNG}grep 'change=${KENNUNG} ' /var/log/rechenwerk-wartung.log > ~/belege/wartung-zeile.txt`,
  ],
};

export const episode2: Ermittlung = {
  nr: 2,
  id: 'prozess-der-nicht-stirbt',
  titel: 'Der Prozess, der nicht stirbt',
  hostname: 'rw-srv01',
  setup: SETUP,
  bildschirm: true,
  ansichten: [
    {
      id: 'raum',
      art: 'raum',
      titel: 'Serverschrank',
      abfrage: ABFRAGE_RAUM,
      hotspots: [
        { id: 'host', label: 'Schild am Rack', x: 72, y: 72, w: 220, h: 96, schluessel: 'host' },
        {
          id: 'konten',
          label: 'Verwaltungsterminal',
          x: 430,
          y: 72,
          w: 300,
          h: 70,
          schluessel: 'konten',
        },
        {
          id: 'laufzeit',
          label: 'Statusleuchte',
          x: 430,
          y: 410,
          w: 180,
          h: 110,
          schluessel: 'laufzeit',
        },
      ],
    },
    {
      id: 'aktenwand',
      art: 'aktenwand',
      titel: 'Aktenwand',
      abfrage: AKTENWAND_ABFRAGE,
    },
  ],
  spuren: [
    { id: 'prozess', titel: 'Prozess', schritte: [schrittProzessZeile, schrittEingriff] },
    { id: 'zettel', titel: 'Zettel', schritte: [schrittKennung, schrittWartungZeile] },
  ],
  vorwurf: {
    verdaechtige: [
      {
        id: 'timo',
        name: 'Timo Kessler',
        rolle: 'Systemadministrator, pflegt die Cron-Listen',
        portraet: bildUrl(timoBild),
      },
      {
        id: 'nadia',
        name: 'Nadia Brem',
        rolle: 'Datenbankverwaltung, Lagerabgleich',
        portraet: bildUrl(nadiaBild),
      },
      {
        id: 'margit',
        name: 'Margit Ostwind',
        rolle: 'Geschäftsführerin',
        portraet: bildUrl(margitBild),
      },
    ],
    taeterId: 'nadia',
    // Reihenfolge wie in der Aktenwand (nach Dateiname), damit der Vorwurf-Dialog gleich sortiert.
    belege: [
      {
        id: 'prozess-zeile',
        beschreibung:
          'rw-abgleich läuft als Dienstkonto abgleich, und crond startet ihn. Ein Mensch hat den Starter eingetragen, nur wer, sagt der Prozess nicht.',
        spurId: 'prozess',
        stuetzt: 'nadia',
        verify: PRUEFE_PROZESS_ZEILE,
      },
      {
        id: 'wartung-zeile',
        beschreibung: `Das Wartungsjournal nennt Nadia unter der Kennung ${KENNUNG}, die auf dem Zettel steht.`,
        spurId: 'zettel',
        stuetzt: 'nadia',
        verify: PRUEFE_WARTUNG_ZEILE,
      },
    ],
    mindestBelege: 2,
    jedeSpur: true,
    antworten: {
      richtig: [
        `Das passt zusammen: Der Zettel nennt ${KENNUNG} für den Wächter, und das Wartungsjournal zeigt, wer diese Änderung eingetragen hat. Das war Nadia.`,
        'Dass Timo und Margit ebenfalls am Cron gearbeitet haben, beweist nichts. Erst die Kennung vom Zettel trennt die Einträge.',
      ],
      falschePerson: [
        'Diese Person passt nicht zu deinen Belegen. Dass jemand am Cron gearbeitet hat, ist noch kein Beweis.',
        'Such die Person, die das Journal unter der Kennung vom Zettel nennt.',
      ],
      zuWenigBelege: [
        'Die Person könnte stimmen, aber die Begründung trägt noch nicht. Ein Prozess allein nennt keine Person.',
        'Du brauchst Belege aus beiden Spuren: Was auf dem Server läuft und was auf dem Zettel steht.',
      ],
      gesperrt: [
        'Der Vorwurf ist vorübergehend gesperrt. Ein weiterer erkannter Beleg hilft, spätestens drei vollständige Prüfungen öffnen ihn wieder.',
      ],
    },
  },
  einsatzrahmen: {
    text: [
      'Du arbeitest im Serverraum der Rechenwerk Ostwind GmbH mit dem Testkonto azubi.',
      'Diagnose außerhalb des ausgeschlossenen Ordners ist erlaubt, auch auf dem Bildschirm.',
      'Eigene Belege unter ~/belege/ darfst du anlegen und ändern. Eingreifen darfst du nur mit den genannten sudo-Befehlen für den Wiedergänger.',
      '/home/nadia/ ist ausgeschlossen. Ein Zugriff dort hat erzählerische Folgen.',
    ],
    verstoss: EINSATZRAHMEN_VERSTOSS,
    sudoBefehle: SUDO_BEFEHLE,
    folge: [
      'Margit wird misstrauisch: Jemand hat im ausgeschlossenen Ordner gelesen.',
      'Der Vorwurf ist vorübergehend gesperrt. Ein weiterer erkannter Beleg hilft, spätestens drei vollständige Prüfungen öffnen ihn wieder.',
    ],
  },
  beweisstueck: {
    id: 'wiedergaenger',
    titel: 'Der Wiedergänger',
    beschreibung: `Der Zettel mit ${KENNUNG} und die passende Journalzeile führen zu Nadia.`,
    code: 'S2-E2-PROZESS',
  },
  szene: [
    `Alex hält das Foto neben das Journal. „${KENNUNG}“, sagt er. „Der Wächter im Cron stammt von Nadia. Sie wollte ihren Abgleich am Leben halten, und niemand hat gefragt, ob er noch gebraucht wird.“`,
    'Margit nickt schnell. Zu schnell, findet Alex. Sie fragt nur, wer den Zettel am Rack noch gesehen hat. Warum ihr das wichtig ist, sagt sie nicht.',
    'Damit ist Episode 2 abgeschlossen. Warum Nadia den Abgleich nicht abschalten ließ, bleibt offen.',
  ],
};

/** Werkzeugkasten der Hilfe; Begriffe und Beispiele stammen aus dem gemeinsamen Glossar. */
export const episode2Werkzeuge = tools('ps', 'kill', 'pkill', 'crontab', 'sudo', 'grep', '>');
