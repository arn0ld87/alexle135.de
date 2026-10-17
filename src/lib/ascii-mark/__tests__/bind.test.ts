import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAsciiMark, type BindOptions } from '../bind';
import { LABEL_START, type Rotation, STATUS_PAUSED, STATUS_RUNNING } from '../rotate';
import * as mark from '../mark';

/**
 * Bindung der Bildmarke ohne Browser: die Medienabfrage, der Leerlauf-Rückruf, die Zeitgeber
 * und der Lader des Drehmoduls kommen als Optionen herein. Geprüft werden reduzierte Bewegung,
 * der Zeitpunkt des Ladens, Idempotenz, Wechsel zur Laufzeit, das Verwerfen eines bereits
 * geplanten Starts, der Generationszähler beim Aufräumen und der stille Fehlerfall — dazu der
 * Schalter, der allen gehört, und das Ziehen, das auch bei reduzierter Bewegung arbeitet.
 */

interface RotateModule {
  start: (root: HTMLElement) => Rotation;
}

interface FakeMedia extends MediaQueryList {
  set: (matches: boolean) => void;
}

/** Ein geplanter Rückruf mit seinem Handle, damit das Stornieren nachvollziehbar bleibt. */
interface Queued {
  handle: number;
  callback: () => void;
}

function makeMedia(initial: boolean): FakeMedia {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches: initial,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    set(matches: boolean) {
      media.matches = matches;
      for (const listener of [...listeners]) listener({ matches } as MediaQueryListEvent);
    },
  };
  return media as unknown as FakeMedia;
}

/** Die gesteuerten Animationsframes, damit das Ziehen im Test Zeit bekommt. */
const frames = new Map<number, (time: number) => void>();
let nextFrameId = 1;
let clock = 0;

function tick(): boolean {
  const entry = frames.entries().next();
  if (entry.done) return false;
  const [id, callback] = entry.value;
  frames.delete(id);
  clock += 20;
  callback(clock);
  return true;
}

function runTicks(count: number): void {
  for (let index = 0; index < count; index += 1) if (!tick()) break;
}

function useAnimatedFrames(): void {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: (time: number) => void) => {
      const id = nextFrameId;
      nextFrameId += 1;
      frames.set(id, callback);
      return id;
    })
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => {
      frames.delete(id);
    })
  );
}

interface Harness {
  root: HTMLElement;
  surface: HTMLElement;
  pause: HTMLButtonElement;
  label: HTMLElement;
  status: HTMLElement;
  body: HTMLElement;
  loadCalls: number[];
  started: HTMLElement[];
  stopped: number[];
  idle: () => void;
  timers: () => void;
  resolveLoad: () => void;
  rejectLoad: () => void;
  media: FakeMedia;
  options: (over?: Partial<BindOptions>) => BindOptions;
}

function makeHarness(): Harness {
  document.body.innerHTML = `
    <div data-ascii-mark>
      <div data-ascii-surface>
        <pre data-ascii-layer="body">${mark.BODY.join('\n')}</pre>
        <pre data-ascii-layer="wedge">${mark.WEDGE.join('\n')}</pre>
      </div>
      <span data-ascii-status>STANDBILD</span>
      <button type="button" data-ascii-pause hidden aria-pressed="false"><span data-ascii-label>Drehung anhalten</span></button>
    </div>`;
  const root = document.querySelector<HTMLElement>('[data-ascii-mark]')!;
  const media = makeMedia(false);
  const loadCalls: number[] = [];
  const started: HTMLElement[] = [];
  const stopped: number[] = [];
  const idleQueue: Queued[] = [];
  const timerQueue: Queued[] = [];
  const cancelledIdle = new Set<number>();
  const cancelledTimers = new Set<number>();
  let idleSeq = 0;
  let timerSeq = 0;
  let settle: { resolve: () => void; reject: () => void } | null = null;

  const module: RotateModule = {
    start(element: HTMLElement) {
      started.push(element);
      const index = started.length;
      const noop = () => {};
      return {
        stop: () => stopped.push(index),
        setRunning: noop,
        hold: noop,
        nudge: noop,
        release: noop,
      };
    },
  };

  const load = () => {
    loadCalls.push(loadCalls.length + 1);
    return new Promise<RotateModule>((resolve, reject) => {
      settle = { resolve: () => resolve(module), reject: () => reject(new Error('kaputt')) };
    });
  };

  const harness: Harness = {
    root,
    surface: root.querySelector<HTMLElement>('[data-ascii-surface]')!,
    pause: root.querySelector<HTMLButtonElement>('[data-ascii-pause]')!,
    label: root.querySelector<HTMLElement>('[data-ascii-label]')!,
    status: root.querySelector<HTMLElement>('[data-ascii-status]')!,
    body: root.querySelector<HTMLElement>('[data-ascii-layer="body"]')!,
    loadCalls,
    started,
    stopped,
    media,
    // Stornierte Rückrufe werden nicht gefeuert — wie im Browser nach cancelIdleCallback
    // bzw. clearTimeout.
    idle: () => {
      for (const item of idleQueue.splice(0)) {
        if (!cancelledIdle.has(item.handle)) item.callback();
      }
    },
    timers: () => {
      for (const item of timerQueue.splice(0)) {
        if (!cancelledTimers.has(item.handle)) item.callback();
      }
    },
    resolveLoad: () => settle?.resolve(),
    rejectLoad: () => settle?.reject(),
    options: (over = {}) => ({
      load,
      matchMedia: () => media,
      requestIdleCallback: (callback) => {
        idleSeq += 1;
        idleQueue.push({ handle: idleSeq, callback });
        return idleSeq;
      },
      cancelIdleCallback: (handle) => {
        cancelledIdle.add(handle);
      },
      setTimeout: (callback) => {
        timerSeq += 1;
        timerQueue.push({ handle: timerSeq, callback });
        return timerSeq;
      },
      clearTimeout: (handle) => {
        cancelledTimers.add(handle);
      },
      ...over,
    }),
  };
  return harness;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const cleanups: (() => void)[] = [];

function bind(harness: Harness, over: Partial<BindOptions> = {}): () => void {
  const cleanup = bindAsciiMark(harness.root, harness.options(over));
  cleanups.push(cleanup);
  return cleanup;
}

/** Bindet die Bildmarke an das echte Drehmodul, damit das Ziehen wirklich rechnet. */
function bindLive(harness: Harness, over: Partial<BindOptions> = {}): () => void {
  return bind(harness, {
    load: () => {
      harness.loadCalls.push(harness.loadCalls.length + 1);
      return import('../rotate');
    },
    ...over,
  });
}

function pointer(type: string, clientX: number): MouseEvent {
  return new MouseEvent(type, { clientX, bubbles: true, cancelable: true });
}

beforeEach(() => {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  );
  frames.clear();
  nextFrameId = 1;
  clock = 0;
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('bindAsciiMark: reduzierte Bewegung', () => {
  it('lädt das Drehmodul nie und lässt den Status auf STANDBILD', async () => {
    const harness = makeHarness();
    harness.media.matches = true;
    bind(harness);
    harness.idle();
    harness.timers();
    await flush();

    expect(harness.loadCalls).toEqual([]);
    expect(harness.started).toEqual([]);
    expect(harness.status.textContent).toBe('STANDBILD');
    expect(harness.root.dataset.initialized).toBe('true');
  });
});

describe('bindAsciiMark: Laden nach dem Laden des Dokuments', () => {
  it('lädt erst im Leerlauf und startet, sobald der Lader aufgelöst ist', async () => {
    const harness = makeHarness();
    bind(harness);
    await flush();
    // Vor dem Leerlauf-Rückruf wird nichts geladen.
    expect(harness.loadCalls).toEqual([]);

    harness.idle();
    await flush();
    expect(harness.loadCalls).toHaveLength(1);
    // Geladen, aber noch nicht gestartet: erst der aufgelöste Lader startet die Drehung.
    expect(harness.started).toEqual([]);

    harness.resolveLoad();
    await flush();
    expect(harness.started).toEqual([harness.root]);
  });

  it('wartet bei noch laufendem Laden auf das Ereignis load', async () => {
    const harness = makeHarness();
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
    bind(harness);
    harness.idle();
    await flush();
    expect(harness.loadCalls).toEqual([]);

    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
    window.dispatchEvent(new Event('load'));
    harness.idle();
    await flush();
    harness.resolveLoad();
    await flush();
    expect(harness.started).toEqual([harness.root]);
  });

  it('greift ohne Leerlauf-Rückruf auf einen Zeitgeber zurück', async () => {
    const harness = makeHarness();
    bind(harness, { requestIdleCallback: null });
    await flush();
    expect(harness.loadCalls).toEqual([]);

    harness.timers();
    await flush();
    harness.resolveLoad();
    await flush();
    expect(harness.started).toEqual([harness.root]);
  });
});

describe('bindAsciiMark: Idempotenz und Wechsel zur Laufzeit', () => {
  it('lädt und startet beim zweiten Binden nur einmal', async () => {
    const harness = makeHarness();
    bind(harness);
    bind(harness);
    harness.idle();
    await flush();
    harness.resolveLoad();
    await flush();

    expect(harness.loadCalls).toHaveLength(1);
    expect(harness.started).toHaveLength(1);
  });

  it('stoppt beim Wechsel auf reduzierte Bewegung und plant danach neu', async () => {
    const harness = makeHarness();
    bind(harness);
    harness.idle();
    await flush();
    harness.resolveLoad();
    await flush();
    expect(harness.started).toHaveLength(1);

    harness.media.set(true);
    expect(harness.stopped).toEqual([1]);

    harness.media.set(false);
    harness.idle();
    await flush();
    harness.resolveLoad();
    await flush();
    expect(harness.loadCalls).toHaveLength(2);
    expect(harness.started).toHaveLength(2);
    expect(harness.started[1]).toBe(harness.root);
  });
});

describe('bindAsciiMark: verworfener geplanter Start', () => {
  it('verwirft den geplanten Leerlauf-Rückruf, wenn vor dem Feuern reduziert wird', async () => {
    const harness = makeHarness();
    bind(harness);
    await flush();
    // Geplant, aber noch nicht gefeuert: bis hierher wurde nichts geladen.
    expect(harness.loadCalls).toEqual([]);

    harness.media.set(true);
    harness.idle();
    harness.timers();
    harness.resolveLoad();
    await flush();

    expect(harness.loadCalls).toEqual([]);
    expect(harness.started).toEqual([]);
  });

  it('verwirft den geplanten Zeitgeber-Rückruf, wenn vor dem Feuern reduziert wird', async () => {
    const harness = makeHarness();
    bind(harness, { requestIdleCallback: null });
    await flush();
    expect(harness.loadCalls).toEqual([]);

    harness.media.set(true);
    harness.timers();
    harness.idle();
    harness.resolveLoad();
    await flush();

    expect(harness.loadCalls).toEqual([]);
    expect(harness.started).toEqual([]);
  });

  it('prüft die Lage vor dem Start nach, wenn der Browser kein Storno kennt', async () => {
    const harness = makeHarness();
    bind(harness, { cancelIdleCallback: null });
    await flush();
    expect(harness.loadCalls).toEqual([]);

    harness.media.set(true);
    harness.idle();
    harness.resolveLoad();
    await flush();

    expect(harness.loadCalls).toEqual([]);
    expect(harness.started).toEqual([]);
  });
});

describe('bindAsciiMark: Aufräumen und Fehlerfall', () => {
  it('verhindert den Start, wenn vor dem Auflösen aufgeräumt wird', async () => {
    const harness = makeHarness();
    const cleanup = bind(harness);
    harness.idle();
    await flush();
    expect(harness.loadCalls).toHaveLength(1);

    cleanup();
    harness.resolveLoad();
    await flush();

    expect(harness.started).toEqual([]);
    expect(harness.root.dataset.initialized).toBeUndefined();
  });

  it('stoppt und räumt auf, wenn nach dem Start aufgeräumt wird', async () => {
    const harness = makeHarness();
    const cleanup = bind(harness);
    harness.idle();
    await flush();
    harness.resolveLoad();
    await flush();
    expect(harness.started).toHaveLength(1);

    cleanup();
    expect(harness.stopped).toEqual([1]);
    expect(harness.root.dataset.initialized).toBeUndefined();
  });

  it('verwirft den geplanten Start beim Aufräumen auch ohne Idle-Storno', async () => {
    // Kennt der Browser kein `cancelIdleCallback`, kann `halt()` den bereits geplanten
    // Rückruf nicht mehr zurückziehen. Der Rückruf muss deshalb selbst erkennen, dass
    // aufgeräumt wurde — sonst startet `rotate.start()` auf dem abgehängten Rahmen einen
    // rAF-Zyklus, den nichts mehr beendet.
    const harness = makeHarness();
    const cleanup = bind(harness, { cancelIdleCallback: null });
    await flush();
    expect(harness.loadCalls).toEqual([]);

    cleanup();
    harness.idle();
    await flush();

    expect(harness.loadCalls).toEqual([]);
    expect(harness.started).toEqual([]);
  });

  it('bleibt beim gescheiterten Laden still', async () => {
    const harness = makeHarness();
    bind(harness);
    harness.idle();
    await flush();
    harness.rejectLoad();
    await flush();

    expect(harness.started).toEqual([]);
    expect(harness.status.textContent).toBe('STANDBILD');
  });
});

describe('bindAsciiMark: Schalter', () => {
  it('blendet ihn beim Binden ein und beschriftet ihn, ohne das Drehmodul zu laden', async () => {
    const harness = makeHarness();
    bind(harness);
    await flush();

    expect(harness.pause.hidden).toBe(false);
    expect(harness.label.textContent).toBe(LABEL_START);
    expect(harness.pause.getAttribute('aria-pressed')).toBe('true');
    expect(harness.loadCalls).toEqual([]);
  });

  it('verbirgt ihn beim Aufräumen wieder', async () => {
    const harness = makeHarness();
    const cleanup = bind(harness);
    cleanup();
    expect(harness.pause.hidden).toBe(true);
  });

  it('lädt das Drehmodul bei reduzierter Bewegung erst auf Klick und folgt dann dem Zustand', async () => {
    const harness = makeHarness();
    harness.media.matches = true;
    bindLive(harness);
    harness.idle();
    harness.timers();
    await flush();
    expect(harness.loadCalls).toEqual([]);
    expect(harness.status.textContent).toBe('STANDBILD');
    expect(harness.label.textContent).toBe(LABEL_START);

    harness.pause.click();
    await flush();
    expect(harness.loadCalls).toHaveLength(1);
    expect(harness.status.textContent).toBe(STATUS_RUNNING);
    expect(harness.label.textContent).not.toBe(LABEL_START);
    expect(harness.pause.getAttribute('aria-pressed')).toBe('false');

    harness.pause.click();
    expect(harness.status.textContent).toBe(STATUS_PAUSED);
    expect(harness.pause.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('bindAsciiMark: Ziehen', () => {
  it('dreht die Bildmarke, hält die eigene Drehung an und rührt nichts ohne JavaScript-Aktion', async () => {
    const harness = makeHarness();
    useAnimatedFrames();
    const cleanup = bindLive(harness);
    await flush();

    harness.surface.dispatchEvent(pointer('pointerdown', 100));
    await flush();
    expect(harness.loadCalls).toHaveLength(1);
    tick();
    expect(harness.body.firstChild?.textContent).toBe(mark.BODY.join('\n'));

    const surface = harness.surface;
    surface.dispatchEvent(pointer('pointermove', 140));
    runTicks(5);
    expect(harness.body.firstChild?.textContent).not.toBe(mark.BODY.join('\n'));

    // Ohne weitere Zeigerbewegung steht der Winkel: die eigene Drehung ist angehalten, der
    // Nachlauf ist abgeklungen.
    const dragged = harness.body.firstChild?.textContent;
    runTicks(120);
    expect(harness.body.firstChild?.textContent).toBe(dragged);

    surface.dispatchEvent(pointer('pointerup', 140));
    expect(surface.classList.contains('is-dragging')).toBe(false);

    // Nach dem Aufräumen hängt kein Zeiger-Listener mehr: ein neuer Zeigerdown lädt nichts.
    cleanup();
    const before = harness.loadCalls.length;
    surface.dispatchEvent(pointer('pointerdown', 10));
    surface.dispatchEvent(pointer('pointermove', 60));
    await flush();
    expect(harness.loadCalls).toHaveLength(before);
    expect(surface.classList.contains('is-dragging')).toBe(false);
  });

  it('setzt nach dem Loslassen die eigene Drehung in Gang und nach Ruhe wieder fort', async () => {
    const harness = makeHarness();
    useAnimatedFrames();
    bindLive(harness);
    await flush();

    harness.surface.dispatchEvent(pointer('pointerdown', 100));
    await flush();
    tick();
    harness.surface.dispatchEvent(pointer('pointermove', 130));
    runTicks(5);
    const held = harness.body.firstChild?.textContent;
    expect(held, 'das Ziehen hat den Winkel verschoben').not.toBe(mark.BODY.join('\n'));

    runTicks(20);
    expect(harness.body.firstChild?.textContent, 'während des Ziehens').toBe(held);

    harness.surface.dispatchEvent(pointer('pointerup', 130));
    runTicks(5);
    expect(harness.body.firstChild?.textContent, 'Nachlauf nach dem Loslassen').not.toBe(held);

    // Nach SETTLE_MS Ruhe dreht sie wieder von allein, ganz ohne Zeiger.
    runTicks(80);
    const settled = harness.body.firstChild?.textContent;
    runTicks(40);
    expect(harness.body.firstChild?.textContent, 'eigene Drehung nach der Ruhe').not.toBe(settled);
  });

  it('zieht auch bei reduzierter Bewegung, ohne die eigene Drehung einzuschalten', async () => {
    const harness = makeHarness();
    harness.media.matches = true;
    useAnimatedFrames();
    bindLive(harness);
    await flush();
    expect(harness.loadCalls).toEqual([]);

    harness.surface.dispatchEvent(pointer('pointerdown', 100));
    await flush();
    expect(harness.loadCalls, 'das Ziehen lädt das Modul').toHaveLength(1);
    expect(harness.status.textContent).toBe(STATUS_PAUSED);

    tick();
    harness.surface.dispatchEvent(pointer('pointermove', 160));
    runTicks(5);
    const dragged = harness.body.firstChild?.textContent;
    expect(dragged, 'das Ziehen bewegt die Bildmarke').not.toBe(mark.BODY.join('\n'));

    // Ohne Zeiger bewegt sich nichts: die eigene Drehung bleibt aus.
    harness.surface.dispatchEvent(pointer('pointerup', 160));
    runTicks(200);
    expect(harness.body.firstChild?.textContent).toBe(dragged);
  });
});

describe('bindAsciiMark: Quelltext', () => {
  const sources = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__' || /\.(test|spec)\./.test(entry.name)) continue;
      const child = join(dir, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (/\.(ts|tsx|astro|js|mjs)$/.test(entry.name)) {
        sources.set(child, readFileSync(child, 'utf8'));
      }
    }
  };
  walk(join(process.cwd(), 'src'));

  it('importiert das Drehmodul in keiner Datei unter src/ statisch', () => {
    expect(sources.size).toBeGreaterThan(20);
    for (const [file, text] of sources) {
      const staticImport = /(?:^|\n)\s*import\s+(?:[^'"\n]*from\s*)?['"][^'"]*\/rotate['"]/.test(
        text
      );
      expect(staticImport, `statischer Import in ${file}`).toBe(false);
    }
  });

  it('nennt das Drehmodul genau einmal, in bind.ts und nur per dynamischem Import', () => {
    const hits: string[] = [];
    for (const [file, text] of sources) {
      const found = text.match(/import\(\s*['"][^'"]*\/rotate['"]\s*\)/g);
      if (found) hits.push(file);
    }
    expect(hits).toHaveLength(1);
    expect(hits[0].endsWith('/ascii-mark/bind.ts')).toBe(true);
  });

  it('setzt in den Dateien der Bildmarke nie Markup zusammen', () => {
    const files = [
      'src/components/home/AsciiMark.astro',
      'src/lib/ascii-mark/bind.ts',
      'src/lib/ascii-mark/project.ts',
      'src/lib/ascii-mark/rotate.ts',
    ];
    for (const relative of files) {
      const text = readFileSync(join(process.cwd(), relative), 'utf8');
      for (const banned of [
        'innerHTML',
        'outerHTML',
        'insertAdjacentHTML',
        'set:html',
        'eval(',
        'new Function',
      ]) {
        expect(text.includes(banned), `${relative} nennt ${banned}`).toBe(false);
      }
    }
  });

  it('hält den Text des Schalters mit dem Drehmodul deckungsgleich', () => {
    // `bind.ts` darf `rotate.ts` nicht importieren; die Beschriftung steht deshalb dort als
    // Zeichenfolge und muss mit LABEL_START übereinstimmen.
    const text = readFileSync(join(process.cwd(), 'src/lib/ascii-mark/bind.ts'), 'utf8');
    expect(text.includes(`'${LABEL_START}'`), `bind.ts nennt ${LABEL_START} nicht`).toBe(true);
  });
});
