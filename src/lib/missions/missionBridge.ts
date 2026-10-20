// Brücke zwischen dem Befehl `mission` in der VM und der Engine im Browser.
//
//   VM -> Browser   OSC 7771 über ttyS0:  ESC ] 7771 ; <anfrage-id> ; <befehl> BEL
//                   xterm fängt die Sequenz ab, sie erscheint nie im Terminal.
//   Browser -> VM   über den Agenten (ttyS1, Befehl REPLY) in die FIFO
//                   /run/mission/reply.<anfrage-id>: eine Zeile `<exitcode> <base64(text)>`,
//                   `mission` liest blockierend.
//   Die stille Prüfung (`__prompt`) wartet auf nichts: Ihre Rückmeldung schreibt die Seite
//   direkt ins Terminal (promptDelivery.ts).
//
// Gegenstück: scripts/mission-image/rootfs-overlay/usr/local/bin/mission
import { MISSION_COMMANDS, type MissionCommand } from './missionTypes';

export const MISSION_OSC = 7771;
export const MISSION_DIR = '/run/mission';

const REQUEST_ID = /^[A-Za-z0-9_-]{1,32}$/;

export type MissionRequest = { requestId: string; command: MissionCommand };

/** Nutzdaten der OSC-Sequenz (ohne Präfix `7771;`), z. B. `r123x4;hint`. */
export function parseMissionRequest(data: string): MissionRequest | null {
  const [requestId, command, ...rest] = data.split(';');
  if (rest.length > 0 || !REQUEST_ID.test(requestId ?? '')) return null;
  if (!(MISSION_COMMANDS as readonly string[]).includes(command ?? '')) return null;
  return { requestId, command: command as MissionCommand };
}

/** Markiert in der VM, ob eine Mission läuft; nur dann fragt der Prompt-Hook nach. */
export function activeMarkerScript(active: boolean): string {
  return active ? `touch ${MISSION_DIR}/active` : `rm -f ${MISSION_DIR}/active`;
}
