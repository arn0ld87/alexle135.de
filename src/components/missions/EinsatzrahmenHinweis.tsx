// Schriftlicher Einsatzrahmen der Staffel-2-App (Ticket 8): auf Abruf lesbar, nie automatisch
// geöffnet. Der Status kommt ausschließlich aus dem Ermittlungszustand; Texte nur als React-Text.
interface EinsatzrahmenHinweisProps {
  text: readonly string[];
  verletzt: boolean;
  gesperrt: boolean;
}

export default function EinsatzrahmenHinweis({
  text,
  verletzt,
  gesperrt,
}: EinsatzrahmenHinweisProps) {
  return (
    <section aria-label="Einsatzrahmen" className="min-w-0 space-y-2">
      <details className="rounded border border-[color:var(--line)] px-3 py-2">
        <summary className="ds-display-s cursor-pointer text-[color:var(--ink)]">
          Einsatzrahmen
        </summary>
        <div className="mt-2 space-y-1 text-sm text-[color:var(--ink)]">
          {text.map((zeile, index) => (
            <p key={index}>{zeile}</p>
          ))}
        </div>
      </details>
      {verletzt && (
        <p role="status" className="font-mono text-xs text-[color:var(--muted)]">
          Einsatzrahmen verletzt.
          {gesperrt && ' Der Vorwurf ist vorübergehend gesperrt.'}
        </p>
      )}
    </section>
  );
}
