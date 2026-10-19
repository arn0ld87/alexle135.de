import { describe, expect, it, vi } from 'vitest';
import { MockWindowsSystem } from '../../../components/interactive/MockWindowsSystem';
import { createMissionStore } from '../missionStore';
import { FLAG_PATTERN } from '../missionTypes';
import { WindowsMissionEngine, deriveFlag, type WindowsMission } from '../windowsEngine';

const mission: WindowsMission = {
  id: 'test-win',
  title: 'Testmission',
  description: 'Zwei Schritte.',
  difficulty: 'einstieg',
  durationMin: 5,
  steps: [
    {
      id: 'a',
      title: 'Ordner anlegen',
      description: 'Lege projekt an.',
      verify: (sys) => sys.isDir('projekt'),
      hints: ['Tipp A1', 'Tipp A2'],
      solution: 'mkdir projekt',
      failMessage: 'projekt fehlt noch.',
    },
    {
      id: 'b',
      title: 'Datei anlegen',
      description: 'Lege notiz.txt an.',
      verify: (sys) => sys.isFile('projekt\\notiz.txt'),
      hints: ['Tipp B1'],
      solution: 'echo x > projekt\\notiz.txt',
    },
  ],
  flagSeed: (sys) => `notiz=${sys.readFile('projekt\\notiz.txt')}`,
};

function setup(options: { store?: ReturnType<typeof createMissionStore> } = {}) {
  let clock = 1_000;
  const sys = new MockWindowsSystem();
  const onChange = vi.fn();
  const engine = new WindowsMissionEngine(mission, sys, {
    ...options,
    now: () => clock,
    onChange,
  });
  /** Tippt eine Zeile wie das Terminal: erst `intercept`, sonst System und stille Prüfung. */
  const type = (line: string) => {
    const reply = engine.intercept(line);
    if (reply !== null) return reply;
    sys.processCommand(line);
    return engine.afterCommand();
  };
  return { sys, engine, onChange, type, advance: (ms: number) => (clock += ms) };
}

describe('deriveFlag', () => {
  it('ist deterministisch, passt zum Flaggenmuster und hängt von Mission und Zustand ab', () => {
    expect(deriveFlag('m-1', 'x')).toBe(deriveFlag('m-1', 'x'));
    expect(deriveFlag('m-1', 'x')).toMatch(FLAG_PATTERN);
    expect(deriveFlag('m-1', 'x')).not.toBe(deriveFlag('m-1', 'y'));
    expect(deriveFlag('m-1', 'x')).not.toBe(deriveFlag('m-2', 'x'));
  });
});

describe('WindowsMissionEngine', () => {
  it('startet bei Schritt 1 und erkennt jeden Weg zum Ziel nach dem Befehl', () => {
    const { engine, type } = setup();
    expect(engine.snapshot()).toMatchObject({ stepIndex: 0, stepCount: 2, finishedAt: null });

    expect(type('dir')).toBe('');
    expect(engine.snapshot().stepIndex).toBe(0);

    const reply = type('md projekt');
    expect(reply).toContain('Schritt 1/2 erfüllt: Ordner anlegen');
    expect(reply).toContain('Weiter mit Schritt 2/2');
    expect(engine.snapshot().stepIndex).toBe(1);
  });

  it('akzeptiert auch mkdir statt md', () => {
    const { engine, type } = setup();
    type('mkdir projekt');
    expect(engine.snapshot().stepIndex).toBe(1);
  });

  it('setzt über bereits erfüllte Schritte hinweg fort, auch wenn sie in anderer Reihenfolge entstehen', () => {
    const { engine, sys } = setup();
    sys.processCommand('mkdir projekt');
    sys.processCommand('echo x > projekt\\notiz.txt');
    const reply = engine.afterCommand();
    expect(reply).toContain('Schritt 1/2 erfüllt');
    expect(reply).toContain('Schritt 2/2 erfüllt');
    expect(engine.snapshot().flag).toMatch(FLAG_PATTERN);
  });

  it('beendet die Mission mit Flagge, Zeit und Eintrag im Store', () => {
    const store = createMissionStore({ getItem: () => null, setItem: vi.fn() });
    const complete = vi.spyOn(store, 'complete');
    const { engine, type, advance } = setup({ store });
    type('mkdir projekt');
    advance(65_000);
    const reply = type('echo x > projekt\\notiz.txt');

    const flag = engine.snapshot().flag!;
    expect(flag).toMatch(FLAG_PATTERN);
    expect(reply).toContain('Mission geschafft in 1:05 min');
    expect(reply).toContain(`Flagge: ${flag}`);
    expect(engine.snapshot()).toMatchObject({ finishedAt: 66_000, withSolution: false });
    expect(complete).toHaveBeenCalledWith('test-win', {
      flag,
      withSolution: false,
      durationMs: 65_000,
      finishedAt: 66_000,
    });
  });

  it('liefert für denselben Zielzustand dieselbe Flagge', () => {
    const a = setup();
    const b = setup();
    for (const t of [a.type, b.type]) {
      t('mkdir projekt');
      t('echo x > projekt\\notiz.txt');
    }
    expect(a.engine.snapshot().flag).toBe(b.engine.snapshot().flag);
  });

  it('meldet nach dem Ende nichts mehr', () => {
    const { type } = setup();
    type('mkdir projekt');
    type('echo x > projekt\\notiz.txt');
    expect(type('dir')).toBe('');
  });

  it('ruft onChange bei Fortschritt und Tipps auf', () => {
    const { type, onChange } = setup();
    type('mission hint');
    type('mkdir projekt');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0][0]).toMatchObject({ hintLevel: 1 });
    expect(onChange.mock.calls[1][0]).toMatchObject({ stepIndex: 1, hintLevel: 0 });
  });

  describe('Befehl mission', () => {
    it('ist ohne Argument und mit unbekanntem Argument eine Kurzhilfe und läuft nicht im System', () => {
      const { type, sys } = setup();
      expect(type('mission')).toContain('Verwendung: mission status');
      expect(type('mission foo')).toContain('Verwendung');
      expect(sys.getLog()).toHaveLength(0);
    });

    it('status nennt Mission, Schritt und Beschreibung', () => {
      const { type } = setup();
      expect(type('mission status')).toBe(
        'Testmission · Schritt 1/2: Ordner anlegen\nLege projekt an.'
      );
      expect(type('MISSION STATUS')).toContain('Schritt 1/2');
    });

    it('hint liefert gestufte Tipps und setzt sie je Schritt zurück', () => {
      const { type } = setup();
      expect(type('mission hint')).toBe('Tipp 1/2: Tipp A1');
      expect(type('mission hint')).toBe('Tipp 2/2: Tipp A2');
      expect(type('mission hint')).toContain('Keine weiteren Tipps');
      type('mkdir projekt');
      expect(type('mission hint')).toBe('Tipp 1/1: Tipp B1');
    });

    it('check meldet den Misserfolg knapp und den Erfolg mit Fortschritt', () => {
      const { engine, type, sys } = setup();
      expect(type('mission check')).toBe('projekt fehlt noch.');
      sys.processCommand('mkdir projekt');
      const reply = type('mission check');
      expect(reply).toContain('Schritt 1/2 erfüllt');
      expect(engine.snapshot().stepIndex).toBe(1);
      expect(type('mission check')).toContain('Noch nicht erfüllt');
    });

    it('solve fragt nach, zeigt die Lösung nur bei j und markiert die Flagge mit Lösung', () => {
      const { engine, type } = setup();
      expect(type('mission solve')).toContain('[j/N]');
      expect(type('n')).toBe('Abgebrochen.');
      expect(engine.snapshot().withSolution).toBe(false);

      type('mission solve');
      expect(type('j')).toContain('mkdir projekt');
      expect(engine.snapshot().withSolution).toBe(true);

      type('mkdir projekt');
      type('echo x > projekt\\notiz.txt');
      expect(engine.snapshot().flag).toMatch(FLAG_PATTERN);
      expect(type('mission status')).toContain('Flagge:');
    });

    it('verbraucht die Antwort auf die Rückfrage, auch wenn sie kein j ist', () => {
      const { sys, type } = setup();
      type('mission solve');
      expect(type('mkdir projekt')).toBe('Abgebrochen.');
      expect(sys.isDir('projekt')).toBe(false);
    });

    it('speichert withSolution im Store', () => {
      const store = createMissionStore({ getItem: () => null, setItem: vi.fn() });
      const complete = vi.spyOn(store, 'complete');
      const { type } = setup({ store });
      type('mission solve');
      type('ja');
      type('mkdir projekt');
      type('echo x > projekt\\notiz.txt');
      expect(complete.mock.calls[0][1].withSolution).toBe(true);
    });

    it('flag gibt es erst nach der Mission', () => {
      const { engine, type } = setup();
      expect(type('mission flag')).toBe('Noch keine Flagge. Schritt 1/2 ist offen.');
      type('mkdir projekt');
      type('echo x > projekt\\notiz.txt');
      expect(type('mission flag')).toBe(engine.snapshot().flag);
    });

    it('hint, check und solve sind nach der Mission harmlos', () => {
      const { type } = setup();
      type('mkdir projekt');
      type('echo x > projekt\\notiz.txt');
      expect(type('mission hint')).toContain('keine Tipps nötig');
      expect(type('mission solve')).toBe('Mission geschafft.');
      expect(type('mission check')).toContain('geschafft');
    });
  });
});
