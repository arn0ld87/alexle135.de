// Reihenfolge und Gesamtlauf der Missionen, ohne DOM und ohne Speicher: testbar mit Listen.
import type { MissionProgress } from './missionStore';
import type { V86Mission } from './missionTypes';

/** Mission nach `id` in Listenreihenfolge; ohne `id` die erste, nach der letzten keine. */
export function nextMission(
  id: string | null,
  missions: readonly V86Mission[]
): V86Mission | undefined {
  if (id === null) return missions[0];
  const index = missions.findIndex((m) => m.id === id);
  return index < 0 ? undefined : missions[index + 1];
}

/** Summe der Zeiten erledigter Missionen; Missionen mit `countsTowardRun: false` zählen nicht. */
export function totalRunMs(missions: readonly V86Mission[], progress: MissionProgress): number {
  return missions
    .filter((m) => m.countsTowardRun !== false)
    .reduce((sum, m) => sum + (progress[m.id]?.durationMs ?? 0), 0);
}
