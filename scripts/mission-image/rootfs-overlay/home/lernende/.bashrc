PS1='\u@missionen:\w\$ '
alias ls='ls --color=auto'
alias grep='grep --color=auto'
# Nach jedem Befehl still prüfen, ob der aktuelle Missionsschritt erfüllt ist.
PROMPT_COMMAND='mission __prompt'
