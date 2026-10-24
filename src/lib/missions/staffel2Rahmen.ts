// Rahmen-Setup für Staffel 2 (KONZEPT §2, SPIKE M4/M5): läuft einmal nach dem Boot als root über
// den Agenten, vor dem Setup der Episode. Rein: erzeugt nur Text.
import { activeMarkerScript } from './missionBridge';

export const STAFFEL2_HOSTNAME = 'rw-srv01';

const HOSTNAME_MUSTER = /^[a-z][a-z0-9-]{0,30}$/;

/** Bash-Skript: Hostname, Belegordner, Missionsmarker, syslogd, dann frische Login-Shell. */
export function rahmenSetupSkript(hostname: string = STAFFEL2_HOSTNAME): string {
  if (!HOSTNAME_MUSTER.test(hostname)) throw new Error(`Ungültiger Hostname: ${hostname}`);
  return `hostname ${hostname}
printf '%s\\n' ${hostname} > /etc/hostname
sed -i 's/alex-schneider/${hostname}/g' /etc/hosts
install -d -o azubi -g azubi -m 755 /home/azubi/belege
mkdir -p /run/mission
${activeMarkerScript(true)}
pgrep -x syslogd >/dev/null || syslogd -O /var/log/messages
// BusyBox-pgrep prüft die Kommandozeile: -x bash träfe die Login-Shell "-bash" nicht.
for p in $(pgrep -u azubi bash); do kill -HUP "$p"; done
exit 0
`;
}
