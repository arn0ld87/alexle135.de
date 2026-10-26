// Ticket 7: Abschluss bei richtigem Vorwurf
import { useEffect, useRef } from 'react';
import type { Ermittlung } from '../../lib/missions/ermittlungTypes';
import { figurGanzUrl, figurUrl } from '../../lib/missions/pager';

export interface WeiterLink {
  href: string;
  text: string;
}

interface ErmittlungsAbschlussProps {
  ermittlung: Ermittlung;
  /** Link zur nächsten Episode, falls es eine gibt. */
  weiter?: WeiterLink;
}

function TerminalZeilen({ zeilen }: { zeilen: readonly string[] }) {
  return (
    <div className="rounded-lg border border-[color:var(--lk-line)] bg-[color:var(--lk-term,#0a0d12)] p-3 font-mono text-[13px] text-[color:var(--lk-ink)]">
      {zeilen.map((z, i) => (
        <div key={i} className="break-words whitespace-pre-wrap">
          {z}
        </div>
      ))}
    </div>
  );
}

export default function ErmittlungsAbschluss({ ermittlung, weiter }: ErmittlungsAbschlussProps) {
  const pose = ermittlung.szenePose ?? 'zeigt';
  const bild = pose === 'zeigt' || pose === 'urlaub' ? figurGanzUrl(pose) : figurUrl(pose);
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titelRef.current?.focus();
  }, []);
  return (
    <section
      aria-labelledby="ermittlung-abschluss"
      className="rounded-xl border border-[color:var(--lk-line-strong)] bg-[color:var(--lk-panel-solid)] p-5 shadow-[var(--lk-shadow)]"
    >
      <h2
        ref={titelRef}
        tabIndex={-1}
        id="ermittlung-abschluss"
        className="text-[26px] leading-tight font-bold text-[color:var(--lk-ink)] outline-none"
      >
        Fall gelöst
      </h2>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div>
          <TerminalZeilen zeilen={ermittlung.szene} />
          <div className="mt-4 rounded-lg border border-[color:var(--lk-line)] p-3">
            <p className="text-[11.5px] tracking-[0.14em] text-[color:var(--lk-dim)] uppercase">
              Beweisstück
            </p>
            <p className="mt-2 text-[15px] font-semibold text-[color:var(--lk-ink)]">
              {ermittlung.beweisstueck.titel}
            </p>
            <p className="mt-1 text-sm break-words text-[color:var(--lk-muted)]">
              {ermittlung.beweisstueck.beschreibung}
            </p>
            <p className="mt-1 font-mono text-sm text-[color:var(--lk-muted)]">
              Code: {ermittlung.beweisstueck.code}
            </p>
          </div>
          {weiter && (
            <p className="mt-4">
              <a
                href={weiter.href}
                className="inline-flex h-[42px] items-center rounded-lg border border-[color:var(--lk-accent-fill)] bg-[color:var(--lk-accent-fill)] px-4 text-[15.5px] font-semibold text-[#fff] hover:bg-[color:var(--lk-accent-fill-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)]"
              >
                {weiter.text}
              </a>
            </p>
          )}
        </div>
        <div className="hidden md:flex justify-center items-start">
          <img src={bild} alt="" className="max-h-[20rem] w-auto" loading="lazy" />
        </div>
      </div>
    </section>
  );
}
