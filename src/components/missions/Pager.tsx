// Pager-Leiste über dem Terminal (#397): Jede Nachricht tippt sich Zeile für Zeile ein,
// mit Schreibmaschinen-Klackern und Glöckchen am Ende (#412, abschaltbar), ältere stehen im
// aufklappbaren Verlauf. Bei
// `prefers-reduced-motion` steht der Text sofort. Screenreader bekommen den ganzen Text auf einmal.
// Links sitzt Alex' Figur (#402): je Nachricht eine Pose als eigenes SVG, geladen wird nur die
// gezeigte. Dekorativ (alt=""), den Text trägt die Sprechblase. Blinzeln und Atmen stecken im
// SVG selbst und laufen nur ohne reduzierte Bewegung.
import { useEffect, useRef, useState } from 'react';
import {
  MS_PAUSE,
  MS_PAUSE_REDUZIERT,
  STANDARD_POSE,
  angezeigte,
  anschlaege,
  figurUrl,
  fortschrittFuer,
  naechsteWartende,
  sichtbareZeilen,
  tippDauer,
  type PagerNachricht,
} from '../../lib/missions/pager';

const TON_KEY = 'pager:ton';
// Selten neu zeichnen: Der Emulator teilt sich den Haupt-Thread mit dem Pager (#399).
const TICK_MS = 100;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function readTon(): boolean {
  try {
    return localStorage.getItem(TON_KEY) !== 'aus';
  } catch {
    return true;
  }
}

function writeTon(an: boolean) {
  try {
    localStorage.setItem(TON_KEY, an ? 'an' : 'aus');
  } catch {
    // gesperrt: Einstellung gilt nur für diese Sitzung
  }
}

// Schreibmaschine (#412): Klang wird per Web Audio erzeugt (keine Audiodatei, kein Netz). Ein
// gemeinsamer AudioContext, erst beim ersten Ton angelegt; ohne Audio-Unterstützung oder bei
// gesperrtem Autoplay bleibt es still.
let audio: AudioContext | null = null;
let rauschen: AudioBuffer | null = null;

function audioContext(): AudioContext | null {
  try {
    if (!audio) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
    }
    // Gesperrt (Autoplay): Freigabe anstoßen, diesen Ton aber verwerfen. Sonst sammeln sich
    // Quellen beim stehenden currentTime und knallen nach der Freigabe als Burst (Codex zu #412).
    if (audio.state !== 'running') {
      void audio.resume().catch(() => {});
      return null;
    }
    return audio;
  } catch {
    return null;
  }
}

/** Anschlag: kurzer, bandpassgefilterter Rauschimpuls mit leicht zufälliger Tonhöhe. */
function klack(versatzS: number) {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    if (!rauschen) {
      rauschen = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
      const d = rauschen.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    }
    const t = ctx.currentTime + versatzS;
    const src = ctx.createBufferSource();
    src.buffer = rauschen;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 900;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = 0.18 + Math.random() * 0.08;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  } catch {
    // dann eben ohne Ton
  }
}

/** Glöckchen am Ende der Nachricht, wie beim Wagenrücklauf. */
function ding() {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 2093;
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.36);
  } catch {
    // dann eben ohne Ton
  }
}

export default function Pager({ nachrichten }: { nachrichten: PagerNachricht[] }) {
  // Warteschlange (#410): Beim ersten Rendern steht die neueste Nachricht, danach kommt eine nach
  // der anderen, jeweils nach dem Eintippen und einer kurzen Pause. Sonst verdrängt die Szene die
  // Erledigt-Meldung, weil StaffelApp beides im selben Callback anhängt.
  const [zeigeId, setZeigeId] = useState(() => nachrichten.at(-1)?.id ?? 0);
  // ID der Nachricht, die fertig getippt und gelesen ist; erst dann darf die nächste kommen.
  const [freiFuer, setFreiFuer] = useState(() => nachrichten.at(-1)?.id ?? 0);
  const aktuell = angezeigte(nachrichten, zeigeId);
  const verlauf = aktuell ? nachrichten.filter((n) => n.id < aktuell.id) : [];
  const wartend = naechsteWartende(nachrichten, aktuell);
  const [ton, setTon] = useState(readTon);
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  // Fortschritt gehört zu einer Nachrichten-ID: Eine neue Nachricht beginnt schon beim ersten
  // Rendern bei 0, nicht erst nach dem Effekt (Codex-Finding zu #397).
  const [fortschritt, setFortschritt] = useState(() => ({
    id: aktuell?.id ?? 0,
    ms: aktuell ? tippDauer(aktuell.zeilen) : 0,
  }));
  const tonRef = useRef(ton);
  tonRef.current = ton;
  const aktuellRef = useRef(aktuell);
  aktuellRef.current = aktuell;
  // Beim ersten Rendern liegende Nachrichten (etwa nach dem Neuladen) klackern nicht.
  const gesehen = useRef(aktuell?.id ?? 0);

  useEffect(() => {
    if (aktuell && wartend && freiFuer === aktuell.id) setZeigeId(wartend.id);
  }, [aktuell, wartend, freiFuer]);

  const aktuellId = aktuell?.id;
  useEffect(() => {
    const nachricht = aktuellRef.current;
    if (!nachricht) return;
    const neu = nachricht.id > gesehen.current;
    gesehen.current = Math.max(gesehen.current, nachricht.id);
    const ende = tippDauer(nachricht.zeilen);
    const { id, zeilen } = nachricht;
    if (!neu) {
      setFortschritt({ id, ms: ende });
      setFreiFuer(id);
      return;
    }
    const reduziert = reducedMotion();
    let pause: number | undefined;
    // Ein Timeout für die Lesepause, kein weiteres Neuzeichnen im Takt.
    const gelesen = () => {
      pause = window.setTimeout(() => setFreiFuer(id), reduziert ? MS_PAUSE_REDUZIERT : MS_PAUSE);
    };
    if (reduziert) {
      setFortschritt({ id, ms: ende });
      gelesen();
      return () => window.clearTimeout(pause);
    }
    setFortschritt({ id, ms: 0 });
    const start = Date.now();
    let vorher = 0;
    const timer = window.setInterval(() => {
      const t = Date.now() - start;
      setFortschritt({ id, ms: t });
      if (tonRef.current) {
        const { klacks, fertig } = anschlaege(zeilen, vorher, t);
        for (let k = 0; k < klacks; k++) klack((k * TICK_MS) / 1000 / klacks);
        if (fertig) ding();
      }
      vorher = t;
      if (t >= ende) {
        window.clearInterval(timer);
        gelesen();
      }
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(pause);
    };
  }, [aktuellId]);

  function toggleTon() {
    const an = !ton;
    setTon(an);
    writeTon(an);
  }

  const ms = fortschrittFuer(fortschritt, aktuell, reducedMotion());
  const zeilen = aktuell ? sichtbareZeilen(aktuell.zeilen, ms) : [];
  // Die Leiste ist flach (#399): Beim Tippen bleibt die jüngste Zeile im Blick.
  const textRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = textRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ms]);
  const fertig = aktuell ? ms >= tippDauer(aktuell.zeilen) : true;

  return (
    <section
      aria-label="Pager"
      data-testid="pager"
      className="grid grid-cols-[4.5rem_1fr] items-start gap-3 border border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-3 font-mono text-sm text-[var(--terminal-fg)]"
    >
      <img
        src={figurUrl(aktuell?.pose ?? (aktuell ? STANDARD_POSE[aktuell.art] : 'neutral'))}
        alt=""
        width={72}
        height={72}
        data-figur={aktuell?.pose ?? (aktuell ? STANDARD_POSE[aktuell.art] : 'neutral')}
        className="h-[4.5rem] w-[4.5rem] border border-[var(--terminal-border)]"
      />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs tracking-wide text-[var(--terminal-fg-muted)] uppercase">
            Pager · Alex
          </span>
          <span className="flex gap-3">
            {verlauf.length > 0 && (
              <button
                type="button"
                onClick={() => setVerlaufOffen((o) => !o)}
                aria-expanded={verlaufOffen}
                aria-controls="pager-verlauf"
                className="text-xs text-[var(--terminal-fg-muted)] underline-offset-2 hover:underline"
              >
                Verlauf ({verlauf.length})
              </button>
            )}
            <button
              type="button"
              onClick={toggleTon}
              aria-pressed={ton}
              className="text-xs text-[var(--terminal-fg-muted)] underline-offset-2 hover:underline"
            >
              Ton {ton ? 'an' : 'aus'}
            </button>
          </span>
        </div>
        {aktuell ? (
          <>
            <p className="sr-only" aria-live="polite">
              {aktuell.zeilen.join(' ')}
            </p>
            {/* Rahmen und Abstand außen, innen genau vier Zeilen à 1,25rem ohne Lücken: Ans Ende
                gescrollt steht oben nie eine halbe Zeile (#411). */}
            <div data-sprechblase="" className="border border-[var(--terminal-border)] px-2 py-1">
              <div
                ref={textRef}
                aria-hidden="true"
                data-testid="pager-text"
                className="h-20 overflow-hidden leading-5"
              >
                {zeilen.map((z, i) => (
                  <p key={i} className="break-words whitespace-pre-wrap">
                    {z}
                    {!fertig && i === zeilen.length - 1 && <span className="pager-cursor">▌</span>}
                  </p>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-[var(--terminal-fg-muted)]">Noch keine Nachricht.</p>
        )}
        {verlauf.length > 0 && (
          // Der Schalter sitzt in der Kopfzeile, damit der Pager keine eigene Zeile dafür braucht.
          <div
            id="pager-verlauf"
            hidden={!verlaufOffen}
            className="text-xs text-[var(--terminal-fg-muted)]"
          >
            <ol className="max-h-48 space-y-2 overflow-y-auto" data-testid="pager-verlauf">
              {verlauf
                .slice()
                .reverse()
                .map((n) => (
                  <li key={n.id} className="whitespace-pre-wrap">
                    {n.zeilen.join('\n')}
                  </li>
                ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
