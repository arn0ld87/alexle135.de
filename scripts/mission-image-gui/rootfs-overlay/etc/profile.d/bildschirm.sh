# Programme aus dem Terminal öffnen ihr Fenster auf dem Bildschirm (sobald er läuft).
export DISPLAY=:0
# Laufzeitordner auf tmpfs: Unix-Sockets auf dem 9p-Root lassen pcmanfm abstürzen.
export XDG_RUNTIME_DIR=/tmp/xdg-$(id -u)
[ -d "$XDG_RUNTIME_DIR" ] || mkdir -m 0700 -p "$XDG_RUNTIME_DIR"
