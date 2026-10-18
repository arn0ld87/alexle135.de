import type { V86Mission } from '../../lib/missions/missionTypes';
import { RESET_HOME, CHOWN_HOME, HELPERS, GIT_IDENTITY, GIT_COMMIT_HELPER } from './shared';

export const gitBranching: V86Mission = {
  nr: '07',
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
