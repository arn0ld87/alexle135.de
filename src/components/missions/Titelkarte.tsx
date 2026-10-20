// Titelkarte der Staffel (E4.1): Kicker, Titel, Einleitung, Start bzw. Weiter und Trailer-Link.
import { istFreigegeben, type Akte } from '../../lib/missions/staffel';
import type { Staffel, Vorfall } from '../../lib/missions/staffelTypes';

export interface TitelkarteProps {
  staffel: Staffel;
  akte: Akte;
  /** Ganzkörperfigur, z. B. figurGanzUrl('zeigt') aus pager.ts (E2.2). */
  figurUrl: string;
  /** Ziel des Links „Trailer ansehen“. */
  trailerUrl: string;
  onStart: (vorfallId: string) => void;
}

/** Erste Episode nach `nr`, die noch nicht in der Akte steht und freigegeben ist; sonst null. */
export function naechsteEpisode(staffel: Staffel, akte: Akte): Vorfall | null {
  return (
    [...staffel.vorfaelle]
      .sort((a, b) => a.nr - b.nr)
      .find((v) => !(v.id in akte) && istFreigegeben(staffel, akte, v.id)) ?? null
  );
}

export function Titelkarte({ staffel, akte, figurUrl, trailerUrl, onStart }: TitelkarteProps) {
  const naechste = naechsteEpisode(staffel, akte);
  const leer = Object.keys(akte).length === 0;
  return (
    <section className="flex flex-col-reverse items-center gap-8 border border-dashed border-[color:color-mix(in_srgb,var(--ink)_20%,transparent)] p-8 lg:flex-row lg:justify-between">
      <div className="max-w-xl">
        <p className="ds-kicker">Ein Linux-Krimi · Staffel 1</p>
        <h2 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">{staffel.titel}</h2>
        <p className="mt-4 text-[color:var(--muted)]">
          Alex ist im Urlaub, und auf seinem Server räumt jemand auf. Du bist sein Azubi.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {naechste && (
            <button
              type="button"
              onClick={() => onStart(naechste.id)}
              className="border border-[color:var(--ink)] px-4 py-2 font-mono text-sm text-[color:var(--ink)] hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]"
            >
              {leer ? `Episode ${naechste.nr} starten` : `Weiter mit Episode ${naechste.nr}`}
            </button>
          )}
          <a
            href={trailerUrl}
            className="text-[color:var(--accent-strong)] underline underline-offset-4"
          >
            Trailer ansehen
          </a>
        </div>
      </div>
      <img src={figurUrl} alt="Alex zeigt auf dich" width={320} height={640} loading="lazy" />
    </section>
  );
}
