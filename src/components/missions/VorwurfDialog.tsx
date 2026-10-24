// Ticket 7: Vorwurf-Dialog
import { useEffect, useId, useRef, useState } from 'react';
import type {
  BelegRegel,
  Ermittlung,
  ErmittlungsZustand,
  Verdaechtige,
} from '../../lib/missions/ermittlungTypes';
import type { VorwurfKandidat } from '../../lib/missions/vorwurfAblauf';

interface VorwurfDialogProps {
  open: boolean;
  ermittlung: Ermittlung;
  zustand: ErmittlungsZustand;
  ausgewaehlteBelegIds: readonly string[];
  onAuswahlAendern: (ids: readonly string[]) => void;
  gesperrt: boolean;
  gesperrtHinweis?: string;
  prueft: boolean;
  onAbbrechen: () => void;
  onAbsenden: (kandidat: VorwurfKandidat) => void;
  oeufnerRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function VorwurfDialog(props: VorwurfDialogProps) {
  const {
    open,
    ermittlung,
    zustand,
    ausgewaehlteBelegIds,
    onAuswahlAendern,
    gesperrt,
    gesperrtHinweis,
    prueft,
    onAbbrechen,
    onAbsenden,
    oeufnerRef,
  } = props;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const personRef = useRef<HTMLFieldSetElement | null>(null);
  const [personId, setPersonId] = useState<string>('');
  const titelId = useId();
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPersonId('');
      setFehler(null);
      const d = dialogRef.current;
      if (d && !d.open) {
        try {
          d.showModal();
        } catch {
          d.setAttribute('open', '');
        }
      }
      const first = personRef.current?.querySelector(
        'input[type=radio]'
      ) as HTMLInputElement | null;
      first?.focus();
    } else {
      const d = dialogRef.current;
      if (d?.open) {
        try {
          d.close();
        } catch {
          d.removeAttribute('open');
        }
      }
      if (oeufnerRef?.current?.isConnected) {
        try {
          oeufnerRef.current.focus();
        } catch {
          // ignorieren
        }
      }
    }
  }, [open, oeufnerRef]);

  const erkennte = new Set(zustand.belegeErkannt);
  const erkennteBelege = ermittlung.vorwurf.belege.filter((b) => erkennte.has(b.id));
  const bekanntePersonen = new Set(ermittlung.vorwurf.verdaechtige.map((v) => v.id));
  const bekannteBelege = new Set(ermittlung.vorwurf.belege.map((b) => b.id));

  const toggleBeleg = (id: string, an: boolean) => {
    const set = new Set(ausgewaehlteBelegIds);
    if (an) set.add(id);
    else set.delete(id);
    onAuswahlAendern([...set]);
  };

  const absenden = (e: React.FormEvent) => {
    e.preventDefault();
    if (prueft || gesperrt) return;
    setFehler(null);
    if (!personId) {
      setFehler('Bitte eine Person auswählen.');
      return;
    }
    if (!bekanntePersonen.has(personId)) {
      setFehler('Ungültige Auswahl.');
      return;
    }
    const clean = [...new Set(ausgewaehlteBelegIds)].filter((id) => bekannteBelege.has(id));
    onAbsenden({ verdaechtigeId: personId, belegIds: clean });
  };

  const schliessen = () => {
    onAbbrechen();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titelId}
      aria-busy={prueft}
      className="max-w-xl border border-[var(--terminal-border)] bg-[var(--bg)] p-4 text-[color:var(--ink)]"
      onCancel={(e) => {
        e.preventDefault();
        schliessen();
      }}
    >
      <form ref={formRef} onSubmit={absenden}>
        <header className="flex items-start justify-between gap-2">
          <h2 id={titelId} className="ds-display-s">
            Vorwurf erheben
          </h2>
          <button
            type="button"
            onClick={schliessen}
            className="rounded-none border border-[var(--terminal-border)] px-2 py-1 font-mono text-xs uppercase"
          >
            Abbrechen
          </button>
        </header>
        <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
          Mindestens {ermittlung.vorwurf.mindestBelege} Beleg(e)
          {ermittlung.vorwurf.jedeSpur ? ', mindestens ein Beleg aus jeder Spur' : ''}. Die Prüfung
          erfolgt frisch vor der Bewertung.
        </p>
        {gesperrt && gesperrtHinweis && (
          <p role="status" className="mt-2 font-mono text-xs text-[color:var(--ink)]">
            {gesperrtHinweis}
          </p>
        )}
        <fieldset ref={personRef} className="mt-4">
          <legend className="font-mono text-xs uppercase tracking-wide">Verdächtige</legend>
          <div className="mt-2 grid gap-2">
            {ermittlung.vorwurf.verdaechtige.map((v: Verdaechtige) => (
              <label key={v.id} className="flex items-center gap-2 font-mono text-xs">
                <input
                  type="radio"
                  name="verdacht"
                  value={v.id}
                  checked={personId === v.id}
                  onChange={() => setPersonId(v.id)}
                  disabled={prueft || gesperrt}
                />
                {v.portraet && (
                  <img
                    src={v.portraet}
                    width={40}
                    height={40}
                    alt=""
                    className="h-10 w-10 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span>
                  {v.name} – {v.rolle}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="font-mono text-xs uppercase tracking-wide">Belege</legend>
          <div className="mt-2 grid gap-2">
            {erkennteBelege.map((b: BelegRegel) => (
              <label key={b.id} className="flex items-start gap-2 font-mono text-xs">
                <input
                  type="checkbox"
                  checked={ausgewaehlteBelegIds.includes(b.id)}
                  onChange={(e) => toggleBeleg(b.id, e.target.checked)}
                  disabled={prueft || gesperrt}
                />
                <span className="break-words">
                  {b.beschreibung} (
                  {ermittlung.spuren.find((s) => s.id === b.spurId)?.titel ?? b.spurId})
                </span>
              </label>
            ))}
          </div>
          {erkennteBelege.length === 0 && (
            <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
              Noch keine erkannten Belege.
            </p>
          )}
        </fieldset>
        {fehler && (
          <p role="alert" className="mt-2 font-mono text-xs text-[color:var(--ink)]">
            {fehler}
          </p>
        )}
        {prueft && (
          <p
            role="status"
            aria-busy="true"
            className="mt-2 font-mono text-xs text-[color:var(--muted)]"
          >
            Belege werden geprüft …
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="submit"
            disabled={prueft || gesperrt}
            className="rounded-none border border-[var(--terminal-border)] px-3 py-2 font-mono text-xs uppercase"
          >
            Absenden
          </button>
        </div>
      </form>
    </dialog>
  );
}
