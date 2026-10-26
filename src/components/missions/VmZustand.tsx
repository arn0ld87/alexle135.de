// Lade- und Fehlerzustand der VM im Spielmodus (#170). Reine Darstellung über dem Terminal-Panel;
// die Meldung für Hilfstechnik bleibt die Statuszeile von V86Terminal/V86Bildschirm.
import type { TerminalPhase } from '../../lib/missions/terminalStatus';

interface VmZustandProps {
  phase: TerminalPhase;
}

const KARTE = 'w-[min(440px,100%)] rounded-[var(--lk-r)] border p-5';

export default function VmZustand({ phase }: VmZustandProps) {
  if (phase.kind === 'fehler') {
    return (
      <div
        aria-hidden="true"
        data-testid="vm-fehler"
        className="pointer-events-none absolute inset-0 grid place-items-center bg-[color:var(--lk-term,#0a0d12)] p-6"
      >
        <div className={`${KARTE} border-[rgba(240,142,114,0.45)] bg-[rgba(240,142,114,0.07)]`}>
          <h3 className="text-lg font-bold text-[color:var(--lk-ink)]">
            Linux ist nicht gestartet
          </h3>
          <p className="mt-1.5 text-[14.5px] text-[color:var(--lk-muted)]">
            Der Rechner antwortet nicht. Mit „Neu starten“ oben rechts noch einmal versuchen.
          </p>
        </div>
      </div>
    );
  }
  if (phase.kind === 'bereit') return null;
  const prozent = phase.kind === 'laden' ? phase.percent : null;
  return (
    <div
      data-testid="vm-laden"
      className="pointer-events-none absolute inset-0 grid place-items-center bg-[color:var(--lk-term,#0a0d12)] p-6"
    >
      <div className={`${KARTE} border-[color:var(--lk-line-strong)] bg-[color:var(--lk-panel)]`}>
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-[color:var(--lk-ink)]">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-[color:var(--lk-warn)] motion-safe:animate-pulse"
          />
          {phase.kind === 'start' ? 'Linux startet …' : 'Linux wird geladen …'}
        </h3>
        <p className="mt-1.5 text-[14.5px] text-[color:var(--lk-muted)]">
          Auf dem Handy dauert der erste Start etwas länger.
        </p>
        {prozent !== null && (
          <div
            role="progressbar"
            aria-label="Ladefortschritt"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={prozent}
            className="mt-3.5 h-1.5 overflow-hidden rounded-[3px] bg-[#1c242f]"
          >
            <span
              className="block h-full bg-[color:var(--lk-accent)]"
              style={{ width: `${prozent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
