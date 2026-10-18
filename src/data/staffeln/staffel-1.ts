// Staffel 1 „Krimi auf Alex' Server“ (#395). Alex ist im Urlaub, jemand pfuscht am Server; jeder
// Vorfall legt eine Spur zum Konto `kehrwoche` (Alex' Aufräum-Agent). Vorfälle 0–4 (#400), 5–8
// folgen mit #401. Alles fiktiv, IPs nur aus Dokumentationsnetzen. Setup und verify laufen als
// root mit /home/azubi als Arbeitsverzeichnis. `${...}` in den Snippets sind nur die
// TypeScript-Konstanten unten, nie Shell-Variablen.
import { tools } from '../../lib/missions/glossar';
import type { Staffel } from '../../lib/missions/staffelTypes';
import { CHOWN_HOME, HELPERS, RESET_HOME } from '../missions/shared';
import { BEGRUESSUNG } from './begruessung';

/** /srv/www neu anlegen; gehört azubi, damit die Handgriffe ohne root gehen. */
const SRV_RESET = 'rm -rf /srv/www && mkdir -p /srv/www';
const SRV_CHOWN = 'chown -R azubi:azubi /srv/www';

const ALEX_IP = '192.0.2.10';
const ANGREIFER_IP = '203.0.113.66';
const KEHRWOCHE_IP = '198.51.100.23';

export const staffel1: Staffel = {
  id: 'staffel-1',
  titel: "Krimi auf Alex' Server",
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
          pager: [
            'Piep. Das Monitoring meldet: Unter /srv/www ist kaum noch Platz.',
            'Irgendwo liegt eine riesige Datei, die da nicht hingehört. Find sie und lösch sie. Die Webseite selbst bleibt bitte stehen.',
          ],
          verify: `[ ! -e /srv/www/tmp/.kehrwoche/sicherung-komplett.img ] && [ -f /srv/www/html/index.html ] && [ "$(ls /srv/www/html | wc -l)" -eq 4 ] && [ -f /srv/www/logs/access.log ]`,
          diagnose: `if [ ! -f /srv/www/html/index.html ] || [ "$(ls /srv/www/html 2>/dev/null | wc -l)" -ne 4 ]; then
  echo 'Zu viel gelöscht: Die Webseite unter /srv/www/html fehlt. Starte den Vorfall neu.'
elif [ -e /srv/www/tmp/.kehrwoche/sicherung-komplett.img ]; then
  echo 'Die große Datei ist noch da. du -sh zeigt Ordnergrößen, ls -a auch versteckte Ordner.'
fi`,
          tipps: [
            'Erst messen, dann löschen: Welcher Ordner unter /srv/www ist so groß? Achte auf versteckte Ordner.',
            '`du -sh` misst Ordner, `ls -la` zeigt auch versteckte und die Größe. Gelöscht wird mit `rm`.',
            'rm /srv/www/tmp/.kehrwoche/sicherung-komplett.img',
          ],
          failMessage: 'Die riesige Datei liegt noch unter /srv/www.',
        },
        {
          id: 'sitzungen',
          title: 'Alte Sitzungen wegräumen',
          pager: [
            'Platz ist wieder da. Schau mal, wem die Datei gehört hat: Das war nicht ich.',
            'Wenn du schon dabei bist: Unter /srv/www/tmp liegen alte Sitzungsdateien mit der Endung .tmp. Die können alle weg, der Ordner tmp bleibt.',
          ],
          verify: `[ -z "$(find /srv/www -name '*.tmp')" ] && [ -d /srv/www/tmp ] && [ -f /srv/www/html/index.html ]`,
          diagnose: `[ -d /srv/www/tmp ] || echo 'Der Ordner tmp selbst sollte stehen bleiben. Starte den Vorfall neu.'`,
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
printf 'online\\n' > status.txt
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
          verify: `[ -x /srv/www/bin/deploy.sh ] && [ -z "$(find /srv/www/bin/deploy.sh -perm -o+w)" ]`,
          diagnose: `f=/srv/www/bin/deploy.sh
if [ -n "$(find "$f" -perm -o+w 2>/dev/null)" ]; then
  echo 'Ausführbar ja, aber jetzt darf jeder das Skript ändern. Nimm nur das x dazu, zum Beispiel u+x.'
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
          pager: [
            'Lies mal die dritte Zeile im Skript. 03:12 Uhr, „sicherheitshalber“. Aha.',
            'Jetzt starte das Skript, damit die Webseite wieder online ist.',
          ],
          verify: 'grep -qx online /srv/www/html/status.txt',
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
          pager: [
            'Piep. Nachts hat jemand versucht, sich bei mir anzumelden. Immer wieder.',
            'In `/var/log/auth.log` steht alles. Finde die IP mit den meisten Fehlversuchen und trag sie in `/srv/www/blocklist.txt` ein, eine IP pro Zeile.',
          ],
          verify: `grep -qx '${ANGREIFER_IP}' /srv/www/blocklist.txt && ! grep -qx '${ALEX_IP}' /srv/www/blocklist.txt`,
          diagnose: `b=/srv/www/blocklist.txt
if grep -qx '${ALEX_IP}' "$b"; then
  echo 'Halt: ${ALEX_IP} bin ich. Nimm meine IP wieder raus, sonst sperrst du mich aus.'
elif grep -q '[0-9]' "$b" && ! grep -qx '${ANGREIFER_IP}' "$b"; then
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
    },
    {
      nr: 4,
      id: 'konto-sperren',
      titel: 'Benutzer sperren, Spur sichern',
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
          pager: [
            'chmod -x, eine Datei voller Nullen, und dann `crontab -e`. Der plant noch was.',
            'Sperr das Konto kehrwoche. Nicht löschen, ich will mir das nach dem Urlaub selbst ansehen.',
          ],
          verify: `id kehrwoche >/dev/null 2>&1 && awk -F: '$1 == "kehrwoche" { found = 1; locked = ($2 ~ /^!/) } END { exit !(found && locked) }' /etc/shadow`,
          diagnose: `id kehrwoche >/dev/null 2>&1 || echo 'Das Konto kehrwoche ist weg. Gesperrt hätte gereicht. Starte den Vorfall neu.'`,
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
  ],
  abzeichen: [
    {
      id: 'ohne-tipp',
      titel: 'Ohne Spickzettel',
      beschreibung: 'Einen Vorfall gelöst, ohne Alex zu fragen.',
      regel: { art: 'ohne-tipp' },
    },
    {
      id: 'schnell',
      titel: 'Schneller als der Kaffee',
      beschreibung: 'Einen Vorfall in unter 5 Minuten gelöst.',
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
