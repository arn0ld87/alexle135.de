import React from 'react';
import type { Mission } from '../../data/missions';

interface MissionSelectorProps {
  missions: Mission[];
  onSelectMission: (mission: Mission) => void;
  currentMission?: Mission;
}

const difficultyColors: Record<Mission['difficulty'], string> = {
  beginner: 'bg-green-500/10 border-green-500/30 text-green-400',
  intermediate: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  advanced: 'bg-red-500/10 border-red-500/30 text-red-400',
  expert:
    'bg-[color:color-mix(in_srgb,var(--terminal-accent)_10%,transparent)] border-[color:color-mix(in_srgb,var(--terminal-accent)_30%,transparent)] text-[var(--terminal-accent)]',
};

const categoryIcons: Record<Mission['category'], string> = {
  linux: '🐧',
  docker: '🐳',
  git: '📦',
  devops: '⚙️',
  windows: '🪟',
};

export default function MissionSelector({
  missions,
  onSelectMission,
  currentMission,
}: MissionSelectorProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {missions.map((mission) => (
        <button
          key={mission.id}
          onClick={() => onSelectMission(mission)}
          className={`group relative p-6 border-2 transition-all duration-base text-left ${
            currentMission?.id === mission.id
              ? 'border-[var(--terminal-accent)] bg-[color:color-mix(in_srgb,var(--terminal-accent)_10%,transparent)]'
              : 'border-[var(--terminal-border)] bg-[color:color-mix(in_srgb,var(--terminal-fg)_4%,var(--terminal-bg))] hover:border-[var(--terminal-accent)]'
          }`}
        >
          {/* Category Badge */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">{categoryIcons[mission.category]}</span>
            <span
              className={`text-xs px-3 py-1 border font-medium ${difficultyColors[mission.difficulty]}`}
            >
              {mission.difficulty}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-[var(--terminal-fg)] mb-3 group-hover:text-[var(--terminal-accent)] transition-colors">
            {mission.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-[var(--terminal-fg-muted)] leading-relaxed mb-4">
            {mission.description}
          </p>

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs text-[var(--terminal-fg-muted)]">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">{mission.estimatedTime} min</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">{mission.steps.length} Schritte</span>
            </div>
          </div>

          {/* Prerequisites */}
          {mission.prerequisites && mission.prerequisites.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--terminal-border)]">
              <p className="text-xs text-[var(--terminal-fg-muted)]">
                Voraussetzung: {mission.prerequisites.join(', ')}
              </p>
            </div>
          )}

          {/* Active Indicator */}
          {currentMission?.id === mission.id && (
            <div className="absolute top-4 right-4">
              <div className="w-2 h-2 rounded-full bg-[var(--terminal-accent)] animate-pulse"></div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
