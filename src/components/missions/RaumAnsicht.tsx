// Reine Raumdarstellung (Ticket 5): statischer Bauplan, Hotspots als native Buttons,
// Detailwerte ausschließlich als React-Text. Kein Agent-Zugriff, kein dynamisches SVG.
import { useEffect, useId, useState, type CSSProperties } from 'react';
import type { AbfrageAusgabe, Ansicht, Hotspot } from '../../lib/missions/ermittlungTypes';

const BREITE = 1000;
const HOEHE = 600;

interface RaumAnsichtProps {
  ansicht: Ansicht;
  ausgabe: AbfrageAusgabe;
}

const istGueltig = (hotspot: Hotspot): boolean =>
  Number.isFinite(hotspot.x) &&
  Number.isFinite(hotspot.y) &&
  Number.isFinite(hotspot.w) &&
  Number.isFinite(hotspot.h) &&
  hotspot.x >= 0 &&
  hotspot.y >= 0 &&
  hotspot.w > 0 &&
  hotspot.h > 0 &&
  hotspot.x + hotspot.w <= BREITE &&
  hotspot.y + hotspot.h <= HOEHE;

const position = (hotspot: Hotspot): CSSProperties =>
  ({
    '--hotspot-x': `${(hotspot.x / BREITE) * 100}%`,
    '--hotspot-y': `${(hotspot.y / HOEHE) * 100}%`,
    '--hotspot-w': `${(hotspot.w / BREITE) * 100}%`,
    '--hotspot-h': `${(hotspot.h / HOEHE) * 100}%`,
  }) as CSSProperties;

export default function RaumAnsicht({ ansicht, ausgabe }: RaumAnsichtProps) {
  const detailId = useId();
  const [aktiveId, setAktiveId] = useState<string | null>(null);

  useEffect(() => {
    setAktiveId(null);
  }, [ansicht.id]);

  const hotspots = ansicht.hotspots ?? [];
  const sichtbar = hotspots.filter(istGueltig);
  const aktiver = sichtbar.find((hotspot) => hotspot.id === aktiveId) ?? null;
  const werte = aktiver ? ausgabe.werte[aktiver.schluessel] : undefined;

  return (
    <div className="mt-3 min-w-0">
      <div className="relative min-w-0">
        <svg
          viewBox={`0 0 ${BREITE} ${HOEHE}`}
          aria-hidden="true"
          focusable="false"
          className="block h-auto w-full border border-[color:var(--panel-rule)] bg-[color:var(--panel)] text-[color:var(--panel-edge)]"
        >
          <rect x="24" y="24" width="952" height="552" fill="none" stroke="currentColor" strokeWidth="4" />
          <line x1="360" y1="24" x2="360" y2="360" stroke="currentColor" strokeWidth="3" />
          <line x1="360" y1="360" x2="976" y2="360" stroke="currentColor" strokeWidth="3" />
          <line x1="24" y1="460" x2="360" y2="460" stroke="currentColor" strokeWidth="3" />
          <rect x="72" y="72" width="220" height="96" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="72" y="212" width="120" height="60" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="430" y="72" width="300" height="70" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="430" y="410" width="180" height="110" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="860" cy="470" r="58" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="72" y1="520" x2="280" y2="520" stroke="currentColor" strokeWidth="2" />
        </svg>

        <div className="mt-2 grid gap-2 md:absolute md:inset-0 md:mt-0 md:block">
          {sichtbar.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              aria-pressed={aktiveId === hotspot.id}
              aria-controls={detailId}
              onClick={() => setAktiveId(hotspot.id)}
              style={position(hotspot)}
              className="w-full min-w-0 rounded-none border border-[color:var(--panel-edge)] bg-[color:var(--panel)] px-2 py-1 text-left font-mono text-xs break-words text-[color:var(--panel-text)] hover:border-[color:var(--panel-accent)] hover:text-[color:var(--panel-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--panel-accent)] md:absolute md:top-[var(--hotspot-y)] md:left-[var(--hotspot-x)] md:flex md:h-[var(--hotspot-h)] md:w-[var(--hotspot-w)] md:items-center md:justify-center md:overflow-hidden md:px-1 md:py-0 md:text-center"
            >
              {hotspot.label}
            </button>
          ))}
        </div>
      </div>

      {sichtbar.length < hotspots.length && (
        <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
          Einige Hotspots haben ungültige Koordinaten und werden nicht angezeigt.
        </p>
      )}

      <div
        id={detailId}
        data-testid="hotspot-detail"
        aria-live="polite"
        className="mt-3 min-w-0 border border-[var(--terminal-border)] p-3"
      >
        {aktiver ? (
          <>
            <h3 className="break-words font-mono text-sm tracking-wide text-[color:var(--ink)] uppercase">
              {aktiver.label}
            </h3>
            {werte && werte.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {werte.map((wert, index) => (
                  <li
                    key={index}
                    className="break-words whitespace-pre-wrap font-mono text-xs text-[color:var(--muted)]"
                  >
                    {wert}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
                Keine lesbaren Angaben vorhanden.
              </p>
            )}
          </>
        ) : (
          <p className="font-mono text-xs text-[color:var(--muted)]">
            Wähle einen Hotspot für Details.
          </p>
        )}
      </div>
    </div>
  );
}
