// Echtes Alpine-Linux im Browser (v86): xterm an serial0, versteckter Befehlskanal
// (AgentClient) an serial1. Wird per React.lazy geladen; v86, xterm und die Image-Assets
// unter /missions/linux/ holt erst der Effekt, also nur auf der Missionsroute.
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { AgentClient } from '../../lib/missions/agentClient';
import { MISSION_OSC, parseMissionRequest, replyScript } from '../../lib/missions/missionBridge';
import type { MissionCommand, MissionReply } from '../../lib/missions/missionTypes';
import { readTerminalTheme } from '../../lib/missions/terminalTheme';

const ASSET_BASE = '/missions/linux/';
const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';
const MEMORY_MB = 128;
/** Zeilenenden für die Serielle: motd hat \n, xterm braucht \r\n. */
const MOTD_SCRIPT = "sed 's/$/\\r/' /etc/motd > /dev/ttyS0";

type Phase =
  | { kind: 'laden'; percent: number | null }
  | { kind: 'start' }
  | { kind: 'bereit' }
  | { kind: 'fehler'; message: string };

interface V86TerminalProps {
  /** Versteckter Befehlskanal, sobald der Agent in der VM antwortet (für setup/verify). */
  onReady?: (client: AgentClient) => void;
  /** Beantwortet den Befehl `mission` in der VM (Missions-Engine). */
  onMissionCommand?: (command: MissionCommand) => Promise<MissionReply>;
  className?: string;
}

export default function V86Terminal({
  onReady,
  onMissionCommand,
  className = '',
}: V86TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onMissionCommandRef = useRef(onMissionCommand);
  onMissionCommandRef.current = onMissionCommand;

  const [phase, setPhase] = useState<Phase>({ kind: 'laden', percent: null });
  // Neustart = neue Generation: Effekt räumt die alte VM ab und bootet aus dem Savestate.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    setPhase({ kind: 'laden', percent: null });

    (async () => {
      const [{ V86 }, { Terminal }, { FitAddon }, { default: wasmUrl }] = await Promise.all([
        import('v86'),
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('v86/build/v86.wasm?url'),
      ]);
      if (disposed || !termRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily:
          getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() ||
          'monospace',
        fontSize: 14,
        theme: readTerminalTheme(getComputedStyle(document.documentElement)),
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(termRef.current);
      fit.fit();

      const emulator = new V86({
        wasm_path: wasmUrl,
        bios: { url: `${ASSET_BASE}seabios.bin` },
        vga_bios: { url: `${ASSET_BASE}vgabios.bin` },
        memory_size: MEMORY_MB * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        autostart: true,
        disable_keyboard: true,
        disable_mouse: true,
        disable_speaker: true,
        uart1: true,
        bzimage_initrd_from_filesystem: true,
        cmdline: CMDLINE,
        filesystem: {
          baseurl: `${ASSET_BASE}alpine-rootfs-flat/`,
          basefs: `${ASSET_BASE}alpine-fs.json`,
        },
        initial_state: { url: `${ASSET_BASE}alpine-state.bin.zst` },
      });

      emulator.add_listener('download-progress', (e) => {
        if (disposed) return;
        // Der Savestate dominiert die Ladezeit; Fortschritt über alle Dateien gemittelt.
        const fileShare = e.lengthComputable && e.total > 0 ? e.loaded / e.total : 0;
        const percent = Math.round(((e.file_index + fileShare) / Math.max(e.file_count, 1)) * 100);
        setPhase({ kind: 'laden', percent: Math.min(percent, 99) });
      });
      const encoder = new TextEncoder();
      const client = new AgentClient((line) => emulator.serial_send_bytes(1, encoder.encode(line)));
      let ready = false;

      const sendSize = () => {
        if (!ready) return;
        // Fenstergröße geht nicht über die Serielle; stty setzt sie über den versteckten Kanal.
        void client.run(`stty -F /dev/ttyS0 cols ${term.cols} rows ${term.rows}`).catch(() => {});
      };

      let started = false;
      emulator.add_listener('emulator-started', () => {
        if (disposed || started) return;
        started = true;
        setPhase((p) => (p.kind === 'bereit' ? p : { kind: 'start' }));
        // Aus dem Savestate steht die Shell schon am Prompt und gibt keinen neuen aus: auf den
        // Agenten warten, Alex' Zettel (/etc/motd) ausgeben, dann mit Enter einen frischen
        // Prompt in das leere Terminal holen. Die motd vom Login liegt vor dem Savestate.
        client
          .waitReady()
          .then(() => client.run(MOTD_SCRIPT).catch(() => {}))
          .then(() => {
            if (disposed) return;
            ready = true;
            emulator.serial_send_bytes(0, encoder.encode('\r'));
            setPhase({ kind: 'bereit' });
            sendSize();
            term.focus();
            onReadyRef.current?.(client);
          })
          .catch((e: Error) => !disposed && setPhase({ kind: 'fehler', message: e.message }));
      });

      // Ausgabe der Seriellen je Task bündeln, nicht je Byte in xterm schreiben.
      let out: number[] = [];
      emulator.add_listener('serial0-output-byte', (byte) => {
        if (out.length === 0) {
          queueMicrotask(() => {
            term.write(Uint8Array.from(out));
            out = [];
          });
        }
        out.push(byte);
      });

      let serial1 = '';
      emulator.add_listener('serial1-output-byte', (byte) => {
        if (serial1.length === 0) {
          queueMicrotask(() => {
            client.feed(serial1);
            serial1 = '';
          });
        }
        serial1 += String.fromCharCode(byte);
      });

      term.onData((data) => emulator.serial_send_bytes(0, encoder.encode(data)));
      term.onResize(sendSize);

      // `mission` in der VM meldet sich per OSC; die Sequenz erscheint nie im Terminal.
      term.parser.registerOscHandler(MISSION_OSC, (data) => {
        const request = parseMissionRequest(data);
        const handler = onMissionCommandRef.current;
        if (request && handler && ready) {
          handler(request.command)
            .catch((e: Error) => ({ exitCode: 3, text: `mission: ${e.message}` }))
            .then((reply) => client.run(replyScript(request.requestId, reply)))
            .catch(() => {});
        }
        return true;
      });

      const observer = new ResizeObserver(() => fit.fit());
      observer.observe(termRef.current);

      cleanup = () => {
        observer.disconnect();
        void emulator.destroy();
        term.dispose();
      };
      if (disposed) cleanup();
    })().catch((e: Error) => {
      if (!disposed) setPhase({ kind: 'fehler', message: e.message });
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [generation]);

  const busy = phase.kind === 'laden' || phase.kind === 'start';

  return (
    <div
      className={`flex flex-col border border-[var(--terminal-border)] bg-[var(--terminal-bg)] ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--terminal-border)] px-3 py-2 font-mono text-xs text-[var(--terminal-fg-muted)]">
        <span data-testid="v86-status" role="status" aria-live="polite">
          {phase.kind === 'laden' &&
            `Linux wird geladen${phase.percent === null ? ' …' : ` … ${phase.percent} %`}`}
          {phase.kind === 'start' && 'Linux startet …'}
          {phase.kind === 'bereit' && 'echtes Linux · Alpine · ohne Netzwerk'}
          {phase.kind === 'fehler' && `Fehler: ${phase.message}`}
        </span>
        <button
          type="button"
          onClick={() => setGeneration((g) => g + 1)}
          disabled={busy}
          className="border border-[var(--terminal-border)] px-2 py-0.5 text-[var(--terminal-fg)] hover:border-[var(--terminal-fg-muted)] disabled:opacity-50"
        >
          Neu starten
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={termRef} data-testid="v86-terminal" className="absolute inset-0 p-2" />
        {busy && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 font-mono text-sm text-[var(--terminal-fg-muted)]">
            <span>{phase.kind === 'start' ? 'Linux startet …' : 'Linux wird geladen …'}</span>
            <span className="text-xs">Auf dem Handy dauert der erste Start etwas länger.</span>
          </div>
        )}
      </div>
    </div>
  );
}
