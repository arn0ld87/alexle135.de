// @vitest-environment node
// antwortSkript gegen die echte VM (v86 headless, Assets aus public/missions/linux/).
// Läuft nur mit MISSION_VM=1, auf gns3 bzw. in einer Umgebung mit gebauten Assets:
//   MISSION_VM=1 pnpm exec vitest run src/lib/missions/__tests__/antwortSkript.vm.test.ts
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentClient } from '../agentClient';
import { antwortSkript } from '../ermittlung';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const assets = join(root, 'public/missions/linux');
const enabled = process.env.MISSION_VM === '1';

const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';
const PRUEFUNG = '[ "$ANTWORT" = "02:30" ]';

describe.skipIf(!enabled)('antwortSkript in der echten VM', () => {
  let emulator: {
    destroy(): Promise<void> | void;
    serial_send_bytes(n: number, d: Uint8Array): void;
  };
  let client: AgentClient;

  // Der Exit-Code des Skripts steht als letzte Zeile in der Ausgabe.
  const exitVon = async (pruefung: string, antwort: string) => {
    const ergebnis = await client.run(`${antwortSkript(pruefung, antwort)}echo "exit=$?"`, 20_000);
    return ergebnis.output.trim().split('\n').pop();
  };

  beforeAll(async () => {
    if (!existsSync(join(assets, 'alpine-state.bin.zst'))) {
      throw new Error(`Assets fehlen unter ${assets} (scripts/mission-image/build.sh)`);
    }
    const { V86 } = await import('v86');
    const encoder = new TextEncoder();
    emulator = new V86({
      wasm_path: fileURLToPath(import.meta.resolve('v86/build/v86.wasm')),
      bios: { url: join(assets, 'seabios.bin') },
      vga_bios: { url: join(assets, 'vgabios.bin') },
      memory_size: 128 * 1024 * 1024,
      vga_memory_size: 2 * 1024 * 1024,
      autostart: true,
      uart1: true,
      bzimage_initrd_from_filesystem: true,
      cmdline: CMDLINE,
      filesystem: {
        baseurl: join(assets, 'alpine-rootfs-flat'),
        basefs: join(assets, 'alpine-fs.json'),
      },
      initial_state: { url: join(assets, 'alpine-state.bin.zst') },
    });
    client = new AgentClient((line) => emulator.serial_send_bytes(1, encoder.encode(line)));
    let buffer = '';
    (emulator as unknown as { add_listener(e: string, f: (b: number) => void): void }).add_listener(
      'serial1-output-byte',
      (byte) => {
        if (buffer.length === 0) {
          queueMicrotask(() => {
            client.feed(buffer);
            buffer = '';
          });
        }
        buffer += String.fromCharCode(byte);
      }
    );
    await client.waitReady({ intervalMs: 1_000, attempts: 300 });
  }, 900_000);

  afterAll(async () => {
    await emulator?.destroy();
  });

  it('richtige Antwort ergibt Exit 0, falsche Exit 1', async () => {
    expect(await exitVon(PRUEFUNG, '02:30')).toBe('exit=0');
    expect(await exitVon(PRUEFUNG, '02:31')).toBe('exit=1');
  });

  it('bösartige Antworten werden nie als Shell ausgeführt', async () => {
    const boese = [
      "'; touch /tmp/pwned #",
      '$(touch /tmp/pwned)',
      '`touch /tmp/pwned`',
      '" ; touch /tmp/pwned ; "',
    ];
    for (const antwort of boese) expect(await exitVon(PRUEFUNG, antwort)).toBe('exit=1');
    const spur = await client.run('test -e /tmp/pwned; echo "da=$?"', 20_000);
    expect(spur.output.trim().split('\n').pop()).toBe('da=1');
  });

  it('reicht den Exit-Code einer Prüfung durch und schweigt', async () => {
    const ergebnis = await client.run(
      `${antwortSkript('echo laut; exit 7', 'x')}echo "exit=$?"`,
      20_000
    );
    expect(ergebnis.output.trim()).toBe('exit=7');
  });
});
