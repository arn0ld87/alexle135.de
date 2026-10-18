// Linux- und Git-Missionen auf echtem Linux (v86). Die Liste steht sofort; die VM lädt
// erst, wenn eine Mission gewählt ist, und bleibt beim Wechsel der Mission laufen: Jeder
// Start setzt den Ausgangszustand per `setup` neu. Prüfung, Tipps und Flagge laufen über
// den Befehl `mission` im Terminal (MissionEngine), der Fortschritt liegt im localStorage.
import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { v86Missions } from '../../data/v86Missions';
import type { AgentClient } from '../../lib/missions/agentClient';
import {
  MissionEngine,
  formatDuration,
  type MissionSnapshot,
} from '../../lib/missions/missionEngine';
import { createMissionStore } from '../../lib/missions/missionStore';
import type {
  MissionCommand,
  MissionDifficulty,
  MissionReply,
  MissionTrack,
  V86Mission,
} from '../../lib/missions/missionTypes';

const LazyV86Terminal = React.lazy(() => import('./V86Terminal'));

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

  const clientRef = useRef<AgentClient | null>(null);
  const engineRef = useRef<MissionEngine | null>(null);
  const selectedRef = useRef<V86Mission | null>(null);

  const startMission = useCallback(
    async (mission: V86Mission) => {
      const client = clientRef.current;
      if (!client) return;
      const engine = new MissionEngine(mission, client, {
        store,
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
      } catch (e) {
        if (engineRef.current === engine) setError((e as Error).message);
      }
    },
    [store]
  );

  function select(mission: V86Mission) {
    selectedRef.current = mission;
    setSelected(mission);
    void startMission(mission);
  }

  // Auch nach „Neu starten“ der VM: frischer Agent, Mission neu aufsetzen.
  const onReady = useCallback(
    (client: AgentClient) => {
      clientRef.current = client;
      if (selectedRef.current) void startMission(selectedRef.current);
    },
    [startMission]
  );

  const onMissionCommand = useCallback(
    (command: MissionCommand) => engineRef.current?.handle(command) ?? Promise.resolve(NO_MISSION),
    []
  );

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
          {v86Missions.map((mission, index) => {
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
                  <span className="ds-meta">{String(index + 1).padStart(2, '0')}</span>
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
            <p className="text-sm text-[color:var(--muted)]">{step.description}</p>
          </div>
        )
      )}
      <p className="ds-meta">
        Im Terminal: mission status · mission hint · mission check · mission solve · mission flag
      </p>
    </div>
  );
}
