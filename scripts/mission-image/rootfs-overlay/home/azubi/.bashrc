PS1='\u@\h:\w\$ '
alias ls='ls --color=auto'
alias grep='grep --color=auto'
# Nach jedem Befehl still prüfen, ob der aktuelle Missionsschritt erfüllt ist.
PROMPT_COMMAND='mission __prompt'

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
