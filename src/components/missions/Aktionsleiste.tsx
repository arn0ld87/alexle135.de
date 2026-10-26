// Aktionsleiste der Spieloberfläche (#170): Linux-Status, Zähler des bereits Gefundenen und der
// Vorwurf-Knopf. Reine Darstellung; Bedingungen und Hinweistext kommen aus der Ermittlung.
export type LinuxStatus = 'laedt' | 'bereit' | 'fehler';

const STATUS_TEXT: Record<LinuxStatus, string> = {
  laedt: 'Linux lädt',
  bereit: 'Linux bereit',
  fehler: 'Linux-Fehler',
};

const STATUS_PUNKT: Record<LinuxStatus, string> = {
  laedt: 'bg-[color:var(--lk-warn)]',
  bereit: 'bg-[color:var(--lk-ok)]',
  fehler: 'bg-[color:var(--lk-err)]',
};

interface AktionsleisteProps {
  linux: LinuxStatus;
  spurenErledigt: number;
  spurenGesamt: number;
  /** Nur bereits gefundene Belege; die Gesamtzahl bleibt verborgen. */
  belegeGefunden: number;
  /** Fehlt der Handler, entfällt der Knopf (Fall gelöst). */
  onVorwurfOeffnen?: () => void;
  vorwurfAktiv: boolean;
  vorwurfHinweis?: string | null;
}

export default function Aktionsleiste(props: AktionsleisteProps) {
  const {
    linux,
    spurenErledigt,
    spurenGesamt,
    belegeGefunden,
    onVorwurfOeffnen,
    vorwurfAktiv,
    vorwurfHinweis,
  } = props;
  const hinweisId = 'aktionsleiste-hinweis';

  return (
    <div className="shrink-0 border-t border-[color:var(--lk-line)] bg-[rgba(7,10,14,0.82)]">
      {vorwurfHinweis && (
        <p
          id={hinweisId}
          role="status"
          className="px-3 pt-2 text-[13px] break-words text-[color:var(--lk-muted)] sm:px-6"
        >
          {vorwurfHinweis}
        </p>
      )}
      <div className="flex h-[62px] items-center gap-2.5 px-3 sm:px-6 max-[759px]:gap-1.5 [@media(max-height:820px)]:h-[54px]">
        <p
          data-testid="linux-status"
          className="flex items-center gap-2.5 text-[14.5px] whitespace-nowrap text-[color:var(--lk-muted)]"
        >
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${STATUS_PUNKT[linux]}`}
          />
          <span className="max-[759px]:sr-only">{STATUS_TEXT[linux]}</span>
        </p>
        <div className="ml-auto flex items-center gap-3 text-[14.5px] whitespace-nowrap text-[color:var(--lk-muted)] max-[759px]:gap-2 max-[759px]:text-[13px]">
          <p data-testid="aktionsleiste-spuren">
            Spuren{' '}
            <b className="font-medium text-[color:var(--lk-ink)]">
              {spurenErledigt}/{spurenGesamt}
            </b>
          </p>
          <p data-testid="aktionsleiste-belege">
            Belege <b className="font-medium text-[color:var(--lk-ink)]">{belegeGefunden}</b>
          </p>
        </div>
        {onVorwurfOeffnen && (
          <button
            type="button"
            onClick={onVorwurfOeffnen}
            disabled={!vorwurfAktiv}
            aria-disabled={!vorwurfAktiv}
            aria-describedby={vorwurfHinweis ? hinweisId : undefined}
            className="inline-flex h-[42px] items-center justify-center rounded-lg border border-[color:var(--lk-accent-fill)] bg-[color:var(--lk-accent-fill)] px-4 text-[15.5px] font-semibold whitespace-nowrap text-[#fff] hover:bg-[color:var(--lk-accent-fill-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)] disabled:cursor-not-allowed disabled:opacity-45 max-[759px]:px-3 max-[759px]:text-[14px] [@media(max-height:820px)]:h-[38px]"
          >
            Vorwurf erheben
          </button>
        )}
      </div>
    </div>
  );
}
