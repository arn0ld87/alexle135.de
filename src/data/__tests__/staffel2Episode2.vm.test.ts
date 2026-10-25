// @vitest-environment node
// Episode 2 „Der Prozess, der nicht stirbt“ in der echten VM des Bildschirm-Images (v86 headless,
// Assets aus public/missions/linux/ und .../bildschirm/). Läuft nur mit MISSION_VM=1, auf gns3:
//   MISSION_VM=1 pnpm exec vitest run src/data/__tests__/staffel2Episode2.vm.test.ts
// Setup und Prüfungen laufen als root wie im Spiel; die Lösungswege laufen als `azubi`.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abfrageSkript, leseAbfrage } from '../../lib/missions/abfrage';
import { AgentClient } from '../../lib/missions/agentClient';
import { einsatzrahmenSetupSkript } from '../../lib/missions/einsatzrahmenSetup';
import {
  antwortSkript,
  buendelSkript,
  leseBuendelAusgabe,
  offenePruefungen,
  pruefeVorwurf,
  startZustand,
  wendeAntwortAn,
  wendePruefungAn,
} from '../../lib/missions/ermittlung';
import type { ErmittlungsEreignis, ErmittlungsZustand } from '../../lib/missions/ermittlungTypes';
import { rahmenSetupSkript } from '../../lib/missions/staffel2Rahmen';
import { LOESUNG } from '../staffeln/staffel-2/episode-1';
import { episode2 } from '../staffeln/staffel-2/episode-2';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = join(root, 'public/missions/linux');
const gui = join(assets, 'bildschirm');
const enabled = process.env.MISSION_VM === '1';

const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';

const CRONTAB = '/etc/crontabs/abgleich';
const JOURNAL = '/var/log/rechenwerk-wartung.log';
const SKRIPT = '/usr/local/sbin/rw-abgleich';
const ZETTEL = '/home/azubi/fotos/IMG_0417.png';
const T8_BEFEHL = '/bin/cat /home/nadia/vertraulich.txt';
const BELEGE = '/home/azubi/belege';

const BELEG_IDS = ['prozess-zeile', 'wartung-zeile'] as const;
type BelegId = (typeof BELEG_IDS)[number];

/** Der geprüfte Lösungsweg, den die dritte Tipp-Stufe nennt. */
const tippLoesung = (spurId: string, schrittId: string): string => {
  const schritt = episode2.spuren
    .find((spur) => spur.id === spurId)
    ?.schritte.find((eintrag) => eintrag.id === schrittId);
  const tipp = schritt?.tipps[2] ?? '';
  expect(tipp.startsWith(LOESUNG)).toBe(true);
  return tipp.slice(LOESUNG.length);
};

/** Gleichwertige Lösungswege je Beleg: jeder muss denselben gültigen Beleg erzeugen. */
const WEGE: Record<BelegId, { name: string; befehl: string }[]> = {
  'prozess-zeile': [
    { name: 'Tipp', befehl: tippLoesung('prozess', 'prozess-zeile') },
    { name: 'ps ganz', befehl: 'ps > ~/belege/prozess-zeile.txt' },
    {
      name: 'zwei grep',
      befehl: `{ ps | grep abgleich; ps | grep crond; } > ~/belege/prozess-zeile.txt`,
    },
    {
      name: 'ps -o plus grep -e',
      befehl: `ps -o pid,ppid,user,comm,args | grep -e rw-abgleich -e crond > ~/belege/prozess-zeile.txt`,
    },
  ],
  'wartung-zeile': [
    { name: 'Tipp', befehl: tippLoesung('zettel', 'wartung-zeile') },
    {
      name: 'grep nadia edit',
      befehl: `grep nadia ${JOURNAL} | grep edit-cron > ~/belege/wartung-zeile.txt`,
    },
    { name: 'awk', befehl: `awk '/RW-2122/' ${JOURNAL} > ~/belege/wartung-zeile.txt` },
    {
      name: 'grep -n plus Login',
      befehl: `grep -n -e RW-2122 -e login ${JOURNAL} > ~/belege/wartung-zeile.txt`,
    },
  ],
};

describe.skipIf(!enabled)('Episode 2 „Der Prozess, der nicht stirbt“ in der echten VM', () => {
  let emulator: {
    destroy(): Promise<void> | void;
    serial_send_bytes(n: number, d: Uint8Array): void;
  };
  let client: AgentClient;

  const run = async (script: string, ms = 55_000) => client.run(`cd /home/azubi\n${script}`, ms);
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
    const einsatz = await run(einsatzrahmenSetupSkript(episode2.einsatzrahmen.sudoBefehle));
    expect(einsatz.exitCode, einsatz.output).toBe(0);
    const episode = await run(episode2.setup);
    expect(episode.exitCode, episode.output).toBe(0);
  };
  const setupEpisode = () => run(episode2.setup);

  const belegPruefung = async (): Promise<Record<BelegId, boolean>> => {
    const buendel = buendelSkript(
      episode2.vorwurf.belege.map((beleg) => ({ id: `b.${beleg.id}`, skript: beleg.verify }))
    );
    const ausgabe = leseBuendelAusgabe((await run(buendel)).output);
    expect(ausgabe.vollstaendig).toBe(true);
    return Object.fromEntries(
      BELEG_IDS.map((id) => [id, ausgabe.ergebnisse[`b.${id}`] === true])
    ) as Record<BelegId, boolean>;
  };
  const nurBeleg = (id: BelegId): Record<BelegId, boolean> => ({
    'prozess-zeile': id === 'prozess-zeile',
    'wartung-zeile': id === 'wartung-zeile',
  });
  const keinBeleg: Record<BelegId, boolean> = { 'prozess-zeile': false, 'wartung-zeile': false };

  const eingriff = episode2.spuren[0].schritte[1];
  const eingriffOk = async () => (await run(eingriff.verify)).exitCode === 0;
  const diagnoseText = async (diagnose: string) => (await run(diagnose)).output.trim();
  const laeuft = async () => (await run('pgrep -x rw-abgleich >/dev/null')).exitCode === 0;
  /** Wartet in Gast-Läufen unter dem Agenten-Limit, bis der Prozess läuft (oder nicht mehr). */
  const warteAuf = async (soll: boolean, gesamtSekunden: number) => {
    for (let t = 0; t < gesamtSekunden; t += 40) {
      const r = await run(
        `for i in $(seq 40); do pgrep -x rw-abgleich >/dev/null; [ $? = ${soll ? 0 : 1} ] && exit 0; sleep 1; done; exit 1`
      );
      if (r.exitCode === 0) return true;
    }
    return false;
  };

  // Ein vollständiger Prüflauf wie im Spiel: Bündel in der VM, Ergebnis in die Engine.
  let zustand: ErmittlungsZustand = startZustand();
  let ereignisse: ErmittlungsEreignis[] = [];
  const pruefLauf = async () => {
    const buendel = buendelSkript(offenePruefungen(episode2, zustand));
    const antwort = await run(buendel);
    const neu = wendePruefungAn(episode2, zustand, leseBuendelAusgabe(antwort.output));
    zustand = neu.zustand;
    ereignisse = neu.ereignisse;
    return neu;
  };
  const frischerLauf = async () => {
    await setupAlles();
    zustand = startZustand();
    ereignisse = [];
  };
  const typen = () => ereignisse.map((e) => e.type);

  const antwort = async (text: string) => {
    const spur = episode2.spuren[1];
    const schritt = spur.schritte[0];
    const res = await run(antwortSkript(schritt.antwort!.pruefung, text), 10_000);
    return res.exitCode === 0;
  };

  beforeAll(async () => {
    if (!existsSync(join(gui, 'alpine-state.bin.zst'))) {
      throw new Error(`Bildschirm-Assets fehlen unter ${gui} (scripts/mission-image-gui/build.sh)`);
    }
    const { V86 } = await import('v86');
    const encoder = new TextEncoder();
    emulator = new V86({
      wasm_path: fileURLToPath(import.meta.resolve('v86/build/v86.wasm')),
      bios: { url: join(assets, 'seabios.bin') },
      vga_bios: { url: join(assets, 'vgabios.bin') },
      memory_size: 512 * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      autostart: true,
      uart1: true,
      bzimage_initrd_from_filesystem: true,
      cmdline: CMDLINE,
      filesystem: {
        baseurl: join(assets, 'alpine-rootfs-flat'),
        basefs: join(gui, 'alpine-fs.json'),
      },
      initial_state: { url: join(gui, 'alpine-state.bin.zst') },
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

  it('Setup: Wiedergänger läuft als Dienstkonto, Cron-Zeile, Journal und Quellen mit Soll-Rechten', async () => {
    const rechte = await run(`stat -c '%n %U:%G %a %y' ${CRONTAB} ${JOURNAL} ${SKRIPT} ${ZETTEL}`);
    console.log(`E2-VM Quellen:\n${rechte.output.trim()}`);
    expect(rechte.output.trim().split('\n')).toEqual([
      `${CRONTAB} root:root 600 2026-04-21 00:00:00.000000000 +0000`,
      `${JOURNAL} root:root 644 2026-04-20 10:05:00.000000000 +0000`,
      `${SKRIPT} root:root 755 ${(await run(`stat -c %y ${SKRIPT}`)).output.trim()}`,
      expect.stringMatching(new RegExp(`^${ZETTEL} azubi:azubi 644 `)),
    ]);
    const prozess = await run(`ps -o user,args | grep '[r]w-abgleich'`);
    expect(prozess.output).toMatch(
      /^abgleich\s+\{rw-abgleich\} \/bin\/sh \/usr\/local\/sbin\/rw-abgleich/m
    );
    expect((await run('pgrep -x crond')).exitCode).toBe(0);
    expect((await run(`cat ${CRONTAB}`)).output.trim()).toBe(
      '* * * * * [ -e /etc/crontabs/abgleich ] && ! pgrep -x rw-abgleich >/dev/null && /usr/local/sbin/rw-abgleich'
    );
    const konten = await run(
      `for u in timo nadia margit abgleich; do grep "^$u:" /etc/passwd | cut -d: -f1,3,5,7; grep "^$u:" /etc/shadow | cut -d: -f1,2; done`
    );
    expect(konten.output.trim().split('\n')).toEqual([
      'timo:1101:Timo Kessler:/sbin/nologin',
      'timo:!',
      'nadia:1102:Nadia Brem:/sbin/nologin',
      'nadia:!',
      'margit:1103:Margit Ostwind:/sbin/nologin',
      'margit:!',
      'abgleich:1105:Abgleich-Dienst:/sbin/nologin',
      'abgleich:!',
    ]);
    expect((await run('visudo -c')).exitCode).toBe(0);
  }, 180_000);

  it('Bildbeleg: nur Pixel, Text nirgends im Gast, für azubi lesbar, neutraler Name', async () => {
    const datei = await run(`file ${ZETTEL}`);
    expect(datei.output).toContain('PNG image data');
    // Nur Bildaufbau-Chunks, keine Textebene.
    const chunks = await run(
      `grep -c -a -e tEXt -e zTXt -e iTXt -e eXIf ${ZETTEL}; strings ${ZETTEL} | grep -c -e Wartung -e RW-2122 -e Wächter`
    );
    expect(chunks.output.trim().split('\n')).toEqual(['0', '0']);
    // Weder Wortlaut noch Kennung stehen als Text in Dateien außerhalb des Journals.
    const treffer = await run(
      `grep -rIl -e 'Wächter-Zeile' -e 'NICHT löschen' /home /etc /root /var /usr/local /opt /srv /tmp /mnt 2>/dev/null; echo ende`
    );
    expect(treffer.output.trim()).toBe('ende');
    const kennung = await run(
      `grep -rIl 'RW-2122' /home /etc /root /var /usr/local /opt /srv /tmp /mnt 2>/dev/null | sort`
    );
    expect(kennung.output.trim()).toBe(JOURNAL);
    // azubi öffnet die Datei lesend (feh läuft als azubi).
    const lesen = await alsAzubi(
      `head -c 8 ${ZETTEL} | od -An -c | head -1; feh --version | head -1`
    );
    expect(lesen.rc).toBe(0);
    expect(lesen.text).toContain('P   N   G');
  }, 180_000);

  it('Ausgangszustand ist ungelöst: alle Schritt-, Beleg- und Verstoßprüfungen negativ', async () => {
    await frischBelege();
    expect(await belegPruefung()).toEqual(keinBeleg);
    expect(await eingriffOk()).toBe(false);
    const buendel = buendelSkript(offenePruefungen(episode2, startZustand()));
    const ausgabe = leseBuendelAusgabe((await run(buendel)).output);
    expect(ausgabe.vollstaendig).toBe(true);
    expect(Object.values(ausgabe.ergebnisse).every((ok) => ok === false)).toBe(true);
    expect((await run(episode2.einsatzrahmen.verstoss)).exitCode).not.toBe(0);
  }, 120_000);

  it('sudo: genau die genannten Befehle, alles andere scheitert', async () => {
    const liste = await alsAzubi('sudo -n -l');
    console.log(`E2-VM sudo -l als azubi:\n${liste.text}`);
    expect(liste.text).not.toMatch(/NOPASSWD: ALL|\(ALL(:ALL)?\) (NOPASSWD: )?ALL/);
    const flach = liste.text.replace(/\s+/g, ' ');
    expect(flach).toContain('/usr/bin/crontab -u abgleich -r');
    expect(flach).toContain('/usr/bin/pkill -x rw-abgleich');
    expect(flach).toContain(T8_BEFEHL);
    expect((await alsAzubi('sudo -n crontab -u abgleich -l')).rc).toBe(0);
    expect((await alsAzubi('sudo -n crontab -u abgleich -l')).text).toContain('rw-abgleich');
    for (const versuch of [
      'sudo -n crontab -u root -l',
      'sudo -n crontab -u root -r',
      'sudo -n crontab -u abgleich -e',
      'sudo -n crontab -u abgleich /tmp/probe.sh',
      'sudo -n pkill -x crond',
      'sudo -n pkill -9 -x rw-abgleich',
      'sudo -n pkill -u root',
      'sudo -n kill 1',
      'sudo -n /etc/init.d/crond stop',
      'sudo -n /bin/sh -c id',
      `sudo -n tee ${CRONTAB}`,
    ]) {
      expect((await alsAzubi(versuch)).rc, versuch).not.toBe(0);
    }
    // Ohne sudo kann azubi weder die Cron-Liste sehen noch den Prozess beenden.
    expect((await alsAzubi(`cat ${CRONTAB}`)).rc).not.toBe(0);
    await alsAzubi('pkill -x rw-abgleich');
    expect(await laeuft()).toBe(true);
    expect((await run(episode2.einsatzrahmen.verstoss)).exitCode).not.toBe(0);
  }, 240_000);

  for (const id of BELEG_IDS) {
    it(`verschiedene Terminal-Lösungswege erzeugen denselben gültigen Beleg ${id}`, async () => {
      for (const weg of WEGE[id]) {
        await frischBelege();
        const ergebnis = await alsAzubi(weg.befehl);
        expect(ergebnis.rc, `${weg.name}: ${weg.befehl}\n${ergebnis.text}`).toBe(0);
        expect(await belegPruefung(), `${weg.name}: ${weg.befehl}`).toEqual(nurBeleg(id));
      }
    }, 300_000);
  }

  it('leere, falsche, teilweise, fremde und als Symlink angelegte Belege sind negativ', async () => {
    const faelle: { id: BelegId; name: string; befehl: string; asRoot?: boolean }[] = [
      { id: 'prozess-zeile', name: 'leer', befehl: ': > ~/belege/prozess-zeile.txt' },
      {
        id: 'prozess-zeile',
        name: 'nur Name',
        befehl: 'echo rw-abgleich crond > ~/belege/prozess-zeile.txt',
      },
      {
        id: 'prozess-zeile',
        name: 'nur der Prozess',
        befehl: 'ps | grep rw-abgleich > ~/belege/prozess-zeile.txt',
      },
      {
        id: 'prozess-zeile',
        name: 'nur crond',
        befehl: 'ps | grep crond > ~/belege/prozess-zeile.txt',
      },
      {
        id: 'prozess-zeile',
        name: 'abgetippt',
        befehl: `printf '%s\\n' 'abgleich rw-abgleich' 'root crond' > ~/belege/prozess-zeile.txt`,
      },
      {
        id: 'prozess-zeile',
        name: 'Symlink auf gültigen Inhalt',
        befehl: 'ps > ~/gut.txt; ln -s ~/gut.txt ~/belege/prozess-zeile.txt',
      },
      {
        id: 'prozess-zeile',
        name: 'fremde Datei (root)',
        befehl: 'ps > ~/belege/prozess-zeile.txt && chown root:root ~/belege/prozess-zeile.txt',
        asRoot: true,
      },
      { id: 'wartung-zeile', name: 'leer', befehl: ': > ~/belege/wartung-zeile.txt' },
      {
        id: 'wartung-zeile',
        name: 'nur der Name',
        befehl: 'echo nadia > ~/belege/wartung-zeile.txt',
      },
      {
        id: 'wartung-zeile',
        name: 'das ganze Journal',
        befehl: `cat ${JOURNAL} > ~/belege/wartung-zeile.txt`,
      },
      {
        id: 'wartung-zeile',
        name: 'Zeile von Timo',
        befehl: `grep RW-2117 ${JOURNAL} > ~/belege/wartung-zeile.txt`,
      },
      {
        id: 'wartung-zeile',
        name: 'Zeile von Margit',
        befehl: `grep RW-2129 ${JOURNAL} > ~/belege/wartung-zeile.txt`,
      },
      {
        id: 'wartung-zeile',
        name: 'richtige Zeile plus eine andere Cron-Änderung',
        befehl: `grep -e RW-2122 -e RW-2124 ${JOURNAL} > ~/belege/wartung-zeile.txt`,
      },
      {
        id: 'wartung-zeile',
        name: 'erfundene Zeile',
        befehl: `echo '2026-04-20T08:47:52Z nadia edit-cron change=RW-2122 target=/etc/crontabs/root' > ~/belege/wartung-zeile.txt`,
      },
      {
        id: 'wartung-zeile',
        name: 'Symlink auf das Journal',
        befehl: `ln -s ${JOURNAL} ~/belege/wartung-zeile.txt`,
      },
      {
        id: 'wartung-zeile',
        name: 'fremde Datei (root)',
        befehl: `grep RW-2122 ${JOURNAL} > ~/belege/wartung-zeile.txt && chown root:root ~/belege/wartung-zeile.txt`,
        asRoot: true,
      },
    ];
    for (const fall of faelle) {
      await frischBelege();
      await run('rm -f /home/azubi/gut.txt');
      const ergebnis = fall.asRoot
        ? await run(fall.befehl.replaceAll('~', '/home/azubi'))
        : await alsAzubi(fall.befehl);
      const rc = 'exitCode' in ergebnis ? ergebnis.exitCode : ergebnis.rc;
      expect(rc, `${fall.id} ${fall.name}`).toBe(0);
      expect((await belegPruefung())[fall.id], `${fall.id}: ${fall.name}`).toBe(false);
    }
    await run('rm -f /home/azubi/gut.txt');
  }, 900_000);

  it('Antwort: nur die Kennung vom Zettel zählt, auch in anderer Schreibweise', async () => {
    for (const richtig of [
      'RW-2122',
      'rw-2122',
      ' RW-2122 ',
      '2122',
      'RW 2122'.replace(' ', '-'),
    ]) {
      expect(await antwort(richtig), richtig).toBe(true);
    }
    for (const falsch of ['RW-2117', 'RW-2124', 'RW-2129', 'RW-2130', '2122x', 'nadia', 'RW-']) {
      expect(await antwort(falsch), falsch).toBe(false);
    }
    const neu = wendeAntwortAn(episode2, startZustand(), 'zettel', 'kennung', true);
    expect(neu.zustand.erledigt).toEqual({ zettel: 1 });
  }, 240_000);

  it('Diagnosen: Beleg fehlt Teile, falsche Zeile, mehrere Cron-Änderungen; erledigen nichts', async () => {
    await frischerLauf();
    const schrittProzess = episode2.spuren[0].schritte[0];
    const schrittWartung = episode2.spuren[1].schritte[1];
    await alsAzubi('ps | grep rw-abgleich > ~/belege/prozess-zeile.txt');
    expect(await diagnoseText(schrittProzess.diagnose!)).toContain('fehlt die Zeile von crond');
    await alsAzubi('ps | grep crond > ~/belege/prozess-zeile.txt');
    expect(await diagnoseText(schrittProzess.diagnose!)).toContain(
      'fehlt die Zeile von rw-abgleich'
    );
    await alsAzubi('echo hallo > ~/belege/prozess-zeile.txt');
    expect(await diagnoseText(schrittProzess.diagnose!)).toContain(
      'fehlen die Zeile von rw-abgleich und'
    );

    await alsAzubi(`grep RW-2117 ${JOURNAL} > ~/belege/wartung-zeile.txt`);
    expect(await diagnoseText(schrittWartung.diagnose!)).toContain('anderen Änderung');
    await alsAzubi(`grep edit-cron ${JOURNAL} > ~/belege/wartung-zeile.txt`);
    expect(await diagnoseText(schrittWartung.diagnose!)).toContain('mehrere Cron-Änderungen');
    await alsAzubi('echo hallo > ~/belege/wartung-zeile.txt');
    expect(await diagnoseText(schrittWartung.diagnose!)).toContain('fehlt die Journalzeile');
    await alsAzubi(tippLoesung('zettel', 'wartung-zeile'));
    expect(await diagnoseText(schrittWartung.diagnose!)).toBe('');
    expect(await laeuft()).toBe(true);
  }, 300_000);

  it('typischer Fehler: nur beenden reicht nicht, der Cron holt den Wiedergänger zurück', async () => {
    await frischerLauf();
    expect((await alsAzubi('sudo pkill -x rw-abgleich')).rc).toBe(0);
    expect(await warteAuf(false, 10)).toBe(true);
    // Die Prüfung ist negativ, und die Diagnose nennt die Ursache (Prozess weg, Cron-Zeile da).
    expect(await eingriffOk()).toBe(false);
    expect(await diagnoseText(eingriff.diagnose!)).toContain(
      'Cron-Eintrag startet ihn gleich wieder'
    );
    const schnell = await pruefLauf();
    expect(schnell.zustand.erledigt).toEqual({});
    // Nach einem Cron-Takt (höchstens eine Minute) ist er wirklich wieder da.
    expect(await warteAuf(true, 120)).toBe(true);
    expect(await eingriffOk()).toBe(false);
  }, 400_000);

  it('typischer Fehler: nur der Cron-Eintrag weg, der Prozess läuft noch', async () => {
    await frischerLauf();
    expect((await alsAzubi('sudo crontab -u abgleich -r')).rc).toBe(0);
    expect(await laeuft()).toBe(true);
    expect(await eingriffOk()).toBe(false);
    expect(await diagnoseText(eingriff.diagnose!)).toContain('Prozess läuft noch');
    expect((await alsAzubi('sudo pkill -u abgleich')).rc).toBe(0);
    expect(await eingriffOk()).toBe(true);
  }, 300_000);

  it('Eingreifen: zwei Wege führen zum Zustand, und nach einem Cron-Takt kommt nichts wieder', async () => {
    const wege = [
      tippLoesung('prozess', 'wiedergaenger'),
      'sudo crontab -u abgleich -r; sudo pkill -u abgleich',
    ];
    for (const weg of wege) {
      await frischerLauf();
      expect(await eingriffOk()).toBe(false);
      const ergebnis = await alsAzubi(weg);
      expect(ergebnis.rc, `${weg}\n${ergebnis.text}`).toBe(0);
      const ok = await eingriffOk();
      const lage = ok
        ? ''
        : (await run("ps | grep -E 'abgleich|crond'; ls -l /etc/crontabs; date")).output;
      expect(ok, `${weg}\n${lage}`).toBe(true);
    }
    // Der letzte Weg bleibt stehen: zwei volle Minuten bleibt der Prozess weg.
    const wiedergekehrt = await warteAuf(true, 80);
    const lage = wiedergekehrt
      ? (await run("ps -o pid,ppid,user,comm,args | grep -E 'abgleich|crond|sh -c'; ls -l /etc/crontabs; grep cron /var/log/messages | tail -8; date")).output
      : '';
    expect(wiedergekehrt, lage).toBe(false);
    expect(await eingriffOk()).toBe(true);
  }, 600_000);

  it('Spuren in freier Reihenfolge, Linearität je Spur, alle Arten laufen durch die Engine', async () => {
    await frischerLauf();
    // Zettel-Spur zuerst: Ablesen per Antwort, dann Journalzeile.
    expect(await antwort('RW-2122')).toBe(true);
    const a = wendeAntwortAn(episode2, zustand, 'zettel', 'kennung', true);
    zustand = a.zustand;
    expect(zustand.erledigt).toEqual({ zettel: 1 });
    await alsAzubi(tippLoesung('zettel', 'wartung-zeile'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ zettel: 2 });
    expect(zustand.belegeErkannt).toEqual(['wartung-zeile']);
    expect(typen()).toEqual(expect.arrayContaining(['schritt-erledigt', 'spur-erledigt']));

    // Eingriff vor dem Beleg: Schritt 1 der Prozess-Spur bleibt offen, kein Fortschritt.
    await alsAzubi(tippLoesung('prozess', 'wiedergaenger'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ zettel: 2 });

    // Neustart der Episode stellt den Wiedergänger wieder her (und räumt ihre Belege ab).
    await setupEpisode();
    await alsAzubi(tippLoesung('zettel', 'wartung-zeile'));
    await alsAzubi(tippLoesung('prozess', 'prozess-zeile'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ zettel: 2, prozess: 1 });
    expect(zustand.belegeErkannt).toEqual(['prozess-zeile', 'wartung-zeile']);
    await alsAzubi(tippLoesung('prozess', 'wiedergaenger'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ zettel: 2, prozess: 2 });

    // Die Belege bleiben auch nach dem Eingriff gültig.
    expect(await belegPruefung()).toEqual({ 'prozess-zeile': true, 'wartung-zeile': true });
  }, 600_000);

  it('Vorwurf: falsche Person, zu wenige Belege, Sperre und Aufholen, dann richtig', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['prozess-zeile'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['prozess-zeile']);

    const zuWenig = pruefeVorwurf(episode2, zustand, {
      verdaechtigeId: 'nadia',
      belegIds: ['prozess-zeile'],
    });
    expect(zuWenig.ergebnis).toBe('zu-wenig-belege');
    expect(zuWenig.antwort).toEqual(episode2.vorwurf.antworten.zuWenigBelege);
    zustand = zuWenig.zustand;

    await alsAzubi(WEGE['wartung-zeile'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['prozess-zeile', 'wartung-zeile']);

    // Timo hat am häufigsten am Cron gearbeitet, aber die Belege sprechen nicht gegen ihn.
    for (const falsch of ['timo', 'margit']) {
      const f = pruefeVorwurf(episode2, zustand, {
        verdaechtigeId: falsch,
        belegIds: ['prozess-zeile', 'wartung-zeile'],
      });
      expect(f.ergebnis, falsch).toBe('falsche-person');
      expect(f.antwort).toEqual(episode2.vorwurf.antworten.falschePerson);
      zustand = f.zustand;
    }
    // Der Vorwurf stimmt, aber die Spuren sind offen: Der Fall schließt noch nicht.
    const offen = pruefeVorwurf(episode2, zustand, {
      verdaechtigeId: 'nadia',
      belegIds: ['prozess-zeile', 'wartung-zeile'],
    });
    expect(offen.ergebnis).toBe('richtig-offen');
    expect(offen.zustand.geloest).toBe(false);
    expect(offen.zustand.vorwurfRichtig).toBe(true);
    expect(offen.antwort.join(' ')).toContain('Der Vorwurf sitzt.');
    zustand = offen.zustand;

    // Die Schritte nacheinander erledigen; der letzte schließt den Fall.
    expect(await antwort('RW-2122')).toBe(true);
    zustand = wendeAntwortAn(episode2, zustand, 'zettel', 'kennung', true).zustand;
    await pruefLauf();
    expect(zustand.geloest).toBe(false);
    await alsAzubi(tippLoesung('prozess', 'wiedergaenger'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ prozess: 2, zettel: 2 });
    expect(zustand.geloest).toBe(true);
    expect(typen()).toContain('fall-geloest');
  }, 400_000);

  it('Beleg verloren: ein gelöschter oder geleerter Beleg wird erkannt', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['wartung-zeile'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['wartung-zeile']);
    await alsAzubi('rm ~/belege/wartung-zeile.txt');
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual([]);
    expect(ereignisse.filter((e) => e.type === 'beleg-verloren')).toEqual([
      { type: 'beleg-verloren', belegId: 'wartung-zeile' },
    ]);
  }, 300_000);

  it('Einsatzrahmen: Zugriff auf /home/nadia wird erkannt, sperrt und lässt sich aufholen', async () => {
    await frischerLauf();
    expect((await alsAzubi('cat /home/nadia/vertraulich.txt')).rc).not.toBe(0);
    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(false);
    expect((await alsAzubi(`sudo -n ${T8_BEFEHL}`)).rc).toBe(0);
    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(true);
    expect(typen()).toContain('einsatzrahmen-verletzt');
    // Die erlaubten Episoden-Befehle verletzen den Rahmen nicht.
    await frischerLauf();
    await alsAzubi(
      'sudo crontab -u abgleich -l; sudo pkill -x rw-abgleich; sudo crontab -u abgleich -r'
    );
    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(false);
  }, 400_000);

  it('Setup wiederholt: gleicher frischer Zustand, eigene Belege bleiben, Fremdes unberührt', async () => {
    await frischerLauf();
    const fremd = async () =>
      (
        await run(
          `sha256sum /etc/passwd /etc/sudoers /etc/sudoers.d/azubi /home/nadia/vertraulich.txt`
        )
      ).output;
    await alsAzubi('echo bleibt > ~/belege/eigene-notiz.txt');
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    await alsAzubi(tippLoesung('prozess', 'wiedergaenger'));
    expect(await eingriffOk()).toBe(true);
    const vorher = (await fremd())
      .split('\n')
      .filter((z) => !z.includes('/etc/passwd'))
      .join('\n');
    const passwdVorher = (await run('grep -E "^(timo|nadia|margit|abgleich):" /etc/passwd')).output;
    for (let i = 0; i < 2; i++) {
      const wieder = await setupEpisode();
      expect(wieder.exitCode, wieder.output).toBe(0);
      expect(await laeuft()).toBe(true);
      expect(await eingriffOk()).toBe(false);
      expect((await run(`ls -A ${BELEGE}`)).output.trim()).toBe('eigene-notiz.txt');
      expect(await belegPruefung()).toEqual(keinBeleg);
      expect((await run('grep -E "^(timo|nadia|margit|abgleich):" /etc/passwd')).output).toBe(
        passwdVorher
      );
      expect(
        (await fremd())
          .split('\n')
          .filter((z) => !z.includes('/etc/passwd'))
          .join('\n')
      ).toBe(vorher);
      expect((await run(`grep -c edit-cron ${JOURNAL}`)).output.trim()).toBe('4');
      expect((await run(`pgrep -x rw-abgleich | wc -l`)).output.trim()).toBe('1');
    }
    await alsAzubi('rm -f ~/belege/eigene-notiz.txt');
  }, 600_000);

  it('Raumansicht liefert echte Gastwerte, bleibt lesend, Aktenwand zeigt die Belege', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['wartung-zeile'][0].befehl);
    const raum = episode2.ansichten.find((ansicht) => ansicht.art === 'raum');
    expect(raum).toBeDefined();
    const roh = await client.run(abfrageSkript(raum!.abfrage), 20_000);
    expect(roh.exitCode).toBe(0);
    const gelesen = leseAbfrage(roh.output);
    expect(gelesen.vollstaendig).toBe(true);
    expect(gelesen.werte.host).toEqual(['rw-srv01']);
    expect(gelesen.werte.konten).toEqual(
      expect.arrayContaining([
        'timo (UID 1101), Timo Kessler',
        'nadia (UID 1102), Nadia Brem',
        'margit (UID 1103), Margit Ostwind',
        'abgleich (UID 1105), Abgleich-Dienst',
      ])
    );
    expect(roh.output).not.toMatch(/:x:|:!:|\$\d\$|root:/);
    const akte = await client.run(abfrageSkript(episode2.ansichten[1].abfrage), 20_000);
    expect(akte.exitCode).toBe(0);
    expect(akte.output).toContain(Buffer.from('wartung-zeile.txt').toString('base64'));
  }, 300_000);
});
