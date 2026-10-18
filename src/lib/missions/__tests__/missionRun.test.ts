import { describe, expect, it } from 'vitest';
import { nextMission, totalRunMs } from '../missionRun';
import type { V86Mission } from '../missionTypes';

const m = (id: string, countsTowardRun?: boolean) =>
  ({ id, countsTowardRun }) as unknown as V86Mission;
const list = [m('00', false), m('01'), m('02')];

describe('nextMission', () => {
  it('liefert die nächste Mission in Listenreihenfolge', () => {
    expect(nextMission('00', list)?.id).toBe('01');
    expect(nextMission('01', list)?.id).toBe('02');
  });

  it('startet ohne aktive Mission bei der ersten', () => {
    expect(nextMission(null, list)?.id).toBe('00');
  });

  it('liefert nach der letzten und bei unbekannter Mission nichts', () => {
    expect(nextMission('02', list)).toBeUndefined();
    expect(nextMission('xx', list)).toBeUndefined();
  });
});

describe('totalRunMs', () => {
  it('summiert erledigte Missionen ohne die, die nicht zum Gesamtlauf zählen', () => {
    const progress = {
      '00': { flag: 'F', withSolution: false, durationMs: 50_000, finishedAt: 1 },
      '01': { flag: 'F', withSolution: false, durationMs: 60_000, finishedAt: 2 },
      '02': { flag: 'F', withSolution: true, durationMs: 30_000, finishedAt: 3 },
    };
    expect(totalRunMs(list, progress)).toBe(90_000);
    expect(totalRunMs(list, {})).toBe(0);
  });
});
