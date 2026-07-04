import React, { Suspense, useMemo, useState } from 'react';
import Terminal from './Terminal';
import MissionSelector from './MissionSelector';
import AITutorSidebar from '../ai-tutor/AITutorSidebar';
import { allMissions, type Mission } from '../../data/missions';

const LazyWebContainerTerminal = React.lazy(() => import('./WebContainerTerminal'));

export type MissionMode = 'linux' | 'windows';

interface BaseMissionTerminalProps {
  mode: MissionMode;
  title?: string;
  description?: string;
}

const defaultTitles: Record<MissionMode, string> = {
  linux: 'Wähle deine Mission',
  windows: 'Wähle deine Windows-Mission',
};

const defaultDescriptions: Record<MissionMode, string> = {
  linux:
    'Interaktive Tutorials für Linux, Docker und Git. Wähle ein Tutorial aus und starte deine Lernreise!',
  windows: 'Interaktive Tutorials für Windows CMD und PowerShell. Vom Anfänger zum Expert!',
};

export default function BaseMissionTerminal({
  mode,
  title,
  description,
}: BaseMissionTerminalProps) {
  // Filter missions based on mode
  const filteredMissions = useMemo(
    () =>
      mode === 'windows'
        ? allMissions.filter((m) => m.category === 'windows')
        : allMissions.filter((m) => m.category !== 'windows'),
    [mode]
  );

  const displayTitle = title || defaultTitles[mode];
  const displayDescription = description || defaultDescriptions[mode];

  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [missionComplete, setMissionComplete] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showAITutor, setShowAITutor] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSelectMission = (mission: Mission) => {
    setSelectedMission(mission);
    setCurrentStepIndex(0);
    setMissionComplete(false);
    setShowHint(false);
    setShowAITutor(false);
    setCommandHistory([]);
    setErrors([]);
  };

  const handleBackToSelector = () => {
    setSelectedMission(null);
    setCurrentStepIndex(0);
    setMissionComplete(false);
    setShowHint(false);
    setShowAITutor(false);
    setCommandHistory([]);
    setErrors([]);
  };

  const handleCommand = (cmd: string) => {
    if (!selectedMission || missionComplete) return;

    // Track command history
    setCommandHistory((prev) => [...prev, cmd].slice(-10));

    const currentStep = selectedMission.steps[currentStepIndex];
    const normalizedCmd = cmd.trim().toLowerCase();

    let isCorrect = false;
    if (
      currentStep.requiredCommand &&
      normalizedCmd === currentStep.requiredCommand.toLowerCase()
    ) {
      isCorrect = true;
    } else if (currentStep.validationRegex && currentStep.validationRegex.test(normalizedCmd)) {
      isCorrect = true;
    }

    if (isCorrect) {
      setErrors([]);
      if (currentStepIndex < selectedMission.steps.length - 1) {
        // Windows mode has a small delay for visual feedback
        if (mode === 'windows') {
          setTimeout(() => {
            setCurrentStepIndex((prev) => prev + 1);
            setShowHint(false);
          }, 800);
        } else {
          setCurrentStepIndex((prev) => prev + 1);
          setShowHint(false);
        }
      } else {
        setCurrentStepIndex((prev) => prev + 1);
        setMissionComplete(true);
      }
    } else {
      setErrors((prev) =>
        [
          ...prev,
          `Command "${cmd}" did not match expected: ${currentStep.requiredCommand || 'regex pattern'}`,
        ].slice(-5)
      );
    }
  };

  // Show mission selector if no mission is selected
  if (!selectedMission) {
    return (
      <div className="space-y-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-semibold text-white mb-4 tracking-tight">{displayTitle}</h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {displayDescription}
          </p>
        </div>
        <MissionSelector missions={filteredMissions} onSelectMission={handleSelectMission} />
      </div>
    );
  }

  const currentStep = selectedMission.steps[currentStepIndex];
  const progressPercent = Math.round((currentStepIndex / selectedMission.steps.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={handleBackToSelector}
          className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors duration-base text-sm font-medium group"
        >
          <svg
            className="w-5 h-5 transition-transform group-hover:-translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Zurück zur Missionsauswahl
        </button>
        <div className="text-xs text-gray-500 tracking-wider uppercase font-medium">
          {selectedMission.category} • {selectedMission.difficulty}
        </div>
      </div>

      {/* Mission Interface */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Mission Sidebar */}
        <div className="bg-surface-glass backdrop-blur-lg border border-surface-border rounded-xl p-6 space-y-6 transition-all duration-base hover:border-surface-border-hover">
          <div>
            <h3 className="text-blue-400 text-xs uppercase tracking-widest font-semibold mb-3">
              {selectedMission.title} • Schritt {currentStepIndex + 1}/
              {selectedMission.steps.length}
            </h3>

            {/* Mission Description - Only for Windows mode */}
            {mode === 'windows' && (
              <div className="mb-6 p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-gray-300 text-xs italic">"{selectedMission.description}"</p>
              </div>
            )}

            <h2 className="text-xl font-semibold text-white mb-3">
              {missionComplete ? 'Mission Erfüllt! 🎉' : currentStep.title}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              {missionComplete
                ? `Du hast "${selectedMission.title}" erfolgreich gemeistert! Du bist bereit für die nächste Herausforderung.`
                : currentStep.description}
            </p>
          </div>

          {!missionComplete && (
            <div className="pt-4 border-t border-white/5 space-y-3">
              <button
                onClick={() => setShowHint(!showHint)}
                className="text-xs text-gray-500 hover:text-blue-400 transition-colors duration-base flex items-center gap-2 font-medium"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {showHint ? 'Hinweis verbergen' : 'Brauchst du einen Hinweis?'}
              </button>

              {showHint && (
                <div className="mt-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300 leading-relaxed">
                  {currentStep.hint}
                </div>
              )}

              <button
                onClick={() => setShowAITutor(!showAITutor)}
                className={`text-xs transition-colors duration-base flex items-center gap-2 font-medium ${
                  mode === 'windows'
                    ? 'text-gray-500 hover:text-purple-400'
                    : 'text-purple-400 hover:text-purple-300'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                {mode === 'windows'
                  ? showAITutor
                    ? 'AI-Tutor verbergen'
                    : 'Brauchst du AI-Hilfe?'
                  : '🤖 AI-Tutor um Hilfe fragen'}
              </button>
            </div>
          )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Fortschritt</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Terminal Area */}
        <div className={`relative ${mode === 'linux' ? 'h-[500px]' : ''}`}>
          {mode === 'windows' ? (
            <Terminal
              onCommand={handleCommand}
              welcomeMessage={`Mission "${selectedMission.title}" gestartet. Tippe "help" für verfügbare Befehle.`}
            />
          ) : (
            <Suspense
              fallback={
                <div className="h-full bg-surface-glass backdrop-blur-lg border border-surface-border rounded-xl flex items-center justify-center text-sm text-gray-400">
                  Terminal wird geladen…
                </div>
              }
            >
              <LazyWebContainerTerminal onCommand={handleCommand} className="h-full" />
            </Suspense>
          )}

          {/* Success Overlay */}
          {missionComplete && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md rounded-xl z-10">
              <div className="text-center p-10 bg-surface-glass backdrop-blur-xl border-2 border-green-500/40 rounded-2xl shadow-glow-lg max-w-md">
                <div className="text-6xl mb-6">🏆</div>
                <h3 className="text-3xl font-semibold text-white mb-3 tracking-tight">
                  Mission erfüllt!
                </h3>
                <p className="text-gray-300 mb-8 text-base leading-relaxed">
                  Du hast "{selectedMission.title}" erfolgreich abgeschlossen.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleBackToSelector}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all duration-base hover:scale-105 shadow-lg hover:shadow-glow-sm"
                  >
                    Neue Mission wählen
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStepIndex(0);
                      setMissionComplete(false);
                      setShowHint(false);
                    }}
                    className="px-6 py-3 bg-surface-glass backdrop-blur-lg border border-surface-border hover:border-surface-border-hover text-white rounded-lg text-sm font-semibold transition-all duration-base hover:scale-105"
                  >
                    Nochmal spielen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI-Tutor Sidebar */}
      {selectedMission && (
        <AITutorSidebar
          isOpen={showAITutor}
          onClose={() => setShowAITutor(false)}
          context={{
            missionId: selectedMission.id,
            stepIndex: currentStepIndex,
            commandHistory,
            errors,
          }}
        />
      )}
    </div>
  );
}
