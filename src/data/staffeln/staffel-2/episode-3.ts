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
 * Episode 3 „Die Lücke im Log“ von Staffel 2: Im Anmeldelog von rw-srv01 fehlt ein Stück der Nacht
 * auf den 18. April. Eine Kopie des Logs auf dem Logserver (Timos Weiterleitung) hat die Zeilen
 * noch. In den fehlenden Zeilen läuft das Skript logkuerzen.sh unter RW-1051 aus Nadias
 * Fernzugang; Timo (Cron, Weiterleitung) und Margit (kurz im Haus) sind Verdächtige mit Gründen.
 * Alle Daten sind fiktiv. Setup, verify und Diagnosen laufen als root; Belege liegen als `<id>.txt`
 * unter ~/belege/. `@{` in den Skripten steht für `${` von Bash (siehe `bash`); `${...}` im
 * Quelltext sind nur die Konstanten unten.
 */

/** Astro liefert beim Bildimport Metadaten mit `src`, reines Vite (Vitest) den Pfad selbst. */
const bildUrl = (bild: string | { src: string }): string =>
  typeof bild === 'string' ? bild : bild.src;

/** Rohtext für Bash; `@{` wird zu `${`, damit Bash-Parameter nicht als Template gelten. */
const bash = (teile: TemplateStringsArray, ...werte: string[]): string =>
  String.raw({ raw: teile.raw }, ...werte).replaceAll('@{', '${');

const BELEGE = '/home/azubi/belege';
const QUARANTAENE = '/home/azubi/quarantaene';
const LOG = '/var/log/rechenwerk-auth.log';
const KOPIE_ORDNER = '/srv/rechenwerk/log-spiegel';
const KOPIE = `${KOPIE_ORDNER}/rechenwerk-auth.log`;
const WARTUNG = '/srv/rechenwerk/wartung';
const BIN = `${WARTUNG}/bin`;
const ARCHIV = `${WARTUNG}/archiv`;
const SKRIPT = `${BIN}/logkuerzen.sh`;
const CHANGE = 'RW-1051';
/** Feste Zeitlinie der Übungsquellen. */
const ZEIT_LOG = '2026-04-18 06:30:00 UTC';
const ZEIT_SKRIPT = '2026-04-16 21:10:00 UTC';
/** Höchstens so viele Zeilen des Belegs dürfen auch im Log stehen (Kontext von diff -u). */
const KONTEXT_MAX = 8;

const ZEILEN_VOR = [
  '2026-04-17T22:41:06Z margit logout result=ok',
  '2026-04-17T23:05:03Z timo cron-backup result=ok target=/srv/rechenwerk/backup',
  '2026-04-17T23:42:55Z timo login result=ok src=konsole',
  '2026-04-18T00:05:02Z timo cron-backup result=ok target=/srv/rechenwerk/backup',
  '2026-04-18T00:19:37Z timo edit-config change=RW-1048 target=/etc/hosts',
  '2026-04-18T00:48:19Z timo logout result=ok',
  '2026-04-18T01:05:03Z timo cron-backup result=ok target=/srv/rechenwerk/backup',
  '2026-04-18T01:20:36Z timo cron-rotate result=ok target=/var/log',
  '2026-04-18T01:44:19Z timo login result=ok src=konsole',
  '2026-04-18T01:52:08Z timo edit-config change=RW-1049 target=/etc/rechenwerk/log.conf',
  '2026-04-18T02:05:02Z timo cron-backup result=ok target=/srv/rechenwerk/backup',
  '2026-04-18T02:07:51Z timo logout result=ok',
];
/** Die entfernten Zeilen; sie stehen nur in der Kopie. */
const ZEILEN_LUECKE = [
  '2026-04-18T02:14:21Z nadia login result=ok src=fernwartung',
  '2026-04-18T02:16:48Z margit login result=ok src=konsole',
  '2026-04-18T02:19:05Z margit logout result=ok',
  `2026-04-18T02:21:37Z nadia run-script change=${CHANGE} target=${SKRIPT}`,
  `2026-04-18T02:48:10Z nadia list-files change=${CHANGE} target=/srv/rechenwerk/backup`,
  '2026-04-18T03:05:03Z timo cron-backup result=ok target=/srv/rechenwerk/backup',
  '2026-04-18T03:09:26Z nadia logout result=ok',
];
const ZEILEN_NACH = [
  '2026-04-18T04:05:02Z timo cron-backup result=ok target=/srv/rechenwerk/backup',
  '2026-04-18T05:05:03Z timo cron-backup result=ok target=/srv/rechenwerk/backup',
  '2026-04-18T06:05:02Z timo cron-backup result=ok target=/srv/rechenwerk/backup',
  '2026-04-18T06:12:40Z timo login result=ok src=konsole',
  '2026-04-18T06:25:17Z timo logout result=ok',
];
const LOG_ZEILEN = [...ZEILEN_VOR, ...ZEILEN_NACH];
const KOPIE_ZEILEN = [...ZEILEN_VOR, ...ZEILEN_LUECKE, ...ZEILEN_NACH];

/** Das Skript aus der Lücke und zwei harmlose Wartungsskripte von Timo; alle tun nichts. */
const SKRIPT_TEXT = `#!/bin/sh
# logkuerzen.sh: schneidet einen Zeitraum aus dem Anmeldelog (fiktive Uebungsdaten)
# Aenderung ${CHANGE}, Aufruf: logkuerzen.sh VON BIS
echo 'Uebungsdatei: tut nichts.'
exit 0
`;
const BACKUP_TEXT = `#!/bin/sh
# backup.sh: sichert die Daten nachts (fiktive Uebungsdaten)
echo 'Uebungsdatei: tut nichts.'
exit 0
`;
const ROTATE_TEXT = `#!/bin/sh
# logrotate-woechentlich.sh: rotiert die Logs am Sonntag (fiktive Uebungsdaten)
echo 'Uebungsdatei: tut nichts.'
exit 0
`;
const SKRIPTE = [
  { name: 'logkuerzen.sh', text: SKRIPT_TEXT, eigner: 'nadia' },
  { name: 'backup.sh', text: BACKUP_TEXT, eigner: 'timo' },
  { name: 'logrotate-woechentlich.sh', text: ROTATE_TEXT, eigner: 'timo' },
] as const;

/** Belegdateien dieser Episode; das Setup entfernt nur genau diese, nichts rekursiv. */
const BELEG_IDS = ['luecke-zeilen', 'konten-zaehlung'] as const;

const sh = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** Fiktive Konten sind gesperrt (`adduser -D`) und ohne Login-Shell; bestehende bleiben, wie sie sind. */
const KONTEN = [
  { uid: 1101, name: 'timo', klartext: 'Timo Kessler' },
  { uid: 1102, name: 'nadia', klartext: 'Nadia Brem' },
  { uid: 1103, name: 'margit', klartext: 'Margit Ostwind' },
] as const;

/** Bash als root: legt den fiktiven Ausgangszustand an; jeder Fehler beendet das Skript mit Exit 1. */
const SETUP = bash`set -eu
export LC_ALL=C
fehler() { echo "Staffel 2, Episode 3: $1" >&2; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ ! -d ${sh(BELEGE)} ] || [ -L ${sh(BELEGE)} ]; then fehler 'Der Belegordner fehlt.'; fi
for p in /srv/rechenwerk ${sh(KOPIE_ORDNER)} ${sh(WARTUNG)} ${sh(BIN)} ${sh(ARCHIV)}; do
  if [ -L "$p" ] || { [ -e "$p" ] && [ ! -d "$p" ]; }; then fehler 'Ein Ordner der Episode ist belegt.'; fi
done
for p in ${sh(LOG)} ${sh(KOPIE)}; do
  if [ -L "$p" ] || [ -d "$p" ]; then fehler 'Eine Logdatei der Episode ist belegt.'; fi
done
for id in ${BELEG_IDS.join(' ')}; do
  rm -f -- "${BELEGE}/$id.txt"
  if [ -e "${BELEGE}/$id.txt" ] || [ -L "${BELEGE}/$id.txt" ]; then fehler "$id.txt ist belegt."; fi
done
konto() {
  if id "$2" >/dev/null 2>&1; then return 0; fi
  adduser -D -H -u "$1" -h "/home/$2" -s /sbin/nologin -g "$3" "$2"
}
${KONTEN.map((k) => `konto ${k.uid} ${k.name} ${sh(k.klartext)}`).join('\n')}
${SKRIPTE.map((s, i) => `printf '%s' ${sh(s.text)} > "$tmp/s${i}"`).join('\n')}
${SKRIPTE.map((s) => `if [ -d ${sh(`${BIN}/${s.name}`)} ] && [ ! -L ${sh(`${BIN}/${s.name}`)} ]; then fehler 'Ein Skriptname ist belegt.'; fi`).join('\n')}
q=${sh(QUARANTAENE)}
if [ -d "$q" ] && [ ! -L "$q" ]; then
  for p in "$q"/*; do
    [ -f "$p" ] && [ ! -L "$p" ] || continue
    for s in ${SKRIPTE.map((_, i) => `"$tmp/s${i}"`).join(' ')}; do
      if cmp -s "$p" "$s"; then rm -f -- "$p"; fi
    done
  done
fi
install -d -o root -g root -m 0755 /srv/rechenwerk ${sh(KOPIE_ORDNER)} ${sh(WARTUNG)} ${sh(ARCHIV)}
install -d -o azubi -g azubi -m 0755 ${sh(BIN)}
${SKRIPTE.map(
  (s, i) => `rm -f -- ${sh(`${BIN}/${s.name}`)}
install -o ${s.eigner} -g ${s.eigner} -m 0755 "$tmp/s${i}" ${sh(`${BIN}/${s.name}`)}
touch -d ${sh(ZEIT_SKRIPT)} ${sh(`${BIN}/${s.name}`)}
install -o root -g root -m 0644 "$tmp/s${i}" ${sh(`${ARCHIV}/${s.name}.sicherung`)}`
).join('\n')}
printf '%s\n' ${LOG_ZEILEN.map(sh).join(' ')} > "$tmp/log"
printf '%s\n' ${KOPIE_ZEILEN.map(sh).join(' ')} > "$tmp/kopie"
install -o root -g root -m 0644 "$tmp/log" ${sh(LOG)}
touch -d ${sh(ZEIT_LOG)} ${sh(LOG)}
install -o root -g root -m 0644 "$tmp/kopie" ${sh(KOPIE)}
touch -d ${sh(ZEIT_LOG)} ${sh(KOPIE)}
[ "$(stat -c '%U:%G:%a' ${sh(LOG)})" = root:root:644 ] || fehler 'Das Log hat falsche Rechte.'
[ "$(stat -c '%U:%G:%a' ${sh(KOPIE)})" = root:root:644 ] || fehler 'Die Kopie hat falsche Rechte.'
[ "$(stat -c '%U:%G:%a' ${sh(SKRIPT)})" = nadia:nadia:755 ] || fehler 'Das Skript hat falsche Rechte.'
[ "$(stat -c '%U:%G:%a' ${sh(BIN)})" = azubi:azubi:755 ] || fehler 'Der Skriptordner hat falsche Rechte.'
[ "$(stat -c %y ${sh(LOG)} | cut -c1-19)" = '2026-04-18 06:30:00' ] || fehler 'Die Zeit des Logs stimmt nicht.'
exit 0
`;

/**
 * Die Prüfungen laufen nach jedem Prompt, auch unter starker CPU-Drosselung, und teilen sich die
 * VM-Warteschlange mit den Abfragen. Sie bleiben deshalb bei Bash-Builtins und höchstens einem
 * stat-Aufruf je Skript.
 */

/** Gemeinsamer Anfang jeder Belegprüfung: ein echtes, nicht leeres Beleg-File im Belegordner. */
const belegAnfang = (id: string) => bash`export LC_ALL=C
set -f
d=${sh(BELEGE)}
f="$d/${id}.txt"
[ -d "$d" ] && [ ! -L "$d" ] && [ -f "$f" ] && [ ! -L "$f" ] && [ -s "$f" ] || exit 1
has() { [[ $inhalt == *"$1"* ]]; }
`;

/** Beleg mit eigenem Besitzer und höchstens 64 KiB; `stat` hat die erste Zeile dafür geliefert. */
const BELEG_GROESSE = bash`{ IFS=: read -r eigner _ groesse; } < <(stat -c '%U:%G:%s' "$f")
[ "$eigner" = azubi ] && [ "$groesse" -le 65536 ] || exit 1
IFS= read -r -d '' inhalt < "$f"
`;

/** Zeilen der Kopie, die im Log fehlen (`fehlt`, Anzahl `n`); beide Quellen echte Dateien. */
const FEHLENDE = bash`l=${sh(LOG)}
k=${sh(KOPIE)}
[ -f "$l" ] && [ ! -L "$l" ] && [ -f "$k" ] && [ ! -L "$k" ] || exit 1
IFS= read -r -d '' logtext < "$l"
IFS= read -r -d '' kopietext < "$k"
logtext=$'\n'$logtext
fehlt=(); n=0
while IFS= read -r z; do
  [[ -n $z && $logtext != *$'\n'"$z"$'\n'* ]] && { fehlt+=("$z"); n=$((n + 1)); }
done <<< "$kopietext"
`;

/** Uhrzeit (HH:MM) der ersten und der letzten fehlenden Zeile als `von` und `bis`. */
const LUECKE_ZEITEN = bash`t=@{fehlt[0]%% *}
von=@{t:11:5}
t=@{fehlt[$((n - 1))]%% *}
bis=@{t:11:5}
`;

/** Wie viele Zeilen des Belegs `inhalt` auch im Log stehen (diff-Markierungen am Anfang zählen nicht). */
const BEKANNTE_ZEILEN = bash`bekannt=0
pm='[-+<> ]'
while IFS= read -r z; do
  while [[ $z == $pm* ]]; do z=@{z:1}; done
  [[ -n $z && $logtext == *$'\n'"$z"$'\n'* ]] && bekannt=$((bekannt + 1))
done <<< "$inhalt"
`;

/** Antwortfeld: erste und letzte fehlende Uhrzeit, geprüft gegen Log und Kopie. */
const PRUEFE_ZEITRAUM = bash`export LC_ALL=C
set -f
${FEHLENDE}[ "$n" -ge 1 ] || exit 1
${LUECKE_ZEITEN}a=@{ANTWORT//[[:space:]]/}
[ "$a" = "$von-$bis" ]
`;

/** Genau die fehlenden Zeilen im Beleg, höchstens ein paar Kontextzeilen aus dem Log dazu. */
const PRUEFE_LUECKE_ZEILEN = `${belegAnfang('luecke-zeilen')}${bash`${FEHLENDE}[ "$n" -ge 1 ] || exit 1
${BELEG_GROESSE}for z in "@{fehlt[@]}"; do has "$z" || exit 1; done
${BEKANNTE_ZEILEN}[ "$bekannt" -le ${String(KONTEXT_MAX)} ]
`}`;

/**
 * Liest die Zählung im Beleg gegen die fehlenden Zeilen: `gelesen` Zählzeilen (Anzahl und Konto,
 * in beiden Reihenfolgen), `falsch` bei fremdem Konto oder falscher Zahl, `fehlend` Konten ohne Zeile.
 */
const ZAEHLUNG = bash`declare -A soll ist
for z in "@{fehlt[@]}"; do
  read -r _ konto _ <<< "$z"
  soll[$konto]=$((@{soll[$konto]:-0} + 1))
done
re1='^[[:space:]]*([0-9]+)[[:space:]]+([a-z]+)[[:space:]]*$'
re2='^[[:space:]]*([a-z]+)[[:space:]:=]+([0-9]+)[[:space:]]*$'
gelesen=0; falsch=0; fehlend=0
while IFS= read -r z; do
  if [[ $z =~ $re1 ]]; then zahl=@{BASH_REMATCH[1]}; konto=@{BASH_REMATCH[2]}
  elif [[ $z =~ $re2 ]]; then konto=@{BASH_REMATCH[1]}; zahl=@{BASH_REMATCH[2]}
  else continue; fi
  gelesen=$((gelesen + 1))
  if [ -z "@{soll[$konto]:-}" ] || [ "@{ist[$konto]:-$zahl}" != "$zahl" ] || [ "@{soll[$konto]}" != "$zahl" ]; then falsch=1; fi
  ist[$konto]=$zahl
done <<< "$inhalt"
for konto in "@{!soll[@]}"; do
  [ -n "@{ist[$konto]:-}" ] || fehlend=$((fehlend + 1))
done
`;

/** Häufigkeit je Konto in den fehlenden Zeilen, nicht im ganzen Log. */
const PRUEFE_ZAEHLUNG = `${belegAnfang('konten-zaehlung')}${bash`${FEHLENDE}[ "$n" -ge 1 ] || exit 1
${BELEG_GROESSE}${ZAEHLUNG}[ "$gelesen" -ge 1 ] && [ "$falsch" = 0 ] && [ "$fehlend" = 0 ]
`}`;

/** Der Beleg hat Zeilen aus der Kopie, aber nicht alle fehlenden, oder zu viel aus dem Log. */
const DIAGNOSE_LUECKE_ZEILEN = `${diagnoseBelegAnfang(`${BELEGE}/luecke-zeilen.txt`)}${bash`${FEHLENDE}[ "$n" -ge 1 ] || exit 0
da=0
for z in "@{fehlt[@]}"; do
  if [[ $inhalt == *"$z"* ]]; then da=$((da + 1)); fi
done
${BEKANNTE_ZEILEN}if [ "$da" -eq 0 ]; then
  printf '%s\n' ${sh('Im Beleg steht keine der fehlenden Zeilen. Sie stehen nur in der Kopie, nicht im Log.')}
elif [ "$da" -lt "$n" ]; then
  printf '%s\n' ${sh('Es fehlen noch Zeilen aus der Kopie. Mit >> hängst du an, statt zu überschreiben.')}
elif [ "$bekannt" -gt ${String(KONTEXT_MAX)} ]; then
  printf '%s\n' ${sh('Dein Beleg enthält auch viele Zeilen, die im Log stehen. Sichere nur die fehlenden.')}
fi
exit 0
`}`;

/** Zählung vorhanden, aber falsch (ganzes Log gezählt), fremd oder unvollständig. */
const DIAGNOSE_ZAEHLUNG = `${diagnoseBelegAnfang(`${BELEGE}/konten-zaehlung.txt`)}${bash`${FEHLENDE}[ "$n" -ge 1 ] || exit 0
${ZAEHLUNG}if [ "$gelesen" -eq 0 ]; then
  printf '%s\n' ${sh('Im Beleg steht keine Zählung. Pro Konto eine Zeile mit Anzahl und Name, zum Beispiel von uniq -c.')}
elif [ "$falsch" = 1 ]; then
  printf '%s\n' ${sh('Eine Zahl oder ein Konto stimmt nicht. Zähle nur die fehlenden Zeilen, nicht das ganze Log.')}
elif [ "$fehlend" -gt 0 ]; then
  printf '%s\n' ${sh('Es fehlt noch ein Konto in deiner Zählung. Mit >> hängst du an, statt zu überschreiben.')}
fi
exit 0
`}`;

/** Gemeinsame Zustandslese für Prüfung und Diagnose des Quarantäne-Schritts. */
const QUARANTAENE_LESEN = bash`w=${sh(WARTUNG)}
o=${sh(SKRIPT)}
q=${sh(QUARANTAENE)}
soll=${sh(SKRIPT_TEXT)}
decoy1=${sh(BACKUP_TEXT)}
decoy2=${sh(ROTATE_TEXT)}
da=0; fremd=0; kopie=0
if [ -d "$q" ] && [ ! -L "$q" ]; then
  for p in "$q"/*; do
    [ -f "$p" ] && [ ! -L "$p" ] || continue
    IFS= read -r -d '' -n 65536 inhalt < "$p"
    if [[ $inhalt == "$soll" ]]; then da=1
    elif [[ $inhalt == "$decoy1" || $inhalt == "$decoy2" ]]; then fremd=1; fi
  done
fi
for p in "$w"/bin/* "$w"/*; do
  [ -f "$p" ] && [ ! -L "$p" ] || continue
  IFS= read -r -d '' -n 65536 inhalt < "$p"
  if [[ $inhalt == "$soll" ]]; then kopie=1; fi
done
`;

/** Das Skript aus der Lücke liegt unverändert in ~/quarantaene/, nirgends sonst im Wartungsordner. */
const PRUEFE_QUARANTAENE = bash`export LC_ALL=C
${QUARANTAENE_LESEN}[ -d "$q" ] && [ ! -L "$q" ] && [ ! -e "$o" ] && [ ! -L "$o" ] || exit 1
[ "$da" = 1 ] && [ "$fremd" = 0 ] && [ "$kopie" = 0 ]
`;

/** Kopiert statt verschoben, zu viel verschoben oder das Original ohne Ziel gelöscht. */
const DIAGNOSE_QUARANTAENE = bash`export LC_ALL=C
${QUARANTAENE_LESEN}if [ "$da" = 1 ] && [ "$kopie" = 1 ]; then
  printf '%s\n' ${sh('Das Original liegt noch im Wartungsordner. Verschieben heißt: Danach ist es dort weg.')}
elif [ "$fremd" = 1 ]; then
  printf '%s\n' ${sh('In ~/quarantaene/ liegt auch ein anderes Skript. Nur das aus der Lücke gehört dorthin.')}
elif [ "$da" = 0 ] && [ ! -e "$o" ] && [ ! -L "$o" ]; then
  printf '%s\n' ${sh('Das Skript ist aus bin/ verschwunden, liegt aber nicht unverändert in ~/quarantaene/. Im Archiv liegt eine Sicherung.')}
fi
exit 0
`;

/** Raumansicht „Serverschrank“: nur lesend, feste Schlüssel, begrenzte Ausgabe, ohne Hilfsprogramme. */
const ABFRAGE_RAUM = bash`read -r host < /proc/sys/kernel/hostname
printf 'host\t%s\n' "$host"
anzahl=0
while IFS=: read -r name _ uid _ klartext _; do
  [[ $uid =~ ^[0-9]+$ ]] && [ "$uid" -ge 1000 ] && [ "$uid" -lt 60000 ] || continue
  if [ -n "$klartext" ]; then
    printf 'konten\t%s (UID %s), %s\n' "$name" "$uid" "$klartext"
  else
    printf 'konten\t%s (UID %s)\n' "$name" "$uid"
  fi
  anzahl=$((anzahl + 1))
  [ "$anzahl" -lt 12 ] || break
done < /etc/passwd
zeilen() {
  local z=0
  if [ -r "$1" ]; then
    while IFS= read -r _; do z=$((z + 1)); done < "$1"
  fi
  REPLY=$z
}
zeilen ${sh(LOG)}
printf 'logs\tAnmeldelog auf dem Server: %s Zeilen\n' "$REPLY"
zeilen ${sh(KOPIE)}
printf 'logs\tKopie auf dem Logserver: %s Zeilen\n' "$REPLY"
IFS=. read -r s _ < /proc/uptime
printf 'laufzeit\tLaufzeit seit Neustart: %d Std. %d Min.\n' $((s / 3600)) $((s % 3600 / 60))
`;

const schrittZeitraum: ErmittlungsSchritt = {
  art: 'ablesen',
  id: 'zeitraum',
  title: 'Lies ab, wann Zeilen fehlen',
  pager: [
    'Nachtschicht bei der Rechenwerk Ostwind GmbH: Im Anmeldelog von rw-srv01 fehlt ein Stück der Nacht auf den 18. April. Jemand hat Zeilen entfernt.',
    'Du bist das Testkonto azubi. Lesen ist erlaubt, Belege legst du als Textdatei in ~/belege/ ab. Geprüft wird beim nächsten Shell-Prompt; wenn du in nano arbeitest, erst speichern und nano verlassen.',
    'Das Log heißt /var/log/rechenwerk-auth.log. Timo leitet es seit gestern auf den Logserver weiter, eine Kopie liegt irgendwo unter /srv/rechenwerk/.',
    'Schritt 1: Vergleiche Log und Kopie und trag unten ein, wann die erste und wann die letzte fehlende Zeile steht.',
  ],
  verify: 'false',
  antwort: {
    frage: 'Wann steht die erste, wann die letzte fehlende Zeile? (HH:MM-HH:MM)',
    format: 'Zwei Uhrzeiten mit Bindestrich, zum Beispiel 01:30-02:45',
    pruefung: PRUEFE_ZEITRAUM,
  },
  tipps: [
    'Das Log und seine Kopie sind fast gleich. Such die Zeilen, die nur in der Kopie stehen, und lies die Uhrzeit der ersten und der letzten.',
    "Mit find /srv/rechenwerk -name '*.log' findest du die Kopie. diff vergleicht zwei Dateien Zeile für Zeile; Zeilen, die nur in der zweiten stehen, beginnen mit >. Die Uhrzeit steckt in jeder Zeile hinter dem T.",
    `${LOESUNG}diff ${LOG} ${KOPIE} zeigt die fehlenden Zeilen; trag die Uhrzeit der ersten und der letzten als HH:MM-HH:MM ein.`,
  ],
};

const schrittLueckeZeilen: ErmittlungsSchritt = {
  art: 'sichern',
  id: 'luecke-zeilen',
  title: 'Sichere die fehlenden Zeilen',
  pager: [
    'Schritt 2: Die fehlenden Zeilen gehören in die Akte.',
    'Sichere genau die Zeilen, die nur in der Kopie stehen, unverändert als ~/belege/luecke-zeilen.txt. Ein Beleg ist die echte Ausgabe eines Befehls, in die Datei umgeleitet. Abgetippter Text zählt nicht.',
  ],
  verify: PRUEFE_LUECKE_ZEILEN,
  diagnose: DIAGNOSE_LUECKE_ZEILEN,
  tipps: [
    'Du hast die fehlenden Zeilen schon gesehen. Jetzt gehören genau sie, und nur sie, unverändert in den Beleg.',
    'diff zeigt sie mit > am Anfang; das stört den Beleg nicht. grep -vxFf LOG KOPIE gibt dieselben Zeilen ohne Markierung aus, ganz ohne Hilfsdatei. Mit > schreibst du das Ergebnis in eine Datei.',
    `${LOESUNG}grep -vxFf ${LOG} ${KOPIE} > ~/belege/luecke-zeilen.txt`,
  ],
};

const schrittZaehlung: ErmittlungsSchritt = {
  art: 'sichern',
  id: 'konten-zaehlung',
  title: 'Sichere die Häufigkeit je Konto',
  pager: [
    'Zweite Spur: Wer war in der Lücke aktiv?',
    'Zähle in den fehlenden Zeilen, wie oft jedes Konto vorkommt, und sichere die Zählung als ~/belege/konten-zaehlung.txt. Pro Konto eine Zeile mit Anzahl und Name.',
    'Gezählt werden nur die fehlenden Zeilen, nicht das ganze Log.',
  ],
  verify: PRUEFE_ZAEHLUNG,
  diagnose: DIAGNOSE_ZAEHLUNG,
  tipps: [
    'Das Konto steht in jeder Zeile an zweiter Stelle. Hol erst die fehlenden Zeilen, dann die zweite Spalte, dann zähl.',
    "cut -d' ' -f2 oder awk '{print $2}' holt die zweite Spalte. sort bringt gleiche Zeilen untereinander, uniq -c zählt sie. Die Pipe | reicht die Ausgabe weiter.",
    `${LOESUNG}grep -vxFf ${LOG} ${KOPIE} | cut -d' ' -f2 | sort | uniq -c > ~/belege/konten-zaehlung.txt`,
  ],
};

const schrittQuarantaene: ErmittlungsSchritt = {
  art: 'ordnen',
  id: 'skript-quarantaene',
  title: 'Verschiebe das Löschskript in die Quarantäne',
  pager: [
    'In der Lücke lief ein Skript, das Zeilen aus dem Log geschnitten hat. Es liegt noch im Wartungsordner unter /srv/rechenwerk/wartung/.',
    'Leg einen Ordner ~/quarantaene/ an und verschiebe das Skript unverändert dorthin. Nicht kopieren und nicht ändern: Danach darf es im Wartungsordner nicht mehr liegen.',
    'Andere Skripte im Ordner gehören nicht dazu. Welches in der Lücke lief, steht in den fehlenden Zeilen.',
  ],
  verify: PRUEFE_QUARANTAENE,
  diagnose: DIAGNOSE_QUARANTAENE,
  tipps: [
    'In den fehlenden Zeilen steht hinter target= der Pfad des Skripts. Verschieben heißt: Das Original ist danach weg.',
    'Mit mkdir -p legst du ~/quarantaene an, mit mv verschiebst du eine Datei dorthin. Andere Skripte im Ordner lässt du, wo sie sind.',
    `${LOESUNG}mkdir -p ~/quarantaene && mv ${SKRIPT} ~/quarantaene/`,
  ],
};

export const episode3: Ermittlung = {
  nr: 3,
  id: 'luecke-im-log',
  titel: 'Die Lücke im Log',
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
          id: 'logs',
          label: 'Logserver',
          x: 780,
          y: 420,
          w: 160,
          h: 100,
          schluessel: 'logs',
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
    { id: 'luecke', titel: 'Lücke', schritte: [schrittZeitraum, schrittLueckeZeilen] },
    { id: 'zaehlung', titel: 'Zählung', schritte: [schrittZaehlung, schrittQuarantaene] },
  ],
  vorwurf: {
    verdaechtige: [
      {
        id: 'timo',
        name: 'Timo Kessler',
        rolle: 'Systemadministrator, richtete die Logweiterleitung ein',
        portraet: bildUrl(timoBild),
      },
      {
        id: 'nadia',
        name: 'Nadia Brem',
        rolle: 'Datenbankverwaltung, Fernwartung',
        portraet: bildUrl(nadiaBild),
      },
      {
        id: 'margit',
        name: 'Margit Ostwind',
        rolle: 'Geschäftsführerin, kennt alle Passwörter',
        portraet: bildUrl(margitBild),
      },
    ],
    taeterId: 'nadia',
    // Reihenfolge wie in der Aktenwand (nach Dateiname), damit der Vorwurf-Dialog gleich sortiert.
    belege: [
      {
        id: 'konten-zaehlung',
        beschreibung: 'In den fehlenden Zeilen kommt Nadia am häufigsten vor, vor Margit und Timo.',
        spurId: 'zaehlung',
        stuetzt: 'nadia',
        verify: PRUEFE_ZAEHLUNG,
      },
      {
        id: 'luecke-zeilen',
        beschreibung: `Die fehlenden Zeilen zeigen Nadia im Fernzugang und das Skript logkuerzen.sh unter ${CHANGE}.`,
        spurId: 'luecke',
        stuetzt: 'nadia',
        verify: PRUEFE_LUECKE_ZEILEN,
      },
    ],
    mindestBelege: 2,
    jedeSpur: true,
    antworten: {
      richtig: [
        `Das passt zusammen: Die fehlenden Zeilen zeigen, dass Nadia im Fernzugang das Skript logkuerzen.sh unter ${CHANGE} gestartet hat, und in der Lücke steht sie am häufigsten.`,
        'Dass Timo im ganzen Log öfter vorkommt, hätte allein nichts bewiesen. Erst die Lücke selbst zeigt, wer sie geschnitten hat.',
      ],
      falschePerson: [
        'Diese Person passt nicht zu deinen Belegen. Wer im ganzen Log oft vorkommt oder kurz im Haus war, hat die Zeilen nicht automatisch entfernt.',
        'Such die Person, die in den fehlenden Zeilen selbst etwas ausgeführt hat.',
      ],
      zuWenigBelege: [
        'Die Person könnte stimmen, aber die Begründung trägt noch nicht. Die fehlenden Zeilen allein sagen nicht, wer in der Lücke am meisten getan hat.',
        'Du brauchst Belege aus beiden Spuren: die fehlenden Zeilen und die Zählung der Konten.',
      ],
      gesperrt: [
        'Der Vorwurf ist vorübergehend gesperrt. Ein weiterer erkannter Beleg hilft, spätestens drei vollständige Prüfungen öffnen ihn wieder.',
      ],
    },
  },
  einsatzrahmen: {
    text: [
      'Du arbeitest wieder auf rw-srv01 der Rechenwerk Ostwind GmbH mit dem Testkonto azubi.',
      'Diagnose außerhalb des ausgeschlossenen Ordners ist erlaubt. Für diesen Fall brauchst du kein sudo.',
      'Eigene Belege unter ~/belege/ und das Verschobene unter ~/quarantaene/ darfst du anlegen und ändern.',
      '/home/nadia/ ist ausgeschlossen. Ein Zugriff dort hat erzählerische Folgen.',
    ],
    sudoBefehle: [],
    verstoss: EINSATZRAHMEN_VERSTOSS,
    folge: [
      'Margit wird misstrauisch: Jemand hat im ausgeschlossenen Ordner gelesen.',
      'Der Vorwurf ist vorübergehend gesperrt. Ein weiterer erkannter Beleg hilft, spätestens drei vollständige Prüfungen öffnen ihn wieder.',
    ],
  },
  beweisstueck: {
    id: 'logluecke',
    titel: 'Die Lücke im Log',
    beschreibung: `Die fehlenden Zeilen unter ${CHANGE} und die Zählung der Konten führen zu Nadia und dem Skript logkuerzen.sh.`,
    code: 'S2-E3-LUECKE',
  },
  szene: [
    `Margit liest die fehlenden Zeilen langsam. „${CHANGE}“, sagt sie. „Nadia. Über den Fernzugang, den Timo ihr freigegeben hat.“`,
    'Timo nickt knapp. Die Weiterleitung auf den Logserver hat er erst in der Nacht davor eingerichtet. Ohne die Kopie wäre die Lücke nie aufgefallen.',
    'Damit ist Episode 3 abgeschlossen. Warum Nadia die Zeilen entfernte, bleibt offen. Margit war in jener Nacht selbst kurz im Haus. Sie erwähnt es nicht.',
  ],
};

/** Werkzeugkasten der Hilfe; Begriffe und Beispiele stammen aus dem gemeinsamen Glossar. */
export const episode3Werkzeuge = tools('diff', 'awk', 'cut', 'sort', 'uniq -c', 'mv');
