import React, { useEffect, useRef, useState } from 'react';
import { WebContainer, type WebContainerProcess } from '@webcontainer/api';
import { Terminal, type IDisposable } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { MockLinuxSystem } from './MockLinuxSystem';
import { SHIM_COMMANDS } from './shimCommands';

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

// Files needed for missions (CTF, etc)
// Build a custom shell script that interprets commands
// This is necessary because jsh doesn't find scripts in PATH like bash does
const buildCustomShell = () => {
  return `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Current working directory
let cwd = process.cwd();

// Prompt
const getPrompt = () => '\\x1b[32mvisitor@linux\\x1b[0m:\\x1b[34m' + (cwd === '/' ? '~' : path.basename(cwd) || '~') + '\\x1b[0m$ ';

// Command implementations
const commands = {
    whoami: () => console.log('visitor'),
    pwd: () => console.log(cwd),
    ls: (args) => {
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const target = args.find(a => !a.startsWith('-')) || '.';
        const targetPath = path.resolve(cwd, target);
        
        try {
            let entries = fs.readdirSync(targetPath);
            if (!showAll) entries = entries.filter(e => !e.startsWith('.'));
            
            if (showLong) {
                entries.forEach(entry => {
                    const fullPath = path.join(targetPath, entry);
                    try {
                        const stat = fs.statSync(fullPath);
                        const isDir = stat.isDirectory();
                        const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
                        const size = stat.size.toString().padStart(8);
                        const date = 'Jan  1 00:00';
                        const name = isDir ? '\\x1b[34m' + entry + '\\x1b[0m' : entry;
                        console.log(perms + ' 1 visitor visitor ' + size + ' ' + date + ' ' + name);
                    } catch {
                        console.log('-rw-r--r-- 1 visitor visitor        0 Jan  1 00:00 ' + entry);
                    }
                });
            } else {
                const formatted = entries.map(e => {
                    try {
                        const stat = fs.statSync(path.join(targetPath, e));
                        return stat.isDirectory() ? '\\x1b[34m' + e + '\\x1b[0m/' : e;
                    } catch { return e; }
                });
                console.log('  '.join(formatted));
            }
        } catch (e) {
            console.log('ls: cannot access \'' + target + '\': No such file or directory');
        }
    },
    cd: (args) => {
        const target = args[0] || '/home/visitor';
        let newPath;
        
        if (target === '~' || target === '') {
            newPath = '/home/visitor';
        } else if (target === '-') {
            newPath = process.env.OLDPWD || cwd;
        } else if (target.startsWith('/')) {
            newPath = target;
        } else {
            newPath = path.resolve(cwd, target);
        }
        
        try {
            const stat = fs.statSync(newPath);
            if (!stat.isDirectory()) {
                console.log('cd: not a directory: ' + newPath);
                return;
            }
            process.env.OLDPWD = cwd;
            cwd = newPath;
        } catch (e) {
            console.log('cd: no such file or directory: ' + target);
        }
    },
    exit: () => {
        console.log('exit');
        process.exit(0);
    }
};

// Interactive shell
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

console.log('\\x1b[32mWelcome to Custom Shell!\\x1b[0m');
console.log('Type \\x1b[33mhelp\\x1b[0m for available commands.\\n');

const readline_loop = () => {
    rl.question(getPrompt(), (input) => {
        const parts = input.trim().split(/\\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);
        
        if (cmd === 'help') {
            console.log('Available commands: whoami, pwd, ls, cd, exit');
        } else if (commands[cmd]) {
            commands[cmd](args);
        } else if (cmd) {
            console.log(cmd + ': command not found');
        }
        
        readline_loop();
    });
};

readline_loop();`;
};

/**
 * Initialize mock mode when WebContainer is not available
 */
function initMockMode(terminal: Terminal) {
  const mockSystem = new MockLinuxSystem();
  terminal.writeln('\\x1b[33m⚠ Running in Mock Mode (WebContainer not available)\\x1b[0m');
  terminal.writeln('Basic Linux commands simulated in browser.\\n');

  let inputBuffer = '';

  terminal.write(mockSystem.getPrompt());

  terminal.onData((data) => {
    for (let i = 0; i < data.length; i++) {
      const char = data[i];

      if (char === '\\r') {
        // Enter
        terminal.write('\\r\\n');
        const result = mockSystem.processCommand(inputBuffer);
        if (result.clear) terminal.clear();
        terminal.writeln(result.output);
        terminal.write(mockSystem.getPrompt());
        inputBuffer = '';
      } else if (char === '\\u007F' || char === '\\b') {
        // Backspace
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          terminal.write('\\b \\b');
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

      // Check if WebContainer can be used
      if (!canUseWebContainer()) {
        console.log('[WebContainer] Falling back to Mock Mode');
        initMockMode(terminal);
        setIsBooting(false);
        return;
      }

      try {
        // Use shared instance if available
        if (!sharedWebContainerInstance) {
          terminal.writeln('\\x1b[32mStarting WebContainer...\\x1b[0m');
          sharedWebContainerInstance = await WebContainer.boot();
          terminal.writeln('\\x1b[32m✓ WebContainer started\\x1b[0m\\r\\n');
        } else {
          terminal.writeln('\\x1b[32m✓ Using existing WebContainer instance\\x1b[0m\\r\\n');
        }

        webContainerRef.current = sharedWebContainerInstance;
        onInstanceReady?.(sharedWebContainerInstance);

        // Mount shim commands
        await sharedWebContainerInstance.mount({
          bin: {
            directory: {
              ...SHIM_COMMANDS,
            },
          },
          home: {
            directory: {
              visitor: {
                directory: {
                  'welcome.txt': {
                    file: {
                      contents: 'Welcome to WebContainer Terminal!\\nType commands to interact.\\n',
                    },
                  },
                },
              },
            },
          },
        });

        terminal.writeln('\\x1b[32m✓ Linux environment ready\\x1b[0m\\r\\n');

        // Start jsh
        const process = await sharedWebContainerInstance.spawn('jsh', {
          env: {
            HOME: '/home/visitor',
            USER: 'visitor',
            PATH: '/bin:/usr/bin:/usr/local/bin',
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
        onDataDisposableRef.current = terminal.onData((data) => {
          input.write(data);
          onCommand?.(data);
        });

        // Handle window resize
        const handleResize = () => {
          fitAddon.fit();
          const dims = terminal.rows + 'x' + terminal.cols;
          input.write('\\x1b]0;' + dims + '\\x07');
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
        initMockMode(terminal);
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
      className={`relative w-full h-full min-h-[400px] bg-[#1e1e1e] rounded-lg overflow-hidden ${className}`}
    >
      {isBooting && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] z-10 text-blue-400 font-mono">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <div>Initializing Linux Environment...</div>
            <div className="text-xs text-gray-500">Dies kann einen Moment dauern...</div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-900/80 text-white text-xs p-2 z-20">
          {error}
        </div>
      )}
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
