// Fortschritt der Missionen im Browser (localStorage), ohne Konto und Backend.
// Fehlender oder gesperrter Speicher (privates Fenster, Vorschau) ist kein Fehler:
// Lesen liefert dann einen leeren Stand, Schreiben wird still übersprungen.

export const STORE_KEY = 'missionen:v1';

export interface MissionResult {
  flag: string;
  /** Lösung über `mission solve` angezeigt. */
  withSolution: boolean;
  durationMs: number;
  finishedAt: number;
}

export type MissionProgress = Record<string, MissionResult>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isResult(value: unknown): value is MissionResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.flag === 'string' &&
    typeof r.withSolution === 'boolean' &&
    typeof r.durationMs === 'number' &&
    typeof r.finishedAt === 'number'
  );
}

export function createMissionStore(storage: StorageLike | null = defaultStorage()) {
  function read(): MissionProgress {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(STORE_KEY) ?? '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isResult(v)));
    } catch {
      return {};
    }
  }

  function write(progress: MissionProgress) {
    try {
      storage?.setItem(STORE_KEY, JSON.stringify(progress));
    } catch {
      // Speicher voll oder gesperrt: Fortschritt gilt nur für diese Sitzung.
    }
  }

  return {
    read,
    get(missionId: string): MissionResult | undefined {
      return read()[missionId];
    },
    /** Ein Lauf ohne Lösung ersetzt einen mit Lösung; sonst zählt die schnellere Zeit. */
    complete(missionId: string, result: MissionResult) {
      const progress = read();
      const previous = progress[missionId];
      const better =
        !previous ||
        (previous.withSolution && !result.withSolution) ||
        (previous.withSolution === result.withSolution && result.durationMs < previous.durationMs);
      if (better) write({ ...progress, [missionId]: result });
    },
    /** Erledigte Missionen je Track, z. B. „Linux 3/5“. */
    countDone(missionIds: string[]): number {
      const progress = read();
      return missionIds.filter((id) => id in progress).length;
    },
  };
}

export type MissionStore = ReturnType<typeof createMissionStore>;
