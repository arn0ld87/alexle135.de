import { describe, expect, it } from 'vitest';
import { STORE_KEY, createMissionStore, type MissionResult } from '../missionStore';

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORE_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const result = (patch: Partial<MissionResult> = {}): MissionResult => ({
  flag: 'FLAG{abcd}',
  withSolution: false,
  durationMs: 60_000,
  finishedAt: 1,
  ...patch,
});

describe('createMissionStore', () => {
  it('speichert und liest Ergebnisse über eine neue Instanz (Reload)', () => {
    const storage = memoryStorage();
    createMissionStore(storage).complete('m1', result());
    expect(createMissionStore(storage).get('m1')).toEqual(result());
  });

  it('behält die bessere Zeit und ersetzt „mit Lösung“ durch einen Lauf ohne', () => {
    const store = createMissionStore(memoryStorage());
    store.complete('m1', result({ withSolution: true, durationMs: 10_000 }));
    store.complete('m1', result({ durationMs: 90_000 }));
    expect(store.get('m1')?.withSolution).toBe(false);
    store.complete('m1', result({ durationMs: 120_000 }));
    expect(store.get('m1')?.durationMs).toBe(90_000);
    store.complete('m1', result({ durationMs: 30_000 }));
    expect(store.get('m1')?.durationMs).toBe(30_000);
    store.complete('m1', result({ withSolution: true, durationMs: 1_000 }));
    expect(store.get('m1')?.withSolution).toBe(false);
  });

  it('zählt erledigte Missionen je Track', () => {
    const store = createMissionStore(memoryStorage());
    store.complete('a', result());
    store.complete('c', result());
    expect(store.countDone(['a', 'b', 'c'])).toBe(2);
  });

  it('übersteht kaputte oder fremde Daten', () => {
    expect(createMissionStore(memoryStorage('{kaputt')).read()).toEqual({});
    expect(createMissionStore(memoryStorage('[1,2]')).read()).toEqual({});
    const store = createMissionStore(
      memoryStorage(JSON.stringify({ ok: result(), bad: { flag: 1 } }))
    );
    expect(Object.keys(store.read())).toEqual(['ok']);
  });

  it('funktioniert ohne Speicher und mit gesperrtem Speicher', () => {
    const none = createMissionStore(null);
    none.complete('m1', result());
    expect(none.read()).toEqual({});

    const locked = createMissionStore({
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => locked.complete('m1', result())).not.toThrow();
    expect(locked.read()).toEqual({});
  });
});
