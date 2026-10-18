// Missions-Engine: führt eine V86Mission über den Agenten in der VM aus und beantwortet den
// Befehl `mission` (status, hint, check, solve, flag, next) sowie die stille Prüfung nach
// jedem Prompt. Kein DOM, keine Uhr außer der injizierten: testbar mit einem Fake-Runner.
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

export type StepState = 'erledigt' | 'aktuell' | 'offen';

export interface MissionSnapshot {
  missionId: string;
  stepIndex: number;
  stepCount: number;
  hintLevel: number;
  withSolution: boolean;
  startedAt: number;
  finishedAt: number | null;
  flag: string | null;
  /** Status je Schritt für die Schrittliste der Seite. */
  stepStates: StepState[];
  /** Letzte Rückmeldung (Erfolg, Fast-Meldung, check) für die Seite. */
  feedback: string | null;
}

interface EngineOptions {
  store?: MissionStore;
  now?: () => number;
  onChange?: (snapshot: MissionSnapshot) => void;
  /** `mission next`: Die Seite startet die nächste Mission und liefert die Antwort. */
  onNext?: () => Promise<MissionReply>;
}

const HOME = '/home/azubi';
const SITE = 'https://alex-schneider.dev';
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
  private feedback: string | null = null;
  // Fingerabdruck des Artefakts bei der letzten Fast-Meldung; je Schritt zurückgesetzt.
  private reportedFingerprint: string | null = null;
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
      this.feedback = null;
      this.reportedFingerprint = await this.artefactFingerprint();
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
      stepStates: this.mission.steps.map((_, i) =>
        this.finished || i < this.stepIndex
          ? 'erledigt'
          : i === this.stepIndex
            ? 'aktuell'
            : 'offen'
      ),
      feedback: this.feedback,
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
      case 'next':
        return this.options.onNext
          ? this.options.onNext()
          : ok('`mission next` geht nur auf der Missionsseite.');
    }
  }

  private status(): string {
    if (this.finished) {
      return `${this.mission.title}: geschafft. Flagge: ${this.flag}`;
    }
    const { title, description, tools } = this.step;
    const lines = [`${this.mission.title} · ${this.stepLabel()}: ${title}`, description];
    if (tools?.length) {
      lines.push('', 'Werkzeugkasten:');
      for (const tool of tools) {
        lines.push(`  ${tool.befehl}  ${tool.erklaerung}`, `      Beispiel: ${tool.beispiel}`);
      }
    }
    return lines.join('\n');
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

  // `silent` = Prompt-Hook: Erfolg immer melden, Fehlschlag nur als Fast-Meldung (Artefakt
  // existiert und hat sich seit der letzten Meldung geändert).
  private async check(silent: boolean): Promise<MissionReply> {
    if (this.finished) return silent ? ok('') : ok(this.status());
    const result = await this.runner.run(`cd ${HOME}\n${this.step.verify}`, VERIFY_TIMEOUT_MS);
    if (result.exitCode !== 0) {
      const fingerprint = await this.artefactFingerprint();
      if (silent && (fingerprint === null || fingerprint === this.reportedFingerprint)) {
        return ok('');
      }
      // Auch `mission check` gilt als Meldung: Der Prompt-Hook danach wiederholt sie nicht.
      if (fingerprint !== null) this.reportedFingerprint = fingerprint;
      return this.report(notYet(await this.failText()));
    }

    const done = `${this.stepLabel()} erfüllt: ${this.step.title}`;
    if (this.stepIndex + 1 < this.mission.steps.length) {
      this.stepIndex += 1;
      this.hintLevel = 0;
      // Ausgangswert: Ein Artefakt, das beim Betreten schon da ist (etwa ein leerer Zielordner aus
      // dem vorigen Schritt), meldet sich erst, wenn es sich ändert.
      this.reportedFingerprint = await this.artefactFingerprint();
      return this.report(
        ok(`${done}\nWeiter mit ${this.stepLabel()}: ${this.step.title} (\`mission status\`)`)
      );
    }
    return this.finish(done);
  }

  /** Fingerabdruck des Artefakts oder `null`, wenn der Schritt keins hat oder es fehlt. */
  private async artefactFingerprint(): Promise<string | null> {
    const target = this.step?.target;
    if (!target) return null;
    const result = await this.runner
      .run(fingerprintScript(target), VERIFY_TIMEOUT_MS)
      .catch(() => ({ exitCode: 1, output: '' }));
    return result.exitCode === 0 ? result.output.trim() : null;
  }

  /** Diagnose vor failMessage vor dem allgemeinen Hinweis. */
  private async failText(): Promise<string> {
    const { diagnose, failMessage } = this.step;
    if (diagnose) {
      const result = await this.runner
        .run(`cd ${HOME}\n${diagnose}`, VERIFY_TIMEOUT_MS)
        .catch(() => ({ exitCode: 1, output: '' }));
      const text = result.output.trim();
      if (text) return text;
    }
    return failMessage ?? 'Noch nicht erfüllt. `mission hint` hilft weiter.';
  }

  private report(reply: MissionReply): MissionReply {
    this.feedback = reply.text;
    this.emit();
    return reply;
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
    const note = this.withSolution ? ' (mit Lösung)' : '';
    const lines = [
      done,
      '',
      `Mission ${this.mission.nr} geschafft · Flagge ${flag} · ${formatClock(durationMs)}${note} · weiter mit \`mission next\``,
    ];
    const link = this.mission.completionLink;
    if (link) lines.push(`${link.label}: ${SITE}${link.href}`);
    return this.report(ok(lines.join('\n')));
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

// Läuft als root über den Agenten; Marker `# artefakt` erkennt der Fake-Runner im Test.
// Inhalt statt Zeitstempel: Ein erneutes Schreiben mit gleichem Inhalt bleibt stumm.
function fingerprintScript(target: string): string {
  const quoted = `'${target.replace(/'/g, `'\\''`)}'`;
  return [
    '# artefakt',
    `cd ${HOME} && t=${quoted}`,
    '[ -e "$t" ] || exit 1',
    'if [ -d "$t" ]; then { find "$t" | sort; find "$t" -type f -exec md5sum {} + | sort; } | md5sum',
    'else md5sum < "$t"; fi',
  ].join('\n');
}

/** mm:ss für den Abschlussblock, z. B. `06:42`. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} min`;
}
