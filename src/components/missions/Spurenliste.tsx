// Spurenliste der Staffel-2-App (Ticket 4): reine Darstellung und Auswahl-Callback.
// Die Reihenfolge folgt den Episodendaten; Fortschritt kommt ausschließlich aus dem
// übergebenen Ermittlungszustand. Ein Klick wählt nur aus und startet keine Prüfung.
import { aktuellerSchritt } from '../../lib/missions/ermittlung';
import type { ErmittlungsZustand, Spur } from '../../lib/missions/ermittlungTypes';

interface SpurenlisteProps {
  spuren: readonly Spur[];
  zustand: ErmittlungsZustand;
  aktiveSpurId: string | null;
  onSpurWaehlen: (spurId: string) => void;
}

const fortschrittText = (erledigt: number, gesamt: number): string =>
  `${erledigt} von ${gesamt} Schritten erledigt`;

export default function Spurenliste({
  spuren,
  zustand,
  aktiveSpurId,
  onSpurWaehlen,
}: SpurenlisteProps) {
  const aktiv = spuren.find((spur) => spur.id === aktiveSpurId) ?? null;
  const schritt = aktiv ? aktuellerSchritt(aktiv, zustand) : null;

  return (
    <section aria-labelledby="staffel2-spuren" className="min-w-0">
      <h2 id="staffel2-spuren" className="ds-display-s text-[color:var(--ink)]">
        Spuren
      </h2>
      {spuren.length > 0 && (
        <ol className="mt-2 space-y-1">
          {spuren.map((spur) => {
            const erledigt = zustand.erledigt[spur.id] ?? 0;
            const gesamt = spur.schritte.length;
            const abgeschlossen = aktuellerSchritt(spur, zustand) === null;
            const text = fortschrittText(erledigt, gesamt);
            const name = `${spur.titel}, ${text}${abgeschlossen ? ', abgeschlossen' : ''}`;
            const gewaehlt = spur.id === aktiveSpurId;
            return (
              <li key={spur.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={gewaehlt}
                  aria-label={name}
                  onClick={() => onSpurWaehlen(spur.id)}
                  className={`flex w-full min-w-0 flex-col items-start gap-1 rounded-none border px-3 py-2 text-left ${
                    gewaehlt
                      ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
                      : 'border-transparent text-[color:var(--muted)]'
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]`}
                >
                  <span className="w-full break-words font-mono text-sm tracking-wide uppercase">
                    {spur.titel}
                  </span>
                  <span className="w-full break-words font-mono text-xs">{text}</span>
                  {abgeschlossen && (
                    <span className="w-full break-words font-mono text-xs">Abgeschlossen</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {aktiv ? (
        <div className="mt-4 min-w-0 border border-[var(--terminal-border)] p-3">
          <h3 className="break-words font-mono text-sm tracking-wide text-[color:var(--ink)] uppercase">
            {aktiv.titel}
          </h3>
          {schritt ? (
            <>
              <p className="mt-2 break-words font-mono text-sm text-[color:var(--ink)]">
                {schritt.title}
              </p>
              <div className="mt-2 space-y-1">
                {schritt.pager.map((zeile, index) => (
                  <p
                    key={index}
                    className="break-words whitespace-pre-wrap font-mono text-xs text-[color:var(--muted)]"
                  >
                    {zeile}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 break-words font-mono text-sm text-[color:var(--ink)]">
              Alle Schritte dieser Spur sind erledigt.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">Keine Spuren vorhanden.</p>
      )}
    </section>
  );
}
