// Request/Response-Schicht über agentProtocol: ordnet Antworten per ID den wartenden
// Aufrufen zu. Transportunabhängig: `send` schreibt eine Zeile in den Kanal (ttyS1),
// `feed` bekommt dessen Ausgabe.
import { createAgentParser, encodePing, encodeRun, type AgentMessage } from './agentProtocol';

export type AgentResult = { exitCode: number; output: string };

type Pending = {
  resolve: (result: AgentResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class AgentClient {
  private readonly parser = createAgentParser();
  private readonly pending = new Map<string, Pending>();
  private counter = 0;

  constructor(private readonly send: (line: string) => void) {}

  feed(chunk: string): void {
    for (const message of this.parser.push(chunk)) this.dispatch(message);
  }

  run(script: string, timeoutMs = 30_000): Promise<AgentResult> {
    const id = this.nextId();
    return this.request(id, encodeRun(id, script), timeoutMs);
  }

  // Der Agent läuft beim Kaltstart erst nach dem Boot und beim Savestate schon; PING
  // wiederholen, bis die erste Antwort da ist.
  async waitReady({ intervalMs = 500, attempts = 120 } = {}): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      const id = this.nextId();
      try {
        await this.request(id, encodePing(id), intervalMs);
        return;
      } catch {
        // keine Antwort in diesem Intervall
      }
    }
    throw new Error('Agent antwortet nicht');
  }

  private nextId(): string {
    this.counter += 1;
    return `m${this.counter}`;
  }

  private request(id: string, line: string, timeoutMs: number): Promise<AgentResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Agent-Timeout (${id})`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send(line);
    });
  }

  private dispatch(message: AgentMessage): void {
    if (message.type === 'hello' || message.id === null) return;
    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.type === 'result') {
      entry.resolve({ exitCode: message.exitCode, output: message.output });
    } else {
      entry.reject(new Error(`Agent-Fehler (${message.id}): ${message.reason}`));
    }
  }
}
