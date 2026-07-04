import { badges } from './achievements';
import type { Badge } from './achievements';

type MissionMeta = {
  id: string;
  category: string;
  difficulty: string;
  estimatedTime?: number;
  tags?: string[];
};

interface MissionProgress {
  completed: boolean;
  stars: number;
  hintsUsed: number;
  errorCount: number;
  completedAt: Date;
  timeSpent: number; // seconds
}

interface StoredProgress {
  version: '2.0';
  missions: Record<string, MissionProgress>;
  badges: string[];
  totalStars: number;
}

export class ProgressTracker {
  private progress: StoredProgress;

  constructor() {
    this.progress = {
      version: '2.0',
      missions: {},
      badges: [],
      totalStars: 0,
    };
  }

  completeMission(
    missionId: string,
    estimatedTime: number,
    hintsUsed: number,
    errorCount: number = 0,
    timeSpent: number = 0
  ) {
    const stars = this.calculateStars(hintsUsed);

    this.progress.missions[missionId] = {
      completed: true,
      stars,
      hintsUsed,
      errorCount,
      completedAt: new Date(),
      timeSpent,
    };

    this.recalculateTotalStars();
  }

  private calculateStars(hintsUsed: number): number {
    if (hintsUsed === 0) return 3;
    if (hintsUsed <= 2) return 2;
    return 1;
  }

  private recalculateTotalStars() {
    this.progress.totalStars = Object.values(this.progress.missions).reduce(
      (sum, m) => sum + m.stars,
      0
    );
  }

  isMissionCompleted(missionId: string): boolean {
    return this.progress.missions[missionId]?.completed || false;
  }

  getStars(missionId: string): number {
    return this.progress.missions[missionId]?.stars || 0;
  }

  getTotalStars(): number {
    return this.progress.totalStars;
  }

  checkBadges(allMissions: MissionMeta[]): string[] {
    const newBadges: string[] = [];

    for (const badge of badges) {
      if (this.progress.badges.includes(badge.id)) continue;

      if (this.meetsRequirement(badge, allMissions)) {
        this.progress.badges.push(badge.id);
        newBadges.push(badge.id);
      }
    }

    return newBadges;
  }

  private meetsRequirement(badge: Badge, allMissions: MissionMeta[]): boolean {
    const req = badge.requirement;

    if (req.category && req.difficulty && req.count) {
      const completed = allMissions.filter(
        (m) =>
          m.category === req.category &&
          m.difficulty === req.difficulty &&
          this.isMissionCompleted(m.id)
      ).length;
      return completed >= req.count;
    }

    if (req.category && req.perfectStars) {
      const categoryMissions = allMissions.filter((m) => m.category === req.category);
      return categoryMissions.every(
        (m) => this.isMissionCompleted(m.id) && this.getStars(m.id) === 3
      );
    }

    if (req.category && req.completeAll) {
      const categoryMissions = allMissions.filter((m) => m.category === req.category);
      return categoryMissions.every((m) => this.isMissionCompleted(m.id));
    }

    if (req.tag && req.count) {
      const completed = allMissions.filter(
        (m) => m.tags?.includes(req.tag!) && this.isMissionCompleted(m.id)
      ).length;
      return completed >= req.count;
    }

    if (req.zeroErrors) {
      return Object.values(this.progress.missions).some((m) => m.completed && m.errorCount === 0);
    }

    if (req.timeBonus) {
      return Object.entries(this.progress.missions).some(([id, m]) => {
        const mission = allMissions.find((am) => am.id === id);
        return m.completed && m.timeSpent < (mission?.estimatedTime || 0) * 60 * 0.5;
      });
    }

    return false;
  }

  getBadges(): string[] {
    return [...this.progress.badges];
  }

  save(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('terminal-missions-progress', JSON.stringify(this.progress));
    }
  }

  static load(): ProgressTracker {
    const tracker = new ProgressTracker();

    if (typeof localStorage === 'undefined') {
      return tracker;
    }

    const saved = localStorage.getItem('terminal-missions-progress');

    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.version === '2.0') {
          tracker.progress = data;
        }
      } catch (error) {
        console.error('Failed to load progress:', error);
      }
    }

    return tracker;
  }
}
