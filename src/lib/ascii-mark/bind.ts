/**
 * Bindung der Bildmarke (Plan 02-18.1, D-48, D-49).
 *
 * Lädt das Drehmodul nach dem Laden des Dokuments und im Leerlauf nach; bei reduzierter
 * Bewegung wird es dabei nie geladen. Die einzige Stelle, die den Pfad des Drehmoduls nennt,
 * ist der dynamische Import unten — `rotate.ts` wird nirgends statisch importiert
 * (Mobile-Performance, PERF-01). Ein gescheiterter Import bleibt still beim Standbild.
 *
 * Dieses Modul bindet außerdem das Ziehen (Pointer Events auf der Fläche) und blendet den
 * Schalter ein: beides gehört allen, auch bei reduzierter Bewegung — Ziehen ist eine eigene
 * Handlung, und die selbsttätige Drehung bleibt bei reduzierter Bewegung trotzdem aus. Das
 * Drehmodul wird für das Ziehen erst beim Anfassen nachgeladen, nie im Leerlauf für Leute,
 * die es nie einschalten.
 *
 * Idempotenz über `dataset.initialized`; ein Generationszähler verhindert den Start, wenn
 * vor dem Auflösen des Laders aufgeräumt wurde. Ein bereits geplanter, aber noch nicht
 * gefeuerter Start wird bei jeder Änderung der Lage storniert; kennt der Browser kein
 * `cancelIdleCallback`, verwirft sich der geplante Rückruf über denselben Generationszähler
 * selbst. Die Bindung folgt dem Muster aus `src/lib/home/previewDialog.ts`: Aufräumfunktion
 * zurückgeben, Aufruf in `astro:page-load`.
 */

/** Die Griffe des Drehmoduls, so wie `./rotate` sie ausgibt. */
interface Rotation {
  stop: () => void;
  setRunning: (running: boolean) => void;
  hold: () => void;
  nudge: (delta: number) => void;
  release: () => void;
}

/** Form des Drehmoduls, so wie `./rotate` sie ausgibt. */
interface RotateRuntime {
  start: (root: HTMLElement) => Rotation;
}

/** Leerlauf-Rückruf mit Frist; fehlt er im Browser, greift der Zeitgeber-Rückfall. */
type IdleScheduler = (callback: () => void, options?: { timeout: number }) => number;

/** Storniert einen bereits geplanten Leerlauf-Rückruf. */
type IdleCanceller = (handle: number) => void;

export interface BindOptions {
  /** Lader des Drehmoduls; im Test ersetzt. */
  load?: () => Promise<RotateRuntime>;
  /** Medienabfrage; im Test ersetzt. */
  matchMedia?: (query: string) => MediaQueryList;
  /** Leerlauf-Rückruf; `null` erzwingt den Zeitgeber-Rückfall. */
  requestIdleCallback?: IdleScheduler | null;
  /** Storno des Leerlaufs; `null` erzwingt die Nachprüfung unmittelbar vor dem Start. */
  cancelIdleCallback?: IdleCanceller | null;
  /** Zeitgeber für den Rückfall; im Test ersetzt. */
  setTimeout?: (callback: () => void, delay: number) => number;
  /** Storno des Zeitgebers; im Test ersetzt. */
  clearTimeout?: (handle: number) => void;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const IDLE_TIMEOUT_MS = 2000;
const IDLE_FALLBACK_MS = 200;
/** Radiant je Bildpunkt waagerechter Zeigerbewegung; ein Bildpunkt ist rund 0,63 Grad. */
const DRAG_RADIANS_PER_PX = 0.011;
/** Beschriftung des Schalters, solange die Drehung noch nie gelaufen ist; wie LABEL_START. */
const LABEL_START = 'Drehung starten';

function noop(): void {}

/** Der Leerlauf-Rückruf aus dem Fenster; ältere Browser (Safari) haben keinen. */
function idleFrom(view: Window): IdleScheduler | null {
  const candidate = (view as Window & { requestIdleCallback?: IdleScheduler }).requestIdleCallback;
  return typeof candidate === 'function' ? candidate.bind(view) : null;
}

/** Das Storno des Leerlaufs aus dem Fenster; fehlt es, entscheidet die Nachprüfung. */
function cancelIdleFrom(view: Window): IdleCanceller | null {
  const candidate = (view as Window & { cancelIdleCallback?: IdleCanceller }).cancelIdleCallback;
  return typeof candidate === 'function' ? candidate.bind(view) : null;
}

/** Fangt den Zeiger, wenn der Browser das kann; sonst bleibt es beim Ziehen im Element. */
function capturePointer(element: HTMLElement | null, pointerId: number): void {
  if (!element || typeof element.setPointerCapture !== 'function') return;
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Der Zeiger ist schon weg; das Ziehen endet ohnehin mit pointerup oder pointercancel.
  }
}

function releasePointer(element: HTMLElement | null, pointerId: number): void {
  if (!element || typeof element.releasePointerCapture !== 'function') return;
  try {
    element.releasePointerCapture(pointerId);
  } catch {
    // Nicht gefangen: nichts freizugeben.
  }
}

function setLabel(button: HTMLElement, text: string): void {
  const label = button.querySelector<HTMLElement>('[data-ascii-label]');
  if (label !== null) label.textContent = text;
}

/**
 * Bindet die Drehung einer Bildmarke und gibt die Aufräumfunktion zurück. Ein zweiter
 * Aufruf auf demselben Rahmen tut nichts.
 */
export function bindAsciiMark(root: HTMLElement, options: BindOptions = {}): () => void {
  if (root.dataset.initialized === 'true') return noop;

  const doc = root.ownerDocument;
  const view = doc.defaultView ?? window;
  const load = options.load ?? (() => import('./rotate'));
  const media = (options.matchMedia ?? ((query: string) => view.matchMedia(query)))(REDUCED_MOTION);
  const idle =
    options.requestIdleCallback === undefined ? idleFrom(view) : options.requestIdleCallback;
  const cancelIdle =
    options.cancelIdleCallback === undefined ? cancelIdleFrom(view) : options.cancelIdleCallback;
  const delay =
    options.setTimeout ?? ((callback: () => void, ms: number) => view.setTimeout(callback, ms));
  const stopDelay = options.clearTimeout ?? ((handle: number) => view.clearTimeout(handle));

  const surface = root.querySelector<HTMLElement>('[data-ascii-surface]');
  const pause = root.querySelector<HTMLButtonElement>('[data-ascii-pause]');

  root.dataset.initialized = 'true';

  // Der Schalter gehört allen, nicht erst der Drehung: er ist hier sofort sichtbar und steht
  // auf „Drehung starten“. Ohne JavaScript bleibt er verborgen, weil er im HTML `hidden` ist.
  if (pause) {
    pause.hidden = false;
    pause.setAttribute('aria-pressed', 'true');
    setLabel(pause, LABEL_START);
  }

  let generation = 0;
  let disposed = false;
  let rotation: Rotation | undefined;
  let loading: Promise<void> | undefined;
  const queued: ((runtime: Rotation) => void)[] = [];
  const drag = { active: false, x: 0 };
  let offLoad: (() => void) | undefined;
  let cancelRun: (() => void) | undefined;

  /** Verwirft alles Geplante: den noch nicht gefeuerten Start und eine laufende Drehung. */
  function halt(): void {
    generation += 1;
    cancelRun?.();
    cancelRun = undefined;
    rotation?.stop();
    rotation = undefined;
    queued.length = 0;
  }

  /**
   * Lädt das Drehmodul und startet die Drehung; mehrfach aufrufbar. `allowAuto` sagt, ob sie
   * von allein laufen darf — das Ziehen lädt sie auch bei reduzierter Bewegung, lässt sie
   * dann aber stehen.
   */
  function boot(allowAuto: boolean): Promise<void> {
    if (rotation || disposed) return Promise.resolve();
    if (loading) return loading;
    const mine = generation;
    loading = load()
      .then((runtime) => {
        // Die Lage kann sich während des Ladens geändert haben.
        if (disposed || mine !== generation) return;
        rotation = runtime.start(root);
        if (!allowAuto && media.matches) rotation.setRunning(false);
        for (const action of queued.splice(0)) action(rotation);
      })
      .catch(() => {
        // Import gescheitert: Standbild und Status „STANDBILD“ bleiben, keine Meldung.
      })
      .finally(() => {
        loading = undefined;
      });
    return loading;
  }

  /** Führt `action` auf der Drehung aus und lädt sie vorher, wenn sie noch fehlt. */
  function withRotation(allowAuto: boolean, action: (runtime: Rotation) => void): void {
    if (rotation) {
      action(rotation);
      return;
    }
    queued.push(action);
    void boot(allowAuto);
  }

  function schedule(): void {
    // Der Rückruf merkt sich die Generation, in der er geplant wurde. `halt()` erhöht sie;
    // damit kann er sich selbst verwerfen, wenn der Browser kein `cancelIdleCallback` kennt
    // und `cancelRun` deshalb leer bleibt — dasselbe Muster wie in `boot()`.
    const mine = generation;
    const run = () => {
      cancelRun = undefined;
      // Zwei Gründe zu verwerfen: es wurde aufgeräumt oder neu geplant (Generation), oder
      // `prefers-reduced-motion` hat sich nach dem Planen auf `reduce` gedreht.
      if (mine !== generation || media.matches) return;
      void boot(true);
    };
    if (idle) {
      const handle = idle(run, { timeout: IDLE_TIMEOUT_MS });
      cancelRun = cancelIdle ? () => cancelIdle(handle) : undefined;
      return;
    }
    const handle = delay(run, IDLE_FALLBACK_MS);
    cancelRun = () => stopDelay(handle);
  }

  function whenLoaded(run: () => void): void {
    if (doc.readyState === 'complete') {
      run();
      return;
    }
    const listener = () => {
      offLoad = undefined;
      run();
    };
    view.addEventListener('load', listener, { once: true });
    offLoad = () => view.removeEventListener('load', listener);
  }

  function sync(): void {
    halt();
    offLoad?.();
    offLoad = undefined;
    if (media.matches) return;
    whenLoaded(schedule);
  }

  /**
   * Der Schalter: der erste Klick lädt die Drehung nach und startet sie. Danach führt das
   * Drehmodul den Schalter selbst — ein zweiter Listener hier würde jeden Klick doppelt
   * auswerten und die Drehung sofort wieder anwerfen.
   */
  function onPause(): void {
    if (rotation) return;
    void boot(true);
  }

  function onPointerDown(event: PointerEvent): void {
    if (typeof event.button === 'number' && event.button !== 0) return;
    drag.active = true;
    drag.x = event.clientX;
    surface?.classList.add('is-dragging');
    capturePointer(surface, event.pointerId);
    withRotation(false, (runtime) => runtime.hold());
  }

  function onPointerMove(event: PointerEvent): void {
    if (!drag.active) return;
    const delta = (event.clientX - drag.x) * DRAG_RADIANS_PER_PX;
    drag.x = event.clientX;
    withRotation(false, (runtime) => runtime.nudge(delta));
  }

  function onPointerEnd(event: PointerEvent): void {
    if (!drag.active) return;
    drag.active = false;
    surface?.classList.remove('is-dragging');
    releasePointer(surface, event.pointerId);
    withRotation(false, (runtime) => runtime.release());
  }

  media.addEventListener('change', sync);
  sync();

  surface?.addEventListener('pointerdown', onPointerDown);
  surface?.addEventListener('pointermove', onPointerMove);
  surface?.addEventListener('pointerup', onPointerEnd);
  surface?.addEventListener('pointercancel', onPointerEnd);
  pause?.addEventListener('click', onPause);

  return function cleanup(): void {
    disposed = true;
    halt();
    offLoad?.();
    offLoad = undefined;
    media.removeEventListener('change', sync);
    surface?.removeEventListener('pointerdown', onPointerDown);
    surface?.removeEventListener('pointermove', onPointerMove);
    surface?.removeEventListener('pointerup', onPointerEnd);
    surface?.removeEventListener('pointercancel', onPointerEnd);
    pause?.removeEventListener('click', onPause);
    if (pause) pause.hidden = true;
    delete root.dataset.initialized;
  };
}
