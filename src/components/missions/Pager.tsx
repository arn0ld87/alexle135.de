// Pager-Leiste über dem Terminal (#397): Die neueste Nachricht tippt sich Zeile für Zeile ein,
// ein kurzer Piepton (abschaltbar) meldet sie an, ältere stehen im aufklappbaren Verlauf. Bei
// `prefers-reduced-motion` steht der Text sofort. Screenreader bekommen den ganzen Text auf einmal.
// Links sitzt der Platz für Alex' Figur (#402), vorerst ein Platzhalter.
import { useEffect, useRef, useState } from 'react';
import {
  fortschrittFuer,
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

/** Kurzer Pager-Piep über Web Audio; ohne Audio-Unterstützung still. */
function piep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1760;
    gain.gain.value = 0.04;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => void ctx.close();
  } catch {
    // Autoplay gesperrt oder kein Audio: dann eben ohne Ton
  }
}

export default function Pager({ nachrichten }: { nachrichten: PagerNachricht[] }) {
  const aktuell = nachrichten.at(-1);
  const verlauf = nachrichten.slice(0, -1);
  const [ton, setTon] = useState(readTon);
  // Fortschritt gehört zu einer Nachrichten-ID: Eine neue Nachricht beginnt schon beim ersten
  // Rendern bei 0, nicht erst nach dem Effekt (Codex-Finding zu #397).
  const [fortschritt, setFortschritt] = useState(() => ({
    id: aktuell?.id ?? 0,
    ms: aktuell ? tippDauer(aktuell.zeilen) : 0,
  }));
  const tonRef = useRef(ton);
  tonRef.current = ton;
  // Beim ersten Rendern liegende Nachrichten (etwa nach dem Neuladen) piepen nicht.
  const gesehen = useRef(aktuell?.id ?? 0);

  useEffect(() => {
    if (!aktuell) return;
    const neu = aktuell.id > gesehen.current;
    gesehen.current = aktuell.id;
    if (neu && tonRef.current) piep();
    const ende = tippDauer(aktuell.zeilen);
    const { id } = aktuell;
    if (reducedMotion() || !neu) {
      setFortschritt({ id, ms: ende });
      return;
    }
    setFortschritt({ id, ms: 0 });
    const start = Date.now();
    const timer = window.setInterval(() => {
      const t = Date.now() - start;
      setFortschritt({ id, ms: t });
      if (t >= ende) window.clearInterval(timer);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [aktuell]);

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
      className="grid grid-cols-[3rem_1fr] gap-3 border border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-3 font-mono text-sm text-[var(--terminal-fg)]"
    >
      <div
        aria-hidden="true"
        data-figur="platzhalter"
        className="flex h-12 w-12 items-center justify-center border border-[var(--terminal-border)] text-[var(--terminal-fg-muted)]"
      >
        AS
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs tracking-wide text-[var(--terminal-fg-muted)] uppercase">
            Pager · Alex
          </span>
          <button
            type="button"
            onClick={toggleTon}
            aria-pressed={ton}
            className="text-xs text-[var(--terminal-fg-muted)] underline-offset-2 hover:underline"
          >
            Ton {ton ? 'an' : 'aus'}
          </button>
        </div>
        {aktuell ? (
          <>
            <p className="sr-only" aria-live="polite">
              {aktuell.zeilen.join(' ')}
            </p>
            <div
              ref={textRef}
              aria-hidden="true"
              data-testid="pager-text"
              className="h-24 space-y-1 overflow-hidden"
            >
              {zeilen.map((z, i) => (
                <p key={i} className="break-words whitespace-pre-wrap">
                  {z}
                  {!fertig && i === zeilen.length - 1 && <span className="pager-cursor">▌</span>}
                </p>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[var(--terminal-fg-muted)]">Noch keine Nachricht.</p>
        )}
        {verlauf.length > 0 && (
          <details className="text-xs text-[var(--terminal-fg-muted)]">
            <summary className="cursor-pointer">Verlauf ({verlauf.length})</summary>
            <ol className="mt-2 space-y-2" data-testid="pager-verlauf">
              {verlauf
                .slice()
                .reverse()
                .map((n) => (
                  <li key={n.id} className="whitespace-pre-wrap">
                    {n.zeilen.join('\n')}
                  </li>
                ))}
            </ol>
          </details>
        )}
      </div>
    </section>
  );
}
