/**
 * Laufzeit der Drehung der Bildmarke (Plan 02-18.1, D-48, D-49).
 *
 * Wird nur per dynamischem `import()` aus `bind.ts` nachgeladen; dieses Modul hat keinen
 * Seiteneffekt beim Import. Es liest die beiden Ebenen, den Status und den Schalter aus dem
 * Rahmen, rechnet je gedrosseltem Bild die Tiefenpuffer-Projektion der vorberechneten Matrix
 * und schreibt den Text in den vorhandenen Textknoten — nie Markup. Pause außer Sicht
 * (IntersectionObserver) und bei verborgenem Tab halten die Schleife an.
 *
 * Der Winkel kommt aus zwei Quellen: der eigenen Drehung und dem Ziehen von außen. Dafür gibt
 * `start` neben `stop` die Griffe `hold`, `nudge`, `release` und `setRunning` zurück — die
 * Bindung ruft sie aus ihren Zeiger- und Klick-Ereignissen. Nach `SETTLE_MS` Ruhe setzt die
 * eigene Drehung wieder ein; der Nachlauf klingt vorher ab. Der Winkel wächst allein aus den
 * Zeitstempeln der Animationsframes, eine Uhr wird nicht gelesen. Geschrieben wird höchstens
 * alle `FRAME_MS` und nur, wenn sich der Text ändert.
 *
 * Den Schalter blendet dieses Modul nicht ein: er gehört der Bindung und ist für alle
 * sichtbar, auch ohne Drehung.
 */
import * as mark from './mark';
import { projectFrame } from './project';

/** Kürzester Abstand zweier geschriebener Bilder: höchstens 14 Bilder je Sekunde. */
export const FRAME_MS = 1000 / 14;
/** Dauer einer vollen Umdrehung in Millisekunden. */
export const TURN_MS = 12000;
/** Statustext im Lineal, solange die Drehung nicht läuft. */
export const STATUS_STILL = 'STANDBILD';
/** Statustext im Lineal, während die Drehung läuft. */
export const STATUS_RUNNING = 'DREHUNG';
/** Statustext im Lineal, solange der Schalter die Drehung angehalten hat. */
export const STATUS_PAUSED = 'ANGEHALTEN';
/** Beschriftung des Schalters, solange die Drehung von allein läuft. */
export const LABEL_STOP = 'Drehung anhalten';
/** Beschriftung des Schalters, wenn er die Drehung angehalten hat. */
export const LABEL_RESUME = 'Drehung fortsetzen';
/** Beschriftung des Schalters, solange die Drehung noch nie gelaufen ist. */
export const LABEL_START = 'Drehung starten';
/** Ruhezeit seit dem letzten Bild des Ziehens, nach der die eigene Drehung wieder einsetzt. */
export const SETTLE_MS = 1200;

const TAU = Math.PI * 2;
/** Winkelgeschwindigkeit der eigenen Drehung in Radiant je Sekunde. */
const AUTO_SPEED = TAU / (TURN_MS / 1000);
/** Abklingen des Nachlaufs je Sekunde; lässt den Schwung in gut einer Sekunde vergehen. */
const COAST_DECAY = 0.02;
/** Zeitkonstante, mit der die eigene Drehung nach der Ruhe wieder einsetzt. */
const RESUME_RATE = 1.2;
/** Winkelgeschwindigkeit je Radiant eines Stoßes: das Ziehen setzt den Nachlauf. */
const NUDGE_SPEED = 60;

interface Parts {
  body: Text;
  wedge: Text;
  status: HTMLElement;
  pause: HTMLButtonElement;
}

/** Die Griffe, die die Bindung an der laufenden Drehung hat. */
export interface Rotation {
  /** Beendet die Drehung, stellt das Standbild her und räumt alle Listener ab. */
  stop: () => void;
  /** Schaltet die eigene Drehung an oder ab (Schalter „Drehung anhalten“). */
  setRunning: (running: boolean) => void;
  /** Beginnt ein Ziehen: die eigene Drehung ruht, bis `release` kommt. */
  hold: () => void;
  /** Verschiebt den Winkel um `delta` und merkt die Geschwindigkeit für den Nachlauf. */
  nudge: (delta: number) => void;
  /** Beendet das Ziehen; die Drehung läuft mit der gemerkten Geschwindigkeit aus. */
  release: () => void;
}

/** Der vorhandene Textknoten der Ebene; fehlt er, wird genau einmal einer angelegt. */
function textNode(element: HTMLElement): Text {
  const first = element.firstChild;
  if (first !== null && first.nodeType === 3) return first as Text;
  const created = element.ownerDocument.createTextNode('');
  element.appendChild(created);
  return created;
}

function setLabel(button: HTMLElement, text: string): void {
  const label = button.querySelector<HTMLElement>('[data-ascii-label]');
  if (label !== null) label.textContent = text;
}

/**
 * Startet die Drehung im Rahmen `root` und gibt ihre Griffe zurück. Fehlt ein Teil des
 * Rahmens, sind alle Griffe wirkungslos und es wird nichts geworfen.
 */
export function start(root: HTMLElement): Rotation {
  const bodyLayer = root.querySelector<HTMLElement>('[data-ascii-layer="body"]');
  const wedgeLayer = root.querySelector<HTMLElement>('[data-ascii-layer="wedge"]');
  const status = root.querySelector<HTMLElement>('[data-ascii-status]');
  const pause = root.querySelector<HTMLButtonElement>('[data-ascii-pause]');
  if (!bodyLayer || !wedgeLayer || !status || !pause) {
    return { stop: noop, setRunning: noop, hold: noop, nudge: noop, release: noop };
  }

  const parts: Parts = {
    body: textNode(bodyLayer),
    wedge: textNode(wedgeLayer),
    status,
    pause,
  };
  const stillBody = parts.body.data;
  const stillWedge = parts.wedge.data;
  const doc = root.ownerDocument;

  let frame = 0;
  let stopped = false;
  let running = true;
  let dragging = false;
  let visible = true;
  let angle = 0;
  let velocity = AUTO_SPEED;
  let quiet = SETTLE_MS;
  let elapsed = 0;
  let lastStamp: number | undefined;
  let lastWrite = 0;

  function cancel(): void {
    if (frame === 0) return;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function schedule(): void {
    if (frame !== 0 || stopped || !visible || doc.hidden) return;
    frame = requestAnimationFrame(step);
  }

  function step(timestamp: number): void {
    frame = 0;
    if (stopped) return;

    const delta = lastStamp === undefined ? 0 : Math.max(0, timestamp - lastStamp);
    lastStamp = timestamp;
    if (!visible || doc.hidden) return;

    if (!running && !dragging) {
      // Der Schalter hält an und niemand zieht: die Schleife ruht, bis wieder etwas passiert.
      // `hold`, `nudge` und `setRunning` wecken sie über `schedule`.
      return;
    }

    elapsed += delta;
    const seconds = delta / 1000;
    if (!dragging) {
      quiet += delta;
      if (quiet >= SETTLE_MS) {
        velocity += (AUTO_SPEED - velocity) * Math.min(1, seconds * RESUME_RATE);
      } else {
        velocity *= Math.pow(COAST_DECAY, seconds);
      }
      angle += velocity * seconds;
    }

    if (elapsed - lastWrite >= FRAME_MS) {
      const image = projectFrame(mark, angle);
      if (image.body !== parts.body.data || image.wedge !== parts.wedge.data) {
        parts.body.data = image.body;
        parts.wedge.data = image.wedge;
        lastWrite = elapsed;
      }
    }

    schedule();
  }

  function onVisibility(): void {
    lastStamp = undefined;
    if (doc.hidden) cancel();
    else schedule();
  }

  function setRunning(next: boolean): void {
    running = next;
    parts.pause.setAttribute('aria-pressed', String(!next));
    setLabel(parts.pause, next ? LABEL_STOP : LABEL_RESUME);
    if (next) {
      // Fortsetzen beginnt beim Standbild und dreht sofort von allein.
      angle = 0;
      velocity = AUTO_SPEED;
      quiet = SETTLE_MS;
      elapsed = 0;
      lastWrite = 0;
      lastStamp = undefined;
      parts.status.textContent = STATUS_RUNNING;
      root.dataset.state = 'running';
      schedule();
      return;
    }
    cancel();
    parts.body.data = stillBody;
    parts.wedge.data = stillWedge;
    parts.status.textContent = STATUS_PAUSED;
    root.dataset.state = 'paused';
  }

  function onPause(): void {
    setRunning(!running);
  }

  /**
   * Weckt die Schleife, wenn sie ruht. Nur dann wird der Zeitstempel verworfen: der erste
   * Frame trägt keine Zeit bei, damit aus der Ruhe kein Sprung im Bild entsteht. Läuft sie
   * schon, bleibt der Takt erhalten und die Drosselung rechnet weiter.
   */
  function wake(): void {
    if (frame === 0) lastStamp = undefined;
    schedule();
  }

  function hold(): void {
    dragging = true;
    quiet = 0;
    velocity = 0;
    wake();
  }

  function nudge(delta: number): void {
    dragging = true;
    quiet = 0;
    angle += delta;
    velocity = delta * NUDGE_SPEED;
    wake();
  }

  function release(): void {
    dragging = false;
    quiet = 0;
    wake();
  }

  let observer: IntersectionObserver | undefined;
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        visible = entry.isIntersecting;
        lastStamp = undefined;
        if (visible) schedule();
        else cancel();
      },
      { threshold: 0 }
    );
    observer.observe(root);
  }

  doc.addEventListener('visibilitychange', onVisibility);
  parts.pause.addEventListener('click', onPause);
  parts.pause.setAttribute('aria-pressed', 'false');
  setLabel(parts.pause, LABEL_STOP);
  parts.status.textContent = STATUS_RUNNING;
  root.dataset.state = 'running';
  schedule();

  return {
    setRunning,
    hold,
    nudge,
    release,
    stop(): void {
      if (stopped) return;
      stopped = true;
      cancel();
      observer?.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      parts.pause.removeEventListener('click', onPause);
      parts.body.data = stillBody;
      parts.wedge.data = stillWedge;
      parts.status.textContent = STATUS_STILL;
      parts.pause.setAttribute('aria-pressed', 'true');
      setLabel(parts.pause, LABEL_START);
      root.dataset.state = 'still';
    },
  };
}

function noop(): void {}
