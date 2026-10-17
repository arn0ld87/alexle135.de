---
title: 'Das Terminal 2026: atuin, zoxide, yazi, lazygit und uv im Alltag'
metaDescription: 'Sechs CLI-Werkzeuge aus meinem Terminal-Alltag: Was sie leisten, wie ich sie einrichte und welche Shell-Init-Zeilen du für den Einstieg brauchst.'
summary: 'Die Rust-Generation der CLI-Tools ist über bat und exa hinaus. Sechs Werkzeuge, die ich täglich nutze, mit den Shell-Init-Zeilen, die du wirklich brauchst, und ohne die übliche Listicle-Beliebigkeit.'
tags:
  - Linux
  - CLI
  - Terminal
  - Tooling
  - Produktivität
  - Rust
  - FISI
heroImage: ../../assets/blog/modernes-terminal-2026-cli-tools.webp
heroImageAlt: 'Modernes Terminal-Setup mit atuin, zoxide, yazi und lazygit'
publishedAt: 2026-05-30
draft: false
faq:
  - question: Muss ich meine gewohnten Befehle verlernen?
    answer: Nein. Die meisten dieser Tools legen sich neben die Klassiker oder dahinter. zoxide bringt `z` zusätzlich zu `cd`, atuin verbessert deine bestehende History, yazi startest du nur, wenn du ihn brauchst. Du kannst sie einzeln einführen.
  - question: Lohnt sich das auf einem Server, oder nur lokal?
    answer: Lokal auf jeden Fall. Auf Servern bin ich zurückhaltender, weil ich dort eine vorhersehbare, nackte Shell will. atuin und zoxide installiere ich auf meiner Arbeitsmaschine, auf Produktionsservern bleibt es bei Standard-Bash.
  - question: Warum so viele Tools in Rust?
    answer: Die meisten dieser Werkzeuge sind als einzelnes Binary ohne Laufzeitabhängigkeiten gebaut und schnell genug, dass sie sich im interaktiven Einsatz nicht bemerkbar machen. Das macht Installation und Verteilung einfach. Die Sprache ist Mittel zum Zweck, nicht der Grund, sie zu nutzen.
---

Listicles über CLI-Tools gibt es genug, und die meisten bleiben bei `bat`, `exa` und `fd` stehen. Das ist die Generation von 2021. Seitdem ist eine neue Welle dazugekommen, die im US-Raum auf Hacker News und in Terminal-Communities ständig auftaucht, hierzulande aber kaum konsolidiert beschrieben ist.

Ich liste hier nicht zwanzig Tools auf, die du eh nie installierst. Ich nehme die sechs, die ich täglich anfasse, und gebe dir die Shell-Zeilen, die wirklich nötig sind. Mein Setup läuft auf zsh, die bash-Varianten schreibe ich dazu.

## zoxide: cd, das sich deine Verzeichnisse merkt

zoxide ersetzt das ständige `cd ../../projekte/foo/bar`. Es merkt sich, wo du oft hingehst, und springt nach einem Teilstück des Namens dorthin. Nach ein paar Tagen tippst du nur noch `z bar`.

Nach der Installation über deinen Paketmanager oder Cargo hängst du die Init-Zeile in deine `~/.zshrc`:

```bash
eval "$(zoxide init zsh)"
```

Für bash dasselbe mit `bash` statt `zsh` in der `~/.bashrc`. Du bekommst zwei Befehle: `z <teil>` springt zum besten Treffer, `zi <teil>` öffnet eine interaktive Auswahl über fzf.

Wenn du mutig bist, lässt du zoxide direkt `cd` übernehmen:

```bash
eval "$(zoxide init zsh --cmd cd)"
```

Dann ist `cd` das schlaue Sprungkommando, und das normale Verhalten bleibt für absolute Pfade erhalten. Ich habe das seit Monaten so und vermisse nichts.

## atuin: deine Shell-History, aber brauchbar

Die normale Shell-History ist ein Textfile, das bei jeder Sitzung halb verloren geht. atuin ersetzt sie durch eine SQLite-Datenbank und gibt dir eine Volltextsuche über alles, was du je getippt hast, inklusive Kontext wie Verzeichnis und Exit-Code.

Installation über das offizielle Skript:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://setup.atuin.sh | sh
```

Dann deine bisherige History importieren:

```bash
atuin import auto
```

Und die Init-Zeile in die `~/.zshrc`:

```bash
eval "$(atuin init zsh)"
```

Ab jetzt öffnet die Pfeil-nach-oben-Taste die atuin-Suche statt der dummen letzten Zeile. Wenn dir das zu invasiv ist, hängst du `--disable-up-arrow` an die Init-Zeile, dann liegt die Suche nur auf `Ctrl+R`.

Ein Punkt, der oft falsch verstanden wird: Die Synchronisierung über mehrere Maschinen ist opt-in. Ohne explizites `atuin register` und `atuin sync` bleibt alles rein lokal in deiner Datenbank. Du teilst deine History mit niemandem, solange du es nicht selbst einrichtest.

## yazi: Dateimanager im Terminal, der wirklich schnell ist

yazi ist ein Dateimanager fürs Terminal, asynchron gebaut, mit Vorschau für Bilder und Code. Ich nutze ihn, wenn ich mich durch ein unbekanntes Verzeichnis wühle, weil das Springen und Vorschauen schneller geht als mit `ls` und `cat`.

Installation über Cargo, zwei Pakete:

```bash
cargo install --force yazi-build
```

Das Binary heißt `yazi`. Wenn du es einfach so startest, wechselst du nach dem Beenden aber nicht in das Verzeichnis, in dem du zuletzt warst. Dafür gibt es einen offiziellen Shell-Wrapper namens `y`, den du in deine `~/.zshrc` legst:

```bash
function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	command yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	[ "$cwd" != "$PWD" ] && [ -d "$cwd" ] && builtin cd -- "$cwd"
	command rm -f -- "$tmp"
}
```

Der Trick ist `--cwd-file`. yazi schreibt beim Beenden das aktuelle Verzeichnis in eine temporäre Datei, und der Wrapper springt dann dorthin. Du startest also `y` statt `yazi`, navigierst, drückst `q`, und deine Shell steht im richtigen Verzeichnis.

## lazygit: Git ohne Befehlsketten

Für die meisten Git-Operationen tippe ich noch Befehle. Aber für das Aufräumen vor einem Commit, das Stagen einzelner Zeilen oder das Durchsehen eines Diffs ist lazygit schneller. Es ist ein TUI, das dir den Repo-Zustand zeigt und Aktionen auf Tastendruck legt.

Installation über den Paketmanager, dann im Repo einfach:

```bash
lazygit
```

Links siehst du Dateien, Branches und Commits, rechts den Diff. `Space` staged, `c` committed, `P` pusht. Das Schöne ist, dass du einzelne Zeilen oder Hunks stagen kannst, ohne dir die `git add -p`-Syntax zu merken. Für FISI-Azubis ist das nebenbei ein guter Weg, Git-Konzepte sichtbar zu machen, statt sie blind zu tippen.

## uv: Python-Tooling, das nicht nervt

uv von Astral ersetzt `pip`, `venv`, `pyenv` und `pipx` durch ein einzelnes Binary, geschrieben in Rust und spürbar schnell. Wenn du regelmäßig mit Python arbeitest, ist das die größte Einzelverbesserung der letzten Jahre.

Installation:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Die Befehle, die ich am häufigsten brauche:

```bash
uv init mein-projekt      # neues Projekt mit Struktur
uv add requests           # Abhängigkeit hinzufügen
uv run skript.py          # im Projekt-Environment ausführen
uv python install 3.12    # Python-Version holen
```

Für CLI-Tools gibt es zwei Wege. `uvx ruff` führt ein Tool einmalig in einer Wegwerf-Umgebung aus, ideal zum Ausprobieren. `uv tool install ruff` installiert es dauerhaft global. Das ist der saubere Ersatz für pipx.

## Wie ich das einführe

Nicht alles auf einmal. Wenn du sechs neue Tools gleichzeitig in deine Shell kippst, kennst du am Ende keines richtig. Ich habe mit zoxide angefangen, weil der Gewinn sofort spürbar ist. Dann kam atuin dazu, später yazi. uv kam über ein Python-Projekt rein und ist geblieben.

Such dir eins aus, nimm die Init-Zeile von oben, leb eine Woche damit. Wenn es klebt, kommt das nächste. Wenn nicht, wirfst du eine Zeile aus der `~/.zshrc` und gut.
