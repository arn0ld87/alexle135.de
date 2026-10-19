# shellcheck shell=bash
# Befehl `mission` als Shell-Funktion (#392). Die .bashrc des Azubis lädt sie, das Skript
# /usr/local/bin/mission ruft sie für nicht-interaktive Aufrufe auf. In v86 kostet jeder
# Prozessstart spürbar Zeit, deshalb kommt der Weg ohne einen einzigen aus: OSC-Sequenz an
# die Engine im Browser (xterm zeigt sie nicht an), Antwort als eine Zeile
# `<anfrage-id> <exitcode> <text>` aus einer FIFO je Shell, die offen bleibt. Zeilenumbrüche
# im Text überträgt die Engine als \x1e. Protokoll: siehe src/lib/missions/missionBridge.ts

__mission_usage() {
  printf '%s\n' \
    'mission status   aktueller Schritt und Aufgabe' \
    'mission hint     nächster Tipp (gestuft)' \
    'mission check    Zustand jetzt prüfen' \
    'mission solve    Lösungsweg zeigen (Flagge gilt dann als „mit Lösung“)' \
    'mission flag     Flagge anzeigen, sobald die Mission geschafft ist' \
    'mission next     nächste Mission starten' \
    '' \
    'erklaer <befehl> erklärt einen Befehl, z. B. erklaer ls'
}

__mission_n=0
__mission_fd=
__mission_pid=

# FIFO je Prozess, lesend und schreibend offen: Das Öffnen blockiert nie, und Antworten
# bleiben im Puffer, bis dieser Prozess sie liest. $BASHPID statt $$: In Subshells wie
# $(mission status) bleibt $$ gleich, die Kennung muss aber eindeutig sein.
# Die Shell des Azubis legt sie schon beim ersten Prompt an (.bashrc), also vor dem Savestate:
# Sonst lädt das erste `mission` erst mkfifo über 9p nach, bis zu drei Sekunden (#421).
__mission_bereit() {
  local pid=$BASHPID
  local fifo=/run/mission/reply.r$pid
  if [[ $__mission_pid != "$pid" || ! -p $fifo ]]; then
    [[ -p $fifo ]] || mkfifo -m 600 "$fifo" || return 3
    exec {__mission_fd}<>"$fifo"
    # Eine Subshell räumt ihre FIFO beim Beenden selbst weg.
    [[ $pid == "$$" ]] || trap 'rm -f "/run/mission/reply.r$BASHPID"' EXIT
    __mission_pid=$pid
  fi
}

mission() {
  local cmd=${1:-status} wait_s=15 answer
  case $cmd in
    status | hint | check | flag) ;;
    # next startet die nächste Mission samt setup, das dauert länger.
    next) wait_s=70 ;;
    solve)
      read -r -p 'Lösung anzeigen? Die Flagge wird dann als „mit Lösung“ markiert. [j/N] ' answer
      [[ $answer == [jJ]* ]] || return 0
      ;;
    -h | --help | help)
      __mission_usage
      return 0
      ;;
    *)
      __mission_usage >&2
      return 2
      ;;
  esac

  __mission_bereit || return 3
  local pid=$BASHPID

  __mission_n=$((__mission_n + 1))
  local id="r${pid}x$__mission_n" rid rc text
  printf '\033]7771;%s;%s\a' "$id" "$cmd" >/dev/tty

  while read -r -t "$wait_s" -u "$__mission_fd" rid rc text; do
    # Spät eingetroffene Antworten früherer, abgebrochener Aufrufe überspringen.
    [[ $rid == "$id" ]] || continue
    [[ -n $text ]] && printf '%s\n' "${text//$'\x1e'/$'\n'}"
    return "${rc:-0}"
  done
  echo 'mission: keine Antwort. Läuft gerade eine Mission?' >&2
  return 3
}
