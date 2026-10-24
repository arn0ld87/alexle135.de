// @vitest-environment node
// Einsatzrahmen von Staffel 2 in der echten VM (v86 headless, Assets aus public/missions/linux/).
// Läuft nur mit MISSION_VM=1, auf gns3 bzw. in einer Umgebung mit gebauten Assets:
//   MISSION_VM=1 pnpm exec vitest run src/data/__tests__/staffel2Einsatzrahmen.vm.test.ts
// Das Setup läuft als root wie im Spiel; die Proben laufen als `azubi` mit den Spielrechten.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentClient } from '../../lib/missions/agentClient';
import {
  EINSATZRAHMEN_VERSTOSS,
  einsatzrahmenSetupSkript,
} from '../../lib/missions/einsatzrahmenSetup';
import { rahmenSetupSkript } from '../../lib/missions/staffel2Rahmen';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = join(root, 'public/missions/linux');
const enabled = process.env.MISSION_VM === '1';

const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';

const LOG = '/var/log/staffel2-sudo.log';
const DROPIN = '/etc/sudoers.d/90-staffel2-rahmen';
const ERLAUBT = '/bin/cat /home/nadia/vertraulich.txt';
const BASELINE = 'sha256sum /etc/sudoers /etc/sudoers.d/azubi';

describe.skipIf(!enabled)('Einsatzrahmen Staffel 2 in der echten VM', () => {
  let emulator: {
    destroy(): Promise<void> | void;
    serial_send_bytes(n: number, d: Uint8Array): void;
  };
  let client: AgentClient;

  const run = async (script: string) => client.run(`cd /home/azubi\n${script}`, 60_000);
  // Spielrechte: jeder Befehl läuft als azubi; stderr mit, Exitcode als letzte Zeile.
  const alsAzubi = async (befehl: string) => {
    const antwort = await run(
      `printf %s '${Buffer.from(befehl).toString('base64')}' | base64 -d > /tmp/probe.sh\n` +
        `chmod 644 /tmp/probe.sh\n` +
        `su azubi -s /bin/bash -c 'cd /home/azubi && bash /tmp/probe.sh </dev/null' 2>&1; echo "rc=$?"`
    );
    const zeilen = antwort.output.trimEnd().split('\n');
    const rc = Number(zeilen.pop()?.replace('rc=', ''));
    return { rc, text: zeilen.join('\n') };
  };
  const verstoss = async () => (await run(EINSATZRAHMEN_VERSTOSS)).exitCode;
  const setup = () => run(einsatzrahmenSetupSkript());
  const logZeilen = async () =>
    (await run(`cat ${LOG}`)).output.split('\n').filter((zeile) => zeile !== '');
  const hashes = async () => (await run(BASELINE)).output;

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

  let baseline = '';

  it('T8-10: eine frische VM (Staffel 1) kennt weder Drop-in noch Protokoll noch geschützten Ordner', async () => {
    baseline = await hashes();
    expect(baseline).toContain('/etc/sudoers.d/azubi');
    const spuren = await run(`ls ${DROPIN} ${LOG} /home/nadia 2>&1; echo rc=$?`);
    expect(spuren.output).not.toContain('rc=0');
    expect(spuren.output.match(/No such file/g)).toHaveLength(3);
    const liste = await alsAzubi('sudo -n -l');
    expect(liste.text).toContain('/usr/sbin/usermod -L kehrwoche');
    expect(liste.text).not.toContain('/bin/cat');
    const lesen = await alsAzubi('sudo -n /bin/cat /home/nadia/vertraulich.txt');
    expect(lesen.rc).not.toBe(0);
  }, 60_000);

  it('T8-1/T8-2: das Setup nach dem Rahmen legt Drop-in, Protokoll und Ordner mit den Soll-Rechten an', async () => {
    expect((await run(rahmenSetupSkript())).exitCode).toBe(0);
    const ergebnis = await setup();
    expect(ergebnis.exitCode, ergebnis.output).toBe(0);

    const rechte = await run(
      `stat -c '%n %U:%G %a' ${DROPIN} ${LOG} /home/nadia /home/nadia/vertraulich.txt`
    );
    expect(rechte.output.trim().split('\n')).toEqual([
      `${DROPIN} root:root 440`,
      `${LOG} root:root 600`,
      '/home/nadia root:root 700',
      '/home/nadia/vertraulich.txt root:root 600',
    ]);
    expect(await hashes()).toBe(baseline);
    expect((await run('visudo -c')).exitCode).toBe(0);
    expect((await run(`cat ${DROPIN}`)).output.trim().split('\n')).toEqual([
      `Defaults:azubi logfile=${LOG}`,
      'Defaults:azubi loglinelen=0',
      `azubi ALL=(root) NOPASSWD: ${ERLAUBT}`,
    ]);
    expect(await logZeilen()).toEqual([]);
    expect(await verstoss()).not.toBe(0);
  }, 120_000);

  it('T8-4: Geschwisterpfad, Argumente, /etc/shadow, Shell und sudo-Editor sind nicht freigegeben', async () => {
    const versuche = [
      'sudo -n /bin/cat /home/nadia/vertraulich.txt.bak',
      'sudo -n /bin/cat /home/nadia/vertraulich.txt /etc/shadow',
      'sudo -n /bin/cat /home/nadia/../../etc/shadow',
      'sudo -n /bin/cat /etc/shadow',
      'sudo -n /usr/bin/cat /home/nadia/vertraulich.txt',
      'sudo -n cat /etc/shadow',
      'sudo -n /bin/sh -c id',
      'sudo -n /bin/bash',
      'sudo -n -s',
      'sudo -n -u root /bin/bash',
      'sudo -n -e /etc/shadow',
      'sudo -n sudoedit /etc/shadow',
      'sudo -n /usr/bin/tee /etc/shadow',
      'sudo -n /usr/bin/id -u',
    ];
    for (const versuch of versuche) {
      const antwort = await alsAzubi(versuch);
      expect(antwort.rc, versuch).not.toBe(0);
      expect(antwort.text, versuch).not.toMatch(/^0$/m);
    }
    const liste = await alsAzubi('sudo -n -l');
    expect(liste.text.match(/NOPASSWD:/g)?.length).toBeGreaterThan(0);
    expect(liste.text).not.toMatch(/NOPASSWD: ALL|\(ALL(:ALL)?\) ALL/);
    // Auch ein abgelehnter Versuch mit Passworteingabe zählt nicht als gelungenes Lesen.
    await alsAzubi('sudo -S /bin/cat /etc/shadow');
    console.log(`T8-Log nach abgelehnten Versuchen:\n${(await logZeilen()).join('\n')}`);
    expect(await verstoss()).not.toBe(0);
  }, 180_000);

  it('T8-5: der erlaubte kehrwoche-Befehl bleibt nutzbar und löst keinen Verstoß aus', async () => {
    const status = await alsAzubi('sudo -n /usr/bin/passwd -S kehrwoche');
    expect(status.rc, status.text).toBe(0);
    expect(status.text).toMatch(/^kehrwoche /);
    expect(await verstoss()).not.toBe(0);
  }, 60_000);

  it('T8-3: direktes cat scheitert, das exakt erlaubte sudo gelingt, wird protokolliert und erkannt', async () => {
    const direkt = await alsAzubi('cat /home/nadia/vertraulich.txt');
    expect(direkt.rc).not.toBe(0);
    expect(direkt.text).toContain('Permission denied');
    expect(await verstoss()).not.toBe(0);

    const erlaubt = await alsAzubi('sudo -n /bin/cat /home/nadia/vertraulich.txt');
    expect(erlaubt.rc, erlaubt.text).toBe(0);
    expect(erlaubt.text).toContain('Fiktive Uebungsdatei');

    const zeilen = await logZeilen();
    const treffer = zeilen.filter((zeile) => zeile.endsWith(`COMMAND=${ERLAUBT}`));
    expect(treffer).toHaveLength(1);
    console.log(`T8-Log nach erlaubtem Aufruf:\n${zeilen.join('\n')}`);
    expect(treffer[0]).toMatch(
      /^[A-Z][a-z]{2} [ 0-9]\d \d\d:\d\d:\d\d : azubi : TTY=\S+ ; PWD=\/home\/azubi ; USER=root ; COMMAND=/
    );
    expect(await verstoss()).toBe(0);
  }, 60_000);

  it('T8-5: azubi kann das Protokoll weder lesen noch ändern noch löschen', async () => {
    const vorher = await run(`sha256sum ${LOG}`);
    for (const versuch of [
      `echo x >> ${LOG}`,
      `: > ${LOG}`,
      `rm -f ${LOG}`,
      `cat ${LOG}`,
      `ln -sf /dev/null ${LOG}`,
      `mv ${LOG} /tmp/anders.log`,
    ]) {
      const antwort = await alsAzubi(versuch);
      expect(antwort.rc, versuch).not.toBe(0);
    }
    expect((await run(`sha256sum ${LOG}`)).output).toBe(vorher.output);
    expect(await verstoss()).toBe(0);
  }, 90_000);

  it('T8-2: ein wiederholtes Setup erzeugt denselben Stand ohne alte Verstoßzeilen', async () => {
    const regel = (await run(`sha256sum ${DROPIN}`)).output;
    const ergebnis = await setup();
    expect(ergebnis.exitCode, ergebnis.output).toBe(0);
    expect((await run(`sha256sum ${DROPIN}`)).output).toBe(regel);
    expect((await run(`grep -c NOPASSWD ${DROPIN}`)).output.trim()).toBe('1');
    expect(await logZeilen()).toEqual([]);
    expect(await verstoss()).not.toBe(0);
    expect(await hashes()).toBe(baseline);

    expect((await alsAzubi(`sudo -n ${ERLAUBT}`)).rc).toBe(0);
    expect(await logZeilen()).toHaveLength(1);
    expect(await verstoss()).toBe(0);
  }, 120_000);

  it('T8-1: ein belegter Ordner oder eine kaputte Konfiguration lässt das Setup sichtbar scheitern', async () => {
    const regel = (await run(`sha256sum ${DROPIN}`)).output;

    await run("printf 'fremd\\n' > /home/nadia/vertraulich.txt");
    const belegt = await setup();
    expect(belegt.exitCode).not.toBe(0);
    expect((await run('cat /home/nadia/vertraulich.txt')).output.trim()).toBe('fremd');
    expect((await run(`sha256sum ${DROPIN}`)).output).toBe(regel);
    await run('rm -rf /home/nadia');

    await run(
      "printf 'kaputte regel ===\\n' > /etc/sudoers.d/99-kaputt; chmod 0440 /etc/sudoers.d/99-kaputt"
    );
    const kaputt = await setup();
    await run('rm -f /etc/sudoers.d/99-kaputt');
    expect(kaputt.exitCode).not.toBe(0);
    // Der vorherige eigene Drop-in ist wiederhergestellt, die Gesamtkonfiguration wieder gültig.
    expect((await run(`sha256sum ${DROPIN}`)).output).toBe(regel);
    expect((await run('visudo -c')).exitCode).toBe(0);

    const danach = await setup();
    expect(danach.exitCode, danach.output).toBe(0);
    expect(await hashes()).toBe(baseline);
  }, 180_000);
});
