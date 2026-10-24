// Ticket 7: Abschluss bei richtigem Vorwurf
import type { Ermittlung } from '../../lib/missions/ermittlungTypes';
import { figurGanzUrl } from '../../lib/missions/pager';

interface ErmittlungsAbschlussProps {
  ermittlung: Ermittlung;
}

function TerminalZeilen({ zeilen }: { zeilen: readonly string[] }) {
  return (
    <div className="border border-[var(--terminal-border)] p-3 font-mono text-xs text-[color:var(--ink)]">
      {zeilen.map((z, i) => (
        <div key={i} className="break-words whitespace-pre-wrap">
          {z}
        </div>
      ))}
    </div>
  );
}

export default function ErmittlungsAbschluss({ ermittlung }: ErmittlungsAbschlussProps) {
  const pose = ermittlung.szenePose ?? 'zeigt';
  return (
    <section aria-labelledby="ermittlung-abschluss" className="mt-4">
      <h2 id="ermittlung-abschluss" className="ds-display-m text-[color:var(--ink)]">
        Fall gelöst
      </h2>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div>
          <TerminalZeilen zeilen={ermittlung.szene} />
          <div className="mt-4 border border-[var(--terminal-border)] p-3">
            <p className="font-mono text-xs uppercase tracking-wide text-[color:var(--muted)]">
              Beweisstück
            </p>
            <p className="mt-2 font-mono text-sm text-[color:var(--ink)]">
              {ermittlung.beweisstueck.titel}
            </p>
            <p className="mt-1 break-words font-mono text-xs text-[color:var(--muted)]">
              {ermittlung.beweisstueck.beschreibung}
            </p>
            <p className="mt-1 font-mono text-xs text-[color:var(--muted)]">
              Code: {ermittlung.beweisstueck.code}
            </p>
          </div>
        </div>
        <div className="hidden md:flex justify-center items-start">
          <img
            src={figurGanzUrl(pose)}
            alt=""
            className="max-h-[28rem] w-auto"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
