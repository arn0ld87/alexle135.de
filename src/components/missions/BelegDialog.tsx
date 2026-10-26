// Vergrößerte Ansicht eines Belegs der Fallakte (#170): reine Darstellung, kein Zugriff auf VM oder
// Fortschritt. Escape schließt nur außerhalb des Terminals; Fokus bleibt im Dialog.
import { useEffect, useRef } from 'react';
import { fokusImTerminal, haltFokusIn } from '../../lib/missions/terminalFokus';

export interface BelegAnsicht {
  id: string;
  titel: string;
  /** Spur, aus der der Beleg stammt. */
  spurTitel: string;
}

interface BelegDialogProps {
  beleg: BelegAnsicht;
  onSchliessen: () => void;
}

export default function BelegDialog({ beleg, onSchliessen }: BelegDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const schliessenRef = useRef<HTMLButtonElement | null>(null);
  const titelId = `beleg-dialog-${beleg.id}`;

  useEffect(() => {
    schliessenRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!fokusImTerminal()) onSchliessen();
        return;
      }
      haltFokusIn(e, dialogRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSchliessen]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-[rgba(4,6,9,0.7)]" onClick={onSchliessen} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        className="relative flex max-h-full w-[min(640px,100%)] flex-col gap-3 overflow-auto rounded-[var(--lk-r)] border border-[color:var(--lk-line-strong)] bg-[color:var(--lk-panel-solid)] p-5 text-[color:var(--lk-ink)] shadow-[var(--lk-shadow)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titelId} className="text-xl leading-tight font-bold">
            Beleg
          </h2>
          <button
            ref={schliessenRef}
            type="button"
            onClick={onSchliessen}
            className="inline-flex h-9 shrink-0 items-center rounded-[var(--lk-r-sm)] border border-[color:var(--lk-line-strong)] px-3 text-[13px] hover:bg-[rgba(255,255,255,0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)]"
          >
            Schließen
          </button>
        </div>
        <p className="font-mono text-[15px] leading-relaxed whitespace-pre-wrap text-[color:var(--lk-ink)]">
          {beleg.titel}
        </p>
        <p className="font-mono text-[11.5px] tracking-[0.14em] text-[color:var(--lk-dim)] uppercase">
          Spur: {beleg.spurTitel}
        </p>
      </div>
    </div>
  );
}
