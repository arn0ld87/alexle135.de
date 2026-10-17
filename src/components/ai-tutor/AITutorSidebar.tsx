import React, { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AITutorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    missionId: string;
    stepIndex: number;
    commandHistory: string[];
    errors: string[];
  };
}

export default function AITutorSidebar({ isOpen, onClose, context }: AITutorSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const generateSmartHint = (question: string): string => {
    const lastError = context.errors[context.errors.length - 1];
    const lastCommand = context.commandHistory[context.commandHistory.length - 1];
    const q = question.toLowerCase();

    // Mission-specific hints based on missionId
    const missionHints: Record<string, string> = {
      'linux-basics-1':
        '📚 Linux Basics Tipps:\n• whoami - zeigt deinen Benutzernamen\n• pwd - zeigt aktuelles Verzeichnis\n• ls - listet Dateien auf\n• cd - wechselt Verzeichnis',
      'linux-files-1':
        '📁 Datei-Operationen:\n• touch datei.txt - erstellt Datei\n• cat datei.txt - zeigt Inhalt\n• mkdir ordner - erstellt Ordner',
      'linux-ctf-hidden-treasure':
        '🔍 CTF Tipp: Versteckte Dateien beginnen mit einem Punkt (.) - nutze "ls -a" um sie zu sehen!',
      'linux-ctf-log-detective':
        '🔎 Log-Analyse: Nutze grep um nach bestimmten Wörtern zu suchen. Beispiel: grep "Failed" logfile',
      'docker-basics-1':
        '🐋 Docker Basics:\n• docker ps - zeigt laufende Container\n• docker images - zeigt verfügbare Images',
      'git-basics-1':
        '📝 Git Basics:\n• git status - zeigt Status\n• git log - zeigt History\n• git init - initialisiert Repo',
    };

    // Check if we have mission-specific hint
    if (
      q.includes('mission') ||
      q.includes('aufgabe') ||
      q.includes('was soll ich') ||
      q.includes('tipp') ||
      q.includes('weiter') ||
      q.includes('feststecken')
    ) {
      if (missionHints[context.missionId]) {
        return missionHints[context.missionId];
      }
    }

    // Error-based hints
    if (lastError && lastError.includes('not found')) {
      return `⚠️ Befehl nicht gefunden!\n\nDein letzter Versuch: "${lastCommand}"\n\n💡 Tipps:\n• Überprüfe die Schreibweise (Linux ist case-sensitive!)\n• Nutze den Hinweis-Button für den richtigen Befehl\n• Probiere "help" für eine Übersicht`;
    }

    if (context.errors.length > 3) {
      return `🤔 Du hast ${context.errors.length} Fehler gemacht.\n\n💡 Lass uns das zusammen lösen:\n\n1️⃣ Lies die Aufgabenbeschreibung nochmal genau\n2️⃣ Nutze den Hinweis-Button für einen Tipp\n3️⃣ Achte auf Groß-/Kleinschreibung\n\nDu schaffst das! 💪`;
    }

    // Command-specific hints
    if (q.includes('hilfe') || q.includes('help')) {
      return '💡 So kommst du weiter:\n\n1️⃣ Hinweis-Button klicken für aktuellen Schritt\n2️⃣ Aufgabenbeschreibung genau lesen\n3️⃣ Befehle exakt wie angegeben eingeben\n\nFrage mich konkret wenn du nicht weiterkommst!';
    }

    if (q.includes('befehl') || q.includes('command') || q.includes('wie')) {
      const cmdTips = [];
      if (context.missionId.includes('linux')) {
        cmdTips.push('📚 Linux: whoami, pwd, ls, cd, cat, touch, mkdir');
      }
      if (context.missionId.includes('docker')) {
        cmdTips.push('🐋 Docker: docker ps, docker images, docker run');
      }
      if (context.missionId.includes('git')) {
        cmdTips.push('📝 Git: git status, git log, git add, git commit');
      }

      if (lastCommand) {
        return `🔍 Letzter Befehl: "${lastCommand}"\n\n${cmdTips.join('\n')}\n\n💡 Der Hinweis-Button zeigt dir den richtigen Befehl!`;
      }
      return `📖 Verfügbare Befehle:\n\n${cmdTips.join('\n')}\n\n💡 Schau dir die Aufgabenbeschreibung an!`;
    }

    // Specific command help
    if (q.includes('ls') || q.includes('dateien') || q.includes('files')) {
      return '📁 Mit `ls` listest du Dateien auf!\n\n🔹 ls - zeigt sichtbare Dateien\n🔹 ls -a - zeigt ALLE Dateien (auch versteckte mit .)\n🔹 ls -la - zeigt alle Details\n\nVersteckte Dateien beginnen mit einem Punkt!';
    }

    if (q.includes('cat') || q.includes('lesen') || q.includes('inhalt')) {
      return '📄 Mit `cat` liest du Dateiinhalte!\n\n🔹 cat dateiname - zeigt Inhalt\n🔹 cat .secret - liest versteckte Datei\n\nNutze "ls" oder "ls -a" um Dateinamen zu sehen!';
    }

    if (q.includes('base64') || q.includes('decode') || q.includes('enkod')) {
      return '🔐 Base64 En-/Dekodierung:\n\n🔹 echo "Text" | base64 - enkodiert zu Base64\n🔹 echo "QmFzZTY0" | base64 -d - dekodiert\n\nBase64 ist ein Encoding-Format, keine Verschlüsselung!';
    }

    if (q.includes('grep') || q.includes('suchen') || q.includes('search')) {
      return '🔍 Mit `grep` suchst du in Dateien!\n\n🔹 grep "wort" datei - sucht "wort" in datei\n🔹 grep "Failed" log.txt - findet Fehler\n🔹 grep -i "text" - Groß-/Kleinschreibung egal\n\nSuper nützlich für Log-Analyse!';
    }

    if (q.includes('pwd') || q.includes('wo bin ich') || q.includes('verzeichnis')) {
      return '📍 Mit `pwd` siehst du wo du bist!\n\npwd = Print Working Directory\nZeigt den kompletten Pfad deines aktuellen Ordners.\n\nBeispiel: /home/visitor';
    }

    if (q.includes('whoami') || q.includes('wer bin ich') || q.includes('user')) {
      return '👤 Mit `whoami` siehst du deinen Benutzernamen!\n\nDer Befehl zeigt einfach an, als welcher User du eingeloggt bist.\n\nTippe genau: whoami (alles klein!)';
    }

    // Fallback: If we are in a mission step, try to give a hint about the current step
    // Note: We don't have direct access to the current step object here, only index.
    // But we can give a generic advice.
    return `👋 Ich bin dein AI-Tutor.\n\nDu bist gerade bei Schritt ${context.stepIndex + 1}.\n\n💡 Tipp: Klicke auf "Brauchst du einen Hinweis?" im linken Menü, um Hilfe zur aktuellen Aufgabe zu bekommen.\n\nOder frag mich konkret nach einem Befehl!`;
  };

  const askTutor = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    let hint: string;

    // Try real API first (if available)
    try {
      const response = await fetch('/api/ai-tutor.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuestion: question,
          context,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        hint = data.hint || generateSmartHint(question);
      } else {
        // API not available, use smart hints
        hint = generateSmartHint(question);
      }
    } catch {
      // Fallback to smart hints if API fails
      await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate thinking
      hint = generateSmartHint(question);
    }

    const assistantMsg: Message = {
      role: 'assistant',
      content: hint,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-[var(--paper)] border-l border-[color:var(--ink)] z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[color:var(--ink)]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            AI-Tutor
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-[color:var(--muted)] hover:text-[color:var(--ink)] transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-[color:var(--muted)] mt-8">
            <p className="mb-2">👋 Hallo!</p>
            <p className="text-sm">Ich bin dein AI-Tutor. Frag mich wenn du nicht weiterkommst!</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-[color:color-mix(in_srgb,var(--ink)_4%,var(--paper))] text-[color:var(--ink)]'
                  : 'text-[color:var(--ink)]'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <span className="text-xs opacity-60 mt-1 block">
                {msg.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[color:color-mix(in_srgb,var(--ink)_4%,var(--paper))] px-4 py-2">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-[color:var(--muted)] rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-[color:var(--muted)] rounded-full animate-pulse delay-100"></div>
                <div className="w-2 h-2 bg-[color:var(--muted)] rounded-full animate-pulse delay-200"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[color:var(--ink)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askTutor(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frag den AI-Tutor..."
            className="flex-1 px-3 py-2 border border-[color:var(--muted)] bg-[color:var(--paper)] text-sm text-[color:var(--ink)] placeholder-[color:var(--muted)] focus:outline-none focus-visible:border-[color:var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-[var(--ink)] text-[color:var(--paper)] hover:bg-[var(--accent-strong)] active:bg-[var(--accent-press)] disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:cursor-not-allowed text-sm font-medium transition"
          >
            Senden
          </button>
        </form>
      </div>
    </div>
  );
}
