import React, { useState, useEffect, useRef } from 'react';
import { MockWindowsSystem } from './MockWindowsSystem';

interface TerminalProps {
  initialPath?: string; // Kept for compatibility, but MockWindowsSystem handles its own path
  welcomeMessage?: string;
  onCommand?: (command: string) => void;
}

interface HistoryItem {
  type: 'input' | 'output' | 'error';
  content: string;
  path?: string;
}

export default function Terminal({
  welcomeMessage = 'Microsoft Windows [Version 10.0.19045.3693]\n(c) Microsoft Corporation. Alle Rechte vorbehalten.',
  onCommand,
}: TerminalProps) {
  // --- State ---
  const [history, setHistory] = useState<HistoryItem[]>([
    { type: 'output', content: welcomeMessage },
  ]);
  const [currentInput, setCurrentInput] = useState('');

  // Command History for Arrow Keys
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // We use a ref for the system so it persists across renders without triggering re-renders itself
  const systemRef = useRef<MockWindowsSystem | null>(null);
  const [prompt, setPrompt] = useState('C:\\Users\\visitor>');
  const [mode, setMode] = useState<'cmd' | 'powershell' | 'diskpart'>('cmd');

  // UI Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize System
  useEffect(() => {
    if (!systemRef.current) {
      systemRef.current = new MockWindowsSystem();
      setPrompt(systemRef.current.getPrompt());
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    const terminalBody = bottomRef.current?.parentElement;
    if (bottomRef.current && terminalBody) {
      const isNearBottom =
        terminalBody.scrollHeight - terminalBody.scrollTop - terminalBody.clientHeight < 100;
      if (isNearBottom) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [history]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        let newIndex = historyIndex;
        if (newIndex === -1) {
          newIndex = commandHistory.length - 1;
        } else if (newIndex > 0) {
          newIndex--;
        }
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex !== -1) {
        let newIndex = historyIndex;
        if (newIndex < commandHistory.length - 1) {
          newIndex++;
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        } else {
          setHistoryIndex(-1);
          setCurrentInput('');
        }
      }
    } else if (e.key === 'Enter') {
      if (!systemRef.current) return;

      const cmd = currentInput; // Don't trim here, let system handle it

      // Add Input to History (Display)
      setHistory((prev) => [
        ...prev,
        {
          type: 'input',
          content: cmd,
          path: prompt,
        },
      ]);

      // Add to Command History (Navigation)
      if (cmd.trim()) {
        setCommandHistory((prev) => [...prev, cmd]);
      }
      setHistoryIndex(-1);

      // Clear Input
      setCurrentInput('');

      // Process Command
      const result = systemRef.current.processCommand(cmd);

      // Update UI State from System
      setPrompt(systemRef.current.getPrompt());
      setMode(systemRef.current.getMode());

      // Handle Result
      if (result.clear) {
        setHistory([]);
      } else if (result.output) {
        setHistory((prev) => [...prev, { type: 'output', content: result.output }]);
      }

      // Notify Parent
      if (onCommand && cmd.trim()) {
        onCommand(cmd.trim());
      }
    }
  };

  // Styles based on mode
  const getTerminalStyles = () => {
    if (mode === 'powershell') {
      return {
        bg: '#012456', // PowerShell Blue
        text: '#FFFFFF',
        promptColor: '#FFFF00', // Yellow Prompt
        titleBg: '#012456',
        title: 'Windows PowerShell',
      };
    } else if (mode === 'diskpart') {
      return {
        bg: '#000000',
        text: '#C0C0C0',
        promptColor: '#FFFFFF',
        titleBg: '#0078D4',
        title: 'DiskPart',
      };
    } else {
      // CMD - Windows Command Prompt
      return {
        bg: '#000000', // Black
        text: '#C0C0C0', // Light Gray (Windows CMD default)
        promptColor: '#C0C0C0', // Same gray as text
        titleBg: '#0078D4', // Windows blue title bar
        title: 'Eingabeaufforderung',
      };
    }
  };

  const terminalStyle = getTerminalStyles();

  return (
    <div
      className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border transition-all duration-300 flex flex-col"
      onClick={focusInput}
      style={{
        fontFamily: 'Consolas, "Courier New", monospace',
        backgroundColor: terminalStyle.bg,
        borderColor: '#404040',
      }}
    >
      {/* Windows Terminal Header */}
      <div
        className="px-2 py-1 flex items-center justify-between border-b shrink-0"
        style={{
          backgroundColor: terminalStyle.titleBg,
          borderColor: '#404040',
          minHeight: '32px',
        }}
      >
        {/* Left: Icon and Title */}
        <div className="flex items-center gap-2">
          {/* Windows Terminal Icon */}
          <div className="w-4 h-4 flex items-center justify-center">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-white">
              <path d="M2 3.5L8 2v12l-6-1.5V3.5zm7 8.5V2l5 1.25v9.5L9 12z" />
            </svg>
          </div>
          <div className="text-xs font-normal" style={{ color: '#FFFFFF' }}>
            {terminalStyle.title}
          </div>
        </div>

        {/* Right: Windows Control Buttons */}
        <div className="flex items-center">
          {/* Minimize */}
          <button
            className="w-11 h-7 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Minimieren"
          >
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 text-white">
              <rect x="1" y="5.5" width="10" height="1" />
            </svg>
          </button>
          {/* Maximize */}
          <button
            className="w-11 h-7 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Maximieren"
          >
            <svg
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="w-3 h-3 text-white"
            >
              <rect x="1.5" y="1.5" width="9" height="9" />
            </svg>
          </button>
          {/* Close */}
          <button
            className="w-11 h-7 flex items-center justify-center hover:bg-red-600 transition-colors"
            title="Schließen"
          >
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 text-white">
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        className="p-4 flex-1 overflow-y-auto cursor-text"
        style={{
          fontSize: '14px',
          backgroundColor: terminalStyle.bg,
          color: terminalStyle.text,
          lineHeight: '1.4',
        }}
      >
        {history.map((item, index) => (
          <div key={index} style={{ marginBottom: '4px' }}>
            {item.type === 'input' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  className="select-none whitespace-nowrap"
                  style={{ color: terminalStyle.promptColor }}
                >
                  {item.path}
                </span>
                <span style={{ color: terminalStyle.text, wordBreak: 'break-all' }}>
                  {item.content}
                </span>
              </div>
            )}
            {item.type === 'output' && (
              <div
                className="whitespace-pre-wrap"
                style={{ color: terminalStyle.text, lineHeight: '1.4' }}
              >
                {item.content}
              </div>
            )}
            {item.type === 'error' && <div style={{ color: '#FF6B6B' }}>{item.content}</div>}
          </div>
        ))}

        {/* Input Line */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <span
            className="select-none whitespace-nowrap"
            style={{ color: terminalStyle.promptColor, fontWeight: 'bold' }}
          >
            {prompt}
          </span>
          <div style={{ flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                background: 'transparent',
                outline: 'none',
                border: 'none',
                color: terminalStyle.text,
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>
        <div ref={bottomRef}></div>
      </div>
    </div>
  );
}
