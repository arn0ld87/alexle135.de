import { describe, expect, it, vi } from 'vitest';
import { MissionEngine, formatClock, formatDuration, type MissionRunner } from '../missionEngine';
import { createMissionStore } from '../missionStore';
import type { V86Mission } from '../missionTypes';

const mission: V86Mission = {
  nr: '01',
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
    expect(reply.text).toContain(
      'Mission 01 geschafft · Flagge FLAG{zielzustand} · 01:35 · weiter mit `mission next`'
    );
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

  it('entprellt die stille Prüfung: eine neue verdrängt die wartende', async () => {
    const state = { a: false, b: false };
    const { engine, scripts } = await started(state);
    const before = scripts.length;
    const replies = await Promise.all([
      engine.handle('__prompt'),
      engine.handle('__prompt'),
      engine.handle('__prompt'),
    ]);
    expect(replies.every((r) => r.text === '')).toBe(true);
    // Alle drei warteten gleichzeitig: Nur die jüngste prüft, die älteren antworten leer.
    expect(scripts.slice(before).filter((s) => s.includes('VERIFY_A'))).toHaveLength(1);
  });

  it('lässt einen expliziten Befehl wartende stille Prüfungen verdrängen', async () => {
    const state = { a: false, b: false };
    const { engine, scripts } = await started(state);
    const before = scripts.length;
    const [p1, p2, status] = await Promise.all([
      engine.handle('__prompt'),
      engine.handle('__prompt'),
      engine.handle('status'),
    ]);
    expect([p1.text, p2.text]).toEqual(['', '']);
    expect(status.text).toContain('Schritt 1/2');
    expect(scripts.slice(before).filter((s) => s.includes('VERIFY_A'))).toHaveLength(0);
  });

  it('arbeitet überlappende Anfragen nacheinander ab', async () => {
    const state = { a: true, b: false };
    const { engine } = await started(state);
    const [first, second] = await Promise.all([engine.handle('__prompt'), engine.handle('check')]);
    // Die wartende stille Prüfung entfällt, mission check übernimmt.
    expect(first).toEqual({ exitCode: 0, text: '' });
    expect(second.text).toContain('Schritt 1/2 erfüllt');
  });
});

// Schritt mit Artefakt und Diagnose: Die stille Prüfung meldet einen Fehlschlag nur, wenn das
// Artefakt existiert, und nur einmal je Änderung (Fingerabdruck über den Agenten).
const withTarget: V86Mission = {
  ...mission,
  completionLink: { href: '/blog/agora/', label: 'Mehr zu Agora' },
  steps: [
    {
      ...mission.steps[0],
      target: 'antwort.txt',
      diagnose: 'DIAG_A',
      tools: [
        { befehl: 'whoami', erklaerung: 'Zeigt deinen Benutzernamen.', beispiel: 'whoami' },
        {
          befehl: '>',
          erklaerung: 'Leitet die Ausgabe in eine Datei.',
          beispiel: 'date > heute.txt',
        },
      ],
    },
    mission.steps[1],
  ],
};

function artefactRunner(state: {
  a: boolean;
  b?: boolean;
  exists: boolean;
  fp: string;
  diag: string;
}) {
  const scripts: string[] = [];
  const runner: MissionRunner = {
    run: vi.fn(async (script: string) => {
      scripts.push(script);
      if (script.includes('# artefakt')) {
        return state.exists
          ? { exitCode: 0, output: `${state.fp}\n` }
          : { exitCode: 1, output: '' };
      }
      if (script.includes('DIAG_A')) return { exitCode: 0, output: state.diag };
      if (script.includes('VERIFY_A')) return { exitCode: state.a ? 0 : 1, output: '' };
      if (script.includes('VERIFY_B')) return { exitCode: state.b ? 0 : 1, output: '' };
      if (script.includes('FLAG_SCRIPT')) return { exitCode: 0, output: 'FLAG{zielzustand}\n' };
      return { exitCode: 0, output: '' };
    }),
  };
  return { runner, scripts };
}

describe('MissionEngine: Fast-Meldung, Werkzeugkasten, Abschluss', () => {
  async function setup(
    state: Parameters<typeof artefactRunner>[0],
    onNext?: () => Promise<{ exitCode: number; text: string }>
  ) {
    const vm = artefactRunner(state);
    const engine = new MissionEngine(withTarget, vm.runner, { now: () => 0, onNext });
    await engine.start();
    return { engine, ...vm };
  }

  it('schweigt, solange das Artefakt fehlt', async () => {
    const { engine } = await setup({ a: false, exists: false, fp: '', diag: '' });
    expect(await engine.handle('__prompt')).toEqual({ exitCode: 0, text: '' });
  });

  it('meldet ein falsches Artefakt genau einmal je Änderung', async () => {
    const state = { a: false, exists: false, fp: 'v1', diag: '' };
    const { engine } = await setup(state);
    state.exists = true;
    expect(await engine.handle('__prompt')).toEqual({ exitCode: 1, text: 'projekt fehlt noch.' });
    expect(await engine.handle('__prompt')).toEqual({ exitCode: 0, text: '' });
    expect(await engine.handle('__prompt')).toEqual({ exitCode: 0, text: '' });
    state.fp = 'v2';
    expect((await engine.handle('__prompt')).text).toBe('projekt fehlt noch.');
    expect(engine.snapshot().feedback).toBe('projekt fehlt noch.');
  });

  it('nimmt die Diagnose vor failMessage, auch bei mission check', async () => {
    const state = {
      a: false,
      exists: false,
      fp: 'v1',
      diag: 'Du hast den Befehl hineingeschrieben.\n',
    };
    const { engine } = await setup(state);
    state.exists = true;
    expect((await engine.handle('__prompt')).text).toBe('Du hast den Befehl hineingeschrieben.');
    expect(await engine.handle('check')).toEqual({
      exitCode: 1,
      text: 'Du hast den Befehl hineingeschrieben.',
    });
  });

  it('schweigt, wenn das Artefakt beim Betreten des Schritts schon unverändert da ist', async () => {
    const state = { a: false, exists: true, fp: 'leer', diag: '' };
    const { engine } = await setup(state);
    expect(await engine.handle('__prompt')).toEqual({ exitCode: 0, text: '' });
    state.fp = 'geaendert';
    expect((await engine.handle('__prompt')).exitCode).toBe(1);
  });

  it('wiederholt nach mission check die Meldung nicht im Prompt-Hook', async () => {
    const state = { a: false, exists: false, fp: 'v1', diag: '' };
    const { engine } = await setup(state);
    state.exists = true;
    expect((await engine.handle('check')).text).toBe('projekt fehlt noch.');
    expect(await engine.handle('__prompt')).toEqual({ exitCode: 0, text: '' });
  });

  it('zeigt den Werkzeugkasten in mission status', async () => {
    const { engine } = await setup({ a: false, exists: false, fp: '', diag: '' });
    const { text } = await engine.handle('status');
    expect(text).toContain('Werkzeugkasten');
    expect(text).toContain('whoami');
    expect(text).toContain('date > heute.txt');
  });

  it('liefert Schrittliste und Abschluss mit Link', async () => {
    const state = { a: true, b: false, exists: true, fp: 'v1', diag: '' };
    const { engine } = await setup(state);
    expect(engine.snapshot().stepStates).toEqual(['aktuell', 'offen']);
    await engine.handle('__prompt');
    expect(engine.snapshot().stepStates).toEqual(['erledigt', 'aktuell']);
    state.b = true;
    const reply = await engine.handle('__prompt');
    expect(reply.text).toContain('Mission 01 geschafft · Flagge FLAG{zielzustand} · 00:00');
    expect(reply.text).toContain('Mehr zu Agora: https://alex-schneider.dev/blog/agora/');
    expect(engine.snapshot().stepStates).toEqual(['erledigt', 'erledigt']);
  });

  it('reicht mission next an die Seite weiter', async () => {
    const onNext = vi.fn(async () => ({ exitCode: 0, text: 'Weiter mit 02' }));
    const { engine } = await setup({ a: false, exists: false, fp: '', diag: '' }, onNext);
    expect(await engine.handle('next')).toEqual({ exitCode: 0, text: 'Weiter mit 02' });
    expect(onNext).toHaveBeenCalledOnce();
  });
});

describe('formatClock', () => {
  it('formatiert mm:ss', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(402_000)).toBe('06:42');
    expect(formatClock(3_725_000)).toBe('62:05');
  });
});

describe('formatDuration', () => {
  it('formatiert Minuten und Sekunden', () => {
    expect(formatDuration(0)).toBe('0:00 min');
    expect(formatDuration(61_400)).toBe('1:01 min');
  });

  // #400: Mit Pager bleibt das Terminal bei stillen Erfolgen leer, `mission check` antwortet.
  it('successInPager: stille Erfolge leer, mission check weiter mit Text', async () => {
    const state = { a: true, b: false };
    const vm = fakeRunner(state);
    const engine = new MissionEngine(mission, vm.runner, { successInPager: true });
    await engine.start();
    expect((await engine.handle('__prompt')).text).toBe('');
    expect(engine.snapshot().stepIndex).toBe(1);
    state.b = true;
    expect((await engine.handle('__prompt')).text).toBe('');
    expect(engine.snapshot().flag).toBe('FLAG{zielzustand}');
    const plain = new MissionEngine(mission, fakeRunner({ a: true, b: false }).runner, {
      successInPager: true,
    });
    await plain.start();
    expect((await plain.handle('check')).text).toContain('Schritt 1/2 erfüllt');
  });
});
