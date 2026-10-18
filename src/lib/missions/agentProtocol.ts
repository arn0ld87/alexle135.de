// Zeilenprotokoll des versteckten Befehlskanals zwischen Missions-Engine (Browser)
// und dem Agenten in der VM (scripts/mission-image/rootfs-overlay/usr/local/bin/mission-agent).
// Transport ist die zweite serielle Schnittstelle (ttyS1) und taucht nie im sichtbaren Terminal auf.
//
//   Host -> Gast   PING <id>
//                  RUN <id> <base64(skript)>
//   Gast -> Host   HELLO 1
//                  RES <id> <exitcode> <base64(stdout+stderr)|->
//                  ERR <id|-> <grund>
//
// Eine Nachricht je Zeile (\n). Base64 (RFC 4648, mit Padding) enthält weder Leerzeichen
// noch Zeilenumbrüche; `-` steht für leere Ausgabe. Zeilen, die nicht zum Protokoll
// passen (z. B. Echo, Rauschen vor dem Start des Agenten), ignoriert der Parser.

export const AGENT_PROTOCOL_VERSION = 1;

// Obergrenze für eine einzelne Zeile (Gast kürzt die Ausgabe auf 64 KiB, Base64 +33 %).
const MAX_LINE_LENGTH = 128 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export type AgentMessage =
  | { type: 'hello'; version: number }
  | { type: 'result'; id: string; exitCode: number; output: string }
  | { type: 'error'; id: string | null; reason: string };

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function decodeBase64(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function assertValidId(id: string): void {
  if (!isValidId(id)) throw new Error(`Ungültige Agent-ID: ${id}`);
}

export function encodePing(id: string): string {
  assertValidId(id);
  return `PING ${id}\n`;
}

export function encodeRun(id: string, script: string): string {
  assertValidId(id);
  return `RUN ${id} ${encodeBase64(script)}\n`;
}

function parseLine(line: string): AgentMessage | null {
  const parts = line.split(' ');
  const [kind] = parts;

  if (kind === 'HELLO' && parts.length === 2) {
    const version = Number(parts[1]);
    return Number.isInteger(version) ? { type: 'hello', version } : null;
  }

  if (kind === 'ERR' && parts.length === 3) {
    const [, id, reason] = parts;
    if (id !== '-' && !isValidId(id)) return null;
    return { type: 'error', id: id === '-' ? null : id, reason };
  }

  if (kind === 'RES' && parts.length === 4) {
    const [, id, code, payload] = parts;
    if (!isValidId(id) || !/^\d{1,3}$/.test(code)) return null;
    const exitCode = Number(code);
    if (payload === '-') return { type: 'result', id, exitCode, output: '' };
    if (payload.length % 4 !== 0 || !BASE64_PATTERN.test(payload)) {
      return { type: 'error', id, reason: 'bad-output' };
    }
    return { type: 'result', id, exitCode, output: decodeBase64(payload) };
  }

  return null;
}

// Zustandsbehafteter Zeilenpuffer: `push` nimmt beliebig zerstückelte Ausgabe des Kanals
// entgegen und liefert die dabei vollständig gewordenen Nachrichten. Arbeitet linear in
// der Chunk-Länge, damit auch Byte-für-Byte-Zufuhr langer Zeilen schnell bleibt.
export function createAgentParser(): { push(chunk: string): AgentMessage[] } {
  let buffer = '';

  return {
    push(chunk: string): AgentMessage[] {
      const messages: AgentMessage[] = [];
      let start = 0;
      for (let end = chunk.indexOf('\n'); end !== -1; end = chunk.indexOf('\n', start)) {
        const raw = buffer + chunk.slice(start, end);
        buffer = '';
        start = end + 1;
        const message = parseLine(raw.endsWith('\r') ? raw.slice(0, -1) : raw);
        if (message) messages.push(message);
      }
      buffer += chunk.slice(start);
      if (buffer.length > MAX_LINE_LENGTH) buffer = '';
      return messages;
    },
  };
}
