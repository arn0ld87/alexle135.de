import { describe, it, expect } from 'vitest';
import { isMissionUnlocked } from '../missionEngine';
import { ProgressTracker } from '../progressTracker';

describe('Mission Engine', () => {
  it('should unlock mission with no prerequisites', () => {
    const tracker = new ProgressTracker();
    const mission = { id: 'test', prerequisites: [] };

    expect(isMissionUnlocked(mission, tracker)).toBe(true);
  });

  it('should lock mission if prerequisite not completed', () => {
    const tracker = new ProgressTracker();
    const mission = { id: 'test', prerequisites: ['prereq-1'] };

    expect(isMissionUnlocked(mission, tracker)).toBe(false);
  });

  it('should unlock mission if all prerequisites completed', () => {
    const tracker = new ProgressTracker();
    tracker.completeMission('prereq-1', 10, 0);

    const mission = { id: 'test', prerequisites: ['prereq-1'] };

    expect(isMissionUnlocked(mission, tracker)).toBe(true);
  });

  it('should lock mission if not enough stars', () => {
    const tracker = new ProgressTracker();
    tracker.completeMission('test-1', 10, 2); // 2 stars

    const mission = { id: 'test', minStarsRequired: 5 };

    expect(isMissionUnlocked(mission, tracker)).toBe(false);
  });

  it('should unlock mission with enough stars', () => {
    const tracker = new ProgressTracker();
    tracker.completeMission('test-1', 10, 0); // 3 stars
    tracker.completeMission('test-2', 10, 0); // 3 stars

    const mission = { id: 'test', minStarsRequired: 5 };

    expect(isMissionUnlocked(mission, tracker)).toBe(true);
  });
});
