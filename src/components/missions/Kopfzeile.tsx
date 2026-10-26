// Kopfzeile der Spieloberfläche von Staffel 2 (#170): Marke, Titel, Episodenauswahl, „Fortschritt
// löschen“ (Bestätigung im Dialog) und „Spiel verlassen“. Sie kennt nur Nummern, nicht den Speicher.
import { useEffect, useId, useRef, useState } from 'react';
import type { EpisodeKarte } from '../../data/staffeln/staffel-2';

interface KopfzeileProps {
  episoden: readonly EpisodeKarte[];
  /** Nummern der gelösten Episoden. */
  geloest: ReadonlySet<number>;
  /** Nummer der Episode, die gerade läuft. */
  aktuell: number;
  /** Ziel von „Spiel verlassen“. */
  verlassenHref: string;
  /** Wählt eine andere Episode. */
  onWaehle: (href: string) => void;
  /** Nach der Bestätigung im Dialog. */
  onLoeschen: () => void;
}

export default function Kopfzeile(props: KopfzeileProps) {
  const { episoden, geloest, aktuell, verlassenHref, onWaehle, onLoeschen } = props;
  const [dialogOffen, setDialogOffen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const oeffnerRef = useRef<HTMLButtonElement | null>(null);
  const titelId = useId();

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
    'inline-flex h-8 items-center rounded-[7px] border border-transparent px-2 text-xs whitespace-nowrap text-[color:var(--lk-muted)] hover:bg-[rgba(237,230,218,0.06)] hover:text-[color:var(--lk-ink)] sm:px-3 sm:text-[13px]';
  const dialogKnopf =
    'rounded-none border px-3 py-1.5 font-mono text-xs tracking-wide uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)]';

  return (
    <header className="flex h-[46px] shrink-0 items-center gap-2 border-b border-[color:var(--lk-line)] bg-[rgba(7,10,14,0.7)] px-3 sm:gap-4 sm:px-5 [@media(max-height:820px)]:h-10">
      <a
        href="/"
        className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-[color:var(--lk-ink)]"
      >
        <span aria-hidden="true" className="size-3 bg-[color:var(--lk-accent)]" />
        <span className="max-sm:sr-only">alex-schneider.dev</span>
      </a>
      <h1 className="flex flex-1 justify-center gap-3.5 font-mono text-[12.5px] tracking-[0.16em] text-[color:var(--lk-muted)] uppercase max-[759px]:sr-only">
        <span className="text-[color:var(--lk-accent-text)]">Ein Linux-Krimi</span>
        <span aria-hidden="true" className="text-[color:var(--lk-dim)]">
          |
        </span>
        <span>Staffel 2</span>
      </h1>
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <select
          aria-label="Episode wählen"
          value={aktuell}
          onChange={(e) => {
            const ziel = episoden.find((ep) => ep.nr === Number(e.target.value));
            if (ziel && ziel.nr !== aktuell) onWaehle(ziel.href);
          }}
          className="h-[34px] max-w-[9.5rem] rounded-[7px] border border-[color:var(--lk-line-strong)] bg-[rgba(15,21,30,0.8)] px-2 text-sm text-[color:var(--lk-ink)] sm:max-w-none sm:px-3"
        >
          {episoden.map((ep) => (
            <option key={ep.nr} value={ep.nr} className="bg-[#121922]">
              Episode {ep.nr} · {ep.titel}
              {geloest.has(ep.nr) ? ' ✓' : ''}
            </option>
          ))}
        </select>
        <button
          ref={oeffnerRef}
          type="button"
          aria-label="Fortschritt löschen"
          onClick={() => setDialogOffen(true)}
          className={knopf}
        >
          <span aria-hidden="true" className="sm:hidden">
            Löschen
          </span>
          <span aria-hidden="true" className="max-sm:hidden">
            Fortschritt löschen
          </span>
        </button>
        <a href={verlassenHref} aria-label="Spiel verlassen" className={knopf}>
          <span aria-hidden="true" className="sm:hidden">
            Verlassen
          </span>
          <span aria-hidden="true" className="max-sm:hidden">
            Spiel verlassen
          </span>
        </a>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titelId}
        className="max-w-md border border-[color:var(--lk-line-strong)] bg-[color:var(--lk-panel-solid)] p-4 text-[color:var(--lk-ink)]"
        onCancel={(e) => {
          e.preventDefault();
          setDialogOffen(false);
        }}
      >
        <h2 id={titelId} className="text-lg font-bold">
          Fortschritt löschen?
        </h2>
        <p className="mt-2 text-sm">
          Alle gelösten Episoden von Staffel 2 werden vergessen. Staffel 1 bleibt unberührt. Danach
          beginnt die Seite wieder bei Episode {episoden[0]?.nr ?? 0}.
        </p>
        <p className="mt-2 text-sm text-[color:var(--lk-muted)]">
          Gespeichert wird nur, welche Episoden du gelöst hast. Neuladen oder „Neu starten“ im
          Terminal beginnt die laufende Episode von vorn.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => setDialogOffen(false)}
            className={`${dialogKnopf} border-[color:var(--lk-line-strong)]`}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => {
              setDialogOffen(false);
              onLoeschen();
            }}
            className={`${dialogKnopf} border-[color:var(--lk-accent)] text-[color:var(--lk-ink)]`}
          >
            Endgültig löschen
          </button>
        </div>
      </dialog>
    </header>
  );
}
