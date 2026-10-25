import { describe, expect, it, vi } from 'vitest';
import { MissionEngine, type EngineEvent, type MissionRunner } from '../missionEngine';
import {
  leererStand,
  gelernteBefehle,
  istFreigegeben,
  neueAbzeichen,
  vorfallAlsMission,
  type AkteEintrag,
} from '../staffel';
import { createStaffelStore, LEGACY_STORE_KEY, STAFFEL_STORE_KEY } from '../staffelStore';
import type { Staffel, Vorfall } from '../staffelTypes';

const tool = (befehl: string) => ({ befehl, erklaerung: `${befehl} erklärt`, beispiel: befehl });

function vorfall(nr: number, extra: Partial<Vorfall> = {}): Vorfall {
  return {
    nr,
    id: `v${nr}`,
    titel: `Vorfall ${nr}`,
    setup: `SETUP_${nr}`,
    schritte: [
      {
        id: 'a',
        title: 'Schritt A',
        pager: ['Zeile 1', 'Zeile 2'],
        verify: `VERIFY_${nr}_A`,
        tipps: ['Richtung', 'Befehl', 'loesung a'],
        failMessage: 'noch nicht',
        target: 'ziel',
      },
      {
        id: 'b',
        title: 'Schritt B',
        pager: ['Weiter'],
        verify: `VERIFY_${nr}_B`,
        tipps: ['R', 'B', 'loesung b'],
      },
    ],
    werkzeuge: [tool('ls'), tool(nr === 1 ? 'git log' : 'cat'), tool('pwd')],
    beweisstueck: { id: `b${nr}`, titel: `Spur ${nr}`, beschreibung: 'x', code: `CODE-${nr}` },
    szene: ['Szene'],
    ...extra,
  };
}

const staffel: Staffel = {
  id: 'test',
  titel: 'Teststaffel',
  vorfaelle: [vorfall(0), vorfall(1), vorfall(2, { finale: true })],
  abzeichen: [
    { id: 'ohne-tipp', titel: 't', beschreibung: 'b', regel: { art: 'ohne-tipp' } },
    { id: 'schnell', titel: 't', beschreibung: 'b', regel: { art: 'schnell', ms: 300_000 } },
    { id: 'nie-loesung', titel: 't', beschreibung: 'b', regel: { art: 'nie-loesung' } },
    { id: 'rot', titel: 't', beschreibung: 'b', regel: { art: 'rote-prompts', anzahl: 3 } },
  ],
};

const eintrag = (extra: Partial<AkteEintrag> = {}): AkteEintrag => ({
  durationMs: 600_000,
  withSolution: false,
  hintsUsed: 1,
  finishedAt: 1,
  ...extra,
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('vorfallAlsMission', () => {
  it('macht Pager zur Beschreibung, Tippstufen 1–2 zu Tipps und Stufe 3 zur Lösung', () => {
    const m = vorfallAlsMission(staffel.vorfaelle[0]);
    expect(m).toMatchObject({ id: 'v0', nr: '0', title: 'Vorfall 0', setup: 'SETUP_0' });
    expect(m.track).toBe('linux');
    expect(m.steps[0]).toMatchObject({
      id: 'a',
      description: 'Zeile 1\nZeile 2',
      verify: 'VERIFY_0_A',
      hints: ['Richtung', 'Befehl'],
      solution: 'loesung a',
      failMessage: 'noch nicht',
      target: 'ziel',
    });
    // Flagge erst nach allen Prüfungen, jede abbrechend (Codex-Finding zu #396).
    expect(m.flag.split('\n')).toEqual([
      '( VERIFY_0_A',
      ') >/dev/null 2>&1 || exit 1',
      '( VERIFY_0_B',
      ') >/dev/null 2>&1 || exit 1',
      "printf '%s\\n' 'FLAG{CODE-0}'",
    ]);
    expect(vorfallAlsMission(staffel.vorfaelle[1]).track).toBe('git');
  });
});

describe('istFreigegeben', () => {
  it('gibt jeden Vorfall frei, das Finale erst bei voller Akte', () => {
    expect(istFreigegeben(staffel, {}, 'v1')).toBe(true);
    expect(istFreigegeben(staffel, {}, 'v2')).toBe(false);
    expect(istFreigegeben(staffel, { v0: eintrag() }, 'v2')).toBe(false);
    expect(istFreigegeben(staffel, { v0: eintrag(), v1: eintrag() }, 'v2')).toBe(true);
    expect(istFreigegeben(staffel, {}, 'unbekannt')).toBe(false);
  });
});

describe('gelernteBefehle', () => {
  it('sammelt die Werkzeuge gelöster Vorfälle, je Befehl einmal', () => {
    expect(gelernteBefehle(staffel, {})).toEqual([]);
    const befehle = gelernteBefehle(staffel, { v0: eintrag(), v1: eintrag() }).map((t) => t.befehl);
    expect(befehle).toEqual(['ls', 'cat', 'pwd', 'git log']);
  });
});

describe('neueAbzeichen', () => {
  it('vergibt ohne-tipp, schnell, rote-prompts und nie-loesung nach ihren Regeln', () => {
    expect(neueAbzeichen(staffel, leererStand())).toEqual([]);
    const flott = { ...leererStand(), akte: { v0: eintrag({ hintsUsed: 0, durationMs: 1000 }) } };
    expect(neueAbzeichen(staffel, flott)).toEqual(['ohne-tipp', 'schnell']);
    expect(neueAbzeichen(staffel, { ...leererStand(), rotePrompts: 3 })).toEqual(['rot']);
    const voll = { v0: eintrag(), v1: eintrag(), v2: eintrag() };
    expect(neueAbzeichen(staffel, { ...leererStand(), akte: voll })).toEqual(['nie-loesung']);
    const mitLoesung = { ...voll, v1: eintrag({ withSolution: true }) };
    expect(neueAbzeichen(staffel, { ...leererStand(), akte: mitLoesung })).toEqual([]);
  });

  it('vergibt kein Abzeichen zweimal', () => {
    const stand = { ...leererStand(), rotePrompts: 5, abzeichen: ['rot'] };
    expect(neueAbzeichen(staffel, stand)).toEqual([]);
  });

  it('zählt den gerade beendeten Lauf, auch wenn die Akte einen anderen behält', () => {
    const stand = { ...leererStand(), akte: { v0: eintrag() } };
    expect(neueAbzeichen(staffel, stand, eintrag({ hintsUsed: 0 }))).toEqual(['ohne-tipp']);
  });

  it('Tipps mit Lösung zählen nicht als ohne Tipp', () => {
    const akte = { v0: eintrag({ hintsUsed: 0, withSolution: true }) };
    expect(neueAbzeichen(staffel, { ...leererStand(), akte })).not.toContain('ohne-tipp');
  });
});

describe('createStaffelStore', () => {
  it('verwirft aus missionen:v1 nur die abgelösten Missionen, Windows bleibt', () => {
    const windows = { flag: 'FLAG{win}', withSolution: false, durationMs: 1, finishedAt: 1 };
    const storage = memoryStorage({
      [LEGACY_STORE_KEY]: JSON.stringify({ 'linux-basics-1': { flag: 'x' }, 'win-demo': windows }),
    });
    const store = createStaffelStore(storage);
    expect(JSON.parse(storage.data.get(LEGACY_STORE_KEY)!)).toEqual({ 'win-demo': windows });
    expect(store.read('test')).toEqual(leererStand());
  });

  it('entfernt missionen:v1 ganz, wenn nur abgelöste Missionen drinstehen', () => {
    const storage = memoryStorage({ [LEGACY_STORE_KEY]: '{"git-ctf-rewind":{"flag":"x"}}' });
    createStaffelStore(storage);
    expect(storage.data.has(LEGACY_STORE_KEY)).toBe(false);
  });

  it('lässt kaputtes oder fremdes missionen:v1 unverändert', () => {
    for (const raw of ['{kaputt', '{"win-demo":{}}', '[]']) {
      const storage = memoryStorage({ [LEGACY_STORE_KEY]: raw });
      createStaffelStore(storage);
      expect(storage.data.get(LEGACY_STORE_KEY)).toBe(raw);
    }
  });

  it('übersteht kaputtes JSON, fremde Felder und fehlenden Speicher', () => {
    const kaputt = memoryStorage({ [STAFFEL_STORE_KEY]: '{nicht json' });
    expect(createStaffelStore(kaputt).read('test')).toEqual(leererStand());
    const fremd = memoryStorage({
      [STAFFEL_STORE_KEY]: JSON.stringify({
        test: {
          akte: { v0: { durationMs: 'x' }, v1: eintrag() },
          abzeichen: [1, 'rot'],
          rotePrompts: -2,
        },
      }),
    });
    expect(createStaffelStore(fremd).read('test')).toEqual({
      akte: { v1: eintrag() },
      abzeichen: ['rot'],
      rotePrompts: 0,
    });
    // Ohne Speicher gilt der Stand für die Sitzung: Akte und Finale-Freigabe gehen weiter.
    const ohne = createStaffelStore(null);
    expect(ohne.loese(staffel, 'v0', eintrag())).toHaveLength(1);
    expect(Object.keys(ohne.read('test').akte)).toEqual(['v0']);
    const gesperrt = {
      getItem: () => {
        throw new Error('gesperrt');
      },
      setItem: () => {
        throw new Error('gesperrt');
      },
      removeItem: () => {
        throw new Error('gesperrt');
      },
    };
    const gesperrtStore = createStaffelStore(gesperrt);
    expect(() => gesperrtStore.loese(staffel, 'v0', eintrag())).not.toThrow();
    expect(() => gesperrtStore.loese(staffel, 'v1', eintrag())).not.toThrow();
    expect(Object.keys(gesperrtStore.read('test').akte)).toEqual(['v0', 'v1']);
  });

  it('meldet das Beweisstück beim ersten Lösen, danach nur noch Abzeichen', () => {
    const store = createStaffelStore(memoryStorage());
    expect(store.loese(staffel, 'v0', eintrag())).toEqual([
      { type: 'beweisstueck', vorfallId: 'v0', beweisstueckId: 'b0', code: 'CODE-0' },
    ]);
    expect(store.loese(staffel, 'v0', eintrag({ hintsUsed: 0 }))).toEqual([
      { type: 'abzeichen', abzeichenId: 'ohne-tipp' },
    ]);
    expect(store.read('test').abzeichen).toEqual(['ohne-tipp']);
    expect(store.loese(staffel, 'unbekannt', eintrag())).toEqual([]);
  });

  it('ersetzt einen Lauf mit Lösung durch einen ohne, sonst zählt der schnellere', () => {
    const store = createStaffelStore(memoryStorage());
    store.loese(staffel, 'v0', eintrag({ withSolution: true, durationMs: 100 }));
    store.loese(staffel, 'v0', eintrag({ durationMs: 900_000 }));
    expect(store.read('test').akte.v0).toMatchObject({ withSolution: false, durationMs: 900_000 });
    store.loese(staffel, 'v0', eintrag({ withSolution: true, durationMs: 1 }));
    expect(store.read('test').akte.v0.withSolution).toBe(false);
    store.loese(staffel, 'v0', eintrag({ durationMs: 700_000 }));
    expect(store.read('test').akte.v0.durationMs).toBe(700_000);
  });

  it('zählt rote Prompts und vergibt das Abzeichen bei der Schwelle', () => {
    const store = createStaffelStore(memoryStorage());
    expect(store.roterPrompt(staffel)).toEqual([]);
    expect(store.roterPrompt(staffel)).toEqual([]);
    expect(store.roterPrompt(staffel)).toEqual([{ type: 'abzeichen', abzeichenId: 'rot' }]);
    expect(store.roterPrompt(staffel)).toEqual([]);
    expect(store.read('test').rotePrompts).toBe(4);
  });

  // Codex-Finding zu #399: Zwei Tabs mit eigenem Store überschreiben sich nicht.
  it('führt den Stand zweier Tabs zusammen', () => {
    const storage = memoryStorage();
    const tabA = createStaffelStore(storage);
    const tabB = createStaffelStore(storage);
    tabA.loese(staffel, 'v0', eintrag());
    tabB.loese(staffel, 'v1', eintrag());
    tabB.roterPrompt(staffel);
    const neu = createStaffelStore(storage).read('test');
    expect(Object.keys(neu.akte).sort()).toEqual(['v0', 'v1']);
    expect(neu.rotePrompts).toBe(1);
  });

  it('hält Staffeln getrennt', () => {
    const storage = memoryStorage();
    const store = createStaffelStore(storage);
    store.loese(staffel, 'v0', eintrag());
    store.loese({ ...staffel, id: 'andere' }, 'v1', eintrag());
    expect(Object.keys(store.read('test').akte)).toEqual(['v0']);
    expect(Object.keys(store.read('andere').akte)).toEqual(['v1']);
  });

  describe('Staffel 2', () => {
    // Stand aus der Zeit vor Staffel 2: Format und Inhalt von Staffel 1 dürfen sich nicht ändern.
    const alt = {
      test: {
        akte: { v0: { durationMs: 5, withSolution: false, hintsUsed: 2, finishedAt: 9 } },
        abzeichen: ['rot'],
        rotePrompts: 3,
      },
    };

    it('liest einen alten Stand von Staffel 1 unverändert und lässt ihn beim Eintragen stehen', () => {
      const storage = memoryStorage({ [STAFFEL_STORE_KEY]: JSON.stringify(alt) });
      const store = createStaffelStore(storage);
      expect(store.read('test')).toEqual(alt.test);
      store.loeseEpisode('staffel-2', 'probelauf', eintrag({ vorwurfVersuche: 2 }));
      expect(JSON.parse(storage.data.get(STAFFEL_STORE_KEY)!)).toEqual({
        ...alt,
        'staffel-2': {
          akte: { probelauf: eintrag({ vorwurfVersuche: 2 }) },
          abzeichen: [],
          rotePrompts: 0,
        },
      });
    });

    it('behält beim erneuten Lösen den besseren Lauf', () => {
      const store = createStaffelStore(memoryStorage());
      store.loeseEpisode('staffel-2', 'e', eintrag({ withSolution: true, durationMs: 1 }));
      store.loeseEpisode('staffel-2', 'e', eintrag({ durationMs: 500 }));
      store.loeseEpisode('staffel-2', 'e', eintrag({ durationMs: 900 }));
      expect(store.read('staffel-2').akte.e.durationMs).toBe(500);
    });

    it('führt zwei Tabs zusammen', () => {
      const storage = memoryStorage();
      createStaffelStore(storage).loeseEpisode('staffel-2', 'a', eintrag());
      createStaffelStore(storage).loeseEpisode('staffel-2', 'b', eintrag());
      expect(Object.keys(createStaffelStore(storage).read('staffel-2').akte).sort()).toEqual([
        'a',
        'b',
      ]);
    });

    it('löscht nur Staffel 2', () => {
      const storage = memoryStorage({ [STAFFEL_STORE_KEY]: JSON.stringify(alt) });
      const store = createStaffelStore(storage);
      store.loeseEpisode('staffel-2', 'a', eintrag());
      store.loescheStaffel('staffel-2');
      expect(store.read('staffel-2')).toEqual(leererStand());
      expect(createStaffelStore(storage).read('staffel-2')).toEqual(leererStand());
      expect(JSON.parse(storage.data.get(STAFFEL_STORE_KEY)!)).toEqual(alt);
      store.loescheStaffel('test');
      expect(storage.data.has(STAFFEL_STORE_KEY)).toBe(false);
    });

    it('verwirft einen Eintrag mit kaputten Versuchen', () => {
      const storage = memoryStorage({
        [STAFFEL_STORE_KEY]: JSON.stringify({
          'staffel-2': { akte: { a: { ...eintrag(), vorwurfVersuche: 'x' }, b: eintrag() } },
        }),
      });
      expect(Object.keys(createStaffelStore(storage).read('staffel-2').akte)).toEqual(['b']);
    });
  });
});

// Engine → Store: Was die Seite bei einem Vorfall der Reihe nach erfährt.
describe('Engine-Ereignisse mit einem Vorfall', () => {
  it('meldet Schritt erledigt, Vorfall gelöst, dann Beweisstück und Abzeichen', async () => {
    const state = { a: false, b: false };
    const runner: MissionRunner = {
      run: vi.fn(async (script: string) => {
        // Flagge zuerst: Ihr Skript enthält alle verify-Skripte und besteht nur, wenn alle bestehen.
        if (script.includes('FLAG{'))
          return state.a && state.b
            ? { exitCode: 0, output: 'FLAG{CODE-0}\n' }
            : { exitCode: 1, output: '' };
        if (script.includes('VERIFY_0_A')) return { exitCode: state.a ? 0 : 1, output: '' };
        if (script.includes('VERIFY_0_B')) return { exitCode: state.b ? 0 : 1, output: '' };
        return { exitCode: 0, output: '' };
      }),
    };
    const store = createStaffelStore(memoryStorage());
    const log: (EngineEvent | ReturnType<typeof store.loese>[number])[] = [];
    let t = 0;
    const engine = new MissionEngine(vorfallAlsMission(staffel.vorfaelle[0]), runner, {
      now: () => t,
      onEvent: (event) => {
        log.push(event);
        if (event.type === 'vorfall-geloest') {
          const { durationMs, withSolution, hintsUsed, finishedAt } = event;
          log.push(
            ...store.loese(staffel, event.missionId, {
              durationMs,
              withSolution,
              hintsUsed,
              finishedAt,
            })
          );
        }
      },
    });
    await engine.start();
    await engine.handle('__prompt');
    expect(log).toEqual([]);

    state.a = true;
    await engine.handle('__prompt');
    expect(log).toEqual([{ type: 'schritt-erledigt', missionId: 'v0', stepIndex: 0, stepId: 'a' }]);

    // Schritt B erfüllt, aber A wieder kaputt: keine Flagge, kein Ereignis, auch nicht doppelt.
    state.a = false;
    state.b = true;
    await engine.handle('__prompt');
    await engine.handle('check');
    expect(log).toHaveLength(1);

    state.a = true;
    t = 60_000;
    await engine.handle('__prompt');
    expect(log.slice(1)).toEqual([
      { type: 'schritt-erledigt', missionId: 'v0', stepIndex: 1, stepId: 'b' },
      {
        type: 'vorfall-geloest',
        missionId: 'v0',
        flag: 'FLAG{CODE-0}',
        durationMs: 60_000,
        withSolution: false,
        hintsUsed: 0,
        finishedAt: 60_000,
      },
      { type: 'beweisstueck', vorfallId: 'v0', beweisstueckId: 'b0', code: 'CODE-0' },
      { type: 'abzeichen', abzeichenId: 'ohne-tipp' },
      { type: 'abzeichen', abzeichenId: 'schnell' },
    ]);
  });

  it('zählt Tipps über alle Schritte und markiert die Lösung', async () => {
    const state = { a: false };
    const runner: MissionRunner = {
      run: async (script: string) => {
        if (script.includes('FLAG{')) return { exitCode: 0, output: 'FLAG{CODE-0}' };
        if (script.includes('VERIFY_0_A')) return { exitCode: state.a ? 0 : 1, output: '' };
        return { exitCode: 0, output: '' };
      },
    };
    const events: EngineEvent[] = [];
    const engine = new MissionEngine(vorfallAlsMission(staffel.vorfaelle[0]), runner, {
      onEvent: (e) => events.push(e),
    });
    await engine.start();
    await engine.handle('hint');
    state.a = true;
    await engine.handle('check');
    await engine.handle('hint');
    await engine.handle('hint');
    await engine.handle('hint'); // keine weitere Stufe: zählt nicht
    await engine.handle('solve');
    await engine.handle('check'); // VERIFY_0_B fällt in den Standardfall: erfüllt
    expect(events.at(-1)).toMatchObject({
      type: 'vorfall-geloest',
      hintsUsed: 3,
      withSolution: true,
    });
  });
});
