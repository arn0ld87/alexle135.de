import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { AgentClient } from '../../lib/missions/agentClient';
import { aktuellerSchritt, startZustand } from '../../lib/missions/ermittlung';
import type {
  Ermittlung,
  ErmittlungsEreignis,
  ErmittlungsZustand,
} from '../../lib/missions/ermittlungTypes';
import type { MissionCommand, MissionReply } from '../../lib/missions/missionTypes';
import { anhaengen, satz } from '../../lib/missions/pager';
import type { PagerArt, PagerNachricht, Pose } from '../../lib/missions/pager';
import { erzeugePruefLauf } from '../../lib/missions/pruefLauf';
import type { PruefLauf } from '../../lib/missions/pruefLauf';
import { STAFFEL2_HOSTNAME, rahmenSetupSkript } from '../../lib/missions/staffel2Rahmen';
import Pager from './Pager';

const LazyV86Terminal = lazy(() => import('./V86Terminal'));

const PRUEF_HINWEIS = 'Prüfung gerade nicht erreichbar. Der nächste Befehl versucht es erneut.';
const RAHMEN_FEHLER = 'Der Rahmen für Staffel 2 konnte nicht gesetzt werden.';
const MISSION_HINWEIS = 'In Staffel 2 gibt es mission noch nicht. Schau in den Pager.';

interface ErmittlungAppProps {
  ermittlung: Ermittlung;
  hostname?: string;
}

type Bereich = 'ansicht' | 'terminal';

export default function ErmittlungApp(props: ErmittlungAppProps) {
  const { ermittlung, hostname = STAFFEL2_HOSTNAME } = props;
  const [pager, setPager] = useState<PagerNachricht[]>([]);
  const [pruefHinweis, setPruefHinweis] = useState<string | null>(null);
  const [rahmenFehler, setRahmenFehler] = useState<string | null>(null);
  const [bereich, setBereich] = useState<Bereich>('terminal');
  const zustand = useRef<ErmittlungsZustand>(startZustand());
  const lauf = useRef<PruefLauf | null>(null);
  const promptAusstehend = useRef(false);

  const melde = useCallback((art: PagerArt, zeilen: string[], pose?: Pose) => {
    setPager((verlauf) => anhaengen(verlauf, art, zeilen, pose));
  }, []);

  const schreibeZustand = useCallback(
    (neu: ErmittlungsZustand, ereignisse: readonly ErmittlungsEreignis[]) => {
      zustand.current = neu;
      setPruefHinweis(null);
      for (const ereignis of ereignisse) {
        if (ereignis.type === 'schritt-erledigt') {
          const spur = ermittlung.spuren.find((eintrag) => eintrag.id === ereignis.spurId);
          const schritt = spur?.schritte.find((eintrag) => eintrag.id === ereignis.schrittId);
          if (schritt) melde('erledigt', [satz(`Erledigt: ${schritt.title}`)]);
        } else if (ereignis.type === 'spur-erledigt') {
          const spur = ermittlung.spuren.find((eintrag) => eintrag.id === ereignis.spurId);
          if (spur) melde('erledigt', [satz(`Spur abgeschlossen: ${spur.titel}`)]);
        }
      }
    },
    [ermittlung, melde]
  );

  const onReady = useCallback(
    async (client: AgentClient) => {
      lauf.current?.stoppe();
      lauf.current = null;
      promptAusstehend.current = false;
      setRahmenFehler(null);
      try {
        await client.run(rahmenSetupSkript(hostname), 60_000);
        await client.run(ermittlung.setup, 60_000);
      } catch {
        setRahmenFehler(RAHMEN_FEHLER);
        return;
      }
      const start = startZustand();
      zustand.current = start;
      setPager([]);
      setPruefHinweis(null);
      lauf.current = erzeugePruefLauf({
        ermittlung,
        run: (skript, timeoutMs) => client.run(skript, timeoutMs),
        leseZustand: () => zustand.current,
        schreibeZustand,
        meldeFehler: () => setPruefHinweis(PRUEF_HINWEIS),
      });
      if (promptAusstehend.current) {
        promptAusstehend.current = false;
        lauf.current.anstossen();
      }
      const erster = ermittlung.spuren
        .map((spur) => aktuellerSchritt(spur, start))
        .find((schritt) => schritt !== null);
      if (erster) melde('auftrag', [...erster.pager]);
    },
    [ermittlung, hostname, melde, schreibeZustand]
  );

  const onMissionCommand = useCallback(async (command: MissionCommand): Promise<MissionReply> => {
    if (command === '__prompt') {
      // Der erste Prompt der frischen Shell kann während des Setups eintreffen; dann nachholen.
      if (lauf.current) lauf.current.anstossen();
      else promptAusstehend.current = true;
      return { exitCode: 0, text: '' };
    }
    return { exitCode: 1, text: MISSION_HINWEIS };
  }, []);

  useEffect(() => () => lauf.current?.stoppe(), []);

  return (
    <div className="grid gap-4 lg:min-h-[32rem] lg:flex-1">
      <Pager nachrichten={pager} />
      {rahmenFehler && <p role="alert">{rahmenFehler}</p>}
      {pruefHinweis && <p role="status">{pruefHinweis}</p>}
      <div className="flex gap-2 lg:hidden">
        <button
          type="button"
          aria-pressed={bereich === 'ansicht'}
          onClick={() => setBereich('ansicht')}
          className={`flex-1 rounded border px-3 py-2 font-mono text-xs tracking-wide uppercase ${
            bereich === 'ansicht'
              ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
              : 'border-transparent text-[color:var(--muted)]'
          }`}
        >
          Ansicht
        </button>
        <button
          type="button"
          aria-pressed={bereich === 'terminal'}
          onClick={() => setBereich('terminal')}
          className={`flex-1 rounded border px-3 py-2 font-mono text-xs tracking-wide uppercase ${
            bereich === 'terminal'
              ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
              : 'border-transparent text-[color:var(--muted)]'
          }`}
        >
          Terminal
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section
          aria-labelledby="staffel2-ansichten"
          className={`min-w-0 ${bereich === 'ansicht' ? 'lg:block' : 'hidden lg:block'}`}
        >
          <h2 id="staffel2-ansichten" className="ds-display-s text-[color:var(--ink)]">
            Ansichten
          </h2>
          <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">Die Ansichten folgen.</p>
        </section>
        <div className={`min-w-0 ${bereich === 'terminal' ? 'lg:block' : 'hidden lg:block'}`}>
          <Suspense
            fallback={<p className="font-mono text-xs text-[color:var(--muted)]">Terminal lädt …</p>}
          >
            <LazyV86Terminal
              className="h-[60dvh] min-h-[20rem] lg:h-full lg:min-h-[12rem]"
              onReady={onReady}
              onMissionCommand={onMissionCommand}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
