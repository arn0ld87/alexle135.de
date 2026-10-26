// Hilfe auf Abruf der Staffel-2-App (Ticket 9): Werkzeugkasten und gestufte Tipps zum aktuellen
// Schritt der gewählten Spur. Reine Anzeige: kein Agent-Aufruf, kein Ermittlungs-Event, kein
// Speichern. Der Tipp-Stand lebt nur in dieser Komponente; wer sie neu einhängt (key), setzt ihn zurück.
import { useState } from 'react';
import type { MissionTool } from '../../lib/missions/missionTypes';
import type { VorfallSchritt } from '../../lib/missions/staffelTypes';

interface ErmittlungsHilfeProps {
  spurId: string | null;
  /** Aktueller offener Schritt der gewählten Spur; null, wenn alles erledigt oder nichts gewählt ist. */
  schritt: VorfallSchritt | null;
  werkzeuge?: readonly MissionTool[];
  /** Ein Tipp wurde aufgedeckt; `stufe` 1 bis 3, Stufe 3 ist die Lösung. */
  onTippGezeigt?: (stufe: number) => void;
}

const TIPP_LABEL = ['Tipp 1', 'Tipp 2', 'Tipp 3 (Lösung)'] as const;
const KNOPF_TEXT = ['Ersten Tipp zeigen', 'Nächsten Tipp zeigen', 'Lösung zeigen'] as const;

export default function ErmittlungsHilfe({
  spurId,
  schritt,
  werkzeuge,
  onTippGezeigt,
}: ErmittlungsHilfeProps) {
  const [gezeigt, setGezeigt] = useState<Readonly<Record<string, number>>>({});
  const schluessel = spurId !== null && schritt ? `${spurId}/${schritt.id}` : null;
  const anzahl =
    schluessel !== null && Object.hasOwn(gezeigt, schluessel) ? gezeigt[schluessel] : 0;

  const zeigeNaechsten = () => {
    if (schluessel === null) return;
    if (anzahl < 3) onTippGezeigt?.(anzahl + 1);
    setGezeigt((alt) => ({
      ...alt,
      [schluessel]: Math.min(3, (Object.hasOwn(alt, schluessel) ? alt[schluessel] : 0) + 1),
    }));
  };

  return (
    <section aria-labelledby="staffel2-hilfe" className="mt-4 min-w-0 space-y-2">
      <h2
        id="staffel2-hilfe"
        className="font-mono text-[11.5px] tracking-[0.14em] text-[color:var(--lk-dim)] uppercase"
      >
        Hilfe von Alex
      </h2>
      {werkzeuge && werkzeuge.length > 0 && (
        <details className="rounded border border-[color:var(--line)] px-3 py-2">
          <summary className="cursor-pointer font-mono text-sm text-[color:var(--ink)]">
            Werkzeugkasten
          </summary>
          <ul className="mt-2 space-y-3">
            {werkzeuge.map((werkzeug) => (
              <li key={werkzeug.befehl} className="min-w-0">
                <p className="font-mono text-sm break-words text-[color:var(--ink)]">
                  {werkzeug.befehl}
                </p>
                <p className="text-sm break-words text-[color:var(--muted)]">
                  {werkzeug.erklaerung}
                </p>
                <p className="font-mono text-xs break-words whitespace-pre-wrap text-[color:var(--muted)]">
                  {werkzeug.beispiel}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {schritt && (
        <div className="min-w-0">
          {anzahl > 0 && (
            <ol aria-label="Tipps" className="space-y-2">
              {schritt.tipps.slice(0, anzahl).map((tipp, index) => (
                <li key={index} className="min-w-0">
                  <span className="font-mono text-xs tracking-wide text-[color:var(--muted)] uppercase">
                    {TIPP_LABEL[index]}
                  </span>
                  <p className="font-mono text-xs break-words whitespace-pre-wrap text-[color:var(--ink)]">
                    {tipp}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {anzahl < 3 && (
            <button
              type="button"
              onClick={zeigeNaechsten}
              className="mt-2 rounded-none border border-[color:var(--accent)] px-3 py-2 font-mono text-xs tracking-wide text-[color:var(--ink)] uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            >
              {KNOPF_TEXT[anzahl]}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
