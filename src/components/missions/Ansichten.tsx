// Ansichtenwahl und Abfrage-Lebenszyklus (Ticket 5): native Buttons, genau ein
// Abfrage-Controller je Setup-Generation, keine Abfrage vor erfolgreichem Setup.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentResult } from '../../lib/missions/agentClient';
import {
  erzeugeAbfragen,
  type AbfrageZustand,
  type ErmittlungsAbfragen,
} from '../../lib/missions/ermittlungsAbfragen';
import { leseAktenwand } from '../../lib/missions/aktenwand';
import type {
  Ansicht,
  BelegRegel,
  ErmittlungsZustand,
} from '../../lib/missions/ermittlungTypes';
import Aktenwand from './Aktenwand';
import RaumAnsicht from './RaumAnsicht';

interface AnsichtenProps {
  ansichten: readonly Ansicht[];
  bereit: boolean;
  generation: number;
  run: (skript: string, timeoutMs: number) => Promise<AgentResult>;
  belegRegeln: readonly BelegRegel[];
  zustand: ErmittlungsZustand;
  ausgewaehlteBelegIds: readonly string[];
  onBelegAuswahlAendern: (ids: readonly string[]) => void;
  onVorwurfOeffnen?: () => void;
  vorwurfOeffnenAktiv?: boolean;
  vorwurfHinweis?: string | null;
}

const START: AbfrageZustand = { status: 'bereit', ansichtId: null, ausgabe: null };

export default function Ansichten({
  ansichten,
  bereit,
  generation,
  run,
  belegRegeln,
  zustand,
  ausgewaehlteBelegIds,
  onBelegAuswahlAendern,
  onVorwurfOeffnen,
  vorwurfOeffnenAktiv,
  vorwurfHinweis,
}: AnsichtenProps) {
  const [abfrage, setAbfrage] = useState<AbfrageZustand>(START);
  const controller = useRef<ErmittlungsAbfragen | null>(null);
  const generationRef = useRef(generation);
  generationRef.current = generation;

  useEffect(() => {
    if (!bereit || generation === 0) {
      setAbfrage(START);
      return;
    }

    const aktuell = erzeugeAbfragen({
      run,
      istAktuell: () => generationRef.current === generation,
      schreibeZustand: setAbfrage,
    });
    controller.current = aktuell;
    setAbfrage(START);
    const erste = ansichten[0];
    if (erste) aktuell.oeffne(erste);

    return () => {
      aktuell.stoppe();
      if (controller.current === aktuell) controller.current = null;
    };
  }, [ansichten, bereit, generation, run]);

  const aktive = ansichten.find((eintrag) => eintrag.id === abfrage.ansichtId) ?? null;
  const aktenInhalt = useMemo(() => {
    if (
      !aktive ||
      aktive.art !== 'aktenwand' ||
      abfrage.status !== 'geladen' ||
      !abfrage.ausgabe
    ) {
      return null;
    }
    return leseAktenwand(abfrage.ausgabe);
  }, [aktive, abfrage.status, abfrage.ausgabe]);

  return (
    <section aria-labelledby="staffel2-ansichten" className="mt-6 min-w-0">
      <h2 id="staffel2-ansichten" className="ds-display-s text-[color:var(--ink)]">
        Ansichten
      </h2>

      {!bereit || generation === 0 ? (
        <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
          Ansichten werden nach dem Start verfügbar.
        </p>
      ) : ansichten.length === 0 ? (
        <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
          Keine Ansichten vorhanden.
        </p>
      ) : (
        <>
          <div role="group" aria-label="Ansichten wählen" className="mt-2 flex flex-wrap gap-1">
            {ansichten.map((ansicht) => {
              const gewaehlt = abfrage.ansichtId === ansicht.id;
              return (
                <button
                  key={ansicht.id}
                  type="button"
                  aria-pressed={gewaehlt}
                  onClick={() => controller.current?.oeffne(ansicht)}
                  className={`min-w-0 rounded-none border px-3 py-2 font-mono text-xs tracking-wide uppercase ${
                    gewaehlt
                      ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
                      : 'border-transparent text-[color:var(--muted)]'
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]`}
                >
                  {ansicht.titel}
                </button>
              );
            })}
          </div>

          {aktive && (
            <div className="mt-3 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="break-words font-mono text-sm tracking-wide text-[color:var(--ink)] uppercase">
                  {aktive.titel}
                </h3>
                <button
                  type="button"
                  onClick={() => controller.current?.aktualisiere()}
                  className="rounded-none border border-[var(--terminal-border)] px-2 py-1 font-mono text-xs tracking-wide text-[color:var(--ink)] uppercase hover:border-[color:var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                >
                  Aktualisieren
                </button>
              </div>

              {abfrage.status === 'laedt' && (
                <p role="status" className="mt-2 font-mono text-xs text-[color:var(--muted)]">
                  Ansicht wird gelesen …
                </p>
              )}

              {abfrage.status === 'fehler' && (
                <p role="alert" className="mt-2 break-words font-mono text-xs text-[color:var(--ink)]">
                  Ansicht konnte nicht gelesen werden. Bitte erneut aktualisieren.
                </p>
              )}

              {abfrage.status === 'geladen' && abfrage.ausgabe && aktive.art === 'raum' && (
                <RaumAnsicht ansicht={aktive} ausgabe={abfrage.ausgabe} />
              )}

              {aktenInhalt && (
                <Aktenwand
                  inhalt={aktenInhalt}
                  belegRegeln={belegRegeln}
                  zustand={zustand}
                  ausgewaehlteBelegIds={ausgewaehlteBelegIds}
                  onAuswahlAendern={onBelegAuswahlAendern}
                  onVorwurfOeffnen={onVorwurfOeffnen}
                  vorwurfOeffnenAktiv={vorwurfOeffnenAktiv}
                  vorwurfHinweis={vorwurfHinweis}
                />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
