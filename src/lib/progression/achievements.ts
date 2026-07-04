export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  requirement: BadgeRequirement;
}

interface BadgeRequirement {
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  count?: number;
  perfectStars?: boolean;
  completeAll?: boolean;
  tag?: string;
  zeroErrors?: boolean;
  timeBonus?: boolean;
}

export const badges: Badge[] = [
  {
    id: 'linux-rookie',
    name: 'Linux Rookie',
    icon: '🐧',
    description: 'Schließe 3 Beginner Linux-Missionen ab',
    requirement: { category: 'linux', difficulty: 'beginner', count: 3 },
  },
  {
    id: 'docker-ninja',
    name: 'Docker Ninja',
    icon: '🐳',
    description: 'Alle Docker-Missionen mit 3⭐',
    requirement: { category: 'docker', perfectStars: true },
  },
  {
    id: 'git-master',
    name: 'Git Master',
    icon: '📦',
    description: 'Alle Git-Missionen abgeschlossen',
    requirement: { category: 'git', completeAll: true },
  },
  {
    id: 'ctf-hunter',
    name: 'CTF Hunter',
    icon: '🏴',
    description: 'Löse 5 CTF-Missionen',
    requirement: { tag: 'ctf', count: 5 },
  },
  {
    id: 'perfect-run',
    name: 'Perfect Run',
    icon: '💎',
    description: 'Eine Mission ohne einzigen Fehler',
    requirement: { zeroErrors: true },
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    icon: '⚡',
    description: 'Mission in unter 50% der Zeit',
    requirement: { timeBonus: true },
  },
];

export function getBadgeById(id: string): Badge | undefined {
  return badges.find((b) => b.id === id);
}
