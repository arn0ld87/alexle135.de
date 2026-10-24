import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { AgentClient } from '../../lib/missions/agentClient';
import { aktuellerSchritt, istGesperrt, startZustand } from '../../lib/missions/ermittlung';
import type {
  Ermittlung,
  ErmittlungsEreignis,
  ErmittlungsZustand,
  Spur,
} from '../../lib/missions/ermittlungTypes';
import type { MissionCommand, MissionReply } from '../../lib/missions/missionTypes';
import { anhaengen, satz } from '../../lib/missions/pager';
import type { PagerArt, PagerNachricht, Pose } from '../../lib/missions/pager';
import { erzeugeErmittlungsRun } from '../../lib/missions/ermittlungsRun';
import { erzeugePruefLauf } from '../../lib/missions/pruefLauf';
import type { PruefLauf } from '../../lib/missions/pruefLauf';
import { STAFFEL2_HOSTNAME, rahmenSetupSkript } from '../../lib/missions/staffel2Rahmen';
import { erstelleFrischPruef, erstelleVorwurfAblauf, type VorwurfKandidat } from '../../lib/missions/vorwurfAblauf';
import Ansichten from './Ansichten';
import ErmittlungsAbschluss from './ErmittlungsAbschluss';
import Pager from './Pager';
import Spurenliste from './Spurenliste';
import VorwurfDialog from './VorwurfDialog';

const LazyV86Terminal = lazy(() => import('./V86Terminal'));

const PRUEF_HINWEIS = 'Prüfung gerade nicht erreichbar. Der nächste Befehl versucht es erneut.';
const RAHMEN_FEHLER = 'Der Rahmen für Staffel 2 konnte nicht gesetzt werden.';
const MISSION_HINWEIS = 'In Staffel 2 gibt es mission noch nicht. Schau in den Pager.';

interface ErmittlungAppProps {
  ermittlung: Ermittlung;
  hostname?: string;
}

type Bereich = 'ansicht' | 'terminal';

/** Erste Spur mit offenem Schritt in Datenreihenfolge; sonst die erste Spur; sonst null. */
function ersteSpur(spuren: readonly Spur[], zustand: ErmittlungsZustand): Spur | null {
  return spuren.find((spur) => aktuellerSchritt(spur, zustand) !== null) ?? spuren[0] ?? null;
}

export default function ErmittlungApp(props: ErmittlungAppProps) {
  const { ermittlung, hostname = STAFFEL2_HOSTNAME } = props;
  const [pager, setPager] = useState<PagerNachricht[]>([]);
  const [pruefHinweis, setPruefHinweis] = useState<string | null>(null);
  const [rahmenFehler, setRahmenFehler] = useState<string | null>(null);
  const [bereich, setBereich] = useState<Bereich>('terminal');
  const [anzeigeZustand, setAnzeigeZustand] = useState<ErmittlungsZustand>(startZustand);
  const [setupGeneration, setSetupGeneration] = useState(0);
  const [aktiveSpurId, setAktiveSpurId] = useState<string | null>(
    () => ersteSpur(ermittlung.spuren, startZustand())?.id ?? null
  );
  const [ausgewaehlteBelegIds, setAusgewaehlteBelegIds] = useState<readonly string[]>([]);
  const [runAdapter] = useState(() => erzeugeErmittlungsRun());
  const [dialogOffen, setDialogOffen] = useState(false);
  const [prueftVorwurf, setPrueftVorwurf] = useState(false);
  const [vorwurfHinweis, setVorwurfHinweis] = useState<string | null>(null);
  const oeufnerRef = useRef<HTMLButtonElement | null>(null);
  const submitGuard = useRef(false);
  const zustand = useRef<ErmittlungsZustand>(startZustand());
  const lauf = useRef<PruefLauf | null>(null);
  const clientRef = useRef<AgentClient | null>(null);
  const promptAusstehend = useRef(false);
  const setupVersion = useRef(0);

  const melde = useCallback((art: PagerArt, zeilen: string[], pose?: Pose) => {
    setPager((verlauf) => anhaengen(verlauf, art, zeilen, pose));
  }, []);

  const schreibeZustand = useCallback(
    (neu: ErmittlungsZustand, ereignisse: readonly ErmittlungsEreignis[]) => {
      zustand.current = neu;
      setAnzeigeZustand(neu);
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
      const version = ++setupVersion.current;
      clientRef.current = client;
      setSetupGeneration(0);
      lauf.current?.stoppe();
      lauf.current = null;
      promptAusstehend.current = false;
      setRahmenFehler(null);
      try {
        const rahmen = await runAdapter.run(
          client,
          rahmenSetupSkript(hostname),
          60_000,
          () => version === setupVersion.current
        );
        if (version !== setupVersion.current) return;
        if (rahmen.exitCode !== 0) throw new Error(RAHMEN_FEHLER);
        const episode = await runAdapter.run(
          client,
          ermittlung.setup,
          60_000,
          () => version === setupVersion.current
        );
        if (version !== setupVersion.current) return;
        if (episode.exitCode !== 0) throw new Error(RAHMEN_FEHLER);
      } catch {
        if (version === setupVersion.current) setRahmenFehler(RAHMEN_FEHLER);
        return;
      }
      const start = startZustand();
      zustand.current = start;
      setAnzeigeZustand(start);
      const startSpur = ersteSpur(ermittlung.spuren, start);
      setAktiveSpurId(startSpur?.id ?? null);
      setAusgewaehlteBelegIds([]);
      setSetupGeneration(version);
      setPager([]);
      setPruefHinweis(null);
      lauf.current = erzeugePruefLauf({
        ermittlung,
        run: (skript, timeoutMs) =>
          runAdapter.run(client, skript, timeoutMs, () => version === setupVersion.current),
        leseZustand: () => zustand.current,
        schreibeZustand,
        meldeFehler: () => setPruefHinweis(PRUEF_HINWEIS),
      });
      if (promptAusstehend.current) {
        promptAusstehend.current = false;
        lauf.current.anstossen();
      }
      const erster = startSpur ? aktuellerSchritt(startSpur, start) : null;
      if (erster) melde('auftrag', [...erster.pager]);
    },
    [ermittlung, hostname, melde, runAdapter, schreibeZustand]
  );

  const abfrageRun = useCallback(
    (skript: string, timeoutMs: number) => {
      const client = clientRef.current;
      if (!client || setupGeneration === 0) {
        return Promise.reject(new Error('Ansichten sind noch nicht bereit.'));
      }
      return runAdapter.run(
        client,
        skript,
        timeoutMs,
        () => setupGeneration === setupVersion.current
      );
    },
    [runAdapter, setupGeneration]
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

  const pruefeFrischFn = useCallback(
    erstelleFrischPruef({
      ermittlung,
      run: (skript: string, timeoutMs: number) => {
        const client = clientRef.current;
        if (!client || setupGeneration === 0) {
          return Promise.reject(new Error('Nicht bereit'));
        }
        return runAdapter.run(client, skript, timeoutMs, () => setupGeneration === setupVersion.current);
      },
      leseZustand: () => zustand.current,
      schreibeZustand: schreibeZustand,
      getPruefLauf: () => lauf.current,
      getGeneration: () => setupGeneration,
      getSetupVersion: () => setupVersion.current,
    }),
    [ermittlung, runAdapter, schreibeZustand, setupGeneration]
  );

  const oeffneVorwurf = useCallback(() => {
    if (anzeigeZustand.geloest) return;
    if (istGesperrt(anzeigeZustand)) {
      setVorwurfHinweis(ermittlung.vorwurf.antworten.gesperrt.join(' '));
      return;
    }
    if (prueftVorwurf || submitGuard.current) return;
    setVorwurfHinweis(null);
    setDialogOffen(true);
  }, [anzeigeZustand, ermittlung.vorwurf.antworten.gesperrt, prueftVorwurf]);

  const abbrechenVorwurf = useCallback(() => {
    if (prueftVorwurf) return;
    setDialogOffen(false);
  }, [prueftVorwurf]);

  const absendenVorwurf = useCallback(
    async (kandidat: VorwurfKandidat) => {
      if (submitGuard.current || prueftVorwurf) return;
      submitGuard.current = true;
      setPrueftVorwurf(true);
      setDialogOffen(false);
      try {
        const res = await erstelleVorwurfAblauf({
          ermittlung,
          leseZustand: () => zustand.current,
          schreibeZustand: (z, e) => {
            zustand.current = z;
            setAnzeigeZustand(z);
            // Ereignisse für Vorwurf werden nicht separat gemeldet außer Pager
          },
          getPruefLauf: () => lauf.current,
          pruefeFrisch: pruefeFrischFn,
          kandidat,
        });
        if (res.art === 'fehler') {
          melde('auftrag', [satz(res.nachricht)]);
          setVorwurfHinweis(res.nachricht);
          submitGuard.current = false;
          setPrueftVorwurf(false);
          return;
        }
        const { ergebnis, antwort, zustand: neu } = res;
        zustand.current = neu;
        setAnzeigeZustand(neu);
        if (ergebnis === 'gesperrt') {
          melde('auftrag', [...antwort]);
          setVorwurfHinweis(ermittlung.vorwurf.antworten.gesperrt.join(' '));
          submitGuard.current = false;
          setPrueftVorwurf(false);
          return;
        }
        if (ergebnis === 'beleg-unbekannt') {
          melde('auftrag', [satz('Ein ausgewählter Beleg ist nicht mehr gültig. Aktualisiere die Aktenwand.')]);
          setVorwurfHinweis('Ein ausgewählter Beleg ist nicht mehr gültig. Aktualisiere die Aktenwand.');
          submitGuard.current = false;
          setPrueftVorwurf(false);
          return;
        }
        if (ergebnis === 'falsche-person' || ergebnis === 'zu-wenig-belege') {
          if (antwort.length) {
            melde('auftrag', [...antwort]);
          }
          submitGuard.current = false;
          setPrueftVorwurf(false);
          return;
        }
        if (ergebnis === 'richtig') {
          if (antwort.length) {
            melde('erledigt', [...antwort]);
          }
          lauf.current?.stoppe();
          setDialogOffen(false);
          submitGuard.current = false;
          setPrueftVorwurf(false);
          return;
        }
        if (ergebnis === 'bereits-geloest') {
          submitGuard.current = false;
          setPrueftVorwurf(false);
          return;
        }
        submitGuard.current = false;
        setPrueftVorwurf(false);
      } catch {
        melde('auftrag', [satz('Belege konnten gerade nicht geprüft werden. Bitte erneut versuchen.')]);
        submitGuard.current = false;
        setPrueftVorwurf(false);
      }
    },
    [ermittlung, melde, pruefeFrischFn]
  );

  // Eine Auswahl ändert nur die sichtbare Spur; Prüfungen bleiben beim bestehenden Bündel.
  const waehleSpur = useCallback(
    (spurId: string) => {
      if (ermittlung.spuren.some((spur) => spur.id === spurId)) setAktiveSpurId(spurId);
    },
    [ermittlung.spuren]
  );

  // Beleg-IDs bleiben eindeutig und auf bekannte Regeln beschränkt; keine Dateinamen.
  const waehleBelege = useCallback(
    (ids: readonly string[]) => {
      const bekannt = new Set(ermittlung.vorwurf.belege.map((beleg) => beleg.id));
      setAusgewaehlteBelegIds([...new Set(ids)].filter((id) => bekannt.has(id)));
    },
    [ermittlung.vorwurf.belege]
  );

  useEffect(
    () => () => {
      setupVersion.current++;
      lauf.current?.stoppe();
      lauf.current = null;
      clientRef.current = null;
      promptAusstehend.current = false;
    },
    []
  );

  return (
    <div className="grid gap-4 lg:min-h-[32rem] lg:flex-1">
      <Pager nachrichten={pager} />
      {rahmenFehler && <p role="alert">{rahmenFehler}</p>}
      {pruefHinweis && <p role="status">{pruefHinweis}</p>}
      {anzeigeZustand.geloest && <ErmittlungsAbschluss ermittlung={ermittlung} />}
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
        <div className={`min-w-0 ${bereich === 'ansicht' ? 'lg:block' : 'hidden lg:block'}`}>
          <Spurenliste
            spuren={ermittlung.spuren}
            zustand={anzeigeZustand}
            aktiveSpurId={aktiveSpurId}
            onSpurWaehlen={waehleSpur}
          />
          <Ansichten
            ansichten={ermittlung.ansichten}
            bereit={setupGeneration > 0}
            generation={setupGeneration}
            run={abfrageRun}
            belegRegeln={ermittlung.vorwurf.belege}
            zustand={anzeigeZustand}
            ausgewaehlteBelegIds={ausgewaehlteBelegIds}
            onBelegAuswahlAendern={waehleBelege}
            onVorwurfOeffnen={oeffneVorwurf}
            vorwurfOeffnenAktiv={setupGeneration > 0 && !anzeigeZustand.geloest && !istGesperrt(anzeigeZustand) && !prueftVorwurf && !submitGuard.current}
            vorwurfHinweis={vorwurfHinweis}
          />
        </div>
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
      <VorwurfDialog
        open={dialogOffen}
        ermittlung={ermittlung}
        zustand={anzeigeZustand}
        ausgewaehlteBelegIds={ausgewaehlteBelegIds}
        gesperrt={istGesperrt(anzeigeZustand)}
        gesperrtHinweis={ermittlung.vorwurf.antworten.gesperrt.join(' ')}
        prueft={prueftVorwurf}
        onAbbrechen={abbrechenVorwurf}
        onAbsenden={absendenVorwurf}
        oeufnerRef={oeufnerRef}
      />
    </div>
  );
}
