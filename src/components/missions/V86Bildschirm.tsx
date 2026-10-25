// Bildschirm (ADR 0008): wie V86Terminal, dazu die grafische Oberfläche des Gasts (VGA-Canvas,
// PS/2-Tastatur, VMMouse) derselben VM. Nur für Episoden mit `bildschirm: true`; Index und
// Savestate kommen aus /missions/linux/bildschirm/ (scripts/mission-image-gui). Terminal und
// Bildschirm sind Reiter; ein Wechsel bootet nicht neu. V86Terminal bleibt dafür unverändert.
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { AgentClient } from '../../lib/missions/agentClient';
import { MISSION_OSC, parseMissionRequest } from '../../lib/missions/missionBridge';
import { createPromptDelivery } from '../../lib/missions/promptDelivery';
import {
  MISSION_ASSET_BASE,
  bildschirmAssetUrl,
  missionAssetUrl,
} from '../../lib/missions/missionAssets';
import type { MissionCommand, MissionReply } from '../../lib/missions/missionTypes';
import { readTerminalTheme } from '../../lib/missions/terminalTheme';
import {
  terminalBeschaeftigt,
  terminalStatusText,
  type TerminalPhase,
  type TerminalPhaseKind,
} from '../../lib/missions/terminalStatus';
import type { ShellControl } from './V86Terminal';

// Build-Versionen der Assets (je VERSION aus build.sh, im Docker-Build gesetzt); fehlt eine, ohne
// Query. BIOS-Dateien gehören zum Missions-Image, Index und Savestate zum Bildschirm-Image.
const ASSET_VERSION = import.meta.env.PUBLIC_MISSION_ASSETS_VERSION;
const BILDSCHIRM_VERSION = import.meta.env.PUBLIC_MISSION_BILDSCHIRM_VERSION;
const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';
const MEMORY_MB = 512;
const VGA_MEMORY_MB = 8;
/** Zeilenenden für die Serielle: motd hat \n, xterm braucht \r\n. */
const MOTD_SCRIPT = "sed 's/$/\\r/' /etc/motd > /dev/ttyS0";

interface V86BildschirmProps {
  /** Versteckter Befehlskanal, sobald der Agent in der VM antwortet (für setup/verify). */
  onReady?: (client: AgentClient, shell: ShellControl) => void;
  /** Beantwortet den Befehl `mission` in der VM (Missions-Engine). */
  onMissionCommand?: (command: MissionCommand) => Promise<MissionReply>;
  /** Nach jedem Befehl; `rot` = er endete mit Exit ≠ 0 (roter Prompt). */
  onPrompt?: (rot: boolean) => void;
  /** Bei jedem Wechsel der Phase (laden, start, bereit, fehler); „Neu starten“ meldet wieder `laden`. */
  onPhase?: (kind: TerminalPhaseKind) => void;
  /** Schalter „Stand prüfen“ am Bildschirm: Speichern in einem Gastprogramm erzeugt keinen Prompt. */
  onStandPruefen?: () => void;
  /** Einmal je Seite, wenn der Reiter „Bildschirm“ zum ersten Mal geöffnet wird. */
  onBildschirmErstmals?: () => void;
  className?: string;
}

export default function V86Bildschirm({
  onReady,
  onMissionCommand,
  onPrompt,
  onPhase,
  onStandPruefen,
  onBildschirmErstmals,
  className = '',
}: V86BildschirmProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const emulatorRef = useRef<{
    keyboard_set_enabled: (on: boolean) => void;
    mouse_set_enabled: (on: boolean) => void;
    keyboard_send_scancodes: (codes: number[]) => void;
  } | null>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const [reiter, setReiter] = useState<'terminal' | 'bildschirm'>('terminal');
  const [eingabe, setEingabe] = useState(false);
  const erstmalsRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onMissionCommandRef = useRef(onMissionCommand);
  onMissionCommandRef.current = onMissionCommand;
  const onPromptRef = useRef(onPrompt);
  onPromptRef.current = onPrompt;
  const onPhaseRef = useRef(onPhase);
  onPhaseRef.current = onPhase;

  const [phase, setPhase] = useState<TerminalPhase>({ kind: 'laden', percent: null });
  // Neustart = neue Generation: Effekt räumt die alte VM ab und bootet aus dem Savestate.
  const [generation, setGeneration] = useState(0);

  // Die Seite hält ihre eigenen Meldungen (Episodenzeile) im Einklang mit dem Terminal.
  useEffect(() => {
    onPhaseRef.current?.(phase.kind);
  }, [phase.kind]);

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
      if (disposed || !termRef.current || !screenRef.current) return;

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
        bios: { url: missionAssetUrl('seabios.bin', ASSET_VERSION) },
        vga_bios: { url: missionAssetUrl('vgabios.bin', ASSET_VERSION) },
        memory_size: MEMORY_MB * 1024 * 1024,
        vga_memory_size: VGA_MEMORY_MB * 1024 * 1024,
        autostart: true,
        screen_container: screenRef.current,
        disable_speaker: true,
        uart1: true,
        bzimage_initrd_from_filesystem: true,
        cmdline: CMDLINE,
        filesystem: {
          baseurl: `${MISSION_ASSET_BASE}alpine-rootfs-flat/`,
          basefs: bildschirmAssetUrl('alpine-fs.json', BILDSCHIRM_VERSION),
        },
        initial_state: { url: bildschirmAssetUrl('alpine-state.bin.zst', BILDSCHIRM_VERSION) },
      });
      // Tastatur und Maus gehen nur an den Gast, solange der Bildschirm fokussiert ist.
      emulator.keyboard_set_enabled(false);
      emulator.mouse_set_enabled(false);
      emulatorRef.current = emulator;

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

      // Fenstergröße geht nicht über die Serielle; stty setzt sie über den versteckten Kanal.
      // Gebündelt: Jeder Aufruf kostet eine Runde zur VM, Größenwechsel kommen oft in Serie (#399).
      let sizeTimer: ReturnType<typeof setTimeout> | undefined;
      let sentSize = '';
      const sendSize = () => {
        if (!ready) return;
        clearTimeout(sizeTimer);
        sizeTimer = setTimeout(() => {
          const size = `${term.cols}x${term.rows}`;
          if (size === sentSize) return;
          sentSize = size;
          void client.run(`stty -F /dev/ttyS0 cols ${term.cols} rows ${term.rows}`).catch(() => {});
        }, 300);
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
            onReadyRef.current?.(client, { resetToHome: () => delivery.resetShell() });
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

      // Rückmeldungen der stillen Prüfung kommen asynchron und werden am Prompt eingeblendet.
      const delivery = createPromptDelivery({
        write: (text) => term.write(text),
        sendKey: (key) => emulator.serial_send_bytes(0, encoder.encode(key)),
      });
      term.onData((data) => {
        delivery.input(data);
        emulator.serial_send_bytes(0, encoder.encode(data));
      });
      term.onResize(sendSize);

      // `mission` in der VM meldet sich per OSC; die Sequenz erscheint nie im Terminal.
      term.parser.registerOscHandler(MISSION_OSC, (data) => {
        const request = parseMissionRequest(data);
        const handler = onMissionCommandRef.current;
        if (request?.command === '__prompt') {
          // Der Prompt-Hook wartet auf nichts (#392); die Antwort geht direkt ins Terminal.
          // Kennung q…: In der Eingabe wartet ein vorgetippter Befehl; P/Q groß: Der Befehl davor
          // ist fehlgeschlagen (siehe .bashrc).
          delivery.prompt(/^[qQ]/.test(request.requestId));
          onPromptRef.current?.(/^[PQ]/.test(request.requestId));
          if (handler && ready) {
            const generation = delivery.generation();
            handler('__prompt')
              .then((reply) => delivery.deliver(reply.text, generation))
              .catch(() => {});
          }
        } else if (request && handler && ready) {
          handler(request.command)
            .catch((e: Error) => ({ exitCode: 3, text: `mission: ${e.message}` }))
            .then((reply) => client.reply(request.requestId, reply))
            .catch(() => {});
        }
        return true;
      });

      fitRef.current = () => fit.fit();
      const observer = new ResizeObserver(() => fit.fit());
      observer.observe(termRef.current);

      cleanup = () => {
        clearTimeout(sizeTimer);
        observer.disconnect();
        emulatorRef.current = null;
        fitRef.current = null;
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

  const busy = terminalBeschaeftigt(phase);
  const fehler = phase.kind === 'fehler';

  // Der Bildschirm skaliert im festen Seitenverhältnis 4:3; Mausposition rechnet v86 relativ.
  const flaecheRef = useRef<HTMLDivElement>(null);
  const [groesse, setGroesse] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = flaecheRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const w = Math.min(el.clientWidth, (el.clientHeight * 4) / 3);
      setGroesse({ w: Math.floor(w), h: Math.floor((w * 3) / 4) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const eingabeAn = (an: boolean) => {
    emulatorRef.current?.keyboard_set_enabled(an);
    emulatorRef.current?.mouse_set_enabled(an);
    setEingabe(an);
  };

  const zeige = (ziel: 'terminal' | 'bildschirm') => {
    setReiter(ziel);
    if (ziel === 'terminal') {
      eingabeAn(false);
      requestAnimationFrame(() => fitRef.current?.());
    } else if (!erstmalsRef.current) {
      erstmalsRef.current = true;
      onBildschirmErstmals?.();
    }
  };

  const reiterKlasse = (aktiv: boolean) =>
    `border px-2 py-0.5 ${
      aktiv
        ? 'border-[var(--terminal-fg-muted)] text-[var(--terminal-fg)]'
        : 'border-transparent text-[var(--terminal-fg-muted)] hover:text-[var(--terminal-fg)]'
    }`;

  return (
    <div
      className={`flex flex-col border border-[var(--terminal-border)] bg-[var(--terminal-bg)] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--terminal-border)] px-3 py-2 font-mono text-xs text-[var(--terminal-fg-muted)]">
        <div className="flex gap-1" role="group" aria-label="Terminal oder Bildschirm">
          <button
            type="button"
            aria-pressed={reiter === 'terminal'}
            onClick={() => zeige('terminal')}
            className={reiterKlasse(reiter === 'terminal')}
          >
            Terminal
          </button>
          <button
            type="button"
            aria-pressed={reiter === 'bildschirm'}
            onClick={() => zeige('bildschirm')}
            className={reiterKlasse(reiter === 'bildschirm')}
          >
            Bildschirm
          </button>
        </div>
        <span
          data-testid="v86-status"
          role={fehler ? 'alert' : 'status'}
          aria-live={fehler ? 'assertive' : 'polite'}
        >
          {terminalStatusText(phase)}
        </span>
        <div className="flex gap-2">
          {reiter === 'bildschirm' && (
            <button
              type="button"
              onClick={() => onStandPruefen?.()}
              disabled={phase.kind !== 'bereit'}
              className="border border-[var(--terminal-fg)] px-2 py-0.5 text-[var(--terminal-fg)] disabled:opacity-50"
            >
              Stand prüfen
            </button>
          )}
          <button
            type="button"
            onClick={() => setGeneration((g) => g + 1)}
            disabled={busy}
            className={`border px-2 py-0.5 disabled:opacity-50 ${
              fehler
                ? 'border-[var(--terminal-fg)] bg-[var(--terminal-fg)] text-[var(--terminal-bg)]'
                : 'border-[var(--terminal-border)] text-[var(--terminal-fg)] hover:border-[var(--terminal-fg-muted)]'
            }`}
          >
            Neu starten
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={termRef}
          data-testid="v86-terminal"
          className={`absolute inset-0 p-2 ${reiter === 'terminal' ? '' : 'invisible'}`}
        />
        <div
          className={`absolute inset-0 flex flex-col gap-1 p-2 ${reiter === 'bildschirm' ? '' : 'invisible'}`}
        >
          <p className="font-mono text-xs text-[var(--terminal-fg-muted)]">
            {eingabe
              ? 'Maus und Tastatur gehen an Linux. Zurück: Umschalt+Esc oder außerhalb klicken.'
              : 'Klick auf den Bildschirm: Maus und Tastatur gehen an Linux.'}
          </p>
          <div ref={flaecheRef} className="flex min-h-0 flex-1 items-start justify-center">
            <div
              ref={screenRef}
              data-testid="v86-bildschirm"
              tabIndex={0}
              role="application"
              aria-label="Bildschirm des Linux-Rechners"
              onFocus={() => eingabeAn(true)}
              onBlur={() => eingabeAn(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  // Umschalt ist im Gast schon gedrückt: loslassen, sonst bleibt sie hängen.
                  emulatorRef.current?.keyboard_send_scancodes([0xaa, 0xb6]);
                  e.currentTarget.blur();
                }
              }}
              className={`v86-bildschirm relative overflow-hidden bg-[var(--terminal-bg)] outline-none ${
                eingabe ? 'ring-2 ring-[var(--accent)]' : ''
              }`}
              style={{ width: groesse.w, height: groesse.h }}
            >
              <div className="whitespace-pre font-mono text-[14px] leading-[14px] text-[var(--terminal-fg)]" />
              <canvas className="block h-full w-full" />
            </div>
          </div>
        </div>
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
