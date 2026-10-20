// Request/Response-Schicht über agentProtocol: ordnet Antworten per ID den wartenden
// Aufrufen zu. Transportunabhängig: `send` schreibt eine Zeile in den Kanal (ttyS1),
// `feed` bekommt dessen Ausgabe.
import {
  createAgentParser,
  encodePing,
  encodeReply,
  encodeRun,
  type AgentMessage,
} from './agentProtocol';

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
    // Der Gast bricht eine Sekunde früher ab, als wir warten: Ein hängender Lauf blockiert den
    // Agenten nie länger, als die Antwort noch jemanden interessiert.
    const guestSeconds = Math.max(1, Math.floor(timeoutMs / 1000) - 1);
    return this.request(id, encodeRun(id, script, guestSeconds), timeoutMs);
  }

  /** Antwort an `mission` in der VM (FIFO), ohne Prozessstart im Agenten. */
  reply(requestId: string, reply: { exitCode: number; text: string }, timeoutMs = 5_000) {
    const id = this.nextId();
    return this.request(id, encodeReply(id, requestId, reply), timeoutMs);
  }

  // Der Agent läuft beim Kaltstart erst nach dem Boot und beim Savestate schon; PING
  // wiederholen, bis die erste Antwort da ist. Jeder PING bleibt bis zum Ende offen: Unter Last
  // (mehrere Tabs, gedrosselte CPU) antwortet der Gast, braucht aber länger als `intervalMs`.
  // Würde jeder PING nach einem Intervall verworfen, käme keine Antwort je rechtzeitig und
  // waitReady gäbe auf, obwohl der Agent läuft (gemessen: 6-fach gedrosselt 1,4 bis 1,8 s je PING).
  async waitReady({ intervalMs = 500, attempts = 120 } = {}): Promise<void> {
    const offen: string[] = [];
    let antwort!: () => void;
    const erstes = new Promise<true>((resolve) => (antwort = () => resolve(true)));
    let takt: ReturnType<typeof setTimeout> | undefined;
    try {
      for (let i = 0; i < attempts; i++) {
        const id = this.nextId();
        offen.push(id);
        // Eine Zeitüberschreitung oder ein ERR zu einem einzelnen PING entscheidet nichts.
        this.request(id, encodePing(id), intervalMs * attempts).then(antwort, () => {});
        const bereit = await Promise.race([
          erstes,
          new Promise<false>((resolve) => {
            takt = setTimeout(() => resolve(false), intervalMs);
          }),
        ]);
        if (bereit) return;
      }
    } finally {
      clearTimeout(takt);
      for (const id of offen) this.forget(id);
    }
    throw new Error('Linux antwortet nicht');
  }

  private forget(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
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
