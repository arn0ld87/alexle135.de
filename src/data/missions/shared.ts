// Gemeinsame Bausteine der Missionsdaten. Setup, verify und flag laufen als root per bash in
// der Alpine-VM (ohne Netzwerk, Arbeitsverzeichnis /home/azubi). Geprüft wird der Zustand, nie
// der getippte Befehl; verify ändert nichts.
// Hinweis für Shell-Snippets: In Template-Literalen kein `${...}` verwenden, das würde von
// TypeScript interpoliert.

/** Räumt das Home-Verzeichnis, lässt aber die Shell-Konfiguration stehen (idempotent). */
export const RESET_HOME =
  "find /home/azubi -mindepth 1 -maxdepth 1 ! -name '.bashrc' ! -name '.bash_profile' ! -name '.bash_history' -exec rm -rf {} +";

/** Übergibt das Home-Verzeichnis an den Azubi. */
export const CHOWN_HOME = 'chown -R azubi:azubi /home/azubi';

/**
 * Hilfsfunktionen für verify-Skripte. `fileis DATEI WERT`: Datei existiert und ihr Inhalt ist
 * WERT, Leerzeichen und Zeilenenden egal. `pathis DATEI PFAD`: erste Zeile der Datei ist ein
 * Pfad (relativ zum Home oder absolut), der auf dasselbe Ziel zeigt wie PFAD.
 */
export const HELPERS = `fileis() { [ -f "$1" ] && [ "$(tr -d '[:space:]' < "$1")" = "$(printf %s "$2" | tr -d '[:space:]')" ]; }
pathis() { [ -f "$1" ] || return 1; p=$(head -n1 "$1" | tr -d '\\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'); [ -n "$p" ] && [ "$(realpath -e "$p" 2>/dev/null)" = "$(realpath -e "$2")" ]; }
`;

/** Git-Identität und Editor für den Azubi; die globale Config enthält beides nicht. */
export const GIT_IDENTITY = `printf '[user]\\n\\tname = Azubi\\n\\temail = azubi@alex-schneider.dev\\n[core]\\n\\teditor = nano\\n' > /home/azubi/.gitconfig`;

/** Commit im Setup mit festem Autor und festem Datum: `gitc DATUM MELDUNG` (im Repo-Verzeichnis). */
export const GIT_COMMIT_HELPER = `gitc() { GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git -c user.name='Anna Beispiel' -c user.email='anna@example.org' commit -q -m "$2"; }
gitadd() { git -c user.name='Anna Beispiel' -c user.email='anna@example.org' add "$@"; }
`;
