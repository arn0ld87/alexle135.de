// Engine der Windows-Missionen (Simulation): prüft nach jedem Befehl den Zustand des
// Mock-Systems, beantwortet den Befehl `mission` und misst die Zeit. Rein und synchron:
// kein DOM, keine Uhr außer der injizierten. Das Gegenstück zu missionEngine.ts, nur ohne
// VM; `verify` liest direkt aus dem MockWindowsSystem.
import type { MockWindowsSystem } from '../../components/interactive/MockWindowsSystem';
import { formatDuration, type MissionSnapshot } from './missionEngine';
import type { MissionStore } from './missionStore';
import type { MissionDifficulty } from './missionTypes';

export interface WindowsStep {
  id: string;
  title: string;
  description: string;
  /** Zustandsprüfung gegen das Mock-System; darf den Zustand nicht ändern. */
  verify: (sys: MockWindowsSystem) => boolean;
  /** Gestufte Tipps, vom Groben zum Genauen; keiner verrät den kompletten Befehl. */
  hints: string[];
  /** Ein möglicher Lösungsweg, nur über `mission solve` (mit Rückfrage). */
  solution: string;
  /** Knappe Rückmeldung bei `mission check`, wenn der Zustand noch nicht stimmt. */
  failMessage?: string;
}

export interface WindowsMission {
  id: string;
  title: string;
  description: string;
  difficulty: MissionDifficulty;
  /** Geschätzte Dauer in Minuten. */
  durationMin: number;
  steps: WindowsStep[];
  /** Tatsachen des Zielzustands als Text; daraus entsteht die Flagge (siehe deriveFlag). */
  flagSeed: (sys: MockWindowsSystem) => string;
}

interface EngineOptions {
  store?: MissionStore;
  now?: () => number;
  onChange?: (snapshot: MissionSnapshot) => void;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Flagge aus Mission und Zielzustand: gleicher Zustand, gleiche Flagge. */
export function deriveFlag(missionId: string, seed: string): string {
  return `FLAG{${missionId}-${fnv1a(`${missionId}|${seed}`)}}`;
}

const USAGE = 'Verwendung: mission status | hint | check | solve | flag';

export class WindowsMissionEngine {
  private stepIndex = 0;
  private hintLevel = 0;
  private withSolution = false;
  private pendingSolve = false;
  private readonly startedAt: number;
  private finishedAt: number | null = null;
  private flag: string | null = null;
  private readonly now: () => number;

  constructor(
    readonly mission: WindowsMission,
    private readonly sys: MockWindowsSystem,
    private readonly options: EngineOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
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

  /**
   * Eingabezeile vor dem Mock-System: Antwort auf die Rückfrage von `mission solve` oder
   * ein `mission`-Befehl. Gibt den Ausgabetext zurück, oder null, wenn die Zeile ein
   * gewöhnlicher Windows-Befehl ist.
   */
  intercept(input: string): string | null {
    const line = input.trim();
    if (this.pendingSolve) {
      this.pendingSolve = false;
      return /^(j|ja|y|yes)$/i.test(line) ? this.showSolution() : 'Abgebrochen.';
    }
    const match = /^mission(?:\s+(\S+))?\s*$/i.exec(line);
    if (!match) return null;
    switch ((match[1] ?? '').toLowerCase()) {
      case 'status':
        return this.status();
      case 'hint':
        return this.hint();
      case 'check':
        return this.check();
      case 'solve':
        return this.solve();
      case 'flag':
        return this.finished
          ? (this.flag ?? '')
          : `Noch keine Flagge. ${this.stepLabel()} ist offen.`;
      default:
        return USAGE;
    }
  }

  /** Stille Prüfung nach jedem Befehl: meldet nur Fortschritt, nie einen Misserfolg. */
  afterCommand(): string {
    return this.advance().join('\n');
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

  private status(): string {
    if (this.finished) return `${this.mission.title}: geschafft. Flagge: ${this.flag}`;
    return `${this.mission.title} · ${this.stepLabel()}: ${this.step.title}\n${this.step.description}`;
  }

  private hint(): string {
    if (this.finished) return 'Mission geschafft, keine Tipps nötig.';
    const { hints } = this.step;
    if (this.hintLevel >= hints.length) {
      return 'Keine weiteren Tipps. `mission solve` zeigt einen Lösungsweg.';
    }
    this.hintLevel += 1;
    this.emit();
    return `Tipp ${this.hintLevel}/${hints.length}: ${hints[this.hintLevel - 1]}`;
  }

  private check(): string {
    if (this.finished) return this.status();
    const lines = this.advance();
    if (lines.length > 0) return lines.join('\n');
    return this.step.failMessage ?? 'Noch nicht erfüllt. `mission hint` hilft weiter.';
  }

  private solve(): string {
    if (this.finished) return 'Mission geschafft.';
    this.pendingSolve = true;
    return `Lösungsweg für ${this.stepLabel()} anzeigen? Die Flagge zählt danach als „mit Lösung“. [j/N]`;
  }

  private showSolution(): string {
    this.withSolution = true;
    this.emit();
    return `Lösungsweg für ${this.stepLabel()}:\n  ${this.step.solution}`;
  }

  /** Setzt die Mission fort, solange der aktuelle Schritt im Zustand bereits erfüllt ist. */
  private advance(): string[] {
    const lines: string[] = [];
    while (!this.finished && this.step.verify(this.sys)) {
      lines.push(`${this.stepLabel()} erfüllt: ${this.step.title}`);
      if (this.stepIndex + 1 < this.mission.steps.length) {
        this.stepIndex += 1;
        this.hintLevel = 0;
      } else {
        lines.push(...this.finish());
      }
    }
    if (lines.length > 0) {
      if (!this.finished) {
        lines.push(`Weiter mit ${this.stepLabel()}: ${this.step.title} (\`mission status\`)`);
      }
      this.emit();
    }
    return lines;
  }

  private finish(): string[] {
    this.flag = deriveFlag(this.mission.id, this.mission.flagSeed(this.sys));
    this.finishedAt = this.now();
    const durationMs = this.finishedAt - this.startedAt;
    this.options.store?.complete(this.mission.id, {
      flag: this.flag,
      withSolution: this.withSolution,
      durationMs,
      finishedAt: this.finishedAt,
    });
    const note = this.withSolution ? ' (mit Lösung)' : '';
    return [`Mission geschafft in ${formatDuration(durationMs)}${note}. Flagge: ${this.flag}`];
  }

  private emit() {
    this.options.onChange?.(this.snapshot());
  }
}
