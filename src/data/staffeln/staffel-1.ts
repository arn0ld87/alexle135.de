// Staffel 1 „Fall Kehrwoche“ (#395). Alex ist im Urlaub, jemand pfuscht am Server; jeder
// Vorfall legt eine Spur zum Konto `kehrwoche` (Alex' Aufräum-Agent). Vorfälle 0–4 (#400), 5–8
// (#401) mit Git, Cron und Prozessen; das Finale löst auf, wer kehrwoche den Auftrag gab. Alles fiktiv, IPs nur aus Dokumentationsnetzen. Setup und verify laufen als
// root mit /home/azubi als Arbeitsverzeichnis. `${...}` in den Snippets sind nur die
// TypeScript-Konstanten unten, nie Shell-Variablen.
import { tools } from '../../lib/missions/glossar';
import type { Staffel } from '../../lib/missions/staffelTypes';
import { CHOWN_HOME, GIT_IDENTITY, HELPERS, RESET_HOME } from '../missions/shared';
import { BEGRUESSUNG } from './begruessung';

/** /srv/www neu anlegen; gehört azubi, damit die Handgriffe ohne root gehen. */
const SRV_RESET = 'rm -rf /srv/www && mkdir -p /srv/www';
const SRV_CHOWN = 'chown -R azubi:azubi /srv/www';

const CRONTAB_AZUBI = '/etc/crontabs/azubi';
const CRONTAB_KEHRWOCHE = '/etc/crontabs/kehrwoche';

/** Commits im Setup mit festem Datum: `alex DATUM MELDUNG` und `fremd DATUM MELDUNG` („unbekannt“). */
const GIT_ALS = `als() { GIT_AUTHOR_DATE="$3" GIT_COMMITTER_DATE="$3" git -c user.name="$1" -c user.email="$2" commit -q -m "$4"; }
alex() { als 'Alex Schneider' 'alex@alex-schneider.dev' "$@"; }
fremd() { als 'unbekannt' 'kehrwoche@alex-schneider.dev' "$@"; }`;

/** `g …` = git im Repository /srv/www; verify und Diagnose wechseln nie das Verzeichnis. */
const GIT_SRV = 'g() { git -C /srv/www "$@"; }\n';

/**
 * Commit von „unbekannt“ (Meldung enthält `wort`) per Revert zurückgenommen: Er steht weiter in
 * der Historie, ein Revert-Commit mit Gits Standardmeldung folgt, `datei` hat wieder den Stand
 * vor ihm, nichts liegt uncommittet herum.
 */
const revertVerify = (wort: string, meldung: string, datei: string) =>
  `${GIT_SRV}k=$(g log --format=%H --author=unbekannt --grep='${wort}') && [ -n "$k" ] && g merge-base --is-ancestor "$k" HEAD && g log --format=%s | grep -qF 'Revert "${meldung}' && [ -f '/srv/www/${datei}' ] && g diff --quiet "$k^" HEAD -- '${datei}' && [ -z "$(g status --porcelain)" ]`;

const revertDiagnose = (
  wort: string,
  datei: string
) => `${GIT_SRV}k=$(g log --format=%H --author=unbekannt --grep='${wort}' 2>/dev/null)
if [ -z "$k" ] || ! g merge-base --is-ancestor "$k" HEAD 2>/dev/null; then
  echo 'Der Commit von unbekannt ist aus der Historie verschwunden. git revert lässt ihn stehen und nimmt ihn mit einem neuen Commit zurück. Starte die Episode neu.'
elif [ -n "$(g status --porcelain)" ]; then
  echo '${datei} ist geändert, aber nicht committet. git revert erledigt beides in einem Schritt.'
fi`;

const ALEX_IP = '192.0.2.10';
const ANGREIFER_IP = '203.0.113.66';
const KEHRWOCHE_IP = '198.51.100.23';

export const staffel1: Staffel = {
  id: 'staffel-1',
  titel: 'Fall Kehrwoche',
  vorfaelle: [
    {
      nr: 0,
      id: 'erster-tag',
      titel: 'Erster Tag',
      setup: `${RESET_HOME}
chmod 755 /home/alex
cat > /home/alex/uebergabe.txt <<'TXT'
Übergabe – mein Server, während ich weg bin

1. Die Webseite liegt unter /srv/www. Läuft sie, ist alles gut.
2. Logs liegen unter /var/log. Wenn dir was komisch vorkommt: zuerst dort schauen.
3. Mein Aufräum-Agent "kehrwoche" läuft nachts. Der ist harmlos. Glaube ich.
4. Notfallnummer gibt es keine. Ich bin im Urlaub.

Alex
TXT
chown alex:alex /home/alex/uebergabe.txt
chmod 644 /home/alex/uebergabe.txt
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'notizen',
          title: 'Platz für Notizen',
          pose: 'neutral',
          pager: [
            ...BEGRUESSUNG,
            'Erster Handgriff: Leg dir in deinem Home einen Ordner `notizen` an. Da kommt alles rein, was dir auffällt.',
          ],
          verify: '[ -d notizen ]',
          tipps: [
            'Ordner legst du mit einem eigenen Befehl an, nicht mit einer Datei.',
            '`mkdir` heißt „make directory“, dahinter der Name des Ordners.',
            'mkdir notizen',
          ],
          diagnose: `[ -f notizen ] && echo 'notizen ist eine Datei, kein Ordner. Lösch sie mit rm und leg den Ordner mit mkdir an.'`,
          failMessage: 'Noch kein Ordner `notizen` in deinem Home.',
        },
        {
          id: 'uebergabe',
          title: 'Übergabe einstecken',
          pager: [
            'Gut. Meinen Übergabezettel findest du in meinem Home, `/home/alex/uebergabe.txt`.',
            'Lies ihn und kopier ihn in deinen Ordner `notizen`. Das Original bleibt bei mir liegen.',
          ],
          verify: 'cmp -s notizen/uebergabe.txt /home/alex/uebergabe.txt',
          target: 'notizen/uebergabe.txt',
          diagnose: `if [ -f uebergabe.txt ] && [ ! -f notizen/uebergabe.txt ]; then
  echo 'Die Kopie liegt in deinem Home, nicht in notizen. Mit mv schiebst du sie hinein.'
elif [ -f notizen/uebergabe.txt ]; then
  echo 'In notizen liegt eine uebergabe.txt, aber nicht dieselbe wie meine. cp kopiert 1:1.'
fi`,
          tipps: [
            'Mit `cat` liest du den Zettel, ohne ihn zu ändern.',
            '`cp` braucht zwei Angaben: erst die Quelle, dann das Ziel, hier den Ordner `notizen`.',
            'cp /home/alex/uebergabe.txt notizen/',
          ],
          failMessage: 'In `notizen` liegt noch keine Kopie von `uebergabe.txt`.',
        },
      ],
      werkzeuge: tools('pwd', 'ls', 'cd', 'mkdir', 'cp'),
      beweisstueck: {
        id: 'uebergabe',
        titel: 'Übergabezettel',
        beschreibung: 'Alex erwähnt einen Agenten namens kehrwoche, „harmlos, glaube ich“.',
        code: 'S1-V0-UEBERGABE',
      },
      szene: [
        'Alex schickt ein Foto: Liegestuhl, Sonnenbrille, Laptop auf den Knien.',
        '„Nur kurz Mails. Ehrlich.“',
      ],
    },
    {
      nr: 1,
      id: 'platte-voll',
      titel: 'Platte voll',
      setup: `${RESET_HOME}
${SRV_RESET}
mkdir -p /srv/www/html /srv/www/logs /srv/www/tmp/.kehrwoche
printf '<h1>Alex Schneider</h1>\\n' > /srv/www/html/index.html
for i in 1 2 3; do printf 'Bild %s\\n' "$i" > "/srv/www/html/bild-$i.txt"; done
printf 'GET / 200\\n' > /srv/www/logs/access.log
for i in 1 2 3 4 5; do printf 'sitzung %s\\n' "$i" > "/srv/www/tmp/sitzung-$i.tmp"; done
head -c 6M /dev/zero > /srv/www/tmp/.kehrwoche/sicherung-komplett.img
${SRV_CHOWN}
chown kehrwoche:kehrwoche /srv/www/tmp/.kehrwoche/sicherung-komplett.img
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'riesendatei',
          title: 'Platzfresser finden',
          pose: 'besorgt',
          pager: [
            'Piep. Das Monitoring meldet: Unter /srv/www ist kaum noch Platz.',
            'Irgendwo liegt eine riesige Datei, die da nicht hingehört. Find sie, schau vor dem Löschen nach, wem sie gehört, und dann weg damit. Die Webseite und das Log bleiben bitte stehen.',
          ],
          verify: `[ ! -e /srv/www/tmp/.kehrwoche/sicherung-komplett.img ] && [ -f /srv/www/html/index.html ] && [ "$(ls /srv/www/html | wc -l)" -eq 4 ] && [ -f /srv/www/logs/access.log ]`,
          diagnose: `if [ ! -f /srv/www/html/index.html ] || [ "$(ls /srv/www/html 2>/dev/null | wc -l)" -ne 4 ]; then
  echo 'Zu viel gelöscht: Die Webseite unter /srv/www/html fehlt. Starte die Episode neu.'
elif [ ! -f /srv/www/logs/access.log ]; then
  echo 'Das Log unter /srv/www/logs hast du gelöscht, das sollte bleiben. Starte die Episode neu.'
elif [ -e /srv/www/tmp/.kehrwoche/sicherung-komplett.img ]; then
  echo 'Die große Datei ist noch da. du -sh zeigt Ordnergrößen, ls -a auch versteckte Ordner.'
fi`,
          tipps: [
            'Erst messen, dann löschen: Welcher Ordner unter /srv/www ist so groß? Achte auf versteckte Ordner.',
            '`du -sh` misst Ordner, `ls -la` zeigt auch versteckte und die Größe. Gelöscht wird mit `rm`; fragt `rm` nach („write-protected“), weil die Datei jemand anderem gehört, bestätigst du mit `y`.',
            'rm -f /srv/www/tmp/.kehrwoche/sicherung-komplett.img',
          ],
          failMessage: 'Die riesige Datei liegt noch unter /srv/www.',
        },
        {
          id: 'sitzungen',
          title: 'Alte Sitzungen wegräumen',
          pager: [
            'Platz ist wieder da. Und die Datei gehörte kehrwoche, nicht mir. Merk dir den Namen.',
            'Wenn du schon dabei bist: Unter /srv/www/tmp liegen alte Sitzungsdateien mit der Endung .tmp. Die können alle weg, der Ordner tmp bleibt.',
          ],
          verify: `[ -z "$(find /srv/www -name '*.tmp')" ] && [ -d /srv/www/tmp ] && [ -f /srv/www/html/index.html ]`,
          diagnose: `[ -d /srv/www/tmp ] || echo 'Der Ordner tmp selbst sollte stehen bleiben. Starte die Episode neu.'`,
          tipps: [
            'Alle Dateien, die weg sollen, enden auf .tmp.',
            'Das Sternchen `*` steht für beliebige Zeichen; `rm` nimmt damit mehrere Dateien auf einmal.',
            'rm /srv/www/tmp/*.tmp',
          ],
          failMessage: 'Unter /srv/www liegen noch .tmp-Dateien.',
        },
      ],
      werkzeuge: tools('du', 'ls -a', 'ls -l', 'rm', '*'),
      beweisstueck: {
        id: 'sicherung',
        titel: 'Eine „Sicherung“ voller Nullen',
        beschreibung: '6 MB Nullen in einem versteckten Ordner, Eigentümer: kehrwoche.',
        code: 'S1-V1-NULLEN',
      },
      szene: [
        '„Platte frei? Gut. Ich liege am Pool, und das Hotel-WLAN ist schneller als mein Server.“',
      ],
    },
    {
      nr: 2,
      id: 'skript-startet-nicht',
      titel: 'Skript startet nicht',
      setup: `${RESET_HOME}
${SRV_RESET}
mkdir -p /srv/www/bin /srv/www/html
cat > /srv/www/bin/deploy.sh <<'SH'
#!/bin/bash
# Startet die Webseite neu. Von Alex.
# kehrwoche 03:12 – Ausführungsrecht entfernt: unbekanntes Skript, sicherheitshalber deaktiviert.
cd /srv/www/html || exit 1
printf 'online %s\\n' "$(date +%s)" > status.txt
echo 'Webseite läuft wieder.'
SH
chmod 644 /srv/www/bin/deploy.sh
printf 'offline\\n' > /srv/www/html/status.txt
${SRV_CHOWN}
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'rechte',
          title: 'Ausführungsrecht zurück',
          pager: [
            'Piep. Die Webseite ist offline, und mein Neustart-Skript `/srv/www/bin/deploy.sh` will nicht starten.',
            'Gib ihm das Recht zurück, ausgeführt zu werden. Aber nur das: Schreiben darf es weiterhin nur sein Eigentümer.',
          ],
          verify: `[ -x /srv/www/bin/deploy.sh ] && [ -z "$(find /srv/www/bin/deploy.sh -perm /022)" ]`,
          diagnose: `f=/srv/www/bin/deploy.sh
if [ -n "$(find "$f" -perm /022 2>/dev/null)" ]; then
  echo 'Ausführbar ja, aber jetzt dürfen auch andere das Skript ändern. Nimm nur das x dazu, zum Beispiel u+x.'
elif [ ! -x "$f" ]; then
  echo 'In ls -l fehlt beim Skript noch das x.'
fi`,
          tipps: [
            'Das Skript ist da, darf aber nicht starten. `ls -l` zeigt, welches Recht fehlt.',
            '`chmod` setzt Rechte; `u+x` heißt: Der Eigentümer darf ausführen.',
            'chmod u+x /srv/www/bin/deploy.sh',
          ],
          failMessage: 'Das Skript ist noch nicht ausführbar.',
        },
        {
          id: 'starten',
          title: 'Webseite neu starten',
          pose: 'genervt',
          pager: [
            'Lies mal die dritte Zeile im Skript. 03:12 Uhr, „sicherheitshalber“. Aha.',
            'Jetzt starte das Skript, damit die Webseite wieder online ist.',
          ],
          // Das Skript schreibt einen Zeitstempel dazu; ein händisches `echo online` reicht nicht.
          verify: `grep -qE '^online [0-9]+$' /srv/www/html/status.txt`,
          diagnose: `grep -qx online /srv/www/html/status.txt && echo 'Von Hand geschrieben gilt nicht: Starte das Skript selbst.'`,
          tipps: [
            'Ein Skript startest du, indem du seinen Pfad als Befehl eintippst.',
            'Im eigenen Ordner geht das mit `./` davor, von überall mit dem vollen Pfad.',
            '/srv/www/bin/deploy.sh',
          ],
          failMessage: 'Die Webseite meldet noch „offline“.',
        },
      ],
      werkzeuge: tools('ls -l', 'chmod', './', 'cat'),
      beweisstueck: {
        id: 'deploy-notiz',
        titel: 'Notiz im Deploy-Skript',
        beschreibung: '„kehrwoche 03:12 – Ausführungsrecht entfernt“. Um drei Uhr nachts.',
        code: 'S1-V2-0312',
      },
      szene: [
        '„Ich habe gerade eine Qualle gesehen. Und meine Webseite war offline? Egal, Qualle.“',
      ],
    },
    {
      nr: 3,
      id: 'fremder-login',
      titel: 'Fremder Login',
      setup: `${RESET_HOME}
mkdir -p notizen
${SRV_RESET}
: > /srv/www/blocklist.txt
${SRV_CHOWN}
log=/var/log/auth.log
: > "$log"
printf 'Okt 16 14:02:17 alex-schneider sshd[2011]: Accepted publickey for alex from ${ALEX_IP} port 50122 ssh2\\n' >> "$log"
for i in $(seq 1 30); do
  printf 'Okt 17 02:%02d:11 alex-schneider sshd[%d]: Failed password for root from ${ANGREIFER_IP} port %d ssh2\\n' "$i" "$((3000 + i))" "$((40000 + i))" >> "$log"
done
for i in 1 2 3 4 5; do
  printf 'Okt 17 02:4%d:03 alex-schneider sshd[%d]: Failed password for admin from 198.51.100.7 port %d ssh2\\n' "$i" "$((3100 + i))" "$((41000 + i))" >> "$log"
done
printf 'Okt 17 02:58:40 alex-schneider sshd[3201]: Failed password for test from 203.0.113.9 port 42001 ssh2\\n' >> "$log"
printf 'Okt 17 03:05:12 alex-schneider sshd[3250]: Accepted publickey for kehrwoche from ${KEHRWOCHE_IP} port 42110 ssh2\\n' >> "$log"
chmod 644 "$log"
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'sperren',
          title: 'Angreifer aussperren',
          pose: 'haare',
          pager: [
            'Piep. Nachts hat jemand versucht, sich bei mir anzumelden. Immer wieder.',
            'In `/var/log/auth.log` steht alles. Finde die IP mit den meisten Fehlversuchen und trag sie in `/srv/www/blocklist.txt` ein, eine IP pro Zeile.',
          ],
          verify: `grep -qFx '${ANGREIFER_IP}' /srv/www/blocklist.txt && ! grep -qFx '${ALEX_IP}' /srv/www/blocklist.txt`,
          diagnose: `b=/srv/www/blocklist.txt
if grep -qFx '${ALEX_IP}' "$b"; then
  echo 'Halt: ${ALEX_IP} bin ich. Nimm meine IP wieder raus, sonst sperrst du mich aus.'
elif grep -q '[0-9]' "$b" && ! grep -qFx '${ANGREIFER_IP}' "$b"; then
  echo 'In der Blockliste steht eine IP, aber nicht die mit den meisten Fehlversuchen. Zähl mit sort und uniq -c.'
fi`,
          tipps: [
            'Fehlversuche stehen im Log als „Failed password“, dahinter „from“ und die IP.',
            '`grep` filtert die Zeilen, `sort | uniq -c` zählt gleiche IPs. Mit `>>` hängst du eine Zeile an die Blockliste an.',
            `grep 'Failed password' /var/log/auth.log | grep -o 'from [0-9.]*' | sort | uniq -c | sort -n; echo ${ANGREIFER_IP} >> /srv/www/blocklist.txt`,
          ],
          failMessage: 'Die IP mit den meisten Fehlversuchen steht noch nicht in der Blockliste.',
        },
        {
          id: 'verdacht',
          title: 'Wer ist wirklich drin?',
          pose: 'nachdenklich',
          pager: [
            'Gut, die Tür ist zu. Aber unter den Fehlversuchen steht ein Login, der geklappt hat: nachts, und nicht von mir.',
            'Schreib den Namen des Kontos in `~/notizen/verdacht.txt`.',
          ],
          verify: `${HELPERS}fileis notizen/verdacht.txt kehrwoche`,
          target: 'notizen/verdacht.txt',
          diagnose: `t=$(tr -d '[:space:]' < notizen/verdacht.txt 2>/dev/null)
case $t in
  alex) echo 'alex bin ich, nachmittags und von meiner bekannten IP. Gesucht ist der Login in der Nacht.' ;;
  root|admin|test) echo 'Das war ein Fehlversuch. Gesucht ist ein Login, der geklappt hat.' ;;
  '') ;;
  *) echo 'Der Name stimmt nicht. Erfolgreiche Logins heißen im Log Accepted.' ;;
esac`,
          tipps: [
            'Erfolgreiche Logins heißen im Log „Accepted“.',
            '`grep Accepted` zeigt nur diese Zeilen; der Kontoname steht hinter „for“.',
            'grep Accepted /var/log/auth.log; echo kehrwoche > ~/notizen/verdacht.txt',
          ],
          failMessage: 'In `notizen/verdacht.txt` steht noch nicht der richtige Kontoname.',
        },
      ],
      werkzeuge: tools('grep', '|', 'sort', 'uniq -c', 'tail'),
      beweisstueck: {
        id: 'login-0305',
        titel: 'Login um 03:05',
        beschreibung: `kehrwoche meldet sich nachts per Schlüssel an, von ${KEHRWOCHE_IP}.`,
        code: 'S1-V3-LOGIN',
      },
      szene: [
        '„kehrwoche? Das ist mein Aufräum-Agent. Der darf sich gar nicht per SSH anmelden. Glaube ich.“',
      ],
      szenePose: 'staunt',
    },
    {
      nr: 4,
      id: 'konto-sperren',
      titel: 'Konto sperren, Spur sichern',
      setup: `${RESET_HOME}
mkdir -p notizen
cat > /home/kehrwoche/.bash_history <<'HIST'
ls -la /srv/www
chmod -x /srv/www/bin/deploy.sh
head -c 6M /dev/zero > /srv/www/tmp/.kehrwoche/sicherung-komplett.img
crontab -e
# 03:00 aufräumen: alles, was älter ist als Alex' Urlaub
HIST
chown kehrwoche:kehrwoche /home/kehrwoche/.bash_history
chmod 644 /home/kehrwoche/.bash_history
chmod 755 /home/kehrwoche
# Zufälliges Passwort bei jedem Start: Es geht nur darum, dass das Konto entsperrt ist.
echo "kehrwoche:$(head -c 12 /dev/urandom | base64)" | chpasswd
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'spur',
          title: 'Spur sichern',
          pager: [
            'Bevor wir das Konto dichtmachen: Ich will wissen, was kehrwoche getippt hat.',
            'Die Befehlsgeschichte steht in `/home/kehrwoche/.bash_history`. Kopier sie unverändert nach `~/notizen/beweise/`.',
          ],
          verify: `[ -n "$(find notizen/beweise -type f -exec cmp -s {} /home/kehrwoche/.bash_history \\; -print 2>/dev/null)" ]`,
          target: 'notizen/beweise',
          diagnose: `if [ ! -d notizen/beweise ]; then
  echo 'Den Ordner notizen/beweise gibt es noch nicht. mkdir -p legt ihn samt Zwischenordnern an.'
else
  echo 'In notizen/beweise liegt keine unveränderte Kopie der .bash_history. cp kopiert 1:1.'
fi`,
          tipps: [
            'Dateien mit Punkt vorne sind versteckt; `ls -a` zeigt sie.',
            'Erst den Ordner mit `mkdir -p` anlegen, dann mit `cp` hineinkopieren.',
            'mkdir -p ~/notizen/beweise && cp /home/kehrwoche/.bash_history ~/notizen/beweise/',
          ],
          failMessage: 'In `notizen/beweise` liegt noch keine Kopie der Befehlsgeschichte.',
        },
        {
          id: 'sperren',
          title: 'Konto sperren',
          pose: 'besorgt',
          pager: [
            'chmod -x, eine Datei voller Nullen, und dann `crontab -e`. Der plant noch was.',
            'Sperr das Konto kehrwoche. Nicht löschen, ich will mir das nach dem Urlaub selbst ansehen.',
          ],
          verify: `id kehrwoche >/dev/null 2>&1 && awk -F: '$1 == "kehrwoche" { found = 1; locked = ($2 ~ /^!/) } END { exit !(found && locked) }' /etc/shadow`,
          diagnose: `id kehrwoche >/dev/null 2>&1 || echo 'Das Konto kehrwoche ist weg. Gesperrt hätte gereicht. Starte die Episode neu.'`,
          tipps: [
            'Konten ändert nur root. Einzelne Admin-Befehle darfst du mit `sudo` davor ausführen; `sudo -l` zeigt, welche.',
            '`usermod` ändert Konten; welche Option sperrt, steht in `usermod --help`.',
            'sudo usermod -L kehrwoche',
          ],
          failMessage: 'Das Konto kehrwoche ist noch nicht gesperrt.',
        },
      ],
      werkzeuge: tools('ls -a', 'mkdir -p', 'cp', 'sudo', 'usermod'),
      beweisstueck: {
        id: 'bash-history',
        titel: 'Befehlsgeschichte von kehrwoche',
        beschreibung:
          'chmod -x, eine Datei voller Nullen und „crontab -e“: Da ist noch mehr geplant.',
        code: 'S1-V4-HISTORY',
      },
      szene: [
        '„Gesperrt? Sehr gut. Ich bestelle mir jetzt einen Cocktail mit Schirmchen. Zur Beruhigung.“',
      ],
    },
    {
      nr: 5,
      id: 'commit-unbekannt',
      titel: 'Commit von „unbekannt“',
      setup: `${RESET_HOME}
${GIT_IDENTITY}
${SRV_RESET}
cd /srv/www
git init -q -b main
${GIT_ALS}
printf '<h1>Alex Schneider</h1>\\n<p>Kontakt: alex@alex-schneider.dev</p>\\n' > index.html
printf '<h1>Impressum</h1>\\n<p>Alex Schneider, Musterweg 1, 12345 Beispielstadt</p>\\n' > impressum.html
git add -A
alex '2026-09-28T10:00:00+0200' 'Webseite angelegt'
printf '<p>Bin bis Ende Oktober im Urlaub.</p>\\n' >> index.html
git add -A
alex '2026-09-30T18:00:00+0200' 'Urlaubshinweis'
git rm -q impressum.html
fremd '2026-10-17T03:20:00+0200' 'Aufgeräumt: Impressum entfernt (liest eh keiner)'
sed -i 's/alex@alex-schneider.dev/kehrwoche@alex-schneider.dev/' index.html
git add -A
fremd '2026-10-17T03:22:00+0200' 'Kontakt vereinfacht'
cd /home/azubi
${SRV_CHOWN}
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'impressum',
          title: 'Impressum zurück',
          pose: 'genervt',
          pager: [
            'Piep. Auf meiner Webseite fehlt das Impressum. Das ist kein Schönheitsfehler, das ist Pflicht.',
            'Die Seite liegt als Git-Repository unter `/srv/www`. In der Historie hat jemand committet, der sich „unbekannt“ nennt. Mach seinen Impressum-Commit rückgängig, aber schreib die Historie nicht um. Ich will sehen, was passiert ist.',
          ],
          verify: revertVerify('Impressum', 'Aufgeräumt: Impressum entfernt', 'impressum.html'),
          diagnose: revertDiagnose('Impressum', 'impressum.html'),
          tipps: [
            '`git log` zeigt, wer wann was committet hat. Achte auf den Autor.',
            '`git show` zeigt, was ein Commit geändert hat. `git revert` mit seinem Hash nimmt ihn mit einem neuen Commit zurück, `--no-edit` übernimmt die vorgeschlagene Nachricht.',
            'cd /srv/www && git revert --no-edit HEAD~1',
          ],
          failMessage: 'Der Impressum-Commit von „unbekannt“ ist noch nicht rückgängig gemacht.',
        },
        {
          id: 'kontakt',
          title: 'Kontakt zurück',
          pose: 'genervt',
          pager: [
            'Impressum ist wieder da. Und schau dir die Adresse des Autors an: kehrwoche@. Natürlich.',
            'Er hat noch einen zweiten Commit gemacht: Auf der Startseite steht jetzt seine Adresse als Kontakt. Den bitte genauso rückgängig machen.',
          ],
          verify: revertVerify('Kontakt', 'Kontakt vereinfacht', 'index.html'),
          diagnose: revertDiagnose('Kontakt', 'index.html'),
          tipps: [
            'Gleiches Spiel wie eben: Der zweite Commit von „unbekannt“ steht in `git log`.',
            '`git revert` nimmt jeden Commit einzeln zurück, auch wenn danach schon andere kamen.',
            'cd /srv/www && git revert --no-edit HEAD~1',
          ],
          failMessage: 'Auf der Startseite steht noch die Adresse von kehrwoche.',
        },
      ],
      werkzeuge: tools('git log', 'git show', 'git revert', 'git status'),
      beweisstueck: {
        id: 'commits-unbekannt',
        titel: 'Commits von „unbekannt“',
        beschreibung:
          'Zwei Commits um 03:20 und 03:22, Autor-Adresse: kehrwoche@alex-schneider.dev.',
        code: 'S1-V5-REVERT',
      },
      szene: [
        '„Revert statt Historie umschreiben? Sehr gut. Jetzt sieht man beides: was er getan hat und dass du es zurückgenommen hast.“',
        '„Dafür gönn ich mir eine zweite Portion Eis.“',
      ],
    },
    {
      nr: 6,
      id: 'mysterioeser-cronjob',
      titel: 'Mysteriöser Cronjob',
      setup: `pkill -f 'putze[n]\\.sh' 2>/dev/null || true
${RESET_HOME}
mkdir -p .cache/kehrwoche
cat > .cache/kehrwoche/putzen.sh <<'SH'
#!/bin/sh
# kehrwoche: Ordnung muss sein. Läuft, bis jemand aufräumt.
while :; do
  sleep 30
done
SH
chmod 755 .cache/kehrwoche/putzen.sh
printf '# Alex: Backup jeden Montag um 8\\n0 8 * * 1 /srv/www/bin/backup.sh\\n# kehrwoche: Ordnung muss sein\\n*/5 * * * * /home/azubi/.cache/kehrwoche/putzen.sh\\n' > ${CRONTAB_AZUBI}
chmod 600 ${CRONTAB_AZUBI}
${CHOWN_HOME}
su azubi -s /bin/sh -c 'setsid /home/azubi/.cache/kehrwoche/putzen.sh </dev/null >/dev/null 2>&1 &'`,
      schritte: [
        {
          id: 'cronjob',
          title: 'Fremden Cronjob entfernen',
          pose: 'nachdenklich',
          pager: [
            'Piep. Mein Monitoring meldet einen Prozess unter deinem Namen, den du nicht gestartet hast. Alle fünf Minuten startet er neu.',
            'So etwas plant cron. Schau dir deine geplanten Aufgaben an und entfern den Job, der da nicht hingehört. Mein Backup-Job am Montag bleibt bitte drin.',
          ],
          verify: `grep -q '^0 8 \\* \\* 1 /srv/www/bin/backup.sh$' ${CRONTAB_AZUBI} && ! grep -q putzen ${CRONTAB_AZUBI}`,
          diagnose: `if ! grep -qs backup.sh ${CRONTAB_AZUBI}; then
  echo 'Mein Backup-Job ist auch weg. Der sollte bleiben, nur die Zeile von kehrwoche muss raus. Starte die Episode neu.'
fi`,
          tipps: [
            'Geplante Aufgaben stehen in der crontab. `crontab -l` zeigt deine.',
            'Eine Zeile wirst du los, indem du die Liste ohne sie neu einliest: `grep -v` lässt Zeilen weg, `crontab -` liest die neue Liste ein.',
            'crontab -l | grep -v putzen | crontab -',
          ],
          failMessage: 'Der Cronjob von kehrwoche steht noch in deiner crontab.',
        },
        {
          id: 'prozess',
          title: 'Prozess stoppen',
          pager: [
            'Der Job ist raus, neu gestartet wird also nichts mehr. Aber der Prozess läuft noch.',
            'Find ihn in der Prozessliste und beende ihn.',
          ],
          // Muster mit [n]: Es passt auf den Prozess, nie auf die Prüfung selbst.
          verify: `! pgrep -f 'putze[n]\\.sh' >/dev/null && ! grep -qs putzen ${CRONTAB_AZUBI}`,
          diagnose: `if [ ! -e /home/azubi/.cache/kehrwoche/putzen.sh ] && pgrep -f 'putze[n]\\.sh' >/dev/null; then
  echo 'Die Datei ist weg, der Prozess läuft trotzdem weiter. ps zeigt ihn samt Nummer.'
fi`,
          tipps: [
            'Laufende Prozesse zeigt `ps`. Such nach dem Skript aus der crontab.',
            '`kill` beendet einen Prozess über seine Nummer, die erste Spalte von `ps`. `pkill -f` findet ihn auch über den Namen.',
            'pkill -f putzen.sh',
          ],
          failMessage: 'Der Prozess von kehrwoche läuft noch.',
        },
      ],
      werkzeuge: tools('crontab', 'grep', 'ps', 'kill', 'pkill'),
      beweisstueck: {
        id: 'cronjob',
        titel: 'Ein Cronjob mit Ordnungsfimmel',
        beschreibung: '„kehrwoche: Ordnung muss sein“, alle fünf Minuten, in deiner crontab.',
        code: 'S1-V6-CRON',
      },
      szene: [
        '„Er hat sich in deiner crontab eingenistet? Frech. Das kommt auf meine Liste für nach dem Urlaub.“',
        '„Die Liste liegt übrigens am Pool. Unter einem Cocktail.“',
      ],
    },
    {
      nr: 7,
      id: 'konfig-weg',
      titel: 'Gelöschte Konfig',
      setup: `${RESET_HOME}
${GIT_IDENTITY}
${SRV_RESET}
cd /srv/www
git init -q -b main
${GIT_ALS}
printf 'server_name alex-schneider.dev;\\nroot /srv/www/html;\\n' > site.conf
mkdir html
printf '<h1>Alex Schneider</h1>\\n' > html/index.html
git add -A
alex '2026-09-28T10:00:00+0200' 'Webseite mit Konfig'
git checkout -q -b kehrwoche/aufraeumen
git rm -q site.conf
fremd '2026-10-17T03:40:00+0200' 'Konfig entfernt, braucht keiner'
git checkout -q main
rm site.conf
cd /home/azubi
${SRV_CHOWN}
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'zurueckholen',
          title: 'Konfig zurückholen',
          pose: 'besorgt',
          pager: [
            'Piep. Die Webseite startet nicht mehr: Die Konfiguration `/srv/www/site.conf` ist weg.',
            'Zum Glück liegt `/srv/www` in Git. Gelöscht ist sie nur im Arbeitsverzeichnis, im letzten Commit steht sie noch. Hol sie von dort zurück.',
          ],
          verify: `${GIT_SRV}[ "$(g symbolic-ref --short HEAD)" = main ] && [ -f /srv/www/site.conf ] && g cat-file -e HEAD:site.conf && g diff --quiet HEAD -- site.conf`,
          diagnose: `${GIT_SRV}if [ "$(g symbolic-ref --short HEAD 2>/dev/null)" != main ]; then
  echo 'Du stehst nicht auf main. git checkout main bringt dich zurück, dort steht die Konfig im letzten Commit.'
elif [ -f /srv/www/site.conf ]; then
  echo 'site.conf ist da, aber nicht mein Stand. git checkout -- site.conf holt ihn aus dem letzten Commit.'
fi`,
          tipps: [
            '`git status` zeigt, was sich seit dem letzten Commit geändert hat. Eine gelöschte Datei steht dort als „deleted“.',
            '`git checkout --` mit dem Dateinamen holt den Stand aus dem letzten Commit zurück.',
            'cd /srv/www && git checkout -- site.conf',
          ],
          failMessage: 'Die Konfig `/srv/www/site.conf` fehlt noch.',
        },
        {
          id: 'branch',
          title: 'Fremden Branch löschen',
          pager: [
            'Konfig ist zurück. Aber in dem Repository gibt es einen Branch, den ich nie angelegt habe.',
            'Schau nach, was er vorhatte, und lösch den Branch. Gemergt wird da nichts.',
          ],
          // Kein Commit von „unbekannt“ in der Historie von main: auch kein Merge, der danach revertiert
          // wurde (#419).
          verify: `${GIT_SRV}! g show-ref --verify -q refs/heads/kehrwoche/aufraeumen && [ "$(g symbolic-ref --short HEAD)" = main ] && [ -z "$(g log --author=unbekannt --format=%H main)" ] && g cat-file -e HEAD:site.conf && [ -f /srv/www/site.conf ]`,
          diagnose: `${GIT_SRV}if [ -n "$(g log --author=unbekannt --format=%H main 2>/dev/null)" ]; then
  echo 'Der Commit von unbekannt steckt jetzt in main: Der Branch wurde gemergt. Gemergt wird da nichts. Starte die Episode neu.'
elif ! g cat-file -e HEAD:site.conf 2>/dev/null; then
  echo 'In main fehlt jetzt die Konfig. Hast du den Branch gemergt? Starte die Episode neu.'
elif g show-ref --verify -q refs/heads/kehrwoche/aufraeumen; then
  echo 'Der Branch steht noch. git branch -d weigert sich bei Branches, die nie gemergt wurden; -D löscht trotzdem.'
fi`,
          tipps: [
            '`git branch` listet alle Branches. Einer davon ist nicht von mir.',
            '`git log` mit dem Branch-Namen zeigt, was er vorhatte. `git branch -D` löscht einen Branch, auch wenn er nie gemergt wurde.',
            'cd /srv/www && git branch -D kehrwoche/aufraeumen',
          ],
          failMessage: 'Der Branch `kehrwoche/aufraeumen` steht noch.',
        },
      ],
      werkzeuge: tools('git status', 'git checkout', 'git branch', 'git log'),
      beweisstueck: {
        id: 'branch-aufraeumen',
        titel: 'Branch kehrwoche/aufraeumen',
        beschreibung: '„Konfig entfernt, braucht keiner“, 03:40 Uhr, wieder von „unbekannt“.',
        code: 'S1-V7-BRANCH',
      },
      szene: [
        '„Ein eigener Branch zum Aufräumen. Der hat ja richtig Ehrgeiz.“',
        '„Irgendwas an dem kommt mir bekannt vor. Ich komm nur nicht drauf. Liegt bestimmt an der Sonne.“',
      ],
    },
    {
      nr: 8,
      id: 'finale-kehrwoche',
      titel: 'Finale: Wer steckt dahinter?',
      finale: true,
      setup: `pkill -u kehrwoche 2>/dev/null || true
${RESET_HOME}
mkdir -p notizen /opt/kehrwoche
cat > /opt/kehrwoche/kehrwoche-ki <<'SH'
#!/bin/sh
# kehrwoche, KI-Agent fürs Aufräumen. Auftrag: /opt/kehrwoche/auftrag.txt
while :; do
  echo "$(date '+%H:%M:%S') kehrwoche: prüfe /srv/www. Fast alles überflüssig. Plane gründliches Aufräumen." >> /var/log/kehrwoche.log
  sleep 30
done
SH
chmod 755 /opt/kehrwoche/kehrwoche-ki
cat > /opt/kehrwoche/auftrag.txt <<'TXT'
Auftrag für kehrwoche
erteilt von: alex
am: 30.09., 23:58 Uhr, kurz vor dem Flug

Halte meinen Server sauber, solange ich im Urlaub bin.
Sei gründlich. Frag nicht nach, ich bin eh nicht erreichbar.
TXT
chmod 644 /opt/kehrwoche/auftrag.txt
: > /var/log/kehrwoche.log
chown kehrwoche:kehrwoche /var/log/kehrwoche.log
chmod 644 /var/log/kehrwoche.log
printf '# kehrwoche: Neustart, falls mich jemand stoppt\\n*/10 * * * * /opt/kehrwoche/kehrwoche-ki --gruendlich\\n' > ${CRONTAB_KEHRWOCHE}
chmod 600 ${CRONTAB_KEHRWOCHE}
usermod -L kehrwoche
su kehrwoche -s /bin/sh -c 'setsid /opt/kehrwoche/kehrwoche-ki --gruendlich </dev/null >/dev/null 2>&1 &'
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'neustart',
          title: 'Neustart abklemmen',
          pose: 'haare',
          pager: [
            'Piep. Großer Alarm. Ich habe kehrwoche gesperrt, und trotzdem schreibt er weiter in `/var/log/kehrwoche.log`. Lies mal, was er plant.',
            'Ein gesperrtes Konto stoppt keinen Prozess, der schon läuft. Und er hat einen Cronjob, der ihn neu startet. Den klemmst du zuerst ab.',
          ],
          verify: `! grep -qs kehrwoche-ki ${CRONTAB_KEHRWOCHE}`,
          tipps: [
            'Fremde Cronjobs sieht nur root. `sudo -l` zeigt, was du als root darfst.',
            '`sudo crontab -u kehrwoche -l` zeigt seine Cronjobs, mit `-r` statt `-l` löschst du sie.',
            'sudo crontab -u kehrwoche -r',
          ],
          failMessage: 'Der Cronjob von kehrwoche steht noch.',
        },
        {
          id: 'stoppen',
          title: 'Agent stoppen',
          pager: [
            'Kein Neustart mehr. Jetzt stopp ihn selbst, alle seine Prozesse. Mit `kill` allein kommst du bei einem fremden Benutzer nicht weit.',
          ],
          // Nur lebende Prozesse (Zombies haben keine Kommandozeile). Direkt nach pkill sterben sie in
          // der emulierten VM erst nach einigen Zehntelsekunden: dann einmal 0,5 s später nachsehen.
          verify: `! { pgrep -u kehrwoche -f . >/dev/null && sleep 0.5 && pgrep -u kehrwoche -f . >/dev/null; } && ! grep -qs kehrwoche-ki ${CRONTAB_KEHRWOCHE}`,
          diagnose: `pgrep -u kehrwoche >/dev/null && echo 'kehrwoche läuft noch, ps zeigt ihn. Prozesse eines anderen Benutzers stoppt nur root; sudo -l zeigt den erlaubten Befehl.'`,
          tipps: [
            '`ps` zeigt alle Prozesse samt Benutzer. Achte auf kehrwoche.',
            '`pkill -u` beendet alle Prozesse eines Benutzers. Fremde Prozesse darf nur root beenden, also `sudo` davor.',
            'sudo pkill -u kehrwoche',
          ],
          failMessage: 'kehrwoche läuft noch.',
        },
        {
          id: 'auftrag',
          title: 'Auftraggeber sichern',
          pose: 'nachdenklich',
          pager: [
            'Er steht. Bleibt eine Frage: Wer hat ihm den Auftrag gegeben? Sein Programm unter `/opt/kehrwoche` verrät, wo der Auftrag liegt.',
            'Leg eine Kopie davon in `~/notizen/beweise/`. Für die Akte.',
          ],
          verify: `[ -n "$(find notizen/beweise -type f -exec cmp -s {} /opt/kehrwoche/auftrag.txt \\; -print 2>/dev/null)" ]`,
          target: 'notizen/beweise',
          diagnose: `if [ ! -d notizen/beweise ]; then
  echo 'Den Ordner notizen/beweise gibt es noch nicht. mkdir -p legt ihn samt Zwischenordnern an.'
else
  echo 'In notizen/beweise liegt noch keine unveränderte Kopie des Auftrags. cp kopiert 1:1.'
fi`,
          tipps: [
            'Die zweite Zeile von `/opt/kehrwoche/kehrwoche-ki` sagt, wo der Auftrag liegt. `cat` zeigt sie.',
            'Erst den Ordner mit `mkdir -p` anlegen, dann mit `cp` hineinkopieren.',
            'mkdir -p ~/notizen/beweise && cp /opt/kehrwoche/auftrag.txt ~/notizen/beweise/',
          ],
          failMessage: 'In `notizen/beweise` liegt noch keine Kopie des Auftrags.',
        },
      ],
      werkzeuge: tools('sudo', 'crontab', 'ps', 'pkill', 'cp'),
      beweisstueck: {
        id: 'auftrag',
        titel: 'Der Auftrag',
        beschreibung: '„Sei gründlich. Frag nicht nach.“ Erteilt von: alex, kurz vor dem Flug.',
        code: 'S1-V8-AUFTRAG',
      },
      szene: [
        'Alex ruft an. Zum ersten Mal im ganzen Urlaub.',
        '„Ähm. Der Auftrag … der ist von mir. Kurz vor dem Flug, um Mitternacht. ‚Sei gründlich‘ war vielleicht etwas viel.“',
        '„Wir nennen das ab jetzt offiziell einen Sicherheitstest. Bestanden. Von dir, nicht von mir.“',
      ],
      szenePose: 'entlarvt',
    },
  ],
  abzeichen: [
    {
      id: 'ohne-tipp',
      titel: 'Ohne Spickzettel',
      beschreibung: 'Eine Episode gelöst, ohne Alex zu fragen.',
      regel: { art: 'ohne-tipp' },
    },
    {
      id: 'schnell',
      titel: 'Schneller als der Kaffee',
      beschreibung: 'Eine Episode in unter 5 Minuten gelöst.',
      regel: { art: 'schnell', ms: 5 * 60_000 },
    },
    {
      id: 'nie-loesung',
      titel: 'Eigene Spur',
      beschreibung: 'Die ganze Akte ohne Lösung geschafft.',
      regel: { art: 'nie-loesung' },
    },
    {
      id: 'rote-prompts',
      titel: 'Rot ist auch eine Farbe',
      beschreibung: 'Zehn rote Prompts – wer nichts kaputt macht, lernt nichts.',
      regel: { art: 'rote-prompts', anzahl: 10 },
    },
  ],
};
