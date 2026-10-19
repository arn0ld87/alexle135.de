// Staffel-Oberfläche der Terminal-Missionen (#399): links die Ermittlungsakte (Vorfälle mit
// Beweisstück, Finale-Schloss, Abzeichen), rechts Pager, „Alex fragen“ und „Werkzeuge“, darunter
// das Terminal so hoch wie möglich. Mobil: Pager oben, darunter Reiter für Terminal, Akte und
// Werkzeuge; das Terminal bleibt dabei eingehängt, damit die VM weiterläuft.
// Die VM lädt erst, wenn ein Vorfall gewählt ist, und bleibt beim Wechsel laufen: Jeder Start
// setzt den Ausgangszustand per `setup` neu (MissionEngine über `vorfallAlsMission`).
import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { staffel1 } from '../../data/staffeln/staffel-1';
import type { AgentClient } from '../../lib/missions/agentClient';
import {
  MissionEngine,
  formatDuration,
  type EngineEvent,
  type MissionSnapshot,
} from '../../lib/missions/missionEngine';
import type { MissionCommand, MissionReply } from '../../lib/missions/missionTypes';
import {
  anhaengen,
  satz,
  type PagerArt,
  type PagerNachricht,
  type Pose,
} from '../../lib/missions/pager';
import { gelernteBefehle, istFreigegeben, vorfallAlsMission } from '../../lib/missions/staffel';
import { createStaffelStore, type StaffelEreignis } from '../../lib/missions/staffelStore';
import type { Vorfall } from '../../lib/missions/staffelTypes';
import Pager from './Pager';

const LazyV86Terminal = React.lazy(() => import('./V86Terminal'));

type Reiter = 'terminal' | 'akte' | 'werkzeuge';

const KEIN_VORFALL: MissionReply = {
  exitCode: 3,
  text: 'Kein Vorfall aktiv. Wähle einen in der Akte.',
};

const START: PagerNachricht[] = [
  {
    id: 1,
    art: 'auftrag',
    zeilen: ['Wähle in der Akte einen Vorfall. Ich würde mit 0 anfangen.'],
    pose: 'neutral',
  },
];

export default function StaffelApp() {
  const staffel = staffel1;
  const store = useMemo(() => createStaffelStore(), []);
  const [stand, setStand] = useState(() => store.read(staffel.id));
  const [vorfall, setVorfall] = useState<Vorfall | null>(null);
  const [snapshot, setSnapshot] = useState<MissionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pager, setPager] = useState<PagerNachricht[]>(START);
  const [tipp, setTipp] = useState<string | null>(null);
  const [werkzeugeOffen, setWerkzeugeOffen] = useState(false);
  const [reiter, setReiter] = useState<Reiter>('akte');

  const clientRef = useRef<AgentClient | null>(null);
  const engineRef = useRef<MissionEngine | null>(null);
  const vorfallRef = useRef<Vorfall | null>(null);
  const nextRef = useRef<() => Promise<MissionReply>>(async () => KEIN_VORFALL);

  const melde = useCallback(
    (art: PagerArt, zeilen: string[], pose?: Pose) =>
      setPager((v) => anhaengen(v, art, zeilen, pose)),
    []
  );

  const staffelEreignisse = useCallback(
    (events: StaffelEreignis[]) => {
      for (const e of events) {
        if (e.type === 'beweisstueck') {
          const v = staffel.vorfaelle.find((x) => x.id === e.vorfallId);
          if (v) {
            melde('erledigt', [
              `Neues Beweisstück für die Akte: ${v.beweisstueck.titel}.`,
              v.beweisstueck.beschreibung,
            ]);
          }
        } else {
          const a = staffel.abzeichen.find((x) => x.id === e.abzeichenId);
          if (a) melde('erledigt', [`Abzeichen: ${a.titel}.`, a.beschreibung]);
        }
      }
      setStand(store.read(staffel.id));
    },
    [melde, staffel, store]
  );

  const onEvent = useCallback(
    (v: Vorfall, event: EngineEvent) => {
      if (event.type === 'schritt-erledigt') {
        setTipp(null);
        const naechster = v.schritte[event.stepIndex + 1];
        if (naechster) {
          melde(
            'auftrag',
            [satz(`Erledigt: ${v.schritte[event.stepIndex].title}`), ...naechster.pager],
            naechster.pose
          );
        }
        return;
      }
      setTipp(null);
      const { durationMs, withSolution, hintsUsed, finishedAt } = event;
      melde('erledigt', [
        `Vorfall ${v.nr} gelöst in ${formatDuration(durationMs)}${withSolution ? ' (mit Lösung)' : ''}.`,
        'Weiter mit dem nächsten Vorfall in der Akte oder `mission next`.',
      ]);
      staffelEreignisse(
        store.loese(staffel, v.id, { durationMs, withSolution, hintsUsed, finishedAt })
      );
      melde('szene', v.szene, v.szenePose);
    },
    [melde, staffel, staffelEreignisse, store]
  );

  const startVorfall = useCallback(
    async (v: Vorfall) => {
      const client = clientRef.current;
      if (!client) return false;
      const engine = new MissionEngine(vorfallAlsMission(v), client, {
        onNext: () => nextRef.current(),
        successInPager: true,
        onChange: (next) => {
          if (engineRef.current === engine) setSnapshot(next);
        },
        onEvent: (event) => {
          if (engineRef.current === engine) onEvent(v, event);
        },
      });
      engineRef.current = engine;
      setSnapshot(null);
      setError(null);
      setTipp(null);
      try {
        await engine.start();
        if (engineRef.current === engine) {
          melde(
            'auftrag',
            [`Vorfall ${v.nr}: ${v.titel}.`, ...v.schritte[0].pager],
            v.schritte[0].pose
          );
        }
        return true;
      } catch (e) {
        if (engineRef.current === engine) {
          // Nicht aufgesetzt: Befehle gehen nicht gegen einen halben Zustand.
          engineRef.current = null;
          setError((e as Error).message);
        }
        return false;
      }
    },
    [melde, onEvent]
  );

  function zumTerminal() {
    setReiter('terminal');
    // Der geklickte Akte-Knopf verschwindet mobil; der Fokus geht ans Terminal statt an body.
    setTimeout(() => document.getElementById('bereich-terminal')?.focus());
  }

  function waehle(v: Vorfall) {
    if (!istFreigegeben(staffel, store.read(staffel.id).akte, v.id)) {
      return Promise.resolve(false);
    }
    // Ein zweiter Klick auf den laufenden Vorfall setzt ihn nicht zurück.
    const engine = engineRef.current;
    if (vorfallRef.current === v && engine && engine.snapshot().finishedAt === null) {
      zumTerminal();
      return Promise.resolve(true);
    }
    vorfallRef.current = v;
    setVorfall(v);
    zumTerminal();
    return startVorfall(v);
  }

  nextRef.current = async () => {
    const aktuell = vorfallRef.current;
    const akte = store.read(staffel.id).akte;
    const ab = aktuell ? staffel.vorfaelle.indexOf(aktuell) + 1 : 0;
    const next = [...staffel.vorfaelle.slice(ab), ...staffel.vorfaelle.slice(0, ab)].find(
      (v) => v !== aktuell && !(v.id in akte) && istFreigegeben(staffel, akte, v.id)
    );
    if (!next)
      return { exitCode: 0, text: 'Kein offener Vorfall mehr. Mehr habe ich gerade nicht.' };
    const started = await waehle(next);
    return started
      ? { exitCode: 0, text: `Vorfall ${next.nr}: ${next.titel}. Der Auftrag steht im Pager.` }
      : { exitCode: 3, text: `Vorfall ${next.nr} ließ sich nicht starten. Wähle ihn in der Akte.` };
  };

  // Auch nach „Neu starten“ der VM: frischer Agent, Vorfall neu aufsetzen.
  const onReady = useCallback(
    (client: AgentClient) => {
      clientRef.current = client;
      if (vorfallRef.current) void startVorfall(vorfallRef.current);
    },
    [startVorfall]
  );

  const onMissionCommand = useCallback((command: MissionCommand) => {
    if (engineRef.current) return engineRef.current.handle(command);
    return command === 'next' ? nextRef.current() : Promise.resolve(KEIN_VORFALL);
  }, []);

  const onPrompt = useCallback(
    (rot: boolean) => {
      if (rot) staffelEreignisse(store.roterPrompt(staffel));
    },
    [staffel, staffelEreignisse, store]
  );

  // „Alex fragen“: Stufe 1 und 2 sind Tipps, Stufe 3 die Lösung (zählt als „mit Lösung“).
  // Die Stufe gilt je Schritt; die Engine setzt hintLevel beim Schrittwechsel zurück.
  const stufe = snapshot?.hintLevel ?? 0;
  async function alexFragen() {
    const engine = engineRef.current;
    if (!engine || !snapshot || snapshot.finishedAt !== null) return;
    const reply = await engine.handle(stufe >= 2 ? 'solve' : 'hint');
    if (engineRef.current === engine) setTipp(reply.text);
  }

  const geloest = Object.keys(stand.akte).length;
  const gelernt = gelernteBefehle(staffel, stand.akte);
  const schritt = vorfall && snapshot ? vorfall.schritte[snapshot.stepIndex] : null;
  const fertig = snapshot?.finishedAt != null;

  const reiterKnopf = (id: Reiter, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      id={`reiter-${id}`}
      aria-selected={reiter === id}
      aria-controls={`bereich-${id}`}
      onClick={() => setReiter(id)}
      className={`flex-1 border-b-2 px-3 py-2 font-mono text-xs tracking-wide uppercase ${
        reiter === id
          ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
          : 'border-transparent text-[color:var(--muted)]'
      }`}
    >
      {label}
    </button>
  );

  const akte = (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="ds-kicker">Ermittlungsakte</h2>
        <span className="ds-meta" data-testid="akte-zaehler">
          {geloest}/{staffel.vorfaelle.length}
        </span>
      </div>
      <ol className="divide-y divide-[color:color-mix(in_srgb,var(--ink)_12%,transparent)] border-y border-[color:color-mix(in_srgb,var(--ink)_12%,transparent)]">
        {staffel.vorfaelle.map((v) => {
          const eintrag = stand.akte[v.id];
          const frei = istFreigegeben(staffel, stand.akte, v.id);
          const aktiv = vorfall?.id === v.id;
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => void waehle(v)}
                disabled={!frei}
                aria-current={aktiv ? 'true' : undefined}
                className={`grid w-full grid-cols-[2rem_1fr_auto] items-baseline gap-3 py-3 text-left hover:bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  aktiv ? 'bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]' : ''
                }`}
              >
                <span className="ds-meta">{v.nr}</span>
                <span>
                  <span className="block text-[color:var(--ink)]">{v.titel}</span>
                  <span className="ds-meta">
                    {eintrag
                      ? `${v.beweisstueck.titel} · ${formatDuration(eintrag.durationMs)}${eintrag.withSolution ? ' · mit Lösung' : ''}`
                      : frei
                        ? 'offen'
                        : 'gesperrt, bis die Akte voll ist'}
                  </span>
                </span>
                <span aria-hidden="true" className="font-mono text-[color:var(--accent)]">
                  {eintrag ? '■' : frei ? '□' : '×'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="space-y-2">
        <h2 className="ds-kicker">Abzeichen</h2>
        <ul className="space-y-1 text-sm">
          {staffel.abzeichen.map((a) => {
            const hat = stand.abzeichen.includes(a.id);
            return (
              <li
                key={a.id}
                data-testid={`abzeichen-${a.id}`}
                className={hat ? 'text-[color:var(--ink)]' : 'text-[color:var(--muted)] opacity-70'}
              >
                <span className="font-mono">{hat ? '■' : '□'}</span> {a.titel}
                <span className="block pl-5 text-xs text-[color:var(--muted)]">
                  {a.beschreibung}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  const werkzeuge = (
    <div className="space-y-4 text-sm">
      {vorfall ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {vorfall.werkzeuge.map((w) => (
            <li
              key={w.befehl}
              className="border border-[color:color-mix(in_srgb,var(--ink)_12%,transparent)] p-3"
            >
              <code className="font-mono text-[color:var(--ink)]">{w.befehl}</code>
              <p className="text-[color:var(--muted)]">{w.erklaerung}</p>
              <details className="mt-1">
                <summary className="ds-meta cursor-pointer">Beispiel</summary>
                <code className="font-mono">{w.beispiel}</code>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[color:var(--muted)]">
          Wähle einen Vorfall, dann liegen hier seine Werkzeuge.
        </p>
      )}
      <details>
        <summary className="ds-meta cursor-pointer">
          Glossar: alle gelernten Befehle ({gelernt.length})
        </summary>
        {gelernt.length ? (
          <dl className="mt-2 space-y-1">
            {gelernt.map((w) => (
              <div key={w.befehl}>
                <dt className="font-mono text-[color:var(--ink)]">{w.befehl}</dt>
                <dd className="text-[color:var(--muted)]">{w.erklaerung}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-[color:var(--muted)]">
            Noch keine. Jeder gelöste Vorfall bringt welche.
          </p>
        )}
        <p className="mt-2 text-[color:var(--muted)]">
          Im Terminal erklärt <code className="font-mono">erklaer &lt;befehl&gt;</code> jeden
          Befehl.
        </p>
      </details>
    </div>
  );

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-7rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <aside
        id="bereich-akte"
        role="tabpanel"
        aria-labelledby="reiter-akte"
        className={`overflow-y-auto lg:order-none lg:block ${reiter === 'akte' ? 'order-3' : 'hidden'}`}
      >
        {akte}
      </aside>

      <div className="flex min-h-0 flex-col gap-3">
        <Pager nachrichten={pager} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void alexFragen()}
            disabled={!snapshot || fertig}
            className="border border-[color:var(--ink)] px-3 py-1.5 font-mono text-sm text-[color:var(--ink)] hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)] disabled:opacity-50"
          >
            {stufe >= 2
              ? 'Alex fragen: Lösung (zählt als „mit Lösung“)'
              : `Alex fragen (Tipp ${stufe + 1}/3)`}
          </button>
          <button
            type="button"
            onClick={() => setWerkzeugeOffen((o) => !o)}
            aria-expanded={werkzeugeOffen}
            aria-controls="werkzeuge-desktop"
            className="hidden border border-[color:color-mix(in_srgb,var(--ink)_30%,transparent)] px-3 py-1.5 font-mono text-sm text-[color:var(--ink)] lg:inline-block"
          >
            Werkzeuge
          </button>
          <span className="ds-meta ml-auto" data-testid="vorfall-schritt">
            {error
              ? `Vorfall ließ sich nicht starten: ${error}`
              : vorfall && !snapshot
                ? 'Vorfall wird vorbereitet …'
                : fertig
                  ? `Vorfall ${vorfall?.nr} gelöst${snapshot?.withSolution ? ' · mit Lösung' : ''}`
                  : schritt && snapshot
                    ? `Schritt ${snapshot.stepIndex + 1}/${snapshot.stepCount}: ${schritt.title}`
                    : null}
          </span>
        </div>

        {tipp && (
          <p
            data-testid="alex-tipp"
            role="status"
            className="max-h-32 overflow-y-auto border-l-2 border-[color:var(--accent)] pl-3 font-mono text-sm whitespace-pre-line text-[color:var(--ink)]"
          >
            {tipp}
          </p>
        )}
        {werkzeugeOffen && (
          <div id="werkzeuge-desktop" className="hidden max-h-48 overflow-y-auto lg:block">
            {werkzeuge}
          </div>
        )}

        <div role="tablist" aria-label="Ansicht" className="flex lg:hidden">
          {reiterKnopf('terminal', 'Terminal')}
          {reiterKnopf('akte', 'Akte')}
          {reiterKnopf('werkzeuge', 'Werkzeuge')}
        </div>

        <div
          id="bereich-werkzeuge"
          role="tabpanel"
          aria-labelledby="reiter-werkzeuge"
          className={reiter === 'werkzeuge' ? 'lg:hidden' : 'hidden'}
        >
          {werkzeuge}
        </div>

        <div
          id="bereich-terminal"
          tabIndex={-1}
          role="tabpanel"
          aria-labelledby="reiter-terminal"
          className={`min-h-0 flex-1 lg:flex lg:flex-col ${reiter === 'terminal' ? 'flex flex-col' : 'hidden'}`}
        >
          {vorfall ? (
            <Suspense
              fallback={
                <div className="flex h-[60dvh] items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-bg)] font-mono text-sm text-[var(--terminal-fg-muted)] lg:h-full">
                  Terminal wird geladen …
                </div>
              }
            >
              <LazyV86Terminal
                onReady={onReady}
                onMissionCommand={onMissionCommand}
                onPrompt={onPrompt}
                className="h-[60dvh] min-h-[20rem] lg:h-full lg:min-h-[12rem]"
              />
            </Suspense>
          ) : (
            <div className="flex h-[60dvh] items-center justify-center border border-dashed border-[color:color-mix(in_srgb,var(--ink)_20%,transparent)] p-8 text-center text-[color:var(--muted)] lg:h-full">
              Wähle einen Vorfall in der Akte. Danach startet ein echtes Alpine-Linux in deinem
              Browser, ohne Installation und ohne Netzwerk.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
