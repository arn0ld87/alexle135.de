import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FRAME_MS,
  LABEL_RESUME,
  LABEL_START,
  LABEL_STOP,
  type Rotation,
  SETTLE_MS,
  STATUS_PAUSED,
  STATUS_RUNNING,
  STATUS_STILL,
  TURN_MS,
  start,
} from '../rotate';
import { projectFrame } from '../project';
import * as mark from '../mark';

/**
 * Laufzeit der Drehung ohne Browser: gesteuerte Animationsframes, ein Stellvertreter für
 * den IntersectionObserver und ein gesteuertes `document.hidden`. Geprüft werden Drosselung,
 * Pause außer Sicht und bei verborgenem Tab, der Schalter und das Ziehen — `hold`, `nudge`
 * und `release` — mit seinem Nachlauf und dem Wiederanlauf nach `SETTLE_MS` Ruhe.
 */

type Frame = (time: number) => void;

const BODY_TEXT = mark.BODY.join('\n');
const WEDGE_TEXT = mark.WEDGE.join('\n');
/** Schrittweite der gesteuerten Uhr; ein Vielfaches von `FRAME_MS` wäre zu grob. */
const STEP_MS = 20;

let frames = new Map<number, Frame>();
let nextFrameId = 1;
let clock = 0;
let observers: FakeIntersectionObserver[];
const started: Rotation[] = [];

class FakeIntersectionObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(public callback: (entries: { isIntersecting: boolean }[]) => void) {
    observers.push(this);
  }
  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

interface Scene {
  root: HTMLElement;
  body: HTMLElement;
  wedge: HTMLElement;
  status: HTMLElement;
  pause: HTMLButtonElement;
  label: HTMLElement;
}

function buildScene({ withParts = true } = {}): Scene {
  document.body.innerHTML = `
    <div data-ascii-mark>
      <pre data-ascii-layer="body">${BODY_TEXT}</pre>
      <pre data-ascii-layer="wedge">${WEDGE_TEXT}</pre>
      ${withParts ? '<span data-ascii-status>STANDBILD</span><button type="button" data-ascii-pause hidden aria-pressed="false"><span data-ascii-label>Drehung anhalten</span></button>' : ''}
    </div>`;
  return {
    root: document.querySelector<HTMLElement>('[data-ascii-mark]')!,
    body: document.querySelector<HTMLElement>('[data-ascii-layer="body"]')!,
    wedge: document.querySelector<HTMLElement>('[data-ascii-layer="wedge"]')!,
    status: document.querySelector<HTMLElement>('[data-ascii-status]')!,
    pause: document.querySelector<HTMLButtonElement>('[data-ascii-pause]')!,
    label: document.querySelector<HTMLElement>('[data-ascii-label]')!,
  };
}

function run(scene: Scene): Rotation {
  const rotation = start(scene.root);
  started.push(rotation);
  return rotation;
}

/** Führt den nächsten anstehenden Frame aus; liefert false, wenn keiner ansteht. */
function tick(): boolean {
  const entry = frames.entries().next();
  if (entry.done) return false;
  const [id, callback] = entry.value;
  frames.delete(id);
  clock += STEP_MS;
  callback(clock);
  return true;
}

function runTicks(count: number) {
  for (let index = 0; index < count; index += 1) {
    if (!tick()) break;
  }
}

function textOf(element: HTMLElement): string {
  return element.firstChild?.textContent ?? '';
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  clock = 0;
  observers = [];
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: Frame) => {
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
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

afterEach(() => {
  for (const rotation of started.splice(0)) rotation.stop();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('start: Drosselung', () => {
  it('schreibt erst mit einem Bild, das mindestens FRAME_MS nach dem letzten liegt', () => {
    const scene = buildScene();
    run(scene);
    expect(frames.size).toBe(1);

    // Frames 1 bis 4 liegen enger als FRAME_MS beieinander: der Text bleibt stehen.
    for (let index = 0; index < 4; index += 1) {
      tick();
      expect(textOf(scene.body), `Frame ${index + 1}`).toBe(BODY_TEXT);
    }

    // Das Bild weicht erst ab rund 240 ms sichtbar vom Standbild ab; geschrieben wird
    // trotzdem höchstens alle FRAME_MS, weil `lastWrite` nur bei einer Änderung weiterrückt.
    runTicks(20);
    expect(textOf(scene.body)).not.toBe(BODY_TEXT);
  });

  it('zeigt nach der halben Umdrehung das Bild bei Winkel π', () => {
    const scene = buildScene();
    run(scene);
    // Erster Frame setzt den Anfangspunkt; danach trägt jeder Frame 20 ms bei.
    runTicks(1 + TURN_MS / 2 / STEP_MS);

    const half = projectFrame(mark, Math.PI);
    expect(textOf(scene.body)).toBe(half.body);
    expect(textOf(scene.wedge)).toBe(half.wedge);
  });

  it('hält höchstens 14 Bilder je Sekunde ein', () => {
    expect(FRAME_MS).toBeCloseTo(1000 / 14, 6);
    expect(TURN_MS).toBe(12000);
  });
});

describe('start: Pause außer Sicht und bei verborgenem Tab', () => {
  it('fordert außer Sicht keinen Frame an und läuft danach ohne Sprung weiter', () => {
    const scene = buildScene();
    run(scene);
    runTicks(40);
    const before = textOf(scene.body);

    observers[0].trigger(false);
    expect(frames.size).toBe(0);
    expect(tick()).toBe(false);
    expect(textOf(scene.body)).toBe(before);

    observers[0].trigger(true);
    expect(frames.size).toBe(1);
    tick();
    // Der erste Frame nach der Pause trägt keine Zeit bei: kein Sprung im Bild.
    expect(textOf(scene.body)).toBe(before);
  });

  it('fordert bei verborgenem Tab keinen Frame an und läuft danach weiter', () => {
    const scene = buildScene();
    setDocumentHidden(true);
    run(scene);
    expect(frames.size).toBe(0);
    expect(tick()).toBe(false);

    setDocumentHidden(false);
    expect(frames.size).toBe(1);
    runTicks(40);
    expect(textOf(scene.body)).not.toBe(BODY_TEXT);
  });
});

describe('start: Ziehen', () => {
  it('hält beim Anfassen an, sodass kein Bild den Winkel weiterdreht', () => {
    const scene = buildScene();
    const rotation = run(scene);
    tick();
    runTicks(40);
    const held = textOf(scene.body);
    expect(held).not.toBe(BODY_TEXT);

    rotation.hold();
    runTicks(30);
    expect(textOf(scene.body), 'Text während des Haltens').toBe(held);
  });

  it('verschiebt den Winkel um die übergebene Strecke', () => {
    const scene = buildScene();
    const rotation = run(scene);
    tick();
    expect(textOf(scene.body)).toBe(BODY_TEXT);

    rotation.hold();
    rotation.nudge(0.5);
    runTicks(5);
    expect(textOf(scene.body)).toBe(projectFrame(mark, 0.5).body);
    expect(textOf(scene.wedge)).toBe(projectFrame(mark, 0.5).wedge);
  });

  it('trägt den Winkel nach dem Loslassen im Nachlauf weiter', () => {
    const scene = buildScene();
    const rotation = run(scene);
    tick();
    rotation.hold();
    rotation.nudge(0.2);
    runTicks(5);
    const released = textOf(scene.body);

    rotation.release();
    runTicks(5);
    const coasted = textOf(scene.body);
    expect(coasted, 'Nachlauf nach dem Loslassen').not.toBe(released);
    expect(coasted).not.toBe(BODY_TEXT);
  });

  it('setzt nach SETTLE_MS Ruhe die eigene Drehung wieder ein', () => {
    const scene = buildScene();
    const rotation = run(scene);
    tick();
    // Ohne Stoß: der Winkel steht, bis die Ruhezeit abgelaufen ist.
    rotation.hold();
    rotation.release();

    runTicks(SETTLE_MS / STEP_MS - 10);
    const still = textOf(scene.body);
    expect(still, 'Standbild während der Ruhezeit').toBe(BODY_TEXT);

    runTicks(10);
    expect(textOf(scene.body), 'noch vor dem Ende der Ruhezeit').toBe(still);

    runTicks(40);
    expect(textOf(scene.body), 'nach SETTLE_MS Ruhe').not.toBe(still);
  });
});

describe('start: Schalter „Drehung anhalten“', () => {
  it('hält an, zeigt das Standbild und setzt beim zweiten Klick bei Winkel 0 fort', () => {
    const scene = buildScene();
    run(scene);
    runTicks(40);
    expect(textOf(scene.body)).not.toBe(BODY_TEXT);

    scene.pause.click();
    expect(scene.pause.getAttribute('aria-pressed')).toBe('true');
    expect(scene.label.textContent).toBe(LABEL_RESUME);
    expect(textOf(scene.body)).toBe(BODY_TEXT);
    expect(textOf(scene.wedge)).toBe(WEDGE_TEXT);
    expect(scene.status.textContent).toBe(STATUS_PAUSED);
    expect(frames.size).toBe(0);

    scene.pause.click();
    expect(scene.pause.getAttribute('aria-pressed')).toBe('false');
    expect(scene.label.textContent).toBe(LABEL_STOP);
    expect(scene.status.textContent).toBe(STATUS_RUNNING);
    expect(frames.size).toBe(1);
    expect(textOf(scene.body)).toBe(BODY_TEXT);
    runTicks(40);
    expect(textOf(scene.body), 'Drehung ab Winkel 0').not.toBe(BODY_TEXT);
  });
});

describe('start: Zustand und Aufräumen', () => {
  it('zeigt beim Start Status, Beschriftung und Zustand, ohne den Schalter selbst einzublenden', () => {
    const scene = buildScene();
    run(scene);
    expect(scene.status.textContent).toBe(STATUS_RUNNING);
    expect(scene.label.textContent).toBe(LABEL_STOP);
    expect(scene.pause.getAttribute('aria-pressed')).toBe('false');
    expect(scene.root.dataset.state).toBe('running');
    // Das Einblenden ist Sache der Bindung; das Drehmodul lässt `hidden` unangetastet.
    expect(scene.pause.hidden).toBe(true);
  });

  it('räumt vollständig auf und lässt sich zweimal aufrufen', () => {
    const scene = buildScene();
    const rotation = run(scene);
    runTicks(40);
    expect(frames.size).toBe(1);

    rotation.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(textOf(scene.body)).toBe(BODY_TEXT);
    expect(textOf(scene.wedge)).toBe(WEDGE_TEXT);
    expect(scene.status.textContent).toBe(STATUS_STILL);
    expect(scene.label.textContent).toBe(LABEL_START);
    expect(scene.pause.getAttribute('aria-pressed')).toBe('true');
    expect(scene.pause.hidden).toBe(true);
    expect(scene.root.dataset.state).toBe('still');

    scene.pause.click();
    expect(scene.pause.getAttribute('aria-pressed')).toBe('true');
    setDocumentHidden(true);
    setDocumentHidden(false);
    expect(frames.size).toBe(0);

    expect(() => rotation.stop()).not.toThrow();
    expect(scene.status.textContent).toBe(STATUS_STILL);
  });

  it('schreibt nur in den vorhandenen Textknoten', () => {
    const scene = buildScene();
    const bodyNode = scene.body.firstChild;
    const wedgeNode = scene.wedge.firstChild;
    run(scene);
    runTicks(400);

    expect(scene.body.childNodes).toHaveLength(1);
    expect(scene.wedge.childNodes).toHaveLength(1);
    expect(scene.body.firstChild).toBe(bodyNode);
    expect(scene.wedge.firstChild).toBe(wedgeNode);
  });

  it('gibt bei fehlenden Teilen eine wirkungslose Drehung zurück', () => {
    const scene = buildScene({ withParts: false });
    const rotation = start(scene.root);
    expect(frames.size).toBe(0);
    expect(() => rotation.stop()).not.toThrow();
    expect(() => rotation.hold()).not.toThrow();
    expect(() => rotation.nudge(1)).not.toThrow();
    expect(() => rotation.release()).not.toThrow();
    expect(() => rotation.setRunning(false)).not.toThrow();
    expect(() => rotation.stop()).not.toThrow();
  });
});
