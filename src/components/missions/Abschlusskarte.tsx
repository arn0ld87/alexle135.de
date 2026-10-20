// Abschlusskarte der Staffel (E4.2): Staffeltitel, Gesamtlauf, verdiente Abzeichen und der
// Ausblick auf Staffel 2. Reine Anzeige, den Stand liefert der Aufrufer.
import { formatDuration } from '../../lib/missions/missionEngine';
import type { Akte, StaffelStand } from '../../lib/missions/staffel';
import type { Staffel } from '../../lib/missions/staffelTypes';

export interface AbschlusskarteProps {
  staffel: Staffel;
  stand: StaffelStand;
  /** Ganzkörperfigur, z. B. figurGanzUrl('urlaub') aus pager.ts (E2.2). */
  figurUrl: string;
  /** Link zur Projektseite. */
  projektUrl: string;
}

/** Summe der `durationMs` aller Akte-Einträge, ohne den Vorfall mit nr 0 (Gesamtlauf, CONTEXT.md). */
export function gesamtlaufMs(staffel: Staffel, akte: Akte): number {
  return staffel.vorfaelle
    .filter((v) => v.nr !== 0)
    .reduce((summe, v) => summe + (akte[v.id]?.durationMs ?? 0), 0);
}

export function Abschlusskarte({ staffel, stand, figurUrl, projektUrl }: AbschlusskarteProps) {
  const verdient = stand.abzeichen.flatMap((id) => {
    const abzeichen = staffel.abzeichen.find((a) => a.id === id);
    return abzeichen ? [abzeichen] : [];
  });

  return (
    <section className="flex flex-col gap-8 lg:flex-row-reverse lg:items-center lg:justify-between">
      <img
        src={figurUrl}
        alt="Alex im Urlaub mit Cocktail"
        width={320}
        height={640}
        loading="lazy"
        className="mx-auto h-auto w-full max-w-[16rem] lg:mx-0 lg:max-w-xs"
      />
      <div className="flex flex-col gap-4">
        <p className="ds-kicker">Ein Linux-Krimi · Staffel 1</p>
        <h2 className="text-3xl font-semibold text-[color:var(--ink)]">{staffel.titel} gelöst</h2>
        <p className="font-mono text-[color:var(--accent-strong)]">
          Gesamtlauf: {formatDuration(gesamtlaufMs(staffel, stand.akte))}
        </p>
        {verdient.length > 0 ? (
          <ul className="list-disc pl-5 text-[color:var(--ink)]">
            {verdient.map((a) => (
              <li key={a.id}>{a.titel}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[color:var(--muted)]">
            Noch keine Abzeichen. Beim nächsten Lauf vielleicht.
          </p>
        )}
        <p className="text-[color:var(--muted)]">
          Alex ist zurück aus dem Urlaub. Staffel 2 folgt.
        </p>
        <a
          href={projektUrl}
          className="self-start border border-[color:var(--ink)] px-3 py-1.5 font-mono text-sm text-[color:var(--ink)] hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]"
        >
          Zur Projektseite
        </a>
      </div>
    </section>
  );
}
