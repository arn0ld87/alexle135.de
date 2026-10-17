import React, { useEffect, useRef, useState } from 'react';
import { WebContainer, type WebContainerProcess } from '@webcontainer/api';
import { Terminal, type IDisposable } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { MockLinuxSystem } from './MockLinuxSystem';
import { MISSION_FILES, SHELL_PATH, createCommandTracker } from './missionShell';

interface WebContainerTerminalProps {
  onInstanceReady?: (instance: WebContainer) => void;
  onCommand?: (command: string) => void;
  className?: string;
}

let sharedWebContainerInstance: WebContainer | null = null;

/**
 * Check if WebContainer can run in this browser environment
 * Requires: SharedArrayBuffer (needs COOP/COEP headers)
 */
function canUseWebContainer(): boolean {
  if (typeof SharedArrayBuffer === 'undefined') {
    console.log(
      '[WebContainer] SharedArrayBuffer not available - COOP/COEP headers missing or unsupported browser'
    );
    return false;
  }

  if (!crossOriginIsolated) {
    console.log('[WebContainer] Not cross-origin isolated - COOP/COEP headers not set');
    return false;
  }

  return true;
}

/**
 * Initialize mock mode when WebContainer is not available
 */
function initMockMode(terminal: Terminal, onLine: (command: string) => void) {
  const mockSystem = new MockLinuxSystem();
  terminal.writeln('\x1b[33m⚠ Running in Mock Mode (WebContainer not available)\x1b[0m');
  terminal.writeln('Basic Linux commands simulated in browser.\n');

  let inputBuffer = '';

  terminal.write(mockSystem.getPrompt());

  terminal.onData((data) => {
    for (let i = 0; i < data.length; i++) {
      const char = data[i];

      if (char === '\r') {
        // Enter
        terminal.write('\r\n');
        const result = mockSystem.processCommand(inputBuffer);
        if (inputBuffer.trim()) onLine(inputBuffer.trim());
        if (result.clear) terminal.clear();
        terminal.writeln(result.output);
        terminal.write(mockSystem.getPrompt());
        inputBuffer = '';
      } else if (char === '\u007F' || char === '\b') {
        // Backspace
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (char >= ' ') {
        // Printable
        inputBuffer += char;
        terminal.write(char);
      }
    }
  });
}

/**
 * WebContainer Terminal Component
 * Provides an interactive Linux terminal using WebContainer API
 */
export default function WebContainerTerminal({
  onInstanceReady,
  onCommand,
  className,
}: WebContainerTerminalProps) {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalRefInstance = useRef<Terminal | null>(null);
  const webContainerRef = useRef<WebContainer | null>(null);
  const processRef = useRef<WebContainerProcess | null>(null);
  const inputWriterRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const onDataDisposableRef = useRef<IDisposable | null>(null);
  const handleResizeRef = useRef<(() => void) | null>(null);
  // Der Effekt läuft nur einmal; die Callbacks ändern sich pro Render (Missionsschritt).
  const onCommandRef = useRef(onCommand);
  const onInstanceReadyRef = useRef(onInstanceReady);
  onCommandRef.current = onCommand;
  onInstanceReadyRef.current = onInstanceReady;

  useEffect(() => {
    const initTerminal = async () => {
      const terminal = new Terminal({
        fontFamily: 'monospace',
        fontSize: 14,
        theme: {
          background: '#1e1e1e',
          foreground: '#f0f0f0',
          cursor: '#00ff00',
        },
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(terminalRef.current!);
      fitAddon.fit();

      terminalRefInstance.current = terminal;

      const reportCommand = (command: string) => onCommandRef.current?.(command);

      // Check if WebContainer can be used
      if (!canUseWebContainer()) {
        console.log('[WebContainer] Falling back to Mock Mode');
        initMockMode(terminal, reportCommand);
        setIsBooting(false);
        return;
      }

      try {
        // Use shared instance if available
        if (!sharedWebContainerInstance) {
          terminal.writeln('\x1b[32mStarting WebContainer...\x1b[0m');
          sharedWebContainerInstance = await WebContainer.boot();
          terminal.writeln('\x1b[32m✓ WebContainer started\x1b[0m\r\n');
        } else {
          terminal.writeln('\x1b[32m✓ Using existing WebContainer instance\x1b[0m\r\n');
        }

        webContainerRef.current = sharedWebContainerInstance;
        onInstanceReadyRef.current?.(sharedWebContainerInstance);

        // Missionsdateien und Shell mounten (relativ zum Arbeitsverzeichnis)
        await sharedWebContainerInstance.mount(MISSION_FILES);

        terminal.writeln('\x1b[32m✓ Linux environment ready\x1b[0m\r\n');

        // Eigene Node-Shell statt jsh: jsh findet die Befehle der Missionen nicht
        const process = await sharedWebContainerInstance.spawn('node', [SHELL_PATH], {
          terminal: { cols: terminal.cols, rows: terminal.rows },
          env: {
            USER: 'visitor',
            SHELL: '/bin/bash',
          },
        });
        processRef.current = process;

        process.output.pipeTo(
          new WritableStream({
            write(chunk) {
              terminal.write(chunk);
            },
          })
        );

        const input = process.input.getWriter();
        inputWriterRef.current = input;
        const tracker = createCommandTracker(reportCommand);
        onDataDisposableRef.current = terminal.onData((data) => {
          input.write(data);
          tracker.feed(data);
        });

        // Handle window resize
        const handleResize = () => {
          fitAddon.fit();
          process.resize({ cols: terminal.cols, rows: terminal.rows });
        };

        handleResizeRef.current = handleResize;
        window.addEventListener('resize', handleResize);
        handleResize();

        setIsBooting(false);
        console.log('[WebContainer] Initialization complete.');
      } catch (err) {
        console.error('[WebContainer] Failed to boot:', err);
        console.log('[WebContainer] Falling back to Mock Mode');
        setError('WebContainer nicht verfügbar – Mock-Modus aktiv.');
        initMockMode(terminal, reportCommand);
        setIsBooting(false);
      }
    };

    initTerminal();

    return () => {
      if (handleResizeRef.current) {
        window.removeEventListener('resize', handleResizeRef.current);
      }
      onDataDisposableRef.current?.dispose();
      try {
        inputWriterRef.current?.releaseLock();
      } catch {
        // Writer war bereits freigegeben (Stream geschlossen) — ignorieren.
      }
      void processRef.current?.kill();
      terminalRefInstance.current?.dispose();
    };
  }, []);

  return (
    <div
      className={`relative w-full h-full min-h-[400px] bg-[var(--terminal-bg)] overflow-hidden ${className}`}
    >
      {isBooting && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--terminal-bg)] z-10 text-[var(--terminal-accent)] font-mono">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-[var(--terminal-accent)] border-t-transparent animate-spin"></div>
            <div>Initializing Linux Environment...</div>
            <div className="text-xs text-[var(--terminal-fg-muted)]">
              Dies kann einen Moment dauern...
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-900/80 text-[var(--terminal-fg)] text-xs p-2 z-20">
          {error}
        </div>
      )}
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
