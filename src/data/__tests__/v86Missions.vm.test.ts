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
import { vorfallAlsMission } from '../../lib/missions/staffel';
import { v86Missions } from '../missions';
import { staffeln } from '../staffeln';

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
    // #397: Die Begrüßung steht im Pager, die motd hat nur noch eine Zeile.
    expect(motd.output.trimEnd().split('\n')).toHaveLength(1);
    expect(motd.output).toContain('Pager');
    expect(motd.output).toContain('alex-schneider.dev');
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

  // #398: Prompt in Farbe, `$` rot nach Fehlschlag; diff (GNU) und git färben.
  it('Farben: Prompt, roter Prompt nach Fehlschlag, diff und git', async () => {
    const shell = (cmd: string) => run(`su azubi -s /bin/bash -c '. ~/.bashrc; ${cmd}' 2>&1`);
    const okPrompt = await shell('true; __mission_prompt; printf %s "${PS1@P}"');
    expect(okPrompt.output).toContain('\x1b[1;38;2;232;96;58m');
    expect(okPrompt.output).toContain('\x1b[0;0m');
    const failPrompt = await shell('false; __mission_prompt; printf %s "${PS1@P}"');
    expect(failPrompt.output).toContain('\x1b[0;31m');
    const diff = await shell(
      'printf "a\\n" > /tmp/d1; printf "b\\n" > /tmp/d2; diff --color=always /tmp/d1 /tmp/d2; rm -f /tmp/d1 /tmp/d2'
    );
    expect(diff.output).toContain('\x1b[');
    expect((await shell('git config --get color.ui')).output.trim()).toBe('auto');
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

  // #392: REPLY schreibt die Antwort an `mission` ohne Prozessstart in die FIFO der Shell.
  // Ein Leser im Hintergrund hält sie offen wie die Funktion `mission`. Ohne FIFO lehnt der
  // Agent ab, und eine FIFO ohne Leser hält ihn nicht fest.
  it('REPLY: Antwort landet in der FIFO der Shell, ohne Leser kein Hänger', async () => {
    const reader = [
      'rm -f /run/mission/reply.r42 /tmp/reply.out',
      'mkfifo -m 600 /run/mission/reply.r42',
      'exec 3<>/run/mission/reply.r42',
      'read -r -t 10 -u 3 rid rc text',
      'printf "%s|%s|%s" "$rid" "$rc" "$text" > /tmp/reply.out',
    ].join('\n');
    await run(
      `printf %s '${Buffer.from(reader).toString('base64')}' | base64 -d > /tmp/leser.sh && chmod 644 /tmp/leser.sh && su azubi -s /bin/bash -c 'bash /tmp/leser.sh >/dev/null 2>&1 &'`
    );
    await run('sleep 1');
    await client.reply('r42x1', { exitCode: 1, text: 'Tipp: `ls -a` äö\nZeile 2' });
    const out = await run('sleep 1; cat /tmp/reply.out');
    expect(out.output).toBe('r42x1|1|Tipp: `ls -a` äö\x1eZeile 2');
    // Die FIFO existiert noch, der Leser ist weg: Der Agent antwortet trotzdem sofort.
    await client.reply('r42x2', { exitCode: 0, text: 'niemand liest' });
    expect((await run('echo lebt')).output.trim()).toBe('lebt');
    await run('rm -f /run/mission/reply.r42 /tmp/reply.out /tmp/leser.sh');
    await expect(client.reply('r42x3', { exitCode: 0, text: 'x' })).rejects.toThrow(/bad-reply/);
  }, 60_000);

  // Codex-Finding zu #392: In einer Subshell ($(mission …)) braucht `mission` eine eigene
  // Kennung und FIFO, sonst teilen sich Eltern- und Subshell IDs. Die OSC-Sequenz an /dev/tty
  // fängt eine printf-Funktion ab: Agent-Skripte haben ttyS1 als Terminal, die Sequenz würde
  // sonst im Agent-Kanal landen.
  it('mission: Subshell nutzt eigene FIFO und räumt sie weg', async () => {
    const script = [
      '. /usr/local/lib/mission.sh',
      'printf() { [[ $1 == \'\\033]\'* ]] && return 0; builtin printf "$@"; }',
      'echo "$$"',
      '( mission status >/dev/null 2>&1; echo "$__mission_pid" )',
      'ls /run/mission | grep -c "^reply\\.r" || true',
    ].join('\n');
    const out = await run(
      `printf %s '${Buffer.from(script).toString('base64')}' | base64 -d > /tmp/sub.sh && chmod 644 /tmp/sub.sh && su azubi -s /bin/bash -c 'bash /tmp/sub.sh' 2>&1`
    );
    const [parent, child, left] = out.output.trim().split('\n');
    expect(child).toMatch(/^\d+$/);
    expect(child).not.toBe(parent);
    expect(left).toBe('0');
  }, 60_000);

  // #375: `erklaer` liest das Glossar im Image, auch ohne aktive Mission.
  it('erklaer: bekannter und unbekannter Befehl', async () => {
    const known = await run("su azubi -s /bin/bash -c 'erklaer ls'");
    expect(known.exitCode).toBe(0);
    expect(known.output).toMatch(/^ls: .+\n {2}Beispiel: /);
    const unknown = await run("su azubi -s /bin/bash -c 'erklaer quatsch'");
    expect(unknown.output.trim()).toBe('Kenne ich nicht. Versuch `quatsch --help`.');
  });

  // #400: azubi darf genau usermod und passwd als root, sonst nichts.
  it('sudo: azubi darf Konten sperren, aber keine Shell als root', async () => {
    const list = await run("su azubi -s /bin/bash -c 'sudo -n -l' 2>&1");
    expect(list.output).toContain('/usr/sbin/usermod');
    expect(list.output).toContain('/usr/bin/passwd');
    const shell = await run("su azubi -s /bin/bash -c 'sudo -n id -u' 2>&1; echo rc=$?");
    expect(shell.output).not.toMatch(/^0$/m);
    expect(shell.output).not.toContain('rc=0');
    expect((await run('id -u kehrwoche')).output.trim()).toBe('1002');
  });

  // Vorfälle der Staffeln laufen über dieselbe Prüfung wie die Missionen (Lösung = Tippstufe 3).
  const vorfaelle = staffeln.flatMap((s) => s.vorfaelle.map(vorfallAlsMission));
  for (const mission of [...v86Missions, ...vorfaelle]) {
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
