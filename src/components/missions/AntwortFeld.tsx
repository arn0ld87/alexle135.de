// Antwortfeld für Schritte der Art „ablesen“ (ADR 0009): Der Spieler liest einen Wert im
// Terminal ab und trägt ihn hier ein. Die Komponente prüft nichts selbst; sie reicht den Text
// weiter und zeigt nur, dass gerade geprüft wird.
import { useId, useState } from 'react';
import type { AntwortFrage } from '../../lib/missions/ermittlungTypes';

interface AntwortFeldProps {
  antwort: AntwortFrage;
  /** true, solange eine Prüfung in der VM läuft; Feld und Knopf sind dann gesperrt. */
  prueft: boolean;
  onAntworten: (text: string) => void;
}

export default function AntwortFeld({ antwort, prueft, onAntworten }: AntwortFeldProps) {
  const [text, setText] = useState('');
  const feldId = useId();
  const formatId = useId();

  return (
    <form
      className="mt-2 min-w-0 space-y-1"
      onSubmit={(ereignis) => {
        ereignis.preventDefault();
        if (!prueft) onAntworten(text);
      }}
    >
      <label htmlFor={feldId} className="block font-mono text-xs text-[color:var(--ink)]">
        {antwort.frage}
      </label>
      <div className="flex min-w-0 gap-2">
        <input
          id={feldId}
          type="text"
          maxLength={64}
          autoComplete="off"
          placeholder={antwort.format}
          aria-describedby={formatId}
          value={text}
          onChange={(ereignis) => setText(ereignis.target.value)}
          disabled={prueft}
          className="min-w-0 flex-1 rounded-none border border-[var(--terminal-border)] bg-transparent px-2 py-1 font-mono text-xs text-[color:var(--ink)]"
        />
        <button
          type="submit"
          disabled={prueft}
          className="rounded-none border border-[var(--terminal-border)] px-2 py-1 font-mono text-xs tracking-wide text-[color:var(--ink)] uppercase disabled:opacity-50"
        >
          Antworten
        </button>
      </div>
      <p id={formatId} className="font-mono text-xs text-[color:var(--muted)]">
        Format: {antwort.format}
      </p>
      <p role="status" className="font-mono text-xs text-[color:var(--muted)]">
        {prueft ? 'Prüfe deine Antwort …' : ''}
      </p>
    </form>
  );
}
