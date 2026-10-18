// Linux- und Git-Missionen auf echtem Linux (v86). Die Liste steht sofort; die VM lädt
// erst, wenn eine Mission gewählt ist, und bleibt beim Wechsel der Mission laufen: Jeder
// Start setzt den Ausgangszustand per `setup` neu. Prüfung, Tipps und Flagge laufen über
// den Befehl `mission` im Terminal (MissionEngine), der Fortschritt liegt im localStorage.
// Auftrag und Rückmeldungen stehen im Pager über dem Terminal (#397); `mission status` bleibt
// als Abkürzung.
import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { v86Missions } from '../../data/missions';
import { BEGRUESSUNG } from '../../data/staffeln/begruessung';
import type { AgentClient } from '../../lib/missions/agentClient';
import {
  MissionEngine,
  formatDuration,
  type MissionSnapshot,
} from '../../lib/missions/missionEngine';
import { nextMission } from '../../lib/missions/missionRun';
import { anhaengen, satz, type PagerArt, type PagerNachricht } from '../../lib/missions/pager';
import { createMissionStore } from '../../lib/missions/missionStore';
import type {
  MissionCommand,
  MissionDifficulty,
  MissionReply,
  MissionTrack,
  V86Mission,
} from '../../lib/missions/missionTypes';

import Pager from './Pager';

const LazyV86Terminal = React.lazy(() => import('./V86Terminal'));

/** Pager-Zeilen für einen Schritt: Nummer und Titel, dann die Aufgabe. */
function schrittZeilen(mission: V86Mission, index: number): string[] {
  const step = mission.steps[index];
  if (!step) return [];
  return [`Schritt ${index + 1}/${mission.steps.length}: ${step.title}`, step.description];
}

const TRACK_LABEL: Record<MissionTrack, string> = { linux: 'Linux', git: 'Git' };
const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  einstieg: 'Einstieg',
  fortgeschritten: 'Fortgeschritten',
  profi: 'Profi',
};

const NO_MISSION: MissionReply = {
  exitCode: 3,
  text: 'Keine Mission aktiv. Wähle links eine Mission aus.',
};

export default function LinuxMissions() {
  const store = useMemo(() => createMissionStore(), []);
  const [progress, setProgress] = useState(() => store.read());
  const [selected, setSelected] = useState<V86Mission | null>(null);
  const [snapshot, setSnapshot] = useState<MissionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pager, setPager] = useState<PagerNachricht[]>([]);
  const melde = useCallback(
    (art: PagerArt, zeilen: string[]) => setPager((v) => anhaengen(v, art, zeilen)),
    []
  );

  const clientRef = useRef<AgentClient | null>(null);
  const engineRef = useRef<MissionEngine | null>(null);
  const selectedRef = useRef<V86Mission | null>(null);
  // `mission next` aus dem Terminal; über eine Ref, weil die Engine sie beim Start bekommt.
  const nextRef = useRef<() => Promise<MissionReply>>(async () => NO_MISSION);

  const startMission = useCallback(
    async (mission: V86Mission) => {
      const client = clientRef.current;
      if (!client) return;
      const engine = new MissionEngine(mission, client, {
        store,
        onNext: () => nextRef.current(),
        successInPager: true,
        onEvent: (event) => {
          if (engineRef.current !== engine) return;
          if (event.type === 'schritt-erledigt') {
            const naechster = event.stepIndex + 1;
            if (naechster < mission.steps.length) {
              melde('auftrag', [
                satz(`Erledigt: ${mission.steps[event.stepIndex].title}`),
                ...schrittZeilen(mission, naechster),
              ]);
            }
          } else {
            melde('erledigt', [
              `Mission ${mission.nr} geschafft. Flagge ${event.flag}${event.withSolution ? ' (mit Lösung)' : ''}.`,
              'Weiter mit `mission next` oder links mit der nächsten Mission.',
            ]);
          }
        },
        onChange: (next) => {
          // Antworten einer abgelösten Engine nicht mehr anzeigen.
          if (engineRef.current !== engine) return;
          setSnapshot(next);
          if (next.finishedAt !== null) setProgress(store.read());
        },
      });
      engineRef.current = engine;
      setSnapshot(null);
      setError(null);
      try {
        await engine.start();
        if (engineRef.current === engine) {
          // Die erste Mission der Sitzung beginnt mit Alex' Begrüßung.
          setPager((v) =>
            anhaengen(v, 'auftrag', [
              ...(v.length ? [] : BEGRUESSUNG),
              `Mission ${mission.nr}: ${mission.title}.`,
              ...schrittZeilen(mission, 0),
            ])
          );
        }
        return true;
      } catch (e) {
        if (engineRef.current === engine) setError((e as Error).message);
        return false;
      }
    },
    [store, melde]
  );

  function select(mission: V86Mission) {
    selectedRef.current = mission;
    setSelected(mission);
    return startMission(mission);
  }

  nextRef.current = async () => {
    const next = nextMission(selectedRef.current?.id ?? null, v86Missions);
    if (!next)
      return { exitCode: 0, text: 'Das war die letzte Mission. Mehr habe ich gerade nicht.' };
    const started = await select(next);
    return started
      ? {
          exitCode: 0,
          text: `Mission ${next.nr}: ${next.title}. \`mission status\` zeigt die Aufgabe.`,
        }
      : { exitCode: 3, text: `Mission ${next.nr} ließ sich nicht starten. Wähle sie links aus.` };
  };

  // Auch nach „Neu starten“ der VM: frischer Agent, Mission neu aufsetzen.
  const onReady = useCallback(
    (client: AgentClient) => {
      clientRef.current = client;
      if (selectedRef.current) void startMission(selectedRef.current);
    },
    [startMission]
  );

  const onMissionCommand = useCallback((command: MissionCommand) => {
    if (engineRef.current) return engineRef.current.handle(command);
    return command === 'next' ? nextRef.current() : Promise.resolve(NO_MISSION);
  }, []);

  const doneCount = (track: MissionTrack) =>
    store.countDone(v86Missions.filter((m) => m.track === track).map((m) => m.id));
  void progress; // Zähler und Liste lesen den Store; progress löst nur das Neuzeichnen aus.

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-6">
        <p className="ds-meta">
          {(['linux', 'git'] as const)
            .map(
              (t) =>
                `${TRACK_LABEL[t]} ${doneCount(t)}/${v86Missions.filter((m) => m.track === t).length}`
            )
            .join(' · ')}
        </p>

        <ol className="divide-y divide-[color:color-mix(in_srgb,var(--ink)_12%,transparent)] border-y border-[color:color-mix(in_srgb,var(--ink)_12%,transparent)]">
          {v86Missions.map((mission) => {
            const result = store.get(mission.id);
            const active = selected?.id === mission.id;
            return (
              <li key={mission.id}>
                <button
                  type="button"
                  onClick={() => select(mission)}
                  aria-current={active ? 'true' : undefined}
                  className={`grid w-full grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 py-3 text-left hover:bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)] ${
                    active ? 'bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]' : ''
                  }`}
                >
                  <span className="ds-meta">{mission.nr}</span>
                  <span>
                    <span className="block text-[color:var(--ink)]">{mission.title}</span>
                    <span className="ds-meta">
                      {TRACK_LABEL[mission.track]} · {DIFFICULTY_LABEL[mission.difficulty]} · ca.{' '}
                      {mission.durationMin} min
                    </span>
                  </span>
                  <span className="ds-meta text-right">
                    {result
                      ? `${formatDuration(result.durationMs)}${result.withSolution ? ' · mit Lösung' : ''}`
                      : 'offen'}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="ds-meta">Docker-Track folgt mit echter Sandbox.</p>
      </div>

      <div className="space-y-4">
        {selected ? (
          <>
            <MissionPanel mission={selected} snapshot={snapshot} error={error} />
            <Pager nachrichten={pager} />
            <Suspense
              fallback={
                <div className="flex h-[480px] items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-bg)] font-mono text-sm text-[var(--terminal-fg-muted)]">
                  Terminal wird geladen …
                </div>
              }
            >
              <LazyV86Terminal
                onReady={onReady}
                onMissionCommand={onMissionCommand}
                className="h-[480px]"
              />
            </Suspense>
          </>
        ) : (
          <div className="flex h-[480px] items-center justify-center border border-dashed border-[color:color-mix(in_srgb,var(--ink)_20%,transparent)] p-8 text-center text-[color:var(--muted)]">
            Wähle eine Mission. Danach startet ein echtes Alpine-Linux in deinem Browser, ohne
            Installation und ohne Netzwerk.
          </div>
        )}
      </div>
    </div>
  );
}

function MissionPanel({
  mission,
  snapshot,
  error,
}: {
  mission: V86Mission;
  snapshot: MissionSnapshot | null;
  error: string | null;
}) {
  const step = snapshot ? mission.steps[snapshot.stepIndex] : null;
  return (
    <div className="space-y-3" aria-live="polite">
      <h2 className="ds-display-s text-[color:var(--ink)]">{mission.title}</h2>
      {error && <p className="text-[color:var(--ink)]">Mission ließ sich nicht starten: {error}</p>}
      {!error && !snapshot && <p className="ds-meta">Mission wird vorbereitet …</p>}
      {snapshot?.flag ? (
        <p className="font-mono text-[color:var(--ink)]">
          Geschafft · Flagge {snapshot.flag}
          {snapshot.withSolution ? ' (mit Lösung)' : ''}
        </p>
      ) : (
        step && (
          <div className="space-y-1">
            <p className="ds-meta">
              Schritt {snapshot!.stepIndex + 1}/{snapshot!.stepCount}
            </p>
            <p className="text-[color:var(--ink)]">{step.title}</p>
            {step.tools && step.tools.length > 0 && (
              <details className="text-sm">
                <summary className="ds-meta cursor-pointer">Werkzeugkasten</summary>
                <dl className="mt-2 space-y-1">
                  {step.tools.map((tool) => (
                    <div key={tool.befehl}>
                      <dt className="font-mono text-[color:var(--ink)]">{tool.befehl}</dt>
                      <dd className="text-[color:var(--muted)]">
                        {tool.erklaerung} <code className="font-mono">{tool.beispiel}</code>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </div>
        )
      )}
      {snapshot?.feedback && (
        <p
          data-testid="mission-feedback"
          className="font-mono text-sm whitespace-pre-line text-[color:var(--muted)]"
        >
          {snapshot.feedback}
        </p>
      )}
      <p className="ds-meta">
        Im Terminal: mission status · hint · check · next · erklaer &lt;befehl&gt;
      </p>
    </div>
  );
}
