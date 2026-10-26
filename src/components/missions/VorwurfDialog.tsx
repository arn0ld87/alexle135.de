// Ticket 7: Vorwurf-Dialog
import { useEffect, useId, useRef, useState } from 'react';
import type {
  BelegRegel,
  Ermittlung,
  ErmittlungsZustand,
  Verdaechtige,
} from '../../lib/missions/ermittlungTypes';
import { fokusImTerminal } from '../../lib/missions/terminalFokus';
import type { VorwurfKandidat } from '../../lib/missions/vorwurfAblauf';

const knopf =
  'inline-flex h-[38px] items-center rounded-lg border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)]';
const legende = 'text-[11.5px] tracking-[0.14em] text-[color:var(--lk-dim)] uppercase';

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
      className="m-auto max-h-[calc(100dvh-20px)] w-[min(740px,calc(100%-20px))] flex-col overflow-hidden rounded-xl border border-[color:var(--lk-line-strong)] bg-[color:var(--lk-panel-solid)] p-0 text-[color:var(--lk-ink)] shadow-[var(--lk-shadow)] backdrop:bg-[rgba(4,6,9,0.74)] backdrop:backdrop-blur-[3px] open:flex"
      onCancel={(e) => {
        e.preventDefault();
        if (!fokusImTerminal()) schliessen();
      }}
    >
      <form ref={formRef} onSubmit={absenden} className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--lk-line)] py-3 pr-3.5 pl-5.5">
          <h2 id={titelId} className="text-xl font-bold">
            Vorwurf erheben
          </h2>
          <button
            type="button"
            onClick={schliessen}
            className={`${knopf} border-[color:var(--lk-line-strong)]`}
          >
            Abbrechen
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-5.5 py-4.5">
          <p className="text-sm text-[color:var(--lk-muted)]">
            Mindestens {ermittlung.vorwurf.mindestBelege} Beleg(e)
            {ermittlung.vorwurf.jedeSpur ? ', mindestens ein Beleg aus jeder Spur' : ''}. Die
            Prüfung erfolgt frisch vor der Bewertung.
          </p>
          {gesperrt && gesperrtHinweis && (
            <p role="status" className="mt-2 text-sm text-[color:var(--lk-ink)]">
              {gesperrtHinweis}
            </p>
          )}
          <fieldset ref={personRef} className="mt-5 min-w-0">
            <legend className={legende}>Verdächtige</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ermittlung.vorwurf.verdaechtige.map((v: Verdaechtige) => (
                <label
                  key={v.id}
                  className="flex items-center gap-3 rounded-lg border border-[color:var(--lk-line)] p-2.5 text-sm has-[:checked]:border-[color:var(--lk-accent)] has-[:checked]:bg-[color:var(--lk-accent-soft)]"
                >
                  <input
                    type="radio"
                    name="verdacht"
                    value={v.id}
                    checked={personId === v.id}
                    onChange={() => setPersonId(v.id)}
                    disabled={prueft || gesperrt}
                    className="accent-[color:var(--lk-accent)]"
                  />
                  {v.portraet && (
                    <img
                      src={v.portraet}
                      width={40}
                      height={40}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
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
          <fieldset className="mt-5 min-w-0">
            <legend className={legende}>Belege</legend>
            <div className="mt-2 grid gap-2">
              {erkennteBelege.map((b: BelegRegel) => (
                <label key={b.id} className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={ausgewaehlteBelegIds.includes(b.id)}
                    onChange={(e) => toggleBeleg(b.id, e.target.checked)}
                    disabled={prueft || gesperrt}
                    className="mt-0.5 accent-[color:var(--lk-accent)]"
                  />
                  <span className="break-words">
                    {b.beschreibung} (
                    {ermittlung.spuren.find((s) => s.id === b.spurId)?.titel ?? b.spurId})
                  </span>
                </label>
              ))}
            </div>
            {erkennteBelege.length === 0 && (
              <p className="mt-2 text-sm text-[color:var(--lk-muted)]">
                Noch keine erkannten Belege.
              </p>
            )}
          </fieldset>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[color:var(--lk-line)] px-5.5 py-3.5">
          {fehler && (
            <p role="alert" className="mr-auto text-sm text-[color:var(--lk-accent-text)]">
              {fehler}
            </p>
          )}
          {prueft && (
            <p
              role="status"
              aria-busy="true"
              className="mr-auto text-sm text-[color:var(--lk-muted)]"
            >
              Belege werden geprüft …
            </p>
          )}
          <button
            type="submit"
            disabled={prueft || gesperrt}
            className={`${knopf} border-[color:var(--lk-accent-fill)] bg-[color:var(--lk-accent-fill)] font-semibold text-[#fff] hover:bg-[color:var(--lk-accent-fill-hover)] disabled:cursor-not-allowed disabled:opacity-45`}
          >
            Absenden
          </button>
        </div>
      </form>
    </dialog>
  );
}
