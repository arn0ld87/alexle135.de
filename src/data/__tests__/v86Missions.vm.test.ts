// @vitest-environment node
// Durchlauf jeder Mission in der echten VM (v86 headless, Assets aus public/missions/linux/).
// Läuft nur mit MISSION_VM=1, auf gns3 bzw. in einer Umgebung mit gebauten Assets:
//   MISSION_VM=1 pnpm exec vitest run src/data/__tests__/v86Missions.vm.test.ts
// Je Schritt: verify scheitert vor der Lösung (Negativfall), die Lösung läuft als
// `azubi`, danach besteht verify; am Ende erzeugt das Flaggen-Skript eine gültige Flagge.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentClient } from '../../lib/missions/agentClient';
import { FLAG_PATTERN } from '../../lib/missions/missionTypes';
import { v86Missions } from '../missions';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = join(root, 'public/missions/linux');
const enabled = process.env.MISSION_VM === '1';

const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';

// Lösung als Datei übergeben (kein Quoting) und als `azubi` ausführen. Konvention: Jede
// `solution` ist für sich aus /home/azubi lauffähig (z. B. `cd ~/projekt && git add …`).
const asUser = (script: string) =>
  [
    `printf %s '${Buffer.from(script).toString('base64')}' | base64 -d > /tmp/loesung.sh`,
    'chmod 644 /tmp/loesung.sh',
    "su azubi -s /bin/bash -c 'cd /home/azubi && bash /tmp/loesung.sh'",
  ].join(' && ');

describe.skipIf(!enabled)('Missionen in der echten VM', () => {
  let emulator: {
    destroy(): Promise<void> | void;
    serial_send_bytes(n: number, d: Uint8Array): void;
  };
  let client: AgentClient;

  const run = async (script: string) => client.run(`cd /home/azubi\n${script}`, 60_000);

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

  // #373: Die Antwortdatei schreibt der Agent als root, `mission` löscht sie als `azubi`.
  // In einem Sticky-Verzeichnis (1777) schlug das nach jedem Befehl mit einem rm-Fehler fehl.
  it('/run/mission gehört azubi, Antworten lassen sich ohne Fehler löschen', async () => {
    const mode = await run('stat -c "%a %U" /run/mission');
    expect(mode.output.trim()).toBe('700 azubi');

    const cycle = await run(
      [
        'printf "0\\nok\\n" > /run/mission/reply.vmtest',
        "su azubi -s /bin/bash -c 'rm -f /run/mission/reply.vmtest' 2>&1",
        'ls /run/mission | grep "^reply\\." || true',
      ].join('\n')
    );
    expect(cycle.exitCode).toBe(0);
    expect(cycle.output.trim(), 'stderr oder übrige reply-Datei').toBe('');
  });

  // #374: Alex' Welt – Azubi auf dem Host alex-schneider, Benutzer alex besitzt die Welt.
  it('Identität: azubi@alex-schneider, FQDN, Benutzer alex, motd', async () => {
    const id = await run(
      "su azubi -s /bin/bash -c 'cd && whoami && pwd && hostname && hostname -f'"
    );
    expect(id.output.trim().split('\n')).toEqual([
      'azubi',
      '/home/azubi',
      'alex-schneider',
      'alex-schneider.dev',
    ]);
    const alex = await run('stat -c "%U" /home/alex && id -u alex');
    expect(alex.output.trim().split('\n')).toEqual(['alex', '1001']);
    const motd = await run('cat /etc/motd');
    expect(motd.output).toContain('mission status');
    expect(motd.output).toContain('https://alex-schneider.dev');
  });

  it('Großschreibung: Hinweis bei bekanntem Befehl, sonst command not found', async () => {
    const shell = (cmd: string) =>
      run(`su azubi -s /bin/bash -c '. ~/.bashrc; ${cmd}' 2>&1; echo "rc=$?"`);
    const upper = await shell('MISSION STATUS');
    expect(upper.output).toContain('Groß- und Kleinschreibung');
    expect(upper.output).toContain('`mission status`');
    expect(upper.output).toContain('rc=127');
    const unknown = await shell('foo');
    expect(unknown.output).toContain('foo: command not found');
    expect(unknown.output).not.toContain('Kleinschreibung');
    expect(unknown.output).toContain('rc=127');
  });

  // Codex-Finding zu #375: Räumt ein neues setup das Verzeichnis weg, in dem die Shell steht,
  // holt der Prompt-Hook sie ins Home zurück (gelöscht und gleichnamig neu angelegt).
  it('Prompt-Hook: Shell in gelöschtem oder ersetztem Verzeichnis kehrt ins Home zurück', async () => {
    const shell = (script: string) => run(`su azubi -s /bin/bash -c '. ~/.bashrc; ${script}' 2>&1`);
    const gone = await shell('mkdir -p ~/weg && cd ~/weg && rm -rf ~/weg && __mission_cwd && pwd');
    expect(gone.output.trim().split('\n').at(-1)).toBe('/home/azubi');
    const replaced = await shell(
      'mkdir -p ~/neu && cd ~/neu && rm -rf ~/neu && mkdir ~/neu && __mission_cwd && pwd'
    );
    expect(replaced.output.trim().split('\n').at(-1)).toBe('/home/azubi');
    const stays = await shell('mkdir -p ~/bleibt && cd ~/bleibt && __mission_cwd && pwd');
    expect(stays.output.trim()).toBe('/home/azubi/bleibt');
    await run('rm -rf /home/azubi/bleibt /home/azubi/neu');
  });

  // #375: `erklaer` liest das Glossar im Image, auch ohne aktive Mission.
  it('erklaer: bekannter und unbekannter Befehl', async () => {
    const known = await run("su azubi -s /bin/bash -c 'erklaer ls'");
    expect(known.exitCode).toBe(0);
    expect(known.output).toMatch(/^ls: .+\n {2}Beispiel: /);
    const unknown = await run("su azubi -s /bin/bash -c 'erklaer quatsch'");
    expect(unknown.output.trim()).toBe('Kenne ich nicht. Versuch `quatsch --help`.');
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
