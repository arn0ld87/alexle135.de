import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressTracker } from '../progressTracker';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  it('should record mission completion', () => {
    tracker.completeMission('linux-basics-1', 3, 0);
    expect(tracker.isMissionCompleted('linux-basics-1')).toBe(true);
  });

  it('should calculate stars correctly', () => {
    tracker.completeMission('test-1', 3, 0, 0); // 0 hints = 3 stars
    tracker.completeMission('test-2', 2, 2, 0); // 2 hints = 2 stars
    tracker.completeMission('test-3', 1, 5, 0); // 5 hints = 1 star

    expect(tracker.getStars('test-1')).toBe(3);
    expect(tracker.getStars('test-2')).toBe(2);
    expect(tracker.getStars('test-3')).toBe(1);
    expect(tracker.getTotalStars()).toBe(6);
  });

  it('should unlock badges', () => {
    // Complete 3 beginner Linux missions
    tracker.completeMission('linux-basics-1', 3, 0, 0);
    tracker.completeMission('linux-files-1', 3, 0, 0);
    tracker.completeMission('linux-perms-1', 3, 0, 0);

    const earnedBadges = tracker.checkBadges([
      { id: 'linux-basics-1', category: 'linux', difficulty: 'beginner', tags: [] },
      { id: 'linux-files-1', category: 'linux', difficulty: 'beginner', tags: [] },
      { id: 'linux-perms-1', category: 'linux', difficulty: 'beginner', tags: [] },
    ]);

    expect(earnedBadges).toContain('linux-rookie');
  });

  it('should persist to localStorage', () => {
    tracker.completeMission('test', 3, 0, 0);
    tracker.save();

    const newTracker = ProgressTracker.load();
    expect(newTracker.isMissionCompleted('test')).toBe(true);
  });
});
