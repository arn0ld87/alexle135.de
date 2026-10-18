# Prompt in Markenfarben (#398): azubi orange (Truecolor, siehe PROMPT_ORANGE in terminalTheme.ts),
# @Host gedämpft, Pfad blau, `$` rot, wenn der letzte Befehl fehlschlug. __ps_rc setzt
# __mission_prompt aus $?, ohne Prozessstart.
__ps_rc=0
PS1='\[\e[1;38;2;232;96;58m\]\u\[\e[0;90m\]@\h\[\e[0m\]:\[\e[34m\]\w\[\e[0;${__ps_rc}m\]\$\[\e[0m\] '
# `mission` als Funktion statt Programm: kein Prozessstart je Aufruf (#392).
. /usr/local/lib/mission.sh
alias ls='ls --color=auto'
alias grep='grep --color=auto'
alias diff='diff --color=auto'
# Startet eine Mission neu (Liste, `mission next`), räumt ihr setup das Home auf. Steht die
# Shell dann in einem gelöschten oder ersetzten Verzeichnis, zurück nach Hause.
__mission_cwd() {
  [[ . -ef $PWD ]] && return 0
  cd ~ && echo 'Die Mission wurde neu aufgesetzt, du bist wieder in deinem Home (~).'
}
# Nach jedem Befehl still prüfen, ob der aktuelle Missionsschritt erfüllt ist (#392): nur die
# OSC-Sequenz an die Engine senden, mit eingebautem printf, ohne Prozessstart und ohne Warten.
# Die Rückmeldung schreibt die Seite später selbst ins Terminal.
__mission_prompt() {
  # Zuerst: $? gehört dem Befehl davor.
  if (($?)); then __ps_rc=31; else __ps_rc=0; fi
  if [[ -e /run/mission/active ]]; then
    # read -t 0: Wartet schon ein vorgetippter Befehl, startet Bash ihn sofort; Kennung q statt p,
    # damit die Seite ihre Rückmeldung bis zum nächsten Prompt zurückhält.
    local kind=p
    read -r -t 0 && kind=q
    printf '\033]7771;%s%s;__prompt\a' "$kind" "$RANDOM"
  fi
  __mission_cwd
}
PROMPT_COMMAND=__mission_prompt
# Kommt eine Rückmeldung, während du am Prompt tippst, leert die Seite die Zeile und sendet F12:
# Bash zeichnet Prompt und deine Eingabe dann neu (siehe promptDelivery.ts).
bind '"\e[24~": redraw-current-line' 2>/dev/null

# Linux unterscheidet Groß- und Kleinschreibung. Wer `MISSION STATUS` tippt, bekommt einen
# Hinweis, sofern es den Befehl kleingeschrieben gibt; sonst die übliche Meldung, Exit 127.
command_not_found_handle() {
  local lower=${1,,}
  if [[ $lower != "$1" ]] && type -P "$lower" >/dev/null 2>&1; then
    local args=("${@:2}")
    printf 'Linux unterscheidet Groß- und Kleinschreibung – meintest du `%s`?\n' \
      "${lower}${args[*]:+ ${args[*],,}}" >&2
  else
    printf 'bash: %s: command not found\n' "$1" >&2
  fi
  return 127
}
