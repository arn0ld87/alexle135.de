// Episodenübersicht von Staffel 2: Nummer, Titel und Stand je Episode als Links, dazu der Hinweis zum
// Neuladen und das Löschen des Fortschritts (Bestätigung im Dialog). Sie kennt nur Nummern, nicht den Speicher.
import { useEffect, useId, useRef, useState } from 'react';
import type { EpisodeKarte } from '../../data/staffeln/staffel-2';

interface EpisodenuebersichtProps {
  episoden: readonly EpisodeKarte[];
  /** Nummern der gelösten Episoden. */
  geloest: ReadonlySet<number>;
  /** Nummer der Episode, die gerade läuft. */
  aktuell: number;
  /** Nach der Bestätigung im Dialog. */
  onLoeschen: () => void;
}

export default function Episodenuebersicht(props: EpisodenuebersichtProps) {
  const { episoden, geloest, aktuell, onLoeschen } = props;
  const [dialogOffen, setDialogOffen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const oeffnerRef = useRef<HTMLButtonElement | null>(null);
  const titelId = useId();
  const anzahl = episoden.filter((e) => geloest.has(e.nr)).length;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (dialogOffen && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
    } else if (!dialogOffen && d.open) {
      try {
        d.close();
      } catch {
        d.removeAttribute('open');
      }
      oeffnerRef.current?.focus();
    }
  }, [dialogOffen]);

  const knopf =
    'rounded-none border px-3 py-1.5 font-mono text-xs tracking-wide uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]';

  return (
    <section aria-labelledby="episoden-titel" className="mb-3 min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2 id="episoden-titel" className="ds-kicker">
          Episoden
        </h2>
        <p role="status" aria-live="polite" data-testid="episoden-zaehler" className="ds-meta">
          {anzahl} von {episoden.length} gelöst
        </p>
        <ul className="flex flex-wrap gap-2">
          {episoden.map((e) => (
            <li key={e.nr}>
              <a
                href={e.href}
                aria-current={e.nr === aktuell ? 'page' : undefined}
                className={`inline-block border px-2 py-1 font-mono text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
                  e.nr === aktuell
                    ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
                    : 'border-[color:var(--line)] text-[color:var(--muted)]'
                }`}
              >
                Episode {e.nr} · {e.titel} · {geloest.has(e.nr) ? 'gelöst' : 'offen'}
              </a>
            </li>
          ))}
        </ul>
        <button
          ref={oeffnerRef}
          type="button"
          onClick={() => setDialogOffen(true)}
          className={`${knopf} ml-auto border-[color:var(--line)] text-[color:var(--muted)]`}
        >
          Fortschritt von Staffel 2 löschen
        </button>
      </div>
      <p className="mt-1 font-mono text-xs text-[color:var(--muted)]">
        Gespeichert wird nur, welche Episoden du gelöst hast. Neuladen oder „Neu starten“ im
        Terminal beginnt die laufende Episode von vorn.
      </p>
      <dialog
        ref={dialogRef}
        aria-labelledby={titelId}
        className="max-w-md border border-[var(--terminal-border)] bg-[var(--bg)] p-4 text-[color:var(--ink)]"
        onCancel={(e) => {
          e.preventDefault();
          setDialogOffen(false);
        }}
      >
        <h2 id={titelId} className="ds-display-s">
          Fortschritt löschen?
        </h2>
        <p className="mt-2 text-sm">
          Alle gelösten Episoden von Staffel 2 werden vergessen. Staffel 1 bleibt unberührt. Danach
          beginnt die Seite wieder bei Episode {episoden[0]?.nr ?? 0}.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => setDialogOffen(false)}
            className={`${knopf} border-[var(--terminal-border)]`}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => {
              setDialogOffen(false);
              onLoeschen();
            }}
            className={`${knopf} border-[color:var(--accent)] text-[color:var(--ink)]`}
          >
            Endgültig löschen
          </button>
        </div>
      </dialog>
    </section>
  );
}
