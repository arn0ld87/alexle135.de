import type { V86Mission } from '../../lib/missions/missionTypes';
import { RESET_HOME, CHOWN_HOME, HELPERS, GIT_IDENTITY, GIT_COMMIT_HELPER } from './shared';

export const gitCtfRewind: V86Mission = {
  nr: '08',
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
