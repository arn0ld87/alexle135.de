// Fallakte der Spieloberfläche (#170): rechte Spalte ab 1180 px, darunter Overlay mit Abdunklung.
// Reine Hülle um Einsatzrahmen, Spuren, Belege und Hilfe; bleibt gemountet (nur `hidden`), damit
// gezeigte Tipps stehen bleiben. Escape gehört im Terminal xterm (#151).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fokusImTerminal, haltFokusIn } from '../../lib/missions/terminalFokus';
import BelegDialog, { type BelegAnsicht } from './BelegDialog';

const SPALTE_QUERY = '(min-width: 1180px)';

/** Ab 1180 px steht die Akte als Spalte neben der Arbeitsfläche; darunter ist sie Overlay. */
export const istSpaltenModus = (): boolean =>
  typeof window.matchMedia !== 'function' || window.matchMedia(SPALTE_QUERY).matches;

interface FallakteProps {
  id: string;
  offen: boolean;
  onSchliessen: () => void;
  belege: readonly BelegAnsicht[];
  /** Einsatzrahmen, Spuren und Hilfe; die Akte setzt Rahmen und Belege dazwischen. */
  vorBelegen: ReactNode;
  nachBelegen: ReactNode;
}

export const kickerKlasse =
  'font-mono text-[11.5px] tracking-[0.14em] text-[color:var(--lk-dim)] uppercase';

export default function Fallakte(props: FallakteProps) {
  const { id, offen, onSchliessen, belege, vorBelegen, nachBelegen } = props;
  const [overlay, setOverlay] = useState(() => !istSpaltenModus());
  const [belegId, setBelegId] = useState<string | null>(null);
  const akteRef = useRef<HTMLElement | null>(null);
  const schliessenRef = useRef<HTMLButtonElement | null>(null);
  const kartenRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const beleg = belege.find((eintrag) => eintrag.id === belegId) ?? null;
  const belegOffen = beleg !== null;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const liste = window.matchMedia(SPALTE_QUERY);
    if (typeof liste.addEventListener !== 'function') return;
    const aendern = () => setOverlay(!liste.matches);
    aendern();
    liste.addEventListener('change', aendern);
    return () => liste.removeEventListener('change', aendern);
  }, []);

  // Overlay-Modus: Fokus in die Akte, Fokusfalle, Escape außerhalb des Terminals. Der Beleg-Dialog
  // darüber hat seine eigene Falle und seinen eigenen Escape.
  useEffect(() => {
    if (!offen || !overlay) return;
    if (!belegOffen) schliessenRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (belegOffen) return;
      if (e.key === 'Escape') {
        if (!fokusImTerminal()) onSchliessen();
        return;
      }
      haltFokusIn(e, akteRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [offen, overlay, belegOffen, onSchliessen]);

  const schliesseBeleg = () => {
    const zurueck = belegId ? kartenRef.current[belegId] : null;
    setBelegId(null);
    zurueck?.focus();
  };

  return (
    <>
      {offen && overlay && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Fallakte schließen"
          onClick={onSchliessen}
          className="absolute inset-0 z-[39] cursor-default border-0 bg-[rgba(4,6,9,0.55)] p-0"
        />
      )}
      <aside
        ref={akteRef}
        id={id}
        hidden={!offen}
        aria-labelledby={`${id}-titel`}
        className={`z-40 flex min-h-0 min-w-0 flex-col overflow-hidden bg-[rgba(14,19,27,0.94)] ${
          overlay
            ? 'absolute top-3.5 right-3 bottom-3 w-[min(400px,calc(100%-24px))] rounded-[var(--lk-r)] border border-[color:var(--lk-line-strong)] shadow-[var(--lk-shadow)] backdrop-blur-[10px] max-[759px]:inset-0 max-[759px]:w-auto max-[759px]:rounded-none'
            : 'w-[372px] border-l border-[color:var(--lk-line)]'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between py-2.5 pr-2.5 pl-[18px]">
          <h2 id={`${id}-titel`} className="text-xl font-bold text-[color:var(--lk-ink)]">
            Fallakte
          </h2>
          <button
            ref={schliessenRef}
            type="button"
            onClick={onSchliessen}
            className="inline-flex h-9 items-center rounded-[var(--lk-r-sm)] border border-[color:var(--lk-line-strong)] px-3 text-[13px] text-[color:var(--lk-ink)] hover:bg-[rgba(255,255,255,0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)]"
          >
            Schließen
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-0.5 pb-3">
          {vorBelegen}
          <section aria-labelledby={`${id}-belege`} className="min-w-0">
            <h2 id={`${id}-belege`} className={kickerKlasse}>
              Belege
            </h2>
            {belege.length === 0 ? (
              <p
                data-testid="belege-leer"
                className="mt-2 rounded-lg border border-dashed border-[color:var(--lk-line-strong)] px-4 py-5 text-center text-sm text-[color:var(--lk-muted)]"
              >
                <strong className="mb-1 block text-[15px] font-semibold text-[color:var(--lk-ink)]">
                  Noch keine Belege
                </strong>
                Gefundene Belege erscheinen hier.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {belege.map((eintrag) => (
                  <li key={eintrag.id}>
                    <button
                      type="button"
                      ref={(el) => {
                        kartenRef.current[eintrag.id] = el;
                      }}
                      onClick={() => setBelegId(eintrag.id)}
                      aria-label={`Beleg vergrößern: ${eintrag.titel}`}
                      className="flex w-full flex-col gap-1 rounded-lg border border-[color:var(--lk-line-strong)] bg-[color:var(--lk-panel-solid)] px-3 py-2 text-left hover:bg-[rgba(255,255,255,0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)]"
                    >
                      <span className="text-[13.5px] text-[color:var(--lk-ink)]">
                        {eintrag.titel}
                      </span>
                      <span className={kickerKlasse}>{eintrag.spurTitel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {nachBelegen}
        </div>
      </aside>
      {beleg && <BelegDialog beleg={beleg} onSchliessen={schliesseBeleg} />}
    </>
  );
}
