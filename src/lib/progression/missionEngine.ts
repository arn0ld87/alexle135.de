import { ProgressTracker } from './progressTracker';

interface Mission {
  id: string;
  prerequisites?: string[];
  minStarsRequired?: number;
  requiredBadges?: string[];
}

export function isMissionUnlocked(mission: Mission, tracker: ProgressTracker): boolean {
  // Check prerequisites
  if (mission.prerequisites && mission.prerequisites.length > 0) {
    const allCompleted = mission.prerequisites.every((prereqId) =>
      tracker.isMissionCompleted(prereqId)
    );
    if (!allCompleted) return false;
  }

  // Check star requirement
  if (mission.minStarsRequired !== undefined) {
    if (tracker.getTotalStars() < mission.minStarsRequired) {
      return false;
    }
  }

  // Check badge requirement
  if (mission.requiredBadges && mission.requiredBadges.length > 0) {
    const userBadges = tracker.getBadges();
    const hasAllBadges = mission.requiredBadges.every((badgeId) => userBadges.includes(badgeId));
    if (!hasAllBadges) return false;
  }

  return true;
}

export function getUnlockRequirements(mission: Mission, tracker: ProgressTracker): string[] {
  const requirements: string[] = [];

  if (mission.prerequisites) {
    const missing = mission.prerequisites.filter((id) => !tracker.isMissionCompleted(id));
    if (missing.length > 0) {
      requirements.push(`Complete: ${missing.join(', ')}`);
    }
  }

  if (mission.minStarsRequired) {
    const current = tracker.getTotalStars();
    const needed = mission.minStarsRequired;
    if (current < needed) {
      requirements.push(`Earn ${needed - current} more ⭐ (${current}/${needed})`);
    }
  }

  if (mission.requiredBadges) {
    const userBadges = tracker.getBadges();
    const missing = mission.requiredBadges.filter((id) => !userBadges.includes(id));
    if (missing.length > 0) {
      requirements.push(`Earn badges: ${missing.join(', ')}`);
    }
  }

  return requirements;
}
