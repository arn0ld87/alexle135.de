import type { V86Mission } from '../../lib/missions/missionTypes';
import { RESET_HOME, CHOWN_HOME, HELPERS } from './shared';

export const linuxCtfPrivesc: V86Mission = {
  nr: '05',
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
