import { Suspense, lazy, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { AgentClient } from '../../lib/missions/agentClient';
import {
  ANTWORT_MUSTER,
  ANTWORT_TIMEOUT_MS,
  aktuellerSchritt,
  antwortSkript,
  istGesperrt,
  alleSpurenErledigt,
  offeneSchritteText,
  startZustand,
  wendeAntwortAn,
} from '../../lib/missions/ermittlung';
import type {
  Ermittlung,
  ErmittlungsEreignis,
  ErmittlungsZustand,
  Spur,
} from '../../lib/missions/ermittlungTypes';
import type { MissionCommand, MissionReply, MissionTool } from '../../lib/missions/missionTypes';
import { einsatzrahmenSetupSkript } from '../../lib/missions/einsatzrahmenSetup';
import type { AkteEintrag } from '../../lib/missions/staffel';
import { anhaengen, satz } from '../../lib/missions/pager';
import type { PagerArt, PagerNachricht, Pose } from '../../lib/missions/pager';
import { erzeugeErmittlungsRun } from '../../lib/missions/ermittlungsRun';
import { erzeugePruefLauf } from '../../lib/missions/pruefLauf';
import type { PruefLauf } from '../../lib/missions/pruefLauf';
import { STAFFEL2_HOSTNAME, rahmenSetupSkript } from '../../lib/missions/staffel2Rahmen';
import {
  erstelleFrischPruef,
  erstelleVorwurfAblauf,
  type PruefRueckmeldung,
  type VorwurfKandidat,
} from '../../lib/missions/vorwurfAblauf';
import Ansichten from './Ansichten';
import AntwortFeld from './AntwortFeld';
import EinsatzrahmenHinweis from './EinsatzrahmenHinweis';
import ErmittlungsAbschluss, { type WeiterLink } from './ErmittlungsAbschluss';
import ErmittlungsHilfe from './ErmittlungsHilfe';
import Pager from './Pager';
import Spurenliste from './Spurenliste';
import VorwurfDialog from './VorwurfDialog';

const LazyV86Terminal = lazy(() => import('./V86Terminal'));
// Nur Episoden mit `bildschirm: true` laden diesen Chunk und das Bildschirm-Image (ADR 0008).
const LazyV86Bildschirm = lazy(() => import('./V86Bildschirm'));
const BILDSCHIRM_HINWEIS = [
  'Das ist der Bildschirm des Rechners. Rechtsklick auf den Hintergrund öffnet das Menü.',
  'Was du in Programmen auf dem Bildschirm speicherst, prüft niemand von selbst. Danach: „Stand prüfen“.',
];

const PRUEF_HINWEIS = 'Prüfung gerade nicht erreichbar. Der nächste Befehl versucht es erneut.';
const RAHMEN_FEHLER = 'Der Rahmen für Staffel 2 konnte nicht gesetzt werden.';
const ANTWORT_ZEICHEN_HINWEIS = 'Bitte nur Buchstaben, Ziffern und . : _ / -';
const ANTWORT_LEER_HINWEIS = 'Bitte trag erst eine Antwort ein.';
const ANTWORT_FALSCH_HINWEIS =
  'Das passt nicht zu dem, was das System zeigt. Schau noch mal genau hin.';
const ANTWORT_FEHLER_HINWEIS =
  'Die Antwort konnte gerade nicht geprüft werden. Versuch es gleich noch einmal.';
const MISSION_HINWEIS = 'In Staffel 2 gibt es mission noch nicht. Schau in den Pager.';

interface ErmittlungAppProps {
  ermittlung: Ermittlung;
  hostname?: string;
  /** Karten des Werkzeugkastens in der Hilfe; ohne sie gibt es nur die Tipps. */
  werkzeuge?: readonly MissionTool[];
  /** Link im Abschluss zur nächsten Episode; fehlt bei der letzten. */
  weiter?: WeiterLink;
  /** Der Fall ist gelöst; meldet einmal je Lauf den Abschluss, den die Seite speichern kann. */
  onGeloest?: (abschluss: AkteEintrag) => void;
}

type Tab = 'terminal' | 'bildschirm' | 'serverraum';

const TAB_NAME: Record<Tab, string> = {
  terminal: 'Terminal',
  bildschirm: 'Bildschirm',
  serverraum: 'Serverraum',
};

/** Ab lg steht die Fallakte neben der Arbeitsfläche; darunter ersetzt sie sie. */
const istBreit = () =>
  typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1024px)').matches;

/** Erste Spur mit offenem Schritt in Datenreihenfolge; sonst die erste Spur; sonst null. */
function ersteSpur(spuren: readonly Spur[], zustand: ErmittlungsZustand): Spur | null {
  return spuren.find((spur) => aktuellerSchritt(spur, zustand) !== null) ?? spuren[0] ?? null;
}

export default function ErmittlungApp(props: ErmittlungAppProps) {
  const { ermittlung, hostname = STAFFEL2_HOSTNAME, werkzeuge, weiter, onGeloest } = props;
  const [pager, setPager] = useState<PagerNachricht[]>([]);
  const [pruefHinweis, setPruefHinweis] = useState<string | null>(null);
  const [rahmenFehler, setRahmenFehler] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('terminal');
  // Terminal und Bildschirm sind zwei Reiter desselben laufenden V86Bildschirm.
  const [vmReiter, setVmReiter] = useState<'terminal' | 'bildschirm'>('terminal');
  const [akteOffen, setAkteOffen] = useState(istBreit);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const idBasis = useId();
  const [anzeigeZustand, setAnzeigeZustand] = useState<ErmittlungsZustand>(startZustand);
  const [setupGeneration, setSetupGeneration] = useState(0);
  // Zählt nur erfolgreiche Setups: Ein gescheitertes setzt die gezeigten Tipps nicht zurück.
  const [hilfeStand, setHilfeStand] = useState(0);
  const [aktiveSpurId, setAktiveSpurId] = useState<string | null>(
    () => ersteSpur(ermittlung.spuren, startZustand())?.id ?? null
  );
  const [ausgewaehlteBelegIds, setAusgewaehlteBelegIds] = useState<readonly string[]>([]);
  const [runAdapter] = useState(() => erzeugeErmittlungsRun());
  const [dialogOffen, setDialogOffen] = useState(false);
  const [prueftVorwurf, setPrueftVorwurf] = useState(false);
  const [prueftAntwort, setPrueftAntwort] = useState(false);
  const [vorwurfHinweis, setVorwurfHinweis] = useState<string | null>(null);
  const oeufnerRef = useRef<HTMLButtonElement | null>(null);
  const submitGuard = useRef(false);
  const antwortGuard = useRef(false);
  const zustand = useRef<ErmittlungsZustand>(startZustand());
  const lauf = useRef<PruefLauf | null>(null);
  const clientRef = useRef<AgentClient | null>(null);
  const promptAusstehend = useRef(false);
  // Beginn des Laufs und genutzte Tipps; ein Neustart der VM beginnt beides neu.
  const laufStart = useRef(Date.now());
  const tippNutzung = useRef({ hintsUsed: 0, withSolution: false });
  const onGeloestRef = useRef(onGeloest);
  onGeloestRef.current = onGeloest;
  const setupVersion = useRef(0);
  const pruefRueckmeldung = useRef<PruefRueckmeldung>({
    sequenz: 0,
    generation: 0,
    vollstaendig: false,
  });

  const melde = useCallback((art: PagerArt, zeilen: string[], pose?: Pose) => {
    setPager((verlauf) => anhaengen(verlauf, art, zeilen, pose));
  }, []);

  const schreibeZustand = useCallback(
    (neu: ErmittlungsZustand, ereignisse: readonly ErmittlungsEreignis[]) => {
      zustand.current = neu;
      setAnzeigeZustand(neu);
      const erkannt = new Set(neu.belegeErkannt);
      setAusgewaehlteBelegIds((ids) => {
        const bereinigt = ids.filter((id) => erkannt.has(id));
        return bereinigt.length === ids.length ? ids : bereinigt;
      });
      setPruefHinweis(
        ereignisse.some((ereignis) => ereignis.type === 'pruefung-unvollstaendig')
          ? PRUEF_HINWEIS
          : null
      );
      for (const ereignis of ereignisse) {
        if (ereignis.type === 'schritt-erledigt') {
          const spur = ermittlung.spuren.find((eintrag) => eintrag.id === ereignis.spurId);
          const schritt = spur?.schritte.find((eintrag) => eintrag.id === ereignis.schrittId);
          if (schritt) melde('erledigt', [satz(`Erledigt: ${schritt.title}`)]);
        } else if (ereignis.type === 'spur-erledigt') {
          const spur = ermittlung.spuren.find((eintrag) => eintrag.id === ereignis.spurId);
          if (spur) melde('erledigt', [satz(`Spur abgeschlossen: ${spur.titel}`)]);
        } else if (ereignis.type === 'diagnose') {
          melde('auftrag', [satz(ereignis.text)]);
        } else if (ereignis.type === 'einsatzrahmen-verletzt') {
          melde('auftrag', [...ermittlung.einsatzrahmen.folge]);
        } else if (ereignis.type === 'sperre-aufgehoben') {
          melde('erledigt', [satz('Der Vorwurf ist wieder möglich.')]);
        } else if (ereignis.type === 'fall-geloest') {
          melde('erledigt', [...ermittlung.vorwurf.antworten.richtig]);
        }
      }
    },
    [ermittlung, melde]
  );

  const onReady = useCallback(
    async (client: AgentClient) => {
      const version = ++setupVersion.current;
      submitGuard.current = false;
      antwortGuard.current = false;
      setPrueftAntwort(false);
      setPrueftVorwurf(false);
      setDialogOffen(false);
      setVorwurfHinweis(null);
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
        const einsatz = await runAdapter.run(
          client,
          einsatzrahmenSetupSkript(ermittlung.einsatzrahmen.sudoBefehle),
          60_000,
          () => version === setupVersion.current
        );
        if (version !== setupVersion.current) return;
        if (einsatz.exitCode !== 0) throw new Error(RAHMEN_FEHLER);
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
      laufStart.current = Date.now();
      tippNutzung.current = { hintsUsed: 0, withSolution: false };
      setSetupGeneration(version);
      setHilfeStand(version);
      setPager([]);
      setPruefHinweis(null);
      lauf.current = erzeugePruefLauf({
        ermittlung,
        run: (skript, timeoutMs) =>
          runAdapter.run(client, skript, timeoutMs, () => version === setupVersion.current),
        leseZustand: () => zustand.current,
        schreibeZustand: (neu, ereignisse) => {
          pruefRueckmeldung.current = {
            sequenz: pruefRueckmeldung.current.sequenz + 1,
            generation: version,
            vollstaendig: !ereignisse.some((e) => e.type === 'pruefung-unvollstaendig'),
          };
          schreibeZustand(neu, ereignisse);
        },
        meldeFehler: () => {
          pruefRueckmeldung.current = {
            sequenz: pruefRueckmeldung.current.sequenz + 1,
            generation: version,
            vollstaendig: false,
          };
          setPruefHinweis(PRUEF_HINWEIS);
        },
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

  // „Stand prüfen“ am Bildschirm: derselbe volle Prüflauf wie nach einem Befehl (ADR 0008).
  const standPruefen = useCallback(() => lauf.current?.anstossen(), []);
  const waehleTab = useCallback((neu: Tab) => {
    setTab(neu);
    if (neu !== 'serverraum') setVmReiter(neu);
    // Schmal ersetzt die Akte die Arbeitsfläche; ein Tab zeigt wieder die Fläche.
    if (!istBreit()) setAkteOffen(false);
  }, []);
  const bildschirmErstmals = useCallback(() => melde('auftrag', BILDSCHIRM_HINWEIS), [melde]);

  const pruefeFrischFn = useCallback(
    () =>
      erstelleFrischPruef({
        getPruefLauf: () => lauf.current,
        getGeneration: () => setupGeneration,
        getSetupVersion: () => setupVersion.current,
        leseRueckmeldung: () => pruefRueckmeldung.current,
      })(),
    [setupGeneration]
  );

  const oeffneVorwurf = useCallback(() => {
    if (anzeigeZustand.geloest) return;
    if (anzeigeZustand.vorwurfRichtig) {
      setVorwurfHinweis(offeneSchritteText(ermittlung, anzeigeZustand).join(' '));
      return;
    }
    if (istGesperrt(anzeigeZustand)) {
      setVorwurfHinweis(ermittlung.vorwurf.antworten.gesperrt.join(' '));
      return;
    }
    if (prueftVorwurf || submitGuard.current) return;
    setVorwurfHinweis(null);
    const fokus = document.activeElement;
    if (fokus instanceof HTMLButtonElement) oeufnerRef.current = fokus;
    setDialogOffen(true);
  }, [anzeigeZustand, ermittlung, prueftVorwurf]);

  const abbrechenVorwurf = useCallback(() => {
    setDialogOffen(false);
  }, []);

  const absendenVorwurf = useCallback(
    async (kandidat: VorwurfKandidat) => {
      if (submitGuard.current || prueftVorwurf) return;
      const version = setupVersion.current;
      const istAktuell = () => version === setupVersion.current;
      submitGuard.current = true;
      setPrueftVorwurf(true);
      try {
        const res = await erstelleVorwurfAblauf({
          ermittlung,
          leseZustand: () => zustand.current,
          istAktuell,
          pruefeFrisch: pruefeFrischFn,
          kandidat,
        });
        if (!istAktuell()) return;
        setDialogOffen(false);
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
          setVorwurfHinweis(null);
          submitGuard.current = false;
          setPrueftVorwurf(false);
          return;
        }
        if (ergebnis === 'beleg-unbekannt') {
          melde('auftrag', [
            satz('Ein ausgewählter Beleg ist nicht mehr gültig. Aktualisiere die Aktenwand.'),
          ]);
          setVorwurfHinweis(
            'Ein ausgewählter Beleg ist nicht mehr gültig. Aktualisiere die Aktenwand.'
          );
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
        if (ergebnis === 'richtig-offen') {
          melde('erledigt', [...antwort]);
          setVorwurfHinweis(antwort.join(' '));
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
        if (!istAktuell()) return;
        melde('auftrag', [
          satz('Belege konnten gerade nicht geprüft werden. Bitte erneut versuchen.'),
        ]);
        submitGuard.current = false;
        setPrueftVorwurf(false);
      }
    },
    [ermittlung, melde, pruefeFrischFn, prueftVorwurf]
  );

  // Prüft die getrimmte Antwort des aktuellen Ablesen-Schritts der aktiven Spur in der VM.
  const antworten = useCallback(
    async (roh: string) => {
      const client = clientRef.current;
      const version = setupVersion.current;
      const spur = ermittlung.spuren.find((eintrag) => eintrag.id === aktiveSpurId);
      const schritt = spur ? aktuellerSchritt(spur, zustand.current) : null;
      if (!client || setupGeneration === 0 || !spur || schritt?.art !== 'ablesen') return;
      if (!schritt.antwort || antwortGuard.current || zustand.current.geloest) return;
      const text = roh.trim();
      if (!text) return melde('auftrag', [satz(ANTWORT_LEER_HINWEIS)]);
      if (!ANTWORT_MUSTER.test(text)) return melde('auftrag', [satz(ANTWORT_ZEICHEN_HINWEIS)]);
      const istAktuell = () => version === setupVersion.current;
      antwortGuard.current = true;
      setPrueftAntwort(true);
      try {
        const res = await runAdapter.run(
          client,
          antwortSkript(schritt.antwort.pruefung, text),
          ANTWORT_TIMEOUT_MS,
          istAktuell
        );
        if (!istAktuell()) return;
        const richtig = res.exitCode === 0;
        const neu = wendeAntwortAn(ermittlung, zustand.current, spur.id, schritt.id, richtig);
        if (neu.ereignisse.length) schreibeZustand(neu.zustand, neu.ereignisse);
        else if (!richtig) melde('auftrag', [satz(ANTWORT_FALSCH_HINWEIS)]);
      } catch {
        if (istAktuell()) melde('auftrag', [satz(ANTWORT_FEHLER_HINWEIS)]);
      } finally {
        if (istAktuell()) {
          antwortGuard.current = false;
          setPrueftAntwort(false);
        }
      }
    },
    [aktiveSpurId, ermittlung, melde, runAdapter, schreibeZustand, setupGeneration]
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
      const erkannt = new Set(zustand.current.belegeErkannt);
      setAusgewaehlteBelegIds([...new Set(ids)].filter((id) => bekannt.has(id) && erkannt.has(id)));
    },
    [ermittlung.vorwurf.belege]
  );

  const bereinigeBelegSnapshot = useCallback((sichtbareIds: readonly string[]) => {
    const sichtbar = new Set(sichtbareIds);
    setAusgewaehlteBelegIds((ids) => {
      const bereinigt = ids.filter((id) => sichtbar.has(id));
      return bereinigt.length === ids.length ? ids : bereinigt;
    });
  }, []);

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

  useEffect(() => {
    // Nach den Kind-Effekten: Der native Dialog muss Außenfokus wieder erlauben.
    if (!anzeigeZustand.geloest) return;
    document.getElementById('ermittlung-abschluss')?.focus();
    const jetzt = Date.now();
    onGeloestRef.current?.({
      durationMs: jetzt - laufStart.current,
      finishedAt: jetzt,
      vorwurfVersuche: zustand.current.vorwurfVersuche,
      ...tippNutzung.current,
    });
  }, [anzeigeZustand.geloest]);

  const merkeTipp = useCallback((stufe: number) => {
    tippNutzung.current = {
      hintsUsed: tippNutzung.current.hintsUsed + 1,
      withSolution: tippNutzung.current.withSolution || stufe === 3,
    };
  }, []);

  const aktiveSpur = ermittlung.spuren.find((spur) => spur.id === aktiveSpurId) ?? null;
  const aktiverSchritt = aktiveSpur ? aktuellerSchritt(aktiveSpur, anzeigeZustand) : null;

  const spurStatus = ermittlung.spuren.map((spur) => ({
    id: spur.id,
    status:
      aktuellerSchritt(spur, anzeigeZustand) === null
        ? 'erledigt'
        : spur.id === aktiveSpurId
          ? 'aktiv'
          : 'offen',
  }));
  const tabs: readonly Tab[] = ermittlung.bildschirm
    ? ['terminal', 'bildschirm', 'serverraum']
    : ['terminal', 'serverraum'];
  const tabId = (t: Tab) => `${idBasis}-tab-${t}`;
  // Terminal und Bildschirm teilen ein Panel (derselbe laufende Emulator).
  const panelId = (t: Tab) => `${idBasis}-panel-${t === 'serverraum' ? t : 'terminal'}`;
  const akteId = `${idBasis}-akte`;
  const leistenKnopf =
    'inline-flex h-9 items-center rounded-[var(--lk-r-sm)] border px-3 text-[13px] whitespace-nowrap text-[color:var(--lk-ink)] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)] max-[759px]:px-2.5';
  const erledigteSpuren = spurStatus.filter((spur) => spur.status === 'erledigt').length;

  // Spielmodus (#170): Kopf und Pager stehen, die Arbeitsfläche füllt den Rest der Fensterhöhe.
  // Gescrollt wird nur in der linken Spalte und im Terminal; das Terminal bleibt fest.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 pt-2 [@media(max-height:820px)]:gap-y-1 [@media(max-height:820px)]:pt-0">
        <h2 className="text-xl leading-tight font-bold tracking-[-0.01em] text-[color:var(--lk-ink)] max-[759px]:w-full sm:text-[30px] [@media(max-height:820px)]:text-[23px] [@media(max-height:820px)]:max-[759px]:text-xl">
          Episode {ermittlung.nr}{' '}
          <span className="text-[color:var(--lk-muted)]">· {ermittlung.titel}</span>
        </h2>
        <p
          data-testid="server-chip"
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-[color:var(--lk-line-strong)] bg-[rgba(15,21,30,0.75)] px-3 font-mono text-[13px] text-[color:var(--lk-ink)] [@media(max-height:820px)]:h-7"
        >
          <span
            aria-hidden="true"
            className="hidden text-[11.5px] tracking-[0.1em] text-[color:var(--lk-muted)] sm:inline"
          >
            SERVER
          </span>
          <span>{hostname}</span>
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${setupGeneration > 0 ? 'bg-[color:var(--lk-ok)]' : 'bg-[color:var(--lk-warn)]'}`}
          />
          <span className="sr-only">
            Server, Status: {setupGeneration > 0 ? 'bereit' : 'startet'}
          </span>
        </p>
        <div className="ml-auto flex items-center gap-3 text-sm text-[color:var(--lk-muted)]">
          <p data-testid="spuren-fortschritt">
            {erledigteSpuren} von {spurStatus.length} Spuren
          </p>
          <ol aria-hidden="true" className="flex items-center">
            {spurStatus.map(({ id, status }, i) => (
              <li
                key={id}
                className={`flex items-center before:h-0.5 before:w-5 before:max-[759px]:w-2.5 first:before:hidden ${
                  spurStatus[i - 1]?.status === 'erledigt'
                    ? 'before:bg-[color:var(--lk-accent)]'
                    : 'before:bg-[color:var(--lk-line-strong)]'
                }`}
                data-status={status}
              >
                <span
                  className={`size-3 rounded-full border-2 ${
                    status === 'erledigt'
                      ? 'border-[color:var(--lk-accent)] bg-[color:var(--lk-accent)]'
                      : status === 'aktiv'
                        ? 'border-[color:var(--lk-accent)] bg-[color:var(--lk-accent)] shadow-[0_0_0_4px_rgba(232,85,47,0.25)]'
                        : 'border-[#5c6573]'
                  }`}
                />
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Pager nachrichten={pager} spiel />
      {setupGeneration > 0 &&
        aktiveSpur &&
        aktiverSchritt?.art === 'ablesen' &&
        aktiverSchritt.antwort && (
          <AntwortFeld
            key={`${aktiveSpur.id}/${aktiverSchritt.id}`}
            antwort={aktiverSchritt.antwort}
            prueft={prueftAntwort}
            onAntworten={antworten}
          />
        )}
      {rahmenFehler && <p role="alert">{rahmenFehler}</p>}
      {/* Die Seite scrollt nicht (#170): Der Abschluss nimmt sich den Platz und scrollt selbst. */}
      {anzeigeZustand.geloest && (
        <div className="min-h-0 shrink overflow-y-auto">
          <ErmittlungsAbschluss ermittlung={ermittlung} weiter={weiter} />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--lk-r)] border border-[color:var(--lk-line-strong)] bg-[color:var(--lk-panel)]">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[color:var(--lk-line)] bg-[rgba(8,11,16,0.65)] p-1.5 max-[759px]:gap-1 max-[759px]:p-[5px]">
          <div
            role="tablist"
            aria-label="Arbeitsfläche"
            className="flex gap-1.5 max-[759px]:gap-0.5"
            onKeyDown={(e) => {
              const index = tabs.indexOf(tab);
              const ziel =
                e.key === 'ArrowRight'
                  ? tabs[(index + 1) % tabs.length]
                  : e.key === 'ArrowLeft'
                    ? tabs[(index - 1 + tabs.length) % tabs.length]
                    : e.key === 'Home'
                      ? tabs[0]
                      : e.key === 'End'
                        ? tabs[tabs.length - 1]
                        : undefined;
              if (!ziel) return;
              e.preventDefault();
              waehleTab(ziel);
              tabRefs.current[ziel]?.focus();
            }}
          >
            {tabs.map((eintrag) => (
              <button
                key={eintrag}
                ref={(el) => {
                  tabRefs.current[eintrag] = el;
                }}
                type="button"
                role="tab"
                id={tabId(eintrag)}
                aria-selected={tab === eintrag}
                aria-controls={panelId(eintrag)}
                tabIndex={tab === eintrag ? 0 : -1}
                onClick={() => waehleTab(eintrag)}
                className={`inline-flex h-[42px] items-center rounded-[var(--lk-r-sm)] border px-4 text-[14.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lk-accent)] max-[759px]:h-9 max-[759px]:px-2.5 max-[759px]:text-[13.5px] ${
                  tab === eintrag
                    ? 'border-[color:var(--lk-accent)] bg-[color:var(--lk-accent-soft)] text-[color:var(--lk-ink)]'
                    : 'border-transparent text-[color:var(--lk-muted)] hover:bg-white/5 hover:text-[color:var(--lk-ink)]'
                }`}
              >
                {TAB_NAME[eintrag]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            {pruefHinweis && (
              <p role="status" className="min-w-0 text-[13px] text-[color:var(--lk-warn)]">
                {pruefHinweis}
              </p>
            )}
            {ermittlung.bildschirm && tab === 'bildschirm' && (
              <button
                type="button"
                onClick={standPruefen}
                disabled={setupGeneration === 0}
                aria-label="Stand prüfen"
                className={`${leistenKnopf} border-[color:var(--lk-line-strong)] disabled:opacity-50`}
              >
                <span aria-hidden="true" className="min-[760px]:hidden">
                  ✓
                </span>
                <span aria-hidden="true" className="max-[759px]:hidden">
                  Stand prüfen
                </span>
              </button>
            )}
            <button
              type="button"
              aria-expanded={akteOffen}
              aria-controls={akteId}
              onClick={() => setAkteOffen((offen) => !offen)}
              className={`${leistenKnopf} ${
                akteOffen
                  ? 'border-[color:var(--lk-accent)] bg-[color:var(--lk-accent-soft)]'
                  : 'border-[color:var(--lk-line-strong)]'
              }`}
            >
              Fallakte
            </button>
          </div>
        </div>
        <div
          className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] ${
            akteOffen ? 'lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]' : ''
          }`}
        >
          <div
            id={akteId}
            hidden={!akteOffen}
            className="min-h-0 min-w-0 overflow-y-auto border-[color:var(--lk-line)] p-3 lg:border-r"
          >
            <EinsatzrahmenHinweis
              text={ermittlung.einsatzrahmen.text}
              verletzt={anzeigeZustand.einsatzrahmenVerletzt}
              gesperrt={istGesperrt(anzeigeZustand)}
            />
            <Spurenliste
              spuren={ermittlung.spuren}
              zustand={anzeigeZustand}
              aktiveSpurId={aktiveSpurId}
              onSpurWaehlen={waehleSpur}
            />
            {/* Neuer key nach erfolgreichem Setup: gezeigte Tipps beginnen wieder bei null. */}
            <ErmittlungsHilfe
              key={hilfeStand}
              spurId={aktiveSpur?.id ?? null}
              schritt={aktiverSchritt}
              werkzeuge={werkzeuge}
              onTippGezeigt={merkeTipp}
            />
          </div>
          {/* Panels bleiben gemountet (nur `hidden`): Die VM darf nie neu starten. */}
          <div className={`min-h-0 min-w-0 ${akteOffen ? 'max-lg:hidden' : ''}`}>
            <div
              role="tabpanel"
              id={panelId('terminal')}
              aria-labelledby={tabId(tab === 'serverraum' ? vmReiter : tab)}
              hidden={tab === 'serverraum'}
              className="h-full min-h-0 bg-[#0A0D12]"
            >
              <Suspense
                fallback={
                  <p className="p-3 font-mono text-xs text-[color:var(--lk-muted)]">
                    Terminal lädt …
                  </p>
                }
              >
                {ermittlung.bildschirm ? (
                  <LazyV86Bildschirm
                    className="h-full min-h-0 [@media(max-height:639px)]:h-[20rem]"
                    reiter={vmReiter}
                    onReady={onReady}
                    onMissionCommand={onMissionCommand}
                    onBildschirmErstmals={bildschirmErstmals}
                  />
                ) : (
                  <LazyV86Terminal
                    className="h-full min-h-0 [@media(max-height:639px)]:h-[20rem]"
                    onReady={onReady}
                    onMissionCommand={onMissionCommand}
                  />
                )}
              </Suspense>
            </div>
            <div
              role="tabpanel"
              id={panelId('serverraum')}
              aria-labelledby={tabId('serverraum')}
              hidden={tab !== 'serverraum'}
              className="h-full min-h-0 overflow-y-auto p-3"
            >
              <Ansichten
                ansichten={ermittlung.ansichten}
                bereit={setupGeneration > 0}
                generation={setupGeneration}
                run={abfrageRun}
                belegRegeln={ermittlung.vorwurf.belege}
                zustand={anzeigeZustand}
                ausgewaehlteBelegIds={ausgewaehlteBelegIds}
                onBelegAuswahlAendern={waehleBelege}
                onBelegSnapshot={bereinigeBelegSnapshot}
                onVorwurfOeffnen={anzeigeZustand.geloest ? undefined : oeffneVorwurf}
                vorwurfOeffnenAktiv={
                  setupGeneration > 0 &&
                  !anzeigeZustand.geloest &&
                  !anzeigeZustand.vorwurfRichtig &&
                  !istGesperrt(anzeigeZustand) &&
                  !prueftVorwurf &&
                  !submitGuard.current
                }
                vorwurfHinweis={
                  anzeigeZustand.geloest
                    ? null
                    : anzeigeZustand.vorwurfRichtig
                      ? alleSpurenErledigt(ermittlung, anzeigeZustand)
                        ? null
                        : offeneSchritteText(ermittlung, anzeigeZustand).join(' ')
                      : istGesperrt(anzeigeZustand)
                        ? ermittlung.vorwurf.antworten.gesperrt.join(' ')
                        : vorwurfHinweis
                }
              />
            </div>
          </div>
        </div>
      </div>
      <VorwurfDialog
        open={dialogOffen}
        ermittlung={ermittlung}
        zustand={anzeigeZustand}
        ausgewaehlteBelegIds={ausgewaehlteBelegIds}
        onAuswahlAendern={waehleBelege}
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
