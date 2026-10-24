// @vitest-environment node
// Episode 1 „Zu viele Rechte“ in der echten VM (v86 headless, Assets aus public/missions/linux/).
// Läuft nur mit MISSION_VM=1, auf gns3 bzw. in einer Umgebung mit gebauten Assets:
//   MISSION_VM=1 pnpm exec vitest run src/data/__tests__/staffel2Episode1.vm.test.ts
// Setup und Prüfungen laufen als root wie im Spiel; die Lösungswege laufen als `azubi`.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abfrageSkript, leseAbfrage } from '../../lib/missions/abfrage';
import { AgentClient } from '../../lib/missions/agentClient';
import { AKTENWAND_ABFRAGE, leseAktenwand } from '../../lib/missions/aktenwand';
import { einsatzrahmenSetupSkript } from '../../lib/missions/einsatzrahmenSetup';
import {
  buendelSkript,
  istGesperrt,
  leseBuendelAusgabe,
  offenePruefungen,
  pruefeVorwurf,
  startZustand,
  wendePruefungAn,
} from '../../lib/missions/ermittlung';
import type { ErmittlungsEreignis, ErmittlungsZustand } from '../../lib/missions/ermittlungTypes';
import { rahmenSetupSkript } from '../../lib/missions/staffel2Rahmen';
import { episode1, LOESUNG } from '../staffeln/staffel-2/episode-1';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = join(root, 'public/missions/linux');
const enabled = process.env.MISSION_VM === '1';

const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';

const SUDOERS = '/etc/sudoers.d/rw-fernwartung';
const STATUS = '/usr/local/bin/rw-status';
const AUDIT = '/var/log/rechenwerk-audit.log';
const T8_DROPIN = '/etc/sudoers.d/90-staffel2-rahmen';
const T8_LOG = '/var/log/staffel2-sudo.log';
const T8_BEFEHL = '/bin/cat /home/nadia/vertraulich.txt';
const BELEGE = '/home/azubi/belege';

const BELEG_IDS = ['rechte-zeile', 'rechte-metadaten', 'log-zeile'] as const;
type BelegId = (typeof BELEG_IDS)[number];

/** Das Lesemanifest aus T5/T6: Metadaten, Inhalte und Links unter /home und /etc. */
const MANIFEST = `set -e
cd /
__m=$(mktemp)
{
  printf 'META\\n'
  find home etc -type f | LC_ALL=C sort | xargs stat -c '%n\\t%a\\t%u\\t%g\\t%s'
  printf 'INHALT\\n'
  find home etc -type f | LC_ALL=C sort | xargs sha256sum
  printf 'LINKS\\n'
  find home etc -type l | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s\\t%s\\n' "$f" "$(readlink "$f")"
  done
} > "$__m"
printf 'manifest\\t%s\\n' "$(sha256sum "$__m" | cut -d' ' -f1)"
printf 'anzahl\\t%s\\n' "$(wc -l < "$__m")"
rm -f "$__m"
`;

/** Der geprüfte Lösungsweg, den die dritte Tipp-Stufe nennt. */
const tippLoesung = (spurId: string, schrittId: string): string => {
  const schritt = episode1.spuren
    .find((spur) => spur.id === spurId)
    ?.schritte.find((eintrag) => eintrag.id === schrittId);
  const tipp = schritt?.tipps[2] ?? '';
  expect(tipp.startsWith(LOESUNG)).toBe(true);
  return tipp.slice(LOESUNG.length);
};

/** Gleichwertige Lösungswege je Beleg: jeder muss denselben gültigen Beleg erzeugen. */
const WEGE: Record<BelegId, { name: string; befehl: string; rcEgal?: boolean }[]> = {
  'rechte-zeile': [
    { name: 'Tipp', befehl: tippLoesung('rechte', 'sudo-zeile') },
    { name: 'cat', befehl: `cat ${SUDOERS} > ~/belege/rechte-zeile.txt` },
    { name: 'cp', befehl: `cp ${SUDOERS} ~/belege/rechte-zeile.txt` },
    {
      name: 'grep -e',
      befehl: `grep -h -e RW-1042 -e nadia ${SUDOERS} > ~/belege/rechte-zeile.txt`,
    },
    { name: 'sed', befehl: `sed -n '1,2p' ${SUDOERS} > ~/belege/rechte-zeile.txt` },
    {
      name: 'echo plus cat',
      befehl: `{ echo 'Fund auf rw-srv01'; cat ${SUDOERS}; } > ~/belege/rechte-zeile.txt`,
    },
  ],
  'rechte-metadaten': [
    { name: 'Tipp', befehl: tippLoesung('rechte', 'datei-metadaten') },
    { name: 'stat', befehl: `stat ${SUDOERS} ${STATUS} > ~/belege/rechte-metadaten.txt` },
    {
      name: 'ls --full-time plus find',
      befehl: `{ ls -l --full-time ${SUDOERS}; find / -xdev -perm -4000 -name 'rw-*' -exec ls -l {} \\; 2>/dev/null; } > ~/belege/rechte-metadaten.txt`,
      // find endet als azubi wegen unlesbarer Ordner mit 1; der Beleg ist trotzdem vollständig.
      rcEgal: true,
    },
    {
      name: 'stat -c',
      befehl: `{ stat -c '%n %U %G %a %y' ${SUDOERS}; stat -c '%n %U %G %a %A' ${STATUS}; } > ~/belege/rechte-metadaten.txt`,
    },
  ],
  'log-zeile': [
    { name: 'Tipp', befehl: tippLoesung('log', 'audit-zeile') },
    { name: 'cat', befehl: `cat ${AUDIT} > ~/belege/log-zeile.txt` },
    { name: 'cp', befehl: `cp ${AUDIT} ~/belege/log-zeile.txt` },
    {
      name: 'grep timo und RW-1042',
      befehl: `grep timo ${AUDIT} | grep RW-1042 > ~/belege/log-zeile.txt`,
    },
    { name: 'awk', befehl: `awk '/install-sudoers/' ${AUDIT} > ~/belege/log-zeile.txt` },
    { name: 'grep -n', befehl: `grep -n sudoers ${AUDIT} > ~/belege/log-zeile.txt` },
  ],
};

describe.skipIf(!enabled)('Episode 1 „Zu viele Rechte“ in der echten VM', () => {
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
  const frischBelege = async () =>
    (
      await run(
        `for id in ${BELEG_IDS.join(' ')}; do rm -f -- ${BELEGE}/$id.txt; done; ls -A ${BELEGE}`
      )
    ).output.trim();

  const setupAlles = async () => {
    const rahmen = await run(rahmenSetupSkript());
    expect(rahmen.exitCode, rahmen.output).toBe(0);
    const einsatz = await run(einsatzrahmenSetupSkript());
    expect(einsatz.exitCode, einsatz.output).toBe(0);
    const episode = await run(episode1.setup);
    expect(episode.exitCode, episode.output).toBe(0);
  };
  const setupEpisode = () => run(episode1.setup);

  const belegPruefung = async (): Promise<Record<BelegId, boolean>> => {
    const buendel = buendelSkript(
      episode1.vorwurf.belege.map((beleg) => ({ id: `b.${beleg.id}`, skript: beleg.verify }))
    );
    const ausgabe = leseBuendelAusgabe((await run(buendel)).output);
    expect(ausgabe.vollstaendig).toBe(true);
    return Object.fromEntries(
      BELEG_IDS.map((id) => [id, ausgabe.ergebnisse[`b.${id}`] === true])
    ) as Record<BelegId, boolean>;
  };
  const nurBeleg = (id: BelegId): Record<BelegId, boolean> => ({
    'rechte-zeile': id === 'rechte-zeile',
    'rechte-metadaten': id === 'rechte-metadaten',
    'log-zeile': id === 'log-zeile',
  });
  const keinBeleg: Record<BelegId, boolean> = {
    'rechte-zeile': false,
    'rechte-metadaten': false,
    'log-zeile': false,
  };

  // Ein vollständiger Prüflauf wie im Spiel: Bündel in der VM, Ergebnis in die Engine.
  let zustand: ErmittlungsZustand = startZustand();
  let ereignisse: ErmittlungsEreignis[] = [];
  const pruefLauf = async () => {
    const buendel = buendelSkript(offenePruefungen(episode1, zustand));
    const antwort = await run(buendel);
    const neu = wendePruefungAn(episode1, zustand, leseBuendelAusgabe(antwort.output));
    zustand = neu.zustand;
    ereignisse = neu.ereignisse;
    return neu;
  };
  // Die lesbare Regeldatei (0644) beanstandet `visudo -c` im T8-Setup. Im Spiel läuft die Folge
  // nur einmal je frischer VM; hier ersetzt das Entfernen der Datei den Neustart der VM.
  const frischerLauf = async () => {
    await run(`rm -f ${SUDOERS}`);
    await setupAlles();
    zustand = startZustand();
    ereignisse = [];
  };
  const typen = () => ereignisse.map((e) => e.type);

  // Inhalt, Besitzer und Modus; mit `mitZeit` auch die Änderungszeit (feste Zeitlinie der Quellen).
  const hashes = async (pfade: readonly string[], mitZeit = false) =>
    (
      await run(
        `stat -c '%n %U:%G %a${mitZeit ? ' %Y' : ''}' ${pfade.join(' ')}; sha256sum ${pfade.join(' ')}`
      )
    ).output;

  const manifest = async () => {
    const ergebnis = await client.run(MANIFEST, 180_000);
    expect(ergebnis.exitCode).toBe(0);
    const zeilen = ergebnis.output.split('\n');
    const wert = (name: string) =>
      zeilen.find((zeile) => zeile.startsWith(`${name}\t`))?.split('\t')[1];
    return { hash: wert('manifest'), anzahl: wert('anzahl') };
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
    await setupAlles();
  }, 900_000);

  afterAll(async () => {
    await emulator?.destroy();
  });

  it('T9-8: das Setup legt die geplanten Quellen mit Soll-Rechten und fester Zeitlinie an', async () => {
    const rechte = await run(`stat -c '%n %U:%G %a %y' ${SUDOERS} ${STATUS} ${AUDIT}`);
    console.log(`T09-VM Quellen:\n${rechte.output.trim()}`);
    expect(rechte.output.trim().split('\n')).toEqual([
      `${SUDOERS} root:root 644 2026-04-17 08:42:00.000000000 +0000`,
      `${STATUS} root:root 4755 2026-04-17 08:42:00.000000000 +0000`,
      `${AUDIT} root:root 644 2026-04-17 08:45:00.000000000 +0000`,
    ]);
    expect((await run(`cat ${SUDOERS}`)).output.trim().split('\n')).toEqual([
      '# Fernwartung, Aenderung RW-1042 (fiktive Uebungsdaten)',
      'nadia ALL=(root) NOPASSWD: /usr/bin/id',
    ]);
    const audit = (await run(`cat ${AUDIT}`)).output.trim().split('\n');
    expect(
      audit.filter((zeile) => zeile.includes('change=RW-1042 target=/etc/sudoers.d/'))
    ).toEqual([
      '2026-04-17T08:42:00Z timo install-sudoers change=RW-1042 target=/etc/sudoers.d/rw-fernwartung',
    ]);
    // Die fiktiven Konten sind gesperrt und ohne Login-Shell.
    const konten = await run(
      `for u in timo nadia margit; do grep "^$u:" /etc/passwd | cut -d: -f1,3,5,7; grep "^$u:" /etc/shadow | cut -d: -f1,2; done`
    );
    expect(konten.output.trim().split('\n')).toEqual([
      'timo:1101:Timo Kessler:/sbin/nologin',
      'timo:!',
      'nadia:1102:Nadia Brem:/sbin/nologin',
      'nadia:!',
      'margit:1103:Margit Ostwind:/sbin/nologin',
      'margit:!',
    ]);
    expect((await run('visudo -cf ' + SUDOERS)).exitCode).toBe(0);
  }, 180_000);

  it('T9-7: Quellen sind root-eigen und für azubi lesbar, aber nicht veränderbar', async () => {
    for (const pfad of [SUDOERS, AUDIT, STATUS]) {
      expect((await alsAzubi(`cat ${pfad} >/dev/null`)).rc, pfad).toBe(0);
    }
    const vorher = await hashes([SUDOERS, STATUS, AUDIT]);
    for (const versuch of [
      `echo x >> ${SUDOERS}`,
      `: > ${SUDOERS}`,
      `rm -f ${SUDOERS}`,
      `mv ${SUDOERS} /tmp/anders`,
      `touch -d '2020-01-01 00:00:00 UTC' ${SUDOERS}`,
      `chmod 600 ${SUDOERS}`,
      `echo x >> ${AUDIT}`,
      `rm -f ${AUDIT}`,
      `echo x >> ${STATUS}`,
      `rm -f ${STATUS}`,
      `cp /bin/true ${STATUS}`,
    ]) {
      expect((await alsAzubi(versuch)).rc, versuch).not.toBe(0);
    }
    expect(await hashes([SUDOERS, STATUS, AUDIT])).toBe(vorher);
  }, 180_000);

  it('T9-7: das Setuid-Programm ist harmlos und öffnet keine Shell oder Root-Rechte', async () => {
    expect((await run(`head -c 2 ${STATUS}`)).output.startsWith('#!')).toBe(true);
    const liste = await alsAzubi('find / -xdev -perm -4000 -type f 2>/dev/null');
    expect(liste.text).toContain(STATUS);
    const direkt = await alsAzubi(`${STATUS}; echo "ausgabe-ende"`);
    expect(direkt.text.trim()).toBe('ausgabe-ende');
    // Eine Multicall-Kopie von coreutils wäre über einen Link namens `cat` oder `id` ein Rootzugang.
    const link = await alsAzubi(
      `ln -s ${STATUS} ~/cat; ln -s ${STATUS} ~/id; ~/cat /etc/shadow; ~/id; rm -f ~/cat ~/id`
    );
    expect(link.text).not.toContain('root:');
    expect(link.text).not.toContain('euid=0');
    const kopie = await alsAzubi(`cp ${STATUS} ~/kopie && ls -l ~/kopie && rm -f ~/kopie`);
    expect(kopie.text).not.toContain('rws');
    const euid = await alsAzubi(`${STATUS}; id -u`);
    expect(euid.text.trim()).toBe('1000');
  }, 120_000);

  it('T9-7: azubi hat keine neuen breiten sudo-Rechte und kann die Quellen nicht per sudo ändern', async () => {
    const liste = await alsAzubi('sudo -n -l');
    console.log(`T09-VM sudo -l als azubi:\n${liste.text}`);
    expect(liste.text).not.toMatch(/NOPASSWD: ALL|\(ALL(:ALL)?\) (NOPASSWD: )?ALL/);
    expect(liste.text).not.toContain('/usr/bin/id');
    expect(liste.text).not.toContain('rw-fernwartung');
    expect(liste.text.match(/\(root\) NOPASSWD:/g)).toHaveLength(2);
    expect(liste.text).toContain(T8_BEFEHL);
    for (const versuch of [
      `sudo -n /usr/bin/id`,
      `sudo -n /usr/bin/tee ${SUDOERS}`,
      `sudo -n /bin/sh -c 'echo x >> ${SUDOERS}'`,
      `sudo -n -u nadia /usr/bin/id`,
      `sudo -n -e ${SUDOERS}`,
      `sudo -n /bin/cat ${AUDIT}`,
    ]) {
      expect((await alsAzubi(versuch)).rc, versuch).not.toBe(0);
    }
    // Weder dieser Test noch die Liste hat den Einsatzrahmen verletzt.
    expect((await run(episode1.einsatzrahmen.verstoss)).exitCode).not.toBe(0);
  }, 180_000);

  it('T9-4: vor der Lösung sind alle Belegprüfungen negativ', async () => {
    await frischBelege();
    expect(await belegPruefung()).toEqual(keinBeleg);
    const buendel = buendelSkript(offenePruefungen(episode1, startZustand()));
    const ausgabe = leseBuendelAusgabe((await run(buendel)).output);
    expect(ausgabe.vollstaendig).toBe(true);
    expect(Object.values(ausgabe.ergebnisse).every((ok) => ok === false)).toBe(true);
  }, 120_000);

  for (const id of BELEG_IDS) {
    it(`T9-4: verschiedene Terminal-Lösungswege erzeugen denselben gültigen Beleg ${id}`, async () => {
      for (const weg of WEGE[id]) {
        await frischBelege();
        const antwort = await alsAzubi(weg.befehl);
        if (!weg.rcEgal) expect(antwort.rc, `${weg.name}: ${weg.befehl}\n${antwort.text}`).toBe(0);
        const ergebnis = await belegPruefung();
        expect(ergebnis, `${weg.name}: ${weg.befehl}`).toEqual(nurBeleg(id));
        console.log(`T09-VM Lösungsweg ${id} [${weg.name}] gültig`);
      }
    }, 300_000);
  }

  it('T9-5: leere, falsche, teilweise, fremde und als Symlink angelegte Belege sind negativ', async () => {
    const faelle: { id: BelegId; name: string; befehl: string; asRoot?: boolean }[] = [
      { id: 'rechte-zeile', name: 'leer', befehl: ': > ~/belege/rechte-zeile.txt' },
      {
        id: 'rechte-zeile',
        name: 'nur der Name',
        befehl: 'echo nadia > ~/belege/rechte-zeile.txt',
      },
      {
        id: 'rechte-zeile',
        name: 'Regel ohne Änderungskennung',
        befehl: `grep nadia ${SUDOERS} > ~/belege/rechte-zeile.txt`,
      },
      {
        id: 'rechte-zeile',
        name: 'Kennung ohne Regel',
        befehl: `grep RW-1042 ${SUDOERS} > ~/belege/rechte-zeile.txt`,
      },
      {
        id: 'rechte-zeile',
        name: 'falsche Regel',
        befehl: `printf '%s\\n' '# RW-1042' 'timo ALL=(root) NOPASSWD: /usr/bin/id' > ~/belege/rechte-zeile.txt`,
      },
      {
        id: 'rechte-zeile',
        name: 'Symlink auf die Quelle',
        befehl: `ln -s ${SUDOERS} ~/belege/rechte-zeile.txt`,
      },
      {
        id: 'rechte-zeile',
        name: 'Symlink auf eine gültige Kopie',
        befehl: `cp ${SUDOERS} ~/kopie.txt; ln -s ~/kopie.txt ~/belege/rechte-zeile.txt`,
      },
      {
        id: 'rechte-zeile',
        name: 'fremde Datei (root)',
        befehl: `cp ${SUDOERS} ~/belege/rechte-zeile.txt && chown root:root ~/belege/rechte-zeile.txt`,
        asRoot: true,
      },
      {
        id: 'rechte-metadaten',
        name: 'leer',
        befehl: ': > ~/belege/rechte-metadaten.txt',
      },
      {
        id: 'rechte-metadaten',
        name: 'nur die Regeldatei',
        befehl: `ls -l --full-time ${SUDOERS} > ~/belege/rechte-metadaten.txt`,
      },
      {
        id: 'rechte-metadaten',
        name: 'nur rw-status',
        befehl: `ls -l ${STATUS} > ~/belege/rechte-metadaten.txt`,
      },
      {
        id: 'rechte-metadaten',
        name: 'Verzeichnislisting ohne Pfad von rw-status',
        befehl: `ls -l /etc/sudoers.d /usr/local/bin > ~/belege/rechte-metadaten.txt`,
      },
      {
        id: 'rechte-metadaten',
        name: 'falsche Rechte und Pfad',
        befehl: `echo 'rw-fernwartung root -rw-rw-rw- Apr 17 2026 /usr/local/bin/rw-status -rwxr-xr-x' > ~/belege/rechte-metadaten.txt`,
      },
      {
        id: 'rechte-metadaten',
        name: 'Symlink auf gültigen Inhalt',
        befehl: `stat ${SUDOERS} ${STATUS} > ~/gut.txt; ln -s ~/gut.txt ~/belege/rechte-metadaten.txt`,
      },
      { id: 'log-zeile', name: 'leer', befehl: ': > ~/belege/log-zeile.txt' },
      { id: 'log-zeile', name: 'nur der Name', befehl: 'echo timo > ~/belege/log-zeile.txt' },
      {
        id: 'log-zeile',
        name: 'andere Zeile von timo',
        befehl: `grep update-packages ${AUDIT} > ~/belege/log-zeile.txt`,
      },
      {
        id: 'log-zeile',
        name: 'falscher Change',
        befehl: `grep RW-1041 ${AUDIT} > ~/belege/log-zeile.txt`,
      },
      {
        id: 'log-zeile',
        name: 'passender Change von nadia',
        befehl: `grep nadia ${AUDIT} | grep RW-1042 > ~/belege/log-zeile.txt`,
      },
      {
        id: 'log-zeile',
        name: 'erfundene Zeile',
        befehl: `echo '2026-04-17T08:42:00Z timo install-sudoers change=RW-1042 target=/etc/sudoers' > ~/belege/log-zeile.txt`,
      },
      {
        id: 'log-zeile',
        name: 'Symlink auf das Log',
        befehl: `ln -s ${AUDIT} ~/belege/log-zeile.txt`,
      },
      {
        id: 'log-zeile',
        name: 'fremde Datei (root)',
        befehl: `cp ${AUDIT} ~/belege/log-zeile.txt && chown root:root ~/belege/log-zeile.txt`,
        asRoot: true,
      },
    ];
    for (const fall of faelle) {
      await frischBelege();
      await run('rm -f /home/azubi/kopie.txt /home/azubi/gut.txt');
      const antwort = fall.asRoot
        ? await run(fall.befehl.replaceAll('~', '/home/azubi'))
        : await alsAzubi(fall.befehl);
      const rc = 'exitCode' in antwort ? antwort.exitCode : antwort.rc;
      expect(rc, `${fall.id} ${fall.name}`).toBe(0);
      const ergebnis = await belegPruefung();
      expect(ergebnis[fall.id], `${fall.id}: ${fall.name}`).toBe(false);
    }
    await run('rm -f /home/azubi/kopie.txt /home/azubi/gut.txt');
  }, 900_000);

  it('T9-5: ein vorher gültiger Beleg, der gelöscht oder geleert wird, wird als verloren erkannt', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['log-zeile'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['log-zeile']);
    expect(typen()).toContain('beleg-erkannt');

    await alsAzubi('rm ~/belege/log-zeile.txt');
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual([]);
    expect(ereignisse.filter((e) => e.type === 'beleg-verloren')).toEqual([
      { type: 'beleg-verloren', belegId: 'log-zeile' },
    ]);

    await alsAzubi(WEGE['log-zeile'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['log-zeile']);
    await alsAzubi(': > ~/belege/log-zeile.txt');
    await pruefLauf();
    expect(typen()).toContain('beleg-verloren');
    expect(zustand.belegeErkannt).toEqual([]);
  }, 300_000);

  it('T9-6: Spur Log vor Spur Rechte, je ein Schritt pro Bündel, ohne Reihenfolgezwang', async () => {
    await frischerLauf();
    await alsAzubi(tippLoesung('log', 'audit-zeile'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ log: 1 });
    expect(typen()).toEqual(
      expect.arrayContaining(['schritt-erledigt', 'spur-erledigt', 'beleg-erkannt'])
    );
    expect(zustand.belegeErkannt).toEqual(['log-zeile']);

    await alsAzubi(tippLoesung('rechte', 'sudo-zeile'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ log: 1, rechte: 1 });
    expect(zustand.belegeErkannt).toEqual(['log-zeile', 'rechte-zeile']);

    await alsAzubi(tippLoesung('rechte', 'datei-metadaten'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ log: 1, rechte: 2 });
    expect(zustand.belegeErkannt).toEqual(['log-zeile', 'rechte-metadaten', 'rechte-zeile']);
  }, 300_000);

  it('T9-6: Spur Rechte vor Spur Log, auch alle drei Belege vor den Schritten', async () => {
    await frischerLauf();
    await alsAzubi(tippLoesung('rechte', 'sudo-zeile'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ rechte: 1 });
    await alsAzubi(tippLoesung('rechte', 'datei-metadaten'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ rechte: 2 });
    await alsAzubi(tippLoesung('log', 'audit-zeile'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ rechte: 2, log: 1 });
    expect(zustand.belegeErkannt).toEqual(['log-zeile', 'rechte-metadaten', 'rechte-zeile']);

    // Alle Belege vorab: Schritt 2 der Rechte-Spur folgt erst im nächsten Bündel nach Schritt 1.
    await frischerLauf();
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ rechte: 1, log: 1 });
    expect(zustand.belegeErkannt).toHaveLength(3);
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ rechte: 2, log: 1 });
  }, 600_000);

  it('T9-6: Timo mit zwei Belegen derselben Spur reicht nicht; Rechte plus Log reicht ohne alle Schritte', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['rechte-zeile'][0].befehl);
    await alsAzubi(WEGE['rechte-metadaten'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['rechte-metadaten', 'rechte-zeile']);

    const zuWenig = pruefeVorwurf(episode1, zustand, {
      verdaechtigeId: 'timo',
      belegIds: ['rechte-zeile', 'rechte-metadaten'],
    });
    expect(zuWenig.ergebnis).toBe('zu-wenig-belege');
    expect(zuWenig.antwort).toEqual(episode1.vorwurf.antworten.zuWenigBelege);
    zustand = zuWenig.zustand;
    expect(istGesperrt(zustand)).toBe(true);
    const gesperrt = pruefeVorwurf(episode1, zustand, {
      verdaechtigeId: 'timo',
      belegIds: ['rechte-zeile'],
    });
    expect(gesperrt.ergebnis).toBe('gesperrt');
    expect(gesperrt.antwort).toEqual(episode1.vorwurf.antworten.gesperrt);

    // Der Log-Beleg hebt die Sperre auf.
    await alsAzubi(WEGE['log-zeile'][0].befehl);
    await pruefLauf();
    expect(typen()).toContain('sperre-aufgehoben');
    expect(istGesperrt(zustand)).toBe(false);

    const falsch = pruefeVorwurf(episode1, zustand, {
      verdaechtigeId: 'nadia',
      belegIds: ['rechte-zeile', 'log-zeile'],
    });
    expect(falsch.ergebnis).toBe('falsche-person');
    expect(falsch.antwort).toEqual(episode1.vorwurf.antworten.falschePerson);
    // Alle drei Belege sind erkannt: keine neue Sperre, der Vorwurf bleibt aufholbar.
    expect(istGesperrt(falsch.zustand)).toBe(false);
    zustand = falsch.zustand;

    const richtig = pruefeVorwurf(episode1, zustand, {
      verdaechtigeId: 'timo',
      belegIds: ['rechte-zeile', 'log-zeile'],
    });
    expect(richtig.ergebnis).toBe('richtig');
    expect(richtig.antwort).toEqual(episode1.vorwurf.antworten.richtig);
    expect(richtig.zustand.geloest).toBe(true);
  }, 600_000);

  it('T9-6: Rechte-Zeile und Log-Zeile reichen für Timo, auch wenn der zweite Rechte-Schritt offen ist', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['rechte-zeile'][0].befehl);
    await alsAzubi(WEGE['log-zeile'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['log-zeile', 'rechte-zeile']);
    expect(zustand.erledigt).toEqual({ rechte: 1, log: 1 });
    const richtig = pruefeVorwurf(episode1, zustand, {
      verdaechtigeId: 'timo',
      belegIds: ['rechte-zeile', 'log-zeile'],
    });
    expect(richtig.ergebnis).toBe('richtig');
    expect(richtig.zustand.geloest).toBe(true);
    expect(richtig.zustand.erledigt).toEqual({ rechte: 1, log: 1 });
  }, 300_000);

  it('T9-8: wiederholtes Setup liefert denselben frischen Datensatz und lässt den Einsatzrahmen intakt', async () => {
    await frischerLauf();
    const quellen = [SUDOERS, STATUS, AUDIT];
    const rahmen = [T8_DROPIN, '/etc/sudoers', '/etc/sudoers.d/azubi'];
    const quellenVorher = await hashes(quellen, true);
    const passwdVorher = (await run('grep -E "^(timo|nadia|margit):" /etc/passwd /etc/shadow'))
      .output;
    const rahmenVorher = await hashes(rahmen);
    const nadiaVorher = await hashes(['/home/nadia/vertraulich.txt']);

    // Eigene Datei im Belegordner und alle drei Episoden-Belege vorhanden.
    await alsAzubi('echo bleibt > ~/belege/eigene-notiz.txt');
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    expect(await belegPruefung()).toEqual({
      'rechte-zeile': true,
      'rechte-metadaten': true,
      'log-zeile': true,
    });

    for (let i = 0; i < 2; i++) {
      const wieder = await setupEpisode();
      expect(wieder.exitCode, wieder.output).toBe(0);
      expect(await hashes(quellen, true)).toBe(quellenVorher);
      expect((await run('grep -E "^(timo|nadia|margit):" /etc/passwd /etc/shadow')).output).toBe(
        passwdVorher
      );
      expect(await hashes(rahmen)).toBe(rahmenVorher);
      expect(await hashes(['/home/nadia/vertraulich.txt'])).toBe(nadiaVorher);
      expect((await run(`ls -A ${BELEGE}`)).output.trim()).toBe('eigene-notiz.txt');
      expect(await belegPruefung()).toEqual(keinBeleg);
    }
    expect((await run('grep -c NOPASSWD ' + T8_DROPIN)).output.trim()).toBe('1');
    expect((await run(`grep -c '' ${SUDOERS}`)).output.trim()).toBe('2');
    await alsAzubi('rm -f ~/belege/eigene-notiz.txt');
  }, 600_000);

  it('T9-8: Verstoß gegen den Einsatzrahmen wird erkannt, sperrt den Vorwurf und lässt sich wieder aufholen', async () => {
    await frischerLauf();
    const direkt = await alsAzubi('cat /home/nadia/vertraulich.txt');
    expect(direkt.rc).not.toBe(0);
    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(false);

    const erlaubt = await alsAzubi(`sudo -n ${T8_BEFEHL}`);
    expect(erlaubt.rc, erlaubt.text).toBe(0);
    // Ein erneutes Episoden-Setup nach dem Verstoß lässt das Protokoll in Ruhe.
    const protokoll = (await run(`cat ${T8_LOG}`)).output;
    expect(protokoll).toContain(`COMMAND=${T8_BEFEHL}`);
    expect((await setupEpisode()).exitCode).toBe(0);
    expect((await run(`cat ${T8_LOG}`)).output).toBe(protokoll);

    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(true);
    expect(typen()).toContain('einsatzrahmen-verletzt');
    expect(istGesperrt(zustand)).toBe(true);
    const gesperrt = pruefeVorwurf(episode1, zustand, {
      verdaechtigeId: 'timo',
      belegIds: [],
    });
    expect(gesperrt.ergebnis).toBe('gesperrt');

    // Erholung: ein erkannter Beleg hebt die Sperre auf, ohne VM-Neustart.
    await alsAzubi(WEGE['log-zeile'][0].befehl);
    await pruefLauf();
    expect(typen()).toContain('sperre-aufgehoben');
    expect(istGesperrt(zustand)).toBe(false);
    await pruefLauf();
    expect(typen()).not.toContain('einsatzrahmen-verletzt');

    // Der Verstoß-Eintrag bleibt für den Rest dieser VM erhalten, die Folge erscheint nicht erneut.
    for (const id of ['rechte-zeile', 'rechte-metadaten'] as const) {
      await alsAzubi(WEGE[id][0].befehl);
    }
    await pruefLauf();
    expect(typen()).not.toContain('einsatzrahmen-verletzt');
  }, 600_000);

  it('T9-8 (Grenze): ein erneutes T8-Setup nach der Episode scheitert sichtbar und lässt Quellen unberührt', async () => {
    // Die absichtlich lesbare Regeldatei (0644) beanstandet `visudo -c` im T8-Setup; im Spiel
    // läuft die Setup-Folge nur einmal je frischer VM. Der Fehler darf nichts zerstören.
    await frischerLauf();
    const quellen = [SUDOERS, STATUS, AUDIT];
    const vorher = await hashes(quellen, true);
    const dropin = await hashes([T8_DROPIN]);
    const erneut = await run(einsatzrahmenSetupSkript());
    console.log(`T09-VM T8-Setup nach Episode: exit=${erneut.exitCode}`);
    expect(erneut.exitCode).not.toBe(0);
    expect(await hashes(quellen, true)).toBe(vorher);
    // Das T8-Setup stellt seinen alten Drop-in nach dem Fehler wieder her (Inhalt, Besitzer, Modus).
    expect(await hashes([T8_DROPIN])).toBe(dropin);
    expect((await run(`visudo -cf ${T8_DROPIN}`)).exitCode).toBe(0);
    // Ein Neustart der Folge mit frischer Regeldatei ist dagegen sauber möglich.
    await run(`rm -f ${SUDOERS}`);
    expect((await run(einsatzrahmenSetupSkript())).exitCode).toBe(0);
    expect((await setupEpisode()).exitCode).toBe(0);
  }, 300_000);

  it('T9-9: Raumansicht liefert echte Gastwerte, bleibt lesend und lässt das Lesemanifest unverändert', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['log-zeile'][0].befehl);
    const raum = episode1.ansichten.find((ansicht) => ansicht.art === 'raum');
    expect(raum).toBeDefined();
    const vorher = await manifest();
    expect(vorher.hash).toMatch(/^[0-9a-f]{64}$/);

    const hostname = (await run('hostname')).output.trim();
    const konten = (
      await run(`awk -F: '$3 >= 1000 && $3 < 60000 { print $1 ":" $3 ":" $5 }' /etc/passwd`)
    ).output
      .trim()
      .split('\n');
    for (let i = 0; i < 5; i++) {
      const roh = await client.run(abfrageSkript(raum!.abfrage), 20_000);
      expect(roh.exitCode).toBe(0);
      const gelesen = leseAbfrage(roh.output);
      expect(gelesen.vollstaendig).toBe(true);
      expect(gelesen.fehlerCode).toBeNull();
      expect(gelesen.werte.host).toEqual([hostname]);
      expect(hostname).toBe('rw-srv01');
      expect(gelesen.werte.konten).toEqual(
        konten.map((zeile) => {
          const [name, uid, klartext] = zeile.split(':');
          return `${name} (UID ${uid})${klartext ? `, ${klartext}` : ''}`;
        })
      );
      expect(gelesen.werte.konten).toEqual(
        expect.arrayContaining([
          'timo (UID 1101), Timo Kessler',
          'nadia (UID 1102), Nadia Brem',
          'margit (UID 1103), Margit Ostwind',
        ])
      );
      expect(gelesen.werte.laufzeit).toHaveLength(1);
      expect(gelesen.werte.laufzeit?.[0]).toMatch(/^Laufzeit seit Neustart: \d+ Std\. \d+ Min\.$/);
      // Keine Passwortfelder und keine Shadow-Daten in der Anzeige.
      expect(roh.output).not.toMatch(/:x:|:!:|\$\d\$|root:/);
      if (i === 0) console.log(`T09-VM Raum:\n${roh.output.trim()}`);

      const akte = await client.run(abfrageSkript(AKTENWAND_ABFRAGE), 20_000);
      const inhalt = leseAktenwand(leseAbfrage(akte.output));
      expect(inhalt.dateien.map((datei) => datei.name)).toEqual(['log-zeile.txt']);
    }
    const nachher = await manifest();
    expect(nachher).toEqual(vorher);
    console.log(`T09-VM manifest=${vorher.hash} anzahl=${vorher.anzahl}`);

    const shadow = await client.run(abfrageSkript('cat /etc/shadow'), 20_000);
    expect(leseAbfrage(shadow.output).fehlerCode).not.toBeNull();
    expect(shadow.output).not.toContain('root:');
  }, 900_000);
});
