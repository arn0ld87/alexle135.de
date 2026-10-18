import { describe, expect, it, vi } from 'vitest';
import { MissionEngine, formatDuration, type MissionRunner } from '../missionEngine';
import { createMissionStore } from '../missionStore';
import type { V86Mission } from '../missionTypes';

const mission: V86Mission = {
  id: 'test-mission',
  track: 'linux',
  title: 'Testmission',
  difficulty: 'einstieg',
  durationMin: 5,
  setup: 'SETUP',
  steps: [
    {
      id: 'a',
      title: 'Ordner anlegen',
      description: 'Lege projekt an.',
      verify: 'VERIFY_A',
      hints: ['Tipp A1', 'Tipp A2'],
      solution: 'mkdir projekt',
      failMessage: 'projekt fehlt noch.',
    },
    {
      id: 'b',
      title: 'Datei anlegen',
      description: 'Lege notiz.txt an.',
      verify: 'VERIFY_B',
      hints: ['Tipp B1'],
      solution: 'touch projekt/notiz.txt',
    },
  ],
  flag: 'FLAG_SCRIPT',
};

// Fake-VM: Skripte werden über ihre Platzhalter erkannt; `state` sagt, welche Prüfung besteht.
function fakeRunner(state: { a: boolean; b: boolean; flag?: string }) {
  const scripts: string[] = [];
  const runner: MissionRunner = {
    run: vi.fn(async (script: string) => {
      scripts.push(script);
      if (script.includes('VERIFY_A')) return { exitCode: state.a ? 0 : 1, output: '' };
      if (script.includes('VERIFY_B')) return { exitCode: state.b ? 0 : 1, output: '' };
      if (script.includes('FLAG_SCRIPT'))
        return { exitCode: 0, output: `${state.flag ?? 'FLAG{zielzustand}'}\n` };
      return { exitCode: 0, output: '' };
    }),
  };
  return { runner, scripts };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

async function started(state: { a: boolean; b: boolean; flag?: string }, now = () => 1_000) {
  const vm = fakeRunner(state);
  const store = createMissionStore(memoryStorage());
  const engine = new MissionEngine(mission, vm.runner, { store, now });
  await engine.start();
  return { engine, store, ...vm };
}

describe('MissionEngine', () => {
  it('führt setup aus und markiert die Mission in der VM als aktiv', async () => {
    const { scripts } = await started({ a: false, b: false });
    expect(scripts[0]).toContain('set -e');
    expect(scripts[0]).toContain('SETUP');
    expect(scripts[0]).toContain('touch /run/mission/active');
  });

  it('bricht ab, wenn setup scheitert', async () => {
    const runner: MissionRunner = { run: async () => ({ exitCode: 1, output: 'kaputt' }) };
    await expect(new MissionEngine(mission, runner).start()).rejects.toThrow(/kaputt/);
  });

  it('zeigt den aktuellen Schritt als Status', async () => {
    const { engine } = await started({ a: false, b: false });
    const reply = await engine.handle('status');
    expect(reply.text).toContain('Schritt 1/2: Ordner anlegen');
    expect(reply.text).toContain('Lege projekt an.');
  });

  it('meldet bei check einen falschen Zustand knapp und bleibt beim Schritt', async () => {
    const { engine } = await started({ a: false, b: false });
    expect(await engine.handle('check')).toEqual({ exitCode: 1, text: 'projekt fehlt noch.' });
    expect(engine.snapshot().stepIndex).toBe(0);
  });

  it('schweigt bei der stillen Prüfung, solange der Zustand nicht stimmt', async () => {
    const { engine } = await started({ a: false, b: false });
    expect(await engine.handle('__prompt')).toEqual({ exitCode: 0, text: '' });
  });

  it('rückt bei erfülltem Zustand vor, egal über welchen Befehl', async () => {
    const state = { a: false, b: false };
    const { engine } = await started(state);
    state.a = true;
    const reply = await engine.handle('__prompt');
    expect(reply.text).toContain('Schritt 1/2 erfüllt');
    expect(reply.text).toContain('Schritt 2/2: Datei anlegen');
    expect(engine.snapshot().stepIndex).toBe(1);
  });

  it('stuft Tipps ab und setzt sie je Schritt zurück', async () => {
    const state = { a: false, b: false };
    const { engine } = await started(state);
    expect((await engine.handle('hint')).text).toBe('Tipp 1/2: Tipp A1');
    expect((await engine.handle('hint')).text).toBe('Tipp 2/2: Tipp A2');
    expect((await engine.handle('hint')).text).toMatch(/Keine weiteren Tipps/);
    state.a = true;
    await engine.handle('check');
    expect((await engine.handle('hint')).text).toBe('Tipp 1/1: Tipp B1');
  });

  it('gibt die Flagge erst im Zielzustand aus und speichert Zeit und Ergebnis', async () => {
    let t = 1_000;
    const state = { a: true, b: false };
    const { engine, store, scripts } = await started(state, () => t);
    await engine.handle('check');
    expect((await engine.handle('flag')).exitCode).toBe(1);

    state.b = true;
    t = 1_000 + 95_000;
    const reply = await engine.handle('check');
    expect(reply.text).toContain('Mission geschafft in 1:35 min. Flagge: FLAG{zielzustand}');
    expect(await engine.handle('flag')).toEqual({ exitCode: 0, text: 'FLAG{zielzustand}' });
    expect(store.get('test-mission')).toEqual({
      flag: 'FLAG{zielzustand}',
      withSolution: false,
      durationMs: 95_000,
      finishedAt: 96_000,
    });
    expect(scripts.at(-1)).toBe('rm -f /run/mission/active');
  });

  it('markiert die Flagge nach solve als „mit Lösung“', async () => {
    const state = { a: true, b: true };
    const { engine, store } = await started(state);
    expect((await engine.handle('solve')).text).toContain('mkdir projekt');
    await engine.handle('check');
    const reply = await engine.handle('check');
    expect(reply.text).toContain('(mit Lösung)');
    expect(store.get('test-mission')?.withSolution).toBe(true);
  });

  it('verweigert eine Flagge, die nicht dem Format entspricht', async () => {
    const { engine, store } = await started({ a: true, b: true, flag: 'kaputt' });
    await engine.handle('check');
    const reply = await engine.handle('check');
    expect(reply.exitCode).toBe(1);
    expect(engine.snapshot().finishedAt).toBeNull();
    expect(store.get('test-mission')).toBeUndefined();
  });

  it('arbeitet überlappende Anfragen nacheinander ab', async () => {
    const state = { a: true, b: false };
    const { engine } = await started(state);
    const [first, second] = await Promise.all([engine.handle('__prompt'), engine.handle('check')]);
    expect(first.text).toContain('Schritt 1/2 erfüllt');
    expect(second).toEqual({
      exitCode: 1,
      text: 'Noch nicht erfüllt. `mission hint` hilft weiter.',
    });
  });
});

describe('formatDuration', () => {
  it('formatiert Minuten und Sekunden', () => {
    expect(formatDuration(0)).toBe('0:00 min');
    expect(formatDuration(61_400)).toBe('1:01 min');
  });
});
