// Windows-Missionen als Simulation: Liste, Panel und Terminal (Aufbau der früheren Linux-Missionsliste).
// Das Terminal ist ein Nachbau (MockWindowsSystem), kein echtes Windows. Prüfung, Tipps und
// Flagge laufen über den Befehl `mission` im Terminal (WindowsMissionEngine); der Fortschritt
// liegt im localStorage und wird synchron nach jedem Befehl aus dem Zustand gelesen.
import { useCallback, useMemo, useRef, useState } from 'react';
import { windowsMissions } from '../../data/windowsMissions';
import { MockWindowsSystem } from '../interactive/MockWindowsSystem';
import Terminal from '../interactive/Terminal';
import { formatDuration, type MissionSnapshot } from '../../lib/missions/missionEngine';
import { createMissionStore } from '../../lib/missions/missionStore';
import type { MissionDifficulty } from '../../lib/missions/missionTypes';
import { WindowsMissionEngine, type WindowsMission } from '../../lib/missions/windowsEngine';

const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  einstieg: 'Einstieg',
  fortgeschritten: 'Fortgeschritten',
  profi: 'Profi',
};

interface Run {
  mission: WindowsMission;
  sys: MockWindowsSystem;
  engine: WindowsMissionEngine;
  /** Neuer Wert bei jedem Start, damit das Terminal frisch aufgesetzt wird. */
  key: number;
}

export default function WindowsMissions() {
  const store = useMemo(() => createMissionStore(), []);
  const [progress, setProgress] = useState(() => store.read());
  const [run, setRun] = useState<Run | null>(null);
  const [snapshot, setSnapshot] = useState<MissionSnapshot | null>(null);
  const engineRef = useRef<WindowsMissionEngine | null>(null);
  const runKey = useRef(0);

  const startMission = useCallback(
    (mission: WindowsMission) => {
      const sys = new MockWindowsSystem();
      const engine = new WindowsMissionEngine(mission, sys, {
        store,
        onChange: (next) => {
          // Meldungen einer abgelösten Engine nicht mehr anzeigen.
          if (engineRef.current !== engine) return;
          setSnapshot(next);
          if (next.finishedAt !== null) setProgress(store.read());
        },
      });
      engineRef.current = engine;
      runKey.current += 1;
      setSnapshot(engine.snapshot());
      setRun({ mission, sys, engine, key: runKey.current });
    },
    [store]
  );

  const doneCount = store.countDone(windowsMissions.map((m) => m.id));
  void progress; // Zähler und Liste lesen den Store; progress löst nur das Neuzeichnen aus.

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-6">
        <p className="ds-meta">{`Windows ${doneCount}/${windowsMissions.length} · Simulation`}</p>

        <ol className="divide-y divide-[color:color-mix(in_srgb,var(--ink)_12%,transparent)] border-y border-[color:color-mix(in_srgb,var(--ink)_12%,transparent)]">
          {windowsMissions.map((mission, index) => {
            const result = store.get(mission.id);
            const active = run?.mission.id === mission.id;
            return (
              <li key={mission.id}>
                <button
                  type="button"
                  onClick={() => startMission(mission)}
                  aria-current={active ? 'true' : undefined}
                  className={`grid w-full grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 py-3 text-left hover:bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)] ${
                    active ? 'bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]' : ''
                  }`}
                >
                  <span className="ds-meta">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="block text-[color:var(--ink)]">{mission.title}</span>
                    <span className="ds-meta">
                      Windows · {DIFFICULTY_LABEL[mission.difficulty]} · ca. {mission.durationMin}{' '}
                      min
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
      </div>

      <div className="space-y-4">
        {run ? (
          <>
            <MissionPanel
              mission={run.mission}
              snapshot={snapshot}
              onRestart={() => startMission(run.mission)}
            />
            <div className="h-[480px]">
              <Terminal
                key={run.key}
                system={run.sys}
                welcomeMessage={`Simulation: Das ist ein Nachbau, kein echtes Windows.\nMission „${run.mission.title}“. Tippe „mission status“ für die Aufgabe.`}
                intercept={(line) => run.engine.intercept(line)}
                onCommand={() => run.engine.afterCommand()}
              />
            </div>
          </>
        ) : (
          <div className="flex h-[480px] flex-col items-center justify-center gap-2 border border-dashed border-[color:color-mix(in_srgb,var(--ink)_20%,transparent)] p-8 text-center text-[color:var(--muted)]">
            <p className="ds-meta ds-meta--ink">Simulation</p>
            <p>
              Wähle eine Mission. Die Aufgaben laufen in einem Nachbau der Windows-Konsole direkt im
              Browser, ohne Installation. Es ist kein echtes Windows.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MissionPanel({
  mission,
  snapshot,
  onRestart,
}: {
  mission: WindowsMission;
  snapshot: MissionSnapshot | null;
  onRestart: () => void;
}) {
  const step = snapshot ? mission.steps[snapshot.stepIndex] : null;
  return (
    <div className="space-y-3" aria-live="polite">
      <h2 className="ds-display-s text-[color:var(--ink)]">{mission.title}</h2>
      <p className="ds-meta ds-meta--ink">Simulation · kein echtes Windows</p>
      <p className="text-sm text-[color:var(--muted)]">{mission.description}</p>
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
      <button type="button" onClick={onRestart} className="ds-meta underline">
        Mission neu starten
      </button>
    </div>
  );
}
