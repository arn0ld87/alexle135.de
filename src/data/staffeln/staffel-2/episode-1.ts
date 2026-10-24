import margitBild from '../../../assets/missions/staffel-2/margit.webp';
import nadiaBild from '../../../assets/missions/staffel-2/nadia.webp';
import timoBild from '../../../assets/missions/staffel-2/timo.webp';
import { AKTENWAND_ABFRAGE } from '../../../lib/missions/aktenwand';
import { EINSATZRAHMEN_VERSTOSS } from '../../../lib/missions/einsatzrahmenSetup';
import type { Ermittlung } from '../../../lib/missions/ermittlungTypes';
import { tools } from '../../../lib/missions/glossar';
import type { VorfallSchritt } from '../../../lib/missions/staffelTypes';

/**
 * Episode 1 „Zu viele Rechte“ von Staffel 2 (Konzept §10): Im Serverraum der Rechenwerk Ostwind
 * GmbH steht eine sudo-Regel, die dort nicht hingehört. Timo hat sie unter der Änderungskennung
 * RW-1042 eingespielt; der Besitzer root nennt keine Person, erst Regel und Audit-Zeile zusammen
 * tragen den Vorwurf. Alle Daten sind fiktiv. Setup und verify laufen als root; die Belege liegen
 * als `<id>.txt` direkt unter ~/belege/. `${...}` in den Skripten sind nur die Konstanten unten.
 */

/** Astro liefert beim Bildimport Metadaten mit `src`, reines Vite (Vitest) den Pfad selbst. */
const bildUrl = (bild: string | { src: string }): string =>
  typeof bild === 'string' ? bild : bild.src;

const BELEGE = '/home/azubi/belege';
const SUDOERS = '/etc/sudoers.d/rw-fernwartung';
const STATUS = '/usr/local/bin/rw-status';
const AUDIT = '/var/log/rechenwerk-audit.log';
const CHANGE = 'RW-1042';
/** Feste Zeitlinie der Übungsquellen; Regeldatei und Audit-Zeile tragen dieselbe Zeit. */
const ZEIT_EINGESPIELT = '2026-04-17 08:42:00 UTC';
const ZEIT_AUDIT_ENDE = '2026-04-17 08:45:00 UTC';
const REGEL = 'nadia ALL=(root) NOPASSWD: /usr/bin/id';

const AUDIT_ZEILEN = [
  '2026-04-17T07:58:12Z margit login result=ok',
  '2026-04-17T08:12:30Z nadia archive-logs change=RW-1038 target=/var/log/archiv',
  '2026-04-17T08:20:44Z timo update-packages change=RW-1040 target=/usr/local/share/rw',
  '2026-04-17T08:31:09Z timo login result=ok',
  '2026-04-17T08:38:05Z nadia open-request change=RW-1042 target=-',
  '2026-04-17T08:41:30Z timo edit-config change=RW-1041 target=/etc/hosts',
  '2026-04-17T08:42:00Z timo install-sudoers change=RW-1042 target=/etc/sudoers.d/rw-fernwartung',
  '2026-04-17T08:44:19Z margit logout result=ok',
];

/** Belegdateien dieser Episode; das Setup entfernt nur genau diese, nichts rekursiv. */
const BELEG_IDS = ['rechte-zeile', 'rechte-metadaten', 'log-zeile'] as const;

const sh = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** Fiktive Konten sind gesperrt (`adduser -D`) und ohne Login-Shell; bestehende bleiben, wie sie sind. */
const KONTEN = [
  { uid: 1101, name: 'timo', klartext: 'Timo Kessler' },
  { uid: 1102, name: 'nadia', klartext: 'Nadia Brem' },
  { uid: 1103, name: 'margit', klartext: 'Margit Ostwind' },
] as const;

/** Bash als root: legt den fiktiven Ausgangszustand an; jeder Fehler beendet das Skript mit Exit 1. */
const SETUP = String.raw`set -eu
export LC_ALL=C
fehler() { echo "Staffel 2, Episode 1: $1" >&2; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ ! -d ${sh(BELEGE)} ] || [ -L ${sh(BELEGE)} ]; then fehler 'Der Belegordner fehlt.'; fi
for id in ${BELEG_IDS.join(' ')}; do
  rm -f -- "${BELEGE}/$id.txt"
  if [ -e "${BELEGE}/$id.txt" ] || [ -L "${BELEGE}/$id.txt" ]; then fehler "$id.txt ist belegt."; fi
done
konto() {
  if id "$2" >/dev/null 2>&1; then return 0; fi
  adduser -D -H -u "$1" -h "/home/$2" -s /sbin/nologin -g "$3" "$2"
}
${KONTEN.map((k) => `konto ${k.uid} ${k.name} ${sh(k.klartext)}`).join('\n')}
printf '%s\n' ${sh(`# Fernwartung, Aenderung ${CHANGE} (fiktive Uebungsdaten)`)} ${sh(REGEL)} > "$tmp/regel"
visudo -cf "$tmp/regel" >/dev/null
install -o root -g root -m 0644 "$tmp/regel" ${sh(SUDOERS)}
touch -d ${sh(ZEIT_EINGESPIELT)} ${sh(SUDOERS)}
printf '%s\n' '#!/bin/sh' 'exit 0' > "$tmp/status"
install -o root -g root -m 0755 "$tmp/status" ${sh(STATUS)}
chmod 4755 ${sh(STATUS)}
touch -d ${sh(ZEIT_EINGESPIELT)} ${sh(STATUS)}
printf '%s\n' ${AUDIT_ZEILEN.map(sh).join(' ')} > "$tmp/audit"
install -o root -g root -m 0644 "$tmp/audit" ${sh(AUDIT)}
touch -d ${sh(ZEIT_AUDIT_ENDE)} ${sh(AUDIT)}
[ "$(stat -c '%U:%G:%a' ${sh(SUDOERS)})" = root:root:644 ] || fehler 'Die Regeldatei hat falsche Rechte.'
[ "$(stat -c '%U:%G:%a' ${sh(STATUS)})" = root:root:4755 ] || fehler 'rw-status hat falsche Rechte.'
[ "$(stat -c '%U:%G:%a' ${sh(AUDIT)})" = root:root:644 ] || fehler 'Das Audit-Log hat falsche Rechte.'
[ "$(stat -c %y ${sh(SUDOERS)} | cut -c1-19)" = '2026-04-17 08:42:00' ] || fehler 'Die Zeit der Regeldatei stimmt nicht.'
exit 0
`;

/**
 * Die Prüfungen laufen nach jedem Prompt, auch unter starker CPU-Drosselung, und teilen sich die
 * VM-Warteschlange mit den Abfragen. Sie bleiben deshalb bei Bash-Builtins und einem einzigen
 * stat-Aufruf je Skript (Besitzer und Größe von Beleg und Quellen).
 */

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

/** Regelzeile aus der echten Regeldatei samt Änderungskennung im Beleg. */
const PRUEFE_RECHTE_ZEILE = `${belegAnfang('rechte-zeile')}${String.raw`q=${sh(SUDOERS)}
[ -f "$q" ] && [ ! -L "$q" ] || exit 1
{ IFS=: read -r eigner _ groesse; IFS=: read -r qu qg _; } < <(stat -c '%U:%G:%s' "$f" "$q")
[ "$qu:$qg" = root:root ] || exit 1
${BELEG_GROESSE}IFS= read -r -d '' quelle < "$q"
regel=; change=; n=0
while IFS= read -r z; do
  if [[ $z =~ ^[[:space:]]*# ]]; then
    [[ -z $change && $z =~ RW-[0-9]+ ]] && change=$BASH_REMATCH
  elif [[ -n $z && ! $z =~ ^[[:space:]]*$ ]]; then
    regel=$z; n=$((n + 1))
  fi
done <<< "$quelle"
[ "$n" = 1 ] && [ -n "$change" ] || exit 1
has "$regel" && has "$change"
`}`;

/** Besitzer, Rechte und Datum der echten Regeldatei sowie Pfad und Setuid-Modus von rw-status. */
const PRUEFE_RECHTE_METADATEN = `${belegAnfang('rechte-metadaten')}${String.raw`q=${sh(SUDOERS)}
s=${sh(STATUS)}
[ -f "$q" ] && [ ! -L "$q" ] && [ -f "$s" ] && [ ! -L "$s" ] || exit 1
{ IFS=':|' read -r eigner _ groesse _; IFS=':|' read -r qu qg _ modus_q sym_q zeit_q; IFS=':|' read -r su sg _ modus_s sym_s _; } < <(stat -c '%U:%G:%s|%a|%A|%Y' "$f" "$q" "$s")
[ "$qu:$qg" = root:root ] && [ "$su:$sg" = root:root ] || exit 1
${BELEG_GROESSE}has rw-fernwartung && has "$s" && has root || exit 1
re_q="(^|[^0-9])0?$modus_q([^0-9]|\$)"
re_s="(^|[^0-9])$modus_s([^0-9]|\$)"
{ has "$sym_q" || [[ $inhalt =~ $re_q ]]; } || exit 1
{ has "$sym_s" || [[ $inhalt =~ $re_s ]]; } || exit 1
# ls zeigt je nach Alter der Datei Uhrzeit oder Jahr, stat und ls --full-time das volle Datum.
printf -v tag '%(%Y-%m-%d)T' "$zeit_q"
printf -v uhr '%(%b %e %H:%M)T' "$zeit_q"
printf -v jahr '%(%b %e  %Y)T' "$zeit_q"
has "$tag" || has "$uhr" || has "$jahr"
`}`;

/** Die einzige Audit-Zeile von timo mit der Kennung aus der Regeldatei und deren Zielpfad. */
const PRUEFE_LOG_ZEILE = `${belegAnfang('log-zeile')}${String.raw`q=${sh(SUDOERS)}
a=${sh(AUDIT)}
[ -f "$q" ] && [ ! -L "$q" ] && [ -f "$a" ] && [ ! -L "$a" ] || exit 1
{ IFS=: read -r eigner _ groesse; IFS=: read -r qu qg _; IFS=: read -r au ag _; } < <(stat -c '%U:%G:%s' "$f" "$q" "$a")
[ "$qu:$qg" = root:root ] && [ "$au:$ag" = root:root ] || exit 1
${BELEG_GROESSE}IFS= read -r -d '' quelle < "$q"
[[ $quelle =~ RW-[0-9]+ ]] || exit 1
change=$BASH_REMATCH
zeile=; n=0
while IFS= read -r z; do
  set -- $z
  if [ "$2" = timo ] && [ "$4" = "change=$change" ] && [ "$5" = "target=${SUDOERS}" ]; then
    zeile=$z; n=$((n + 1))
  fi
done < "$a"
[ "$n" = 1 ] && has "$zeile"
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

/** Präfix der dritten Tipp-Stufe: Sie zeigt den im Gast geprüften Lösungsweg. */
export const LOESUNG = 'Lösung: ';

const schrittRechteZeile: VorfallSchritt = {
  id: 'sudo-zeile',
  title: 'Sichere die unerwartete sudo-Regel',
  pager: [
    'Serverraum der Rechenwerk Ostwind GmbH: Auf rw-srv01 steht eine sudo-Regel, die dort nicht hingehört.',
    'Du bist das Testkonto azubi. Lesen ist erlaubt, Belege legst du als Textdatei in ~/belege/ ab.',
    'Ein Beleg ist die echte Ausgabe eines Befehls, in die Datei umgeleitet. Abgetippter Text zählt nicht. Geprüft wird beim nächsten Shell-Prompt; wenn du in nano arbeitest, erst speichern und nano verlassen.',
    'Schritt 1: Sichere die Regel samt der Zeile mit der Änderungskennung (RW-…) als ~/belege/rechte-zeile.txt. Die Regelzeile muss unverändert drinstehen.',
  ],
  verify: PRUEFE_RECHTE_ZEILE,
  tipps: [
    'Die Regeln für sudo liegen in Dateien unter /etc/sudoers.d. Eine davon nennt eine Person, die dort nichts zu suchen hat, und eine Änderungskennung steht gleich dabei.',
    'Mit ls siehst du, welche Dateien im Ordner liegen, mit grep suchst du darin nach Text. Mit grep -B1 nimmst du die Zeile davor mit, und > schreibt das Ergebnis in eine Datei. Achtung: > überschreibt die Datei jedes Mal, >> hängt nur hinten an.',
    `${LOESUNG}grep -B1 nadia /etc/sudoers.d/rw-fernwartung > ~/belege/rechte-zeile.txt`,
  ],
};

const schrittMetadaten: VorfallSchritt = {
  id: 'datei-metadaten',
  title: 'Sichere Besitzer, Rechte und Datum',
  pager: [
    'Schritt 2: Die Regeldatei gehört root. Das sagt nur, wer sie angelegt hat, nicht wer die Änderung veranlasste. Trotzdem gehört es in die Akte.',
    'Halte in ~/belege/rechte-metadaten.txt fest, wem die Regeldatei gehört, welche Rechte sie hat und wann sie zuletzt geändert wurde. Dazu kommt rw-status, ein Programm mit Setuid-Bit.',
    'Beide Dateien gehören in denselben Beleg, und zwar als echte Ausgabe von ls -l mit Dateiname, Besitzer, Rechten und Datum. Von Hand abgetippte Werte erkennt die Prüfung nicht.',
  ],
  verify: PRUEFE_RECHTE_METADATEN,
  tipps: [
    'Besitzer, Rechte und Datum einer Datei zeigt ein einziger Befehl. Das Programm rw-status liegt irgendwo unter /usr/local; sein Setuid-Bit erkennst du an einem s in den Rechten.',
    'ls -l zeigt Besitzer, Rechte und Datum, stat zeigt sie ausführlicher. Mit find /usr/local -perm -4000 findest du Dateien mit Setuid-Bit. Mit $( ) setzt du die Ausgabe eines Befehls in einen anderen ein. Willst du zwei Befehle nacheinander in dieselbe Datei schreiben, nimm beim zweiten >>, denn > würde die erste Ausgabe überschreiben.',
    `${LOESUNG}ls -l /etc/sudoers.d/rw-fernwartung $(find /usr/local -perm -4000 -type f) > ~/belege/rechte-metadaten.txt`,
  ],
};

const schrittAuditZeile: VorfallSchritt = {
  id: 'audit-zeile',
  title: 'Sichere die passende Audit-Zeile',
  pager: [
    'Das Audit-Log /var/log/rechenwerk-audit.log führt Buch über Änderungen am Server.',
    'Finde die Zeile, in der jemand etwas unter /etc/sudoers.d eingespielt hat, und sichere sie als ~/belege/log-zeile.txt.',
    'Die ganze Zeile muss unverändert in der Datei stehen, so wie sie im Log steht, ohne eigene Kürzungen oder Ergänzungen.',
  ],
  verify: PRUEFE_LOG_ZEILE,
  tipps: [
    'Das Log ist eine Textdatei. Jede Zeile nennt Zeit, Person, Aktion, Änderungskennung (change=) und Ziel (target=).',
    'grep sucht Zeilen mit einem bestimmten Wort. Such nach dem Ordner, in dem die Regeln für sudo liegen, und leite das Ergebnis mit > in eine Datei um.',
    `${LOESUNG}grep sudoers.d /var/log/rechenwerk-audit.log > ~/belege/log-zeile.txt`,
  ],
};

export const episode1: Ermittlung = {
  nr: 1,
  id: 'zu-viele-rechte',
  titel: 'Zu viele Rechte',
  hostname: 'rw-srv01',
  setup: SETUP,
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
    { id: 'rechte', titel: 'Rechte', schritte: [schrittRechteZeile, schrittMetadaten] },
    { id: 'log', titel: 'Log', schritte: [schrittAuditZeile] },
  ],
  vorwurf: {
    verdaechtige: [
      {
        id: 'timo',
        name: 'Timo Kessler',
        rolle: 'Systemadministrator, Fernwartung',
        portraet: bildUrl(timoBild),
      },
      {
        id: 'nadia',
        name: 'Nadia Brem',
        rolle: 'Datenbankverwaltung',
        portraet: bildUrl(nadiaBild),
      },
      {
        id: 'margit',
        name: 'Margit Ostwind',
        rolle: 'Geschäftsführerin',
        portraet: bildUrl(margitBild),
      },
    ],
    taeterId: 'timo',
    // Reihenfolge wie in der Aktenwand (nach Dateiname), damit der Vorwurf-Dialog gleich sortiert.
    belege: [
      {
        id: 'log-zeile',
        beschreibung: `Das Audit-Log nennt Timo als die Person, die ${CHANGE} eingespielt hat.`,
        spurId: 'log',
        stuetzt: 'timo',
        verify: PRUEFE_LOG_ZEILE,
      },
      {
        id: 'rechte-metadaten',
        beschreibung:
          'Die Regeldatei gehört root und stammt vom 17. April. Root als Besitzer nennt allerdings keine Person.',
        spurId: 'rechte',
        stuetzt: 'timo',
        verify: PRUEFE_RECHTE_METADATEN,
      },
      {
        id: 'rechte-zeile',
        beschreibung: `Die unerwartete sudo-Regel in rw-fernwartung gehört zur Änderung ${CHANGE}.`,
        spurId: 'rechte',
        stuetzt: 'timo',
        verify: PRUEFE_RECHTE_ZEILE,
      },
    ],
    mindestBelege: 2,
    jedeSpur: true,
    antworten: {
      richtig: [
        `Das passt zusammen: Die Regel trägt die Kennung ${CHANGE}, und das Audit-Log zeigt, wer sie unter dieser Kennung eingespielt hat. Das war Timo.`,
        'Dass die Datei root gehört, hätte allein nichts bewiesen. Erst Regel und Logzeile zusammen tragen den Vorwurf.',
      ],
      falschePerson: [
        'Diese Person passt nicht zu deinen Belegen. Wem die Regel gilt oder wem die Datei gehört, sagt nicht, wer die Änderung veranlasst hat.',
        'Such die Person, die das Audit-Log unter der Kennung der Regel nennt.',
      ],
      zuWenigBelege: [
        'Die Person könnte stimmen, aber die Begründung trägt noch nicht. Eine Regel allein nennt keine Person.',
        'Du brauchst Belege aus beiden Spuren: Was in den Rechten steht und was das Log dazu sagt.',
      ],
      gesperrt: [
        'Der Vorwurf ist vorübergehend gesperrt. Ein weiterer erkannter Beleg hilft, spätestens drei vollständige Prüfungen öffnen ihn wieder.',
      ],
    },
  },
  einsatzrahmen: {
    text: [
      'Du arbeitest im Serverraum der Rechenwerk Ostwind GmbH mit dem Testkonto azubi.',
      'Diagnose außerhalb des ausgeschlossenen Ordners ist erlaubt.',
      'Eigene Belege unter ~/belege/ darfst du anlegen und ändern.',
      '/home/nadia/ ist ausgeschlossen. Ein Zugriff dort hat erzählerische Folgen.',
    ],
    verstoss: EINSATZRAHMEN_VERSTOSS,
    folge: [
      'Margit wird misstrauisch: Jemand hat im ausgeschlossenen Ordner gelesen.',
      'Der Vorwurf ist vorübergehend gesperrt. Ein weiterer erkannter Beleg hilft, spätestens drei vollständige Prüfungen öffnen ihn wieder.',
    ],
  },
  beweisstueck: {
    id: 'rechtefund',
    titel: 'Der Rechtefund',
    beschreibung: `Die Regel ${CHANGE} in rw-fernwartung und die passende Audit-Zeile führen zu Timo.`,
    code: 'S2-E1-RECHTE',
  },
  szene: [
    'Margit liest die Logzeile zweimal. „RW-1042“, sagt sie leise. „Das war Timo, mit unserer eigenen Fernwartung.“',
    'Er hat die Regel unter einer Änderungskennung eingespielt, die niemand gegengeprüft hat. Zu viele Rechte, und keiner hat nachgesehen.',
    'Damit ist Episode 1 abgeschlossen. Warum Timo das tat, bleibt offen.',
  ],
};

/** Werkzeugkasten der Hilfe; Begriffe und Beispiele stammen aus dem gemeinsamen Glossar. */
export const episode1Werkzeuge = tools('ls -l', 'stat', 'find', 'grep', '>', '>>');
