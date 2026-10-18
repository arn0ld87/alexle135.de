// Missions-Engine: führt eine V86Mission über den Agenten in der VM aus und beantwortet den
// Befehl `mission` (status, hint, check, solve, flag) sowie die stille Prüfung nach jedem
// Prompt. Kein DOM, keine Uhr außer der injizierten: testbar mit einem Fake-Runner.
import { activeMarkerScript } from './missionBridge';
import type { MissionStore } from './missionStore';
import {
  FLAG_PATTERN,
  type MissionCommand,
  type MissionReply,
  type V86Mission,
} from './missionTypes';

export interface MissionRunner {
  run(script: string, timeoutMs?: number): Promise<{ exitCode: number; output: string }>;
}

export interface MissionSnapshot {
  missionId: string;
  stepIndex: number;
  stepCount: number;
  hintLevel: number;
  withSolution: boolean;
  startedAt: number;
  finishedAt: number | null;
  flag: string | null;
}

interface EngineOptions {
  store?: MissionStore;
  now?: () => number;
  onChange?: (snapshot: MissionSnapshot) => void;
}

const HOME = '/home/azubi';
const VERIFY_TIMEOUT_MS = 10_000;
const SETUP_TIMEOUT_MS = 20_000;

const ok = (text: string): MissionReply => ({ exitCode: 0, text });
const notYet = (text: string): MissionReply => ({ exitCode: 1, text });

export class MissionEngine {
  private stepIndex = 0;
  private hintLevel = 0;
  private withSolution = false;
  private startedAt = 0;
  private finishedAt: number | null = null;
  private flag: string | null = null;
  // Prompt-Hook und `mission check` können sich überholen; alles läuft nacheinander.
  private queue: Promise<unknown> = Promise.resolve();
  private readonly now: () => number;

  constructor(
    readonly mission: V86Mission,
    private readonly runner: MissionRunner,
    private readonly options: EngineOptions = {}
  ) {
    this.now = options.now ?? Date.now;
  }

  /** Stellt den Ausgangszustand her und startet die Zeit. */
  start(): Promise<void> {
    return this.enqueue(async () => {
      const script = `set -e\ncd ${HOME}\n${this.mission.setup}\n${activeMarkerScript(true)}`;
      const result = await this.runner.run(script, SETUP_TIMEOUT_MS);
      if (result.exitCode !== 0) {
        throw new Error(`Setup von ${this.mission.id} fehlgeschlagen: ${result.output.trim()}`);
      }
      this.stepIndex = 0;
      this.hintLevel = 0;
      this.withSolution = false;
      this.finishedAt = null;
      this.flag = null;
      this.startedAt = this.now();
      this.emit();
    });
  }

  handle(command: MissionCommand): Promise<MissionReply> {
    return this.enqueue(() => this.dispatch(command));
  }

  snapshot(): MissionSnapshot {
    return {
      missionId: this.mission.id,
      stepIndex: this.stepIndex,
      stepCount: this.mission.steps.length,
      hintLevel: this.hintLevel,
      withSolution: this.withSolution,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      flag: this.flag,
    };
  }

  private get finished() {
    return this.finishedAt !== null;
  }

  private get step() {
    return this.mission.steps[this.stepIndex];
  }

  private stepLabel() {
    return `Schritt ${this.stepIndex + 1}/${this.mission.steps.length}`;
  }

  private async dispatch(command: MissionCommand): Promise<MissionReply> {
    switch (command) {
      case 'status':
        return ok(this.status());
      case 'hint':
        return this.hint();
      case 'check':
        return this.check(false);
      case '__prompt':
        return this.check(true);
      case 'solve':
        return this.solve();
      case 'flag':
        return this.finished
          ? ok(this.flag ?? '')
          : notYet(`Noch keine Flagge. ${this.stepLabel()} ist offen.`);
    }
  }

  private status(): string {
    if (this.finished) {
      return `${this.mission.title}: geschafft. Flagge: ${this.flag}`;
    }
    const { title, description } = this.step;
    return `${this.mission.title} · ${this.stepLabel()}: ${title}\n${description}`;
  }

  private hint(): MissionReply {
    if (this.finished) return ok('Mission geschafft, keine Tipps nötig.');
    const { hints } = this.step;
    if (this.hintLevel >= hints.length) {
      return ok('Keine weiteren Tipps. `mission solve` zeigt einen Lösungsweg.');
    }
    this.hintLevel += 1;
    this.emit();
    return ok(`Tipp ${this.hintLevel}/${hints.length}: ${hints[this.hintLevel - 1]}`);
  }

  private solve(): MissionReply {
    if (this.finished) return ok('Mission geschafft.');
    this.withSolution = true;
    this.emit();
    return ok(`Lösungsweg für ${this.stepLabel()}:\n  ${this.step.solution}`);
  }

  // `silent` = Prompt-Hook: Erfolg melden, Misserfolg nicht.
  private async check(silent: boolean): Promise<MissionReply> {
    if (this.finished) return silent ? ok('') : ok(this.status());
    const result = await this.runner.run(`cd ${HOME}\n${this.step.verify}`, VERIFY_TIMEOUT_MS);
    if (result.exitCode !== 0) {
      if (silent) return ok('');
      return notYet(this.step.failMessage ?? 'Noch nicht erfüllt. `mission hint` hilft weiter.');
    }

    const done = `${this.stepLabel()} erfüllt: ${this.step.title}`;
    if (this.stepIndex + 1 < this.mission.steps.length) {
      this.stepIndex += 1;
      this.hintLevel = 0;
      this.emit();
      return ok(`${done}\nWeiter mit ${this.stepLabel()}: ${this.step.title} (\`mission status\`)`);
    }
    return this.finish(done);
  }

  private async finish(done: string): Promise<MissionReply> {
    const result = await this.runner.run(`cd ${HOME}\n${this.mission.flag}`, VERIFY_TIMEOUT_MS);
    const flag = result.output.trim();
    if (result.exitCode !== 0 || !FLAG_PATTERN.test(flag)) {
      // Zielzustand passt nicht zur Flagge: Mission bleibt offen, statt eine falsche auszugeben.
      return notYet(
        `${done}\nDie Flagge ließ sich nicht erzeugen. Prüfe den Zustand mit \`mission check\`.`
      );
    }
    this.flag = flag;
    this.finishedAt = this.now();
    const durationMs = this.finishedAt - this.startedAt;
    this.options.store?.complete(this.mission.id, {
      flag,
      withSolution: this.withSolution,
      durationMs,
      finishedAt: this.finishedAt,
    });
    await this.runner.run(activeMarkerScript(false)).catch(() => {});
    this.emit();
    const note = this.withSolution ? ' (mit Lösung)' : '';
    return ok(
      `${done}\nMission geschafft in ${formatDuration(durationMs)}${note}. Flagge: ${flag}`
    );
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => {});
    return next;
  }

  private emit() {
    this.options.onChange?.(this.snapshot());
  }
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} min`;
}
