// @vitest-environment node
// Durchlauf jeder Mission in der echten VM (v86 headless, Assets aus public/missions/linux/).
// Läuft nur mit MISSION_VM=1, auf gns3 bzw. in einer Umgebung mit gebauten Assets:
//   MISSION_VM=1 pnpm exec vitest run src/data/__tests__/v86Missions.vm.test.ts
// Je Schritt: verify scheitert vor der Lösung (Negativfall), die Lösung läuft als
// `lernende`, danach besteht verify; am Ende erzeugt das Flaggen-Skript eine gültige Flagge.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentClient } from '../../lib/missions/agentClient';
import { FLAG_PATTERN } from '../../lib/missions/missionTypes';
import { v86Missions } from '../v86Missions';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = join(root, 'public/missions/linux');
const enabled = process.env.MISSION_VM === '1';

const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';

// Lösung als Datei übergeben (kein Quoting) und als `lernende` ausführen. Konvention: Jede
// `solution` ist für sich aus /home/lernende lauffähig (z. B. `cd ~/projekt && git add …`).
const asUser = (script: string) =>
  [
    `printf %s '${Buffer.from(script).toString('base64')}' | base64 -d > /tmp/loesung.sh`,
    'chmod 644 /tmp/loesung.sh',
    "su lernende -s /bin/bash -c 'cd /home/lernende && bash /tmp/loesung.sh'",
  ].join(' && ');

describe.skipIf(!enabled)('Missionen in der echten VM', () => {
  let emulator: {
    destroy(): Promise<void> | void;
    serial_send_bytes(n: number, d: Uint8Array): void;
  };
  let client: AgentClient;

  const run = async (script: string) => client.run(`cd /home/lernende\n${script}`, 60_000);

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
  }, 600_000);

  afterAll(async () => {
    await emulator?.destroy();
  });

  for (const mission of v86Missions) {
    it(`${mission.id}: durchspielbar, Negativfälle scheitern, Flagge gültig`, async () => {
      const setup = await run(`set -e\n${mission.setup}`);
      expect(setup.exitCode, `setup: ${setup.output}`).toBe(0);

      for (const [i, step] of mission.steps.entries()) {
        const before = await run(step.verify);
        expect(before.exitCode, `${step.id} schon vor der Lösung erfüllt`).not.toBe(0);

        const solved = await run(asUser(step.solution));
        expect(solved.exitCode, `${step.id} Lösung: ${solved.output}`).toBe(0);

        const after = await run(step.verify);
        expect(after.exitCode, `${step.id} nach der Lösung nicht erfüllt: ${after.output}`).toBe(0);

        // Kein späterer Schritt darf durch diesen Zustand schon erfüllt sein.
        const next = mission.steps[i + 1];
        if (next) {
          const early = await run(next.verify);
          expect(early.exitCode, `${next.id} schon nach ${step.id} erfüllt`).not.toBe(0);
        }
      }

      const flag = await run(mission.flag);
      expect(flag.output.trim()).toMatch(FLAG_PATTERN);
      const again = await run(mission.flag);
      expect(again.output.trim(), 'Flagge nicht deterministisch').toBe(flag.output.trim());
    }, 300_000);
  }
});
