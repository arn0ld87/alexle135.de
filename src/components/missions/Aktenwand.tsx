// Reine Aktenwand (Ticket 6/7): Dateiliste, Vorschau und Belegauswahl als React-Text.
// Kein Agent-Zugriff, kein Dateischreibpfad, keine Interpretation von Namen als Markup.
import { useId, useState } from 'react';
import { ordneBelege, type AktenInhalt } from '../../lib/missions/aktenwand';
import type { BelegRegel, ErmittlungsZustand } from '../../lib/missions/ermittlungTypes';

interface AktenwandProps {
  inhalt: AktenInhalt;
  belegRegeln: readonly BelegRegel[];
  zustand: ErmittlungsZustand;
  ausgewaehlteBelegIds: readonly string[];
  onAuswahlAendern: (ids: readonly string[]) => void;
  onVorwurfOeffnen?: () => void;
  vorwurfOeffnenAktiv?: boolean;
  vorwurfHinweis?: string | null;
}

const bytesText = (bytes: number): string => (bytes === 1 ? '1 Byte' : `${bytes} Bytes`);

function Vorschau({ text }: { text: string }) {
  const [offen, setOffen] = useState(false);
  const id = useId();

  return (
    <div className="mt-2 min-w-0">
      <button
        type="button"
        aria-expanded={offen}
        aria-controls={id}
        onClick={() => setOffen((wert) => !wert)}
        className="cursor-pointer font-mono text-xs text-[color:var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
      >
        Vorschau (bis 192 Bytes)
      </button>
      {offen && (
        <pre
          id={id}
          className="mt-2 max-w-full break-words whitespace-pre-wrap font-mono text-xs text-[color:var(--muted)]"
        >
          {text}
        </pre>
      )}
    </div>
  );
}

export default function Aktenwand(props: AktenwandProps) {
  const {
    inhalt,
    belegRegeln,
    zustand,
    ausgewaehlteBelegIds,
    onAuswahlAendern,
    onVorwurfOeffnen,
    vorwurfOeffnenAktiv = false,
    vorwurfHinweis,
  } = props;
  const eintraege = ordneBelege(inhalt, belegRegeln, zustand.belegeErkannt);
  const waehle = (belegId: string, an: boolean): void => {
    const naechste = new Set(ausgewaehlteBelegIds);
    if (an) naechste.add(belegId);
    else naechste.delete(belegId);
    onAuswahlAendern([...naechste]);
  };

  return (
    <div className="mt-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="break-words font-mono text-xs text-[color:var(--muted)]">
          Dateien werden beim Öffnen oder Aktualisieren gelesen. Belege prüft das Terminal nach
          einem Befehl.
        </p>
        {onVorwurfOeffnen && (
          <button
            type="button"
            onClick={onVorwurfOeffnen}
            disabled={!vorwurfOeffnenAktiv}
            className="rounded-none border border-[var(--terminal-border)] px-2 py-1 font-mono text-xs tracking-wide text-[color:var(--ink)] uppercase disabled:opacity-50"
            aria-disabled={!vorwurfOeffnenAktiv}
          >
            Vorwurf erheben
          </button>
        )}
      </div>
      {vorwurfHinweis && (
        <p className="mt-2 break-words font-mono text-xs text-[color:var(--ink)]">
          {vorwurfHinweis}
        </p>
      )}

      {inhalt.weitereDateien && (
        <p className="mt-2 break-words font-mono text-xs text-[color:var(--ink)]">
          Die Liste ist auf 50 Dateien begrenzt. Weitere Dateien sind nicht sichtbar.
        </p>
      )}

      {inhalt.hinweis && (
        <p role="status" className="mt-2 break-words font-mono text-xs text-[color:var(--ink)]">
          {inhalt.hinweis}
        </p>
      )}

      {eintraege.length === 0 ? (
        <p className="mt-3 font-mono text-xs text-[color:var(--muted)]">
          Noch keine Dateien in ~/belege/.
        </p>
      ) : (
        <ul className="mt-3 min-w-0 space-y-3">
          {eintraege.map(({ datei, regel, erkannt }) => (
            <li key={datei.name} className="min-w-0 border-b border-[var(--terminal-border)] pb-3">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0 break-words whitespace-pre-wrap font-mono text-sm text-[color:var(--ink)]">
                  {datei.name}
                </span>
                <span className="shrink-0 font-mono text-xs text-[color:var(--muted)]">
                  {bytesText(datei.bytes)}
                </span>
              </div>

              <p className="mt-1 break-words font-mono text-xs text-[color:var(--muted)]">
                {regel
                  ? erkannt
                    ? 'Als Beleg erkannt'
                    : 'Noch nicht als Beleg erkannt'
                  : 'Keine Belegregel für diese Datei'}
              </p>

              {regel && erkannt && (
                <label className="mt-2 flex min-w-0 items-start gap-2 font-mono text-xs text-[color:var(--ink)]">
                  <input
                    type="checkbox"
                    checked={ausgewaehlteBelegIds.includes(regel.id)}
                    onChange={(ereignis) => waehle(regel.id, ereignis.target.checked)}
                    className="mt-0.5 shrink-0 rounded-none"
                  />
                  <span className="min-w-0 break-words">
                    {`${regel.beschreibung}: ${datei.name}`}
                  </span>
                </label>
              )}

              <Vorschau text={datei.vorschau} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
