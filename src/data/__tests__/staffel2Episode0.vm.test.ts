// @vitest-environment node
// Episode 0 „Probelauf“ in der echten VM (v86 headless, Assets aus public/missions/linux/).
// Läuft nur mit MISSION_VM=1, auf gns3 bzw. in einer Umgebung mit gebauten Assets:
//   MISSION_VM=1 pnpm exec vitest run src/data/__tests__/staffel2Episode0.vm.test.ts
// Setup, Prüfungen und Diagnosen laufen als root wie im Spiel; die Lösungswege laufen als `azubi`.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentClient } from '../../lib/missions/agentClient';
import { einsatzrahmenSetupSkript } from '../../lib/missions/einsatzrahmenSetup';
import {
  antwortSkript,
  buendelSkript,
  istGesperrt,
  leseBuendelAusgabe,
  offenePruefungen,
  pruefeVorwurf,
  startZustand,
  wendeAntwortAn,
  wendePruefungAn,
} from '../../lib/missions/ermittlung';
import type { ErmittlungsEreignis, ErmittlungsZustand } from '../../lib/missions/ermittlungTypes';
import { rahmenSetupSkript } from '../../lib/missions/staffel2Rahmen';
import { episode0 } from '../staffeln/staffel-2/episode-0';
import { LOESUNG } from '../staffeln/staffel-2/episode-1';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = join(root, 'public/missions/linux');
const enabled = process.env.MISSION_VM === '1';

const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';

const BELEGE = '/home/azubi/belege';
const UEBUNG = '/srv/rechenwerk/uebung';
const LISTE = `${UEBUNG}/kaffeekasse.csv`;
const SICHERUNG = `${UEBUNG}/kaffeekasse.bak`;

const BELEG_IDS = ['kasse-meta', 'kasse-zeilen'] as const;
type BelegId = (typeof BELEG_IDS)[number];

const MELDUNG = {
  bakFehlt: 'In deinem Beleg fehlt noch kaffeekasse.bak. Beide Dateien gehören in denselben Beleg.',
  csvFehlt: 'In deinem Beleg fehlt noch kaffeekasse.csv. Beide Dateien gehören in denselben Beleg.',
  abgetippt: 'Der Beleg sieht abgetippt aus. Leite die echte Ausgabe von ls -l um.',
  sicherungFehlt:
    'Es fehlt noch die Zeile aus der Sicherung. Mit >> hängst du an, statt zu überschreiben.',
  listeFehlt:
    'Es fehlt noch die geänderte Zeile aus der Liste. Mit >> hängst du an, statt zu überschreiben.',
  schonRepariert:
    'Die Liste ist schon repariert, die geänderte Zeile steht nicht mehr darin. Lade die Seite neu und sichere vor dem Reparieren.',
  betragNoch: 'Der falsche Betrag steht noch in der Liste. Der richtige steht in der Sicherung.',
  leer: 'Die Liste ist leer. Hol den Inhalt der Sicherung zurück in die Liste.',
  laenger:
    'Die Liste ist jetzt länger als die Sicherung. Hänge nichts an, ersetze den ganzen Inhalt.',
  kuerzer: 'In der Liste fehlen Zeilen. Sie soll wieder genau so aussehen wie die Sicherung.',
  weicht:
    'Die Liste weicht noch von der Sicherung ab. Sie muss genau so aussehen wie die Sicherung.',
} as const;

/** Der geprüfte Lösungsweg, den die dritte Tipp-Stufe nennt. */
const tippLoesung = (spurId: string, schrittId: string): string => {
  const schritt = episode0.spuren
    .find((spur) => spur.id === spurId)
    ?.schritte.find((eintrag) => eintrag.id === schrittId);
  const tipp = schritt?.tipps[2] ?? '';
  expect(tipp.startsWith(LOESUNG)).toBe(true);
  return tipp.slice(LOESUNG.length);
};

/** Gleichwertige Wege, die Liste aus der Sicherung wiederherzustellen; jeder muss den Schritt lösen. */
const WEGE_ZURUECK: { name: string; befehl: string }[] = [
  { name: 'Tipp', befehl: tippLoesung('inhalt', 'kasse-zurueck') },
  { name: 'cat umleiten', befehl: `cat ${SICHERUNG} > ${LISTE}` },
  { name: 'tee', befehl: `tee ${LISTE} < ${SICHERUNG} > /dev/null` },
  {
    name: 'sed über eine Zwischendatei',
    befehl: `sed 's/0.50/2.50/' ${LISTE} > ~/neu.csv && cat ~/neu.csv > ${LISTE}`,
  },
  {
    name: 'Zeilen von Hand',
    befehl: `{ echo datum,name,betrag; echo 2026-04-13,Timo,5.00; echo 2026-04-14,Nadia,5.00; echo 2026-04-15,Timo,2.50; echo 2026-04-16,Nadia,7.00; echo 2026-04-17,Timo,3.50; } > ${LISTE}`,
  },
  { name: 'cp mit -f', befehl: `cp -f ${SICHERUNG} ${LISTE}` },
];

/** Gleichwertige Lösungswege je Beleg: jeder muss denselben gültigen Beleg erzeugen. */
const WEGE: Record<BelegId, { name: string; befehl: string; rcEgal?: boolean }[]> = {
  'kasse-meta': [
    { name: 'Tipp', befehl: tippLoesung('akte', 'kasse-meta') },
    { name: 'ls -l mit Pfad', befehl: `ls -l ${LISTE} ${SICHERUNG} > ~/belege/kasse-meta.txt` },
    { name: 'stat', befehl: `stat ${LISTE} ${SICHERUNG} > ~/belege/kasse-meta.txt` },
    {
      name: 'ls -l nacheinander',
      befehl: `{ ls -l --full-time ${LISTE}; ls -l ${SICHERUNG}; } > ~/belege/kasse-meta.txt`,
    },
    {
      name: 'ls -l aus dem Ordner',
      befehl: `cd /srv/rechenwerk/uebung && ls -l kaffeekasse.csv kaffeekasse.bak > ~/belege/kasse-meta.txt`,
    },
  ],
  'kasse-zeilen': [
    { name: 'Tipp', befehl: tippLoesung('inhalt', 'kasse-zeilen') },
    {
      name: 'grep nach Betrag',
      befehl: `{ grep 0.50 ${LISTE}; grep 2.50 ${SICHERUNG}; } > ~/belege/kasse-zeilen.txt`,
    },
    {
      name: 'cat beider Dateien',
      befehl: `cat ${LISTE} ${SICHERUNG} > ~/belege/kasse-zeilen.txt`,
    },
    {
      name: 'diff',
      befehl: `diff ${LISTE} ${SICHERUNG} > ~/belege/kasse-zeilen.txt`,
      // diff endet bei Unterschieden mit 1; der Beleg ist trotzdem vollständig.
      rcEgal: true,
    },
  ],
};

describe.skipIf(!enabled)('Episode 0 „Probelauf“ in der echten VM', () => {
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
    const episode = await run(episode0.setup);
    expect(episode.exitCode, episode.output).toBe(0);
  };
  const setupEpisode = () => run(episode0.setup);

  const belegPruefung = async (): Promise<Record<BelegId, boolean>> => {
    const buendel = buendelSkript(
      episode0.vorwurf.belege.map((beleg) => ({ id: `b.${beleg.id}`, skript: beleg.verify }))
    );
    const ausgabe = leseBuendelAusgabe((await run(buendel)).output);
    expect(ausgabe.vollstaendig).toBe(true);
    return Object.fromEntries(
      BELEG_IDS.map((id) => [id, ausgabe.ergebnisse[`b.${id}`] === true])
    ) as Record<BelegId, boolean>;
  };
  const nurBeleg = (id: BelegId): Record<BelegId, boolean> => ({
    'kasse-meta': id === 'kasse-meta',
    'kasse-zeilen': id === 'kasse-zeilen',
  });

  // Ein vollständiger Prüflauf wie im Spiel: Bündel in der VM, Ergebnis in die Engine.
  let zustand: ErmittlungsZustand = startZustand();
  let ereignisse: ErmittlungsEreignis[] = [];
  const pruefLauf = async () => {
    const buendel = buendelSkript(offenePruefungen(episode0, zustand));
    const antwort = await run(buendel);
    const neu = wendePruefungAn(episode0, zustand, leseBuendelAusgabe(antwort.output));
    zustand = neu.zustand;
    ereignisse = neu.ereignisse;
    return neu;
  };
  const typen = () => ereignisse.map((e) => e.type);
  // Prüfung und Diagnose des Reparaturschritts, wie das Bündel sie fährt.
  const zurueckPruefung = async () => {
    const schritt = episode0.spuren[1].schritte[1];
    const ausgabe = leseBuendelAusgabe(
      (
        await run(
          buendelSkript([
            { id: 's.inhalt.kasse-zurueck', skript: schritt.verify },
            { id: 'd.inhalt.kasse-zurueck', skript: schritt.diagnose ?? 'true', diagnose: true },
          ])
        )
      ).output
    );
    expect(ausgabe.vollstaendig).toBe(true);
    return {
      geloest: ausgabe.ergebnisse['s.inhalt.kasse-zurueck'] === true,
      diagnose: ausgabe.diagnosen?.['d.inhalt.kasse-zurueck'] ?? '',
    };
  };
  const diagnosen = () =>
    ereignisse.flatMap((e) =>
      e.type === 'diagnose' ? [`${e.spurId}/${e.schrittId}: ${e.text}`] : []
    );
  const frischerLauf = async () => {
    expect((await setupEpisode()).exitCode).toBe(0);
    zustand = startZustand();
    ereignisse = [];
  };
  // Die Antwort des ablesen-Schritts wie im Spiel: Skript in der VM, Ergebnis in die Engine.
  const antworte = async (text: string) => {
    const schritt = episode0.spuren[0].schritte[1];
    const res = await client.run(antwortSkript(schritt.antwort?.pruefung ?? 'false', text), 20_000);
    const neu = wendeAntwortAn(episode0, zustand, 'akte', schritt.id, res.exitCode === 0);
    zustand = neu.zustand;
    ereignisse = neu.ereignisse;
    return res.exitCode === 0;
  };

  const hashes = async (pfade: readonly string[]) =>
    (await run(`stat -c '%n %U:%G %a %Y' ${pfade.join(' ')}; sha256sum ${pfade.join(' ')}`)).output;

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

  it('T12-0: das Setup legt Liste und Sicherung mit Besitzer, Zeit und einem veränderten Betrag an', async () => {
    const meta = await run(`stat -c '%n %U %a %y' ${LISTE} ${SICHERUNG}`);
    expect(meta.output.trim().split('\n')).toEqual([
      `${LISTE} kaffee 664 2026-04-17 03:12:00.000000000 +0000`,
      `${SICHERUNG} root 644 2026-04-16 22:05:00.000000000 +0000`,
    ]);
    const diff = await run(`diff ${SICHERUNG} ${LISTE}; true`);
    expect(diff.output.split('\n').filter((z) => /^[<>]/.test(z))).toEqual([
      '< 2026-04-15,Timo,2.50',
      '> 2026-04-15,Timo,0.50',
    ]);
    const konto = await run(
      `grep '^kaffee:' /etc/passwd | cut -d: -f1,3,5,7; grep '^kaffee:' /etc/shadow | cut -d: -f1,2`
    );
    expect(konto.output.trim().split('\n')).toEqual([
      'kaffee:1104:Kaffeeautomat:/sbin/nologin',
      'kaffee:!',
    ]);
  }, 180_000);

  it('T12-0: azubi darf nur die Liste beschreiben, nicht die Sicherung, den Ordner oder die Rechte', async () => {
    const sicherung = await hashes([SICHERUNG]);
    for (const versuch of [
      `echo x >> ${SICHERUNG}`,
      `rm -f ${LISTE}`,
      `rm -f ${SICHERUNG}`,
      `mv ${LISTE} /tmp/anders`,
      `touch ${UEBUNG}/neu.txt`,
      `sed -i s/0.50/2.50/ ${LISTE}`,
      `chmod 600 ${LISTE}`,
      `chown azubi ${LISTE}`,
    ]) {
      expect((await alsAzubi(versuch)).rc, versuch).not.toBe(0);
    }
    expect(await hashes([SICHERUNG])).toBe(sicherung);
    const vorher = await hashes([LISTE]);
    expect((await alsAzubi(`echo x >> ${LISTE}`)).rc).toBe(0);
    expect(await hashes([LISTE])).not.toBe(vorher);
    await setupEpisode();
    expect(await hashes([LISTE])).toBe(vorher);
  }, 120_000);

  it('T12-0: vor der Lösung sind alle Prüfungen und Diagnosen negativ oder leer', async () => {
    await frischerLauf();
    expect(await frischBelege()).toBe('');
    expect(await belegPruefung()).toEqual({ 'kasse-meta': false, 'kasse-zeilen': false });
    const ausgabe = leseBuendelAusgabe(
      (await run(buendelSkript(offenePruefungen(episode0, startZustand())))).output
    );
    expect(ausgabe.vollstaendig).toBe(true);
    expect(Object.values(ausgabe.ergebnisse).every((ok) => ok === false)).toBe(true);
    expect(Object.values(ausgabe.diagnosen ?? {}).every((text) => text === '')).toBe(true);
    await pruefLauf();
    expect(diagnosen()).toEqual([]);
  }, 120_000);

  for (const id of BELEG_IDS) {
    it(`T12-0: verschiedene Terminal-Lösungswege erzeugen denselben gültigen Beleg ${id}`, async () => {
      for (const weg of WEGE[id]) {
        await frischBelege();
        const antwort = await alsAzubi(weg.befehl);
        if (!weg.rcEgal) expect(antwort.rc, `${weg.name}: ${weg.befehl}\n${antwort.text}`).toBe(0);
        expect(await belegPruefung(), `${weg.name}: ${weg.befehl}`).toEqual(nurBeleg(id));
      }
    }, 300_000);
  }

  it('T12-0: halbe, abgetippte, leere, fremde und als Symlink angelegte Belege sind negativ', async () => {
    const faelle: { id: BelegId; name: string; befehl: string; asRoot?: boolean }[] = [
      { id: 'kasse-meta', name: 'leer', befehl: ': > ~/belege/kasse-meta.txt' },
      {
        id: 'kasse-meta',
        name: 'nur die Liste',
        befehl: `ls -l ${LISTE} > ~/belege/kasse-meta.txt`,
      },
      {
        id: 'kasse-meta',
        name: 'nur die Sicherung',
        befehl: `ls -l ${SICHERUNG} > ~/belege/kasse-meta.txt`,
      },
      {
        id: 'kasse-meta',
        name: 'abgetippt',
        befehl: `echo 'kaffeekasse.csv kaffeekasse.bak kaffee' > ~/belege/kasse-meta.txt`,
      },
      {
        id: 'kasse-meta',
        name: 'Namen und Rechte ohne Besitzer',
        befehl: `echo '-rw-r--r-- kaffeekasse.csv kaffeekasse.bak' > ~/belege/kasse-meta.txt`,
      },
      {
        id: 'kasse-meta',
        name: 'Symlink auf gültigen Inhalt',
        befehl: `ls -l ${LISTE} ${SICHERUNG} > ~/gut.txt; ln -s ~/gut.txt ~/belege/kasse-meta.txt`,
      },
      {
        id: 'kasse-meta',
        name: 'fremde Datei (root)',
        befehl: `ls -l ${LISTE} ${SICHERUNG} > ~/belege/kasse-meta.txt && chown root:root ~/belege/kasse-meta.txt`,
        asRoot: true,
      },
      { id: 'kasse-zeilen', name: 'leer', befehl: ': > ~/belege/kasse-zeilen.txt' },
      {
        id: 'kasse-zeilen',
        name: 'nur die geänderte Zeile',
        befehl: `grep 0.50 ${LISTE} > ~/belege/kasse-zeilen.txt`,
      },
      {
        id: 'kasse-zeilen',
        name: 'nur die Originalzeile',
        befehl: `grep 2.50 ${SICHERUNG} > ~/belege/kasse-zeilen.txt`,
      },
      {
        id: 'kasse-zeilen',
        name: 'zweite Zeile überschreibt die erste',
        befehl: `grep 0.50 ${LISTE} > ~/belege/kasse-zeilen.txt; grep 2.50 ${SICHERUNG} > ~/belege/kasse-zeilen.txt`,
      },
      {
        id: 'kasse-zeilen',
        name: 'unveränderte Zeilen',
        befehl: `grep 2026-04-14 ${LISTE} > ~/belege/kasse-zeilen.txt; grep 2026-04-14 ${SICHERUNG} >> ~/belege/kasse-zeilen.txt`,
      },
      {
        id: 'kasse-zeilen',
        name: 'Symlink auf die Liste',
        befehl: `ln -s ${LISTE} ~/belege/kasse-zeilen.txt`,
      },
      {
        id: 'kasse-zeilen',
        name: 'fremde Datei (root)',
        befehl: `cat ${LISTE} ${SICHERUNG} > ~/belege/kasse-zeilen.txt && chown root:root ~/belege/kasse-zeilen.txt`,
        asRoot: true,
      },
    ];
    for (const fall of faelle) {
      await frischBelege();
      await run('rm -f /home/azubi/gut.txt');
      const antwort = fall.asRoot
        ? await run(fall.befehl.replaceAll('~', '/home/azubi'))
        : await alsAzubi(fall.befehl);
      const rc = 'exitCode' in antwort ? antwort.exitCode : antwort.rc;
      expect(rc, `${fall.id} ${fall.name}`).toBe(0);
      expect((await belegPruefung())[fall.id], `${fall.id}: ${fall.name}`).toBe(false);
    }
    await run('rm -f /home/azubi/gut.txt');
  }, 900_000);

  it('T12-0: das Antwortfeld akzeptiert nur den Besitzer der geänderten Liste', async () => {
    await frischerLauf();
    await alsAzubi(tippLoesung('akte', 'kasse-meta'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ akte: 1 });
    for (const falsch of ['azubi', 'timo', 'nadia', 'root', 'kaffeekasse', 'kaffe']) {
      expect(await antworte(falsch), falsch).toBe(false);
    }
    expect(zustand.erledigt).toEqual({ akte: 1 });
    expect(await antworte('kaffee')).toBe(true);
    expect(zustand.erledigt).toEqual({ akte: 2 });
    expect(ereignisse.map((e) => e.type)).toEqual(['schritt-erledigt', 'spur-erledigt']);
  }, 300_000);

  it('T12-0: ein gefälschtes ~/uebung ändert nichts an Prüfungen, Diagnosen und Antwort', async () => {
    await frischerLauf();
    await alsAzubi(
      `mkdir -p ~/uebung && echo 'datum,name,betrag' > ~/uebung/kaffeekasse.csv && cp ~/uebung/kaffeekasse.csv ~/uebung/kaffeekasse.bak`
    );
    await alsAzubi(
      `ls -l ~/uebung/kaffeekasse.csv ~/uebung/kaffeekasse.bak > ~/belege/kasse-meta.txt`
    );
    await alsAzubi(
      `cat ~/uebung/kaffeekasse.csv ~/uebung/kaffeekasse.bak > ~/belege/kasse-zeilen.txt`
    );
    expect(await belegPruefung()).toEqual({ 'kasse-meta': false, 'kasse-zeilen': false });
    await pruefLauf();
    expect(zustand.erledigt).toEqual({});
    expect(await antworte('azubi')).toBe(false);
    expect(await antworte('kaffee')).toBe(true);
    await alsAzubi('rm -rf ~/uebung');
  }, 300_000);

  it('T12-0: ein falscher Vorwurf vor vollständiger Belegsammlung sperrt nicht', async () => {
    await frischerLauf();
    await alsAzubi(tippLoesung('akte', 'kasse-meta'));
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['kasse-meta']);
    const falsch = pruefeVorwurf(episode0, zustand, {
      verdaechtigeId: 'timo',
      belegIds: ['kasse-meta'],
    });
    expect(falsch.ergebnis).toBe('falsche-person');
    expect(falsch.antwort).toEqual(episode0.vorwurf.antworten.falschePerson);
    expect(falsch.zustand.sperreBis).toBeNull();
    expect(istGesperrt(falsch.zustand)).toBe(false);
    const zuWenig = pruefeVorwurf(episode0, falsch.zustand, {
      verdaechtigeId: 'kaffee',
      belegIds: ['kasse-meta'],
    });
    expect(zuWenig.ergebnis).toBe('zu-wenig-belege');
    expect(istGesperrt(zuWenig.zustand)).toBe(false);
  }, 300_000);

  it('T12-0: Lösungsweg A, Akte vor Inhalt, bis zum richtigen Vorwurf', async () => {
    await frischerLauf();
    await alsAzubi(tippLoesung('akte', 'kasse-meta'));
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['kasse-meta']);
    expect(await antworte('kaffee')).toBe(true);
    await alsAzubi(tippLoesung('inhalt', 'kasse-zeilen'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ akte: 2, inhalt: 1 });
    expect(zustand.belegeErkannt).toEqual(['kasse-meta', 'kasse-zeilen']);
    // Erst gesichert, dann repariert: Die Belege bleiben gültig, der Vorwurf trägt auch danach.
    await alsAzubi(tippLoesung('inhalt', 'kasse-zurueck'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ akte: 2, inhalt: 2 });
    expect(zustand.belegeErkannt).toEqual(['kasse-meta', 'kasse-zeilen']);
    expect(typen()).toEqual(expect.arrayContaining(['schritt-erledigt', 'spur-erledigt']));
    expect(typen()).not.toContain('beleg-verloren');
    const richtig = pruefeVorwurf(episode0, zustand, {
      verdaechtigeId: 'kaffee',
      belegIds: ['kasse-meta', 'kasse-zeilen'],
    });
    expect(richtig.ergebnis).toBe('richtig');
    expect(richtig.zustand.geloest).toBe(true);
  }, 300_000);

  it('T12-R: vor der Reparatur ist der Schritt offen und die Diagnose stumm', async () => {
    await frischerLauf();
    expect(await zurueckPruefung()).toEqual({ geloest: false, diagnose: '' });
  }, 120_000);

  it('T12-R: jeder richtige Weg stellt die Liste her und löst genau den Reparaturschritt', async () => {
    for (const weg of WEGE_ZURUECK) {
      await frischerLauf();
      const antwort = await alsAzubi(weg.befehl);
      expect(antwort.rc, `${weg.name}: ${weg.befehl}\n${antwort.text}`).toBe(0);
      expect(await zurueckPruefung(), weg.name).toEqual({ geloest: true, diagnose: '' });
      expect((await run(`cmp -s ${LISTE} ${SICHERUNG}`)).exitCode, weg.name).toBe(0);
      await alsAzubi('rm -f ~/neu.csv');
    }
  }, 600_000);

  it('T12-R: typische Fehler lösen nichts und bekommen eine passende Diagnose', async () => {
    const faelle: { name: string; befehl: string; text: string }[] = [
      { name: 'angehängt', befehl: `cat ${SICHERUNG} >> ${LISTE}`, text: MELDUNG.betragNoch },
      { name: 'leer', befehl: `: > ${LISTE}`, text: MELDUNG.leer },
      {
        name: 'zu lang ohne falschen Betrag',
        befehl: `{ cat ${SICHERUNG}; echo 2026-04-18,Timo,1.00; } > ${LISTE}`,
        text: MELDUNG.laenger,
      },
      { name: 'zu kurz', befehl: `head -3 ${SICHERUNG} > ${LISTE}`, text: MELDUNG.kuerzer },
      {
        name: 'anderer Betrag',
        befehl: `sed 's/0.50/9.99/' ${LISTE} > ~/neu.csv && cat ~/neu.csv > ${LISTE}`,
        text: MELDUNG.weicht,
      },
      {
        name: 'Datum statt Betrag geändert',
        befehl: `sed 's/2026-04-17,Timo,3.50/2026-04-18,Timo,3.50/' ${SICHERUNG} > ~/neu.csv && cat ~/neu.csv > ${LISTE}`,
        text: MELDUNG.weicht,
      },
    ];
    for (const fall of faelle) {
      await frischerLauf();
      expect((await alsAzubi(fall.befehl)).rc, fall.name).toBe(0);
      expect(await zurueckPruefung(), fall.name).toEqual({ geloest: false, diagnose: fall.text });
      await alsAzubi('rm -f ~/neu.csv');
    }
  }, 600_000);

  it('T12-R: nach der Reparatur bleiben vorher gesicherte Belege gültig, neue Belege der Zeilen nicht', async () => {
    await frischerLauf();
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    expect(await belegPruefung()).toEqual({ 'kasse-meta': true, 'kasse-zeilen': true });
    await alsAzubi(WEGE_ZURUECK[0].befehl);
    expect(await belegPruefung()).toEqual({ 'kasse-meta': true, 'kasse-zeilen': true });

    // Ein Beleg der Zeilen lässt sich aus der reparierten Liste nicht mehr erzeugen; die Diagnose sagt warum.
    await frischBelege();
    await alsAzubi(WEGE['kasse-zeilen'][0].befehl);
    expect(await belegPruefung()).toEqual({ 'kasse-meta': false, 'kasse-zeilen': false });
    zustand = startZustand();
    await pruefLauf();
    expect(diagnosen()).toContain(`inhalt/kasse-zeilen: ${MELDUNG.schonRepariert}`);

    // Besitzer, Rechte und Datum der Dateien lassen sich weiterhin sichern.
    await alsAzubi(WEGE['kasse-meta'][0].befehl);
    expect((await belegPruefung())['kasse-meta']).toBe(true);
  }, 300_000);

  it('T12-R: Reparatur zuerst, dann Rest: ein erneutes Setup stellt den Ausgangszustand her', async () => {
    await frischerLauf();
    const vorher = await hashes([LISTE, SICHERUNG]);
    await alsAzubi(WEGE_ZURUECK[0].befehl);
    expect(await hashes([LISTE, SICHERUNG])).not.toBe(vorher);
    expect((await setupEpisode()).exitCode).toBe(0);
    expect(await hashes([LISTE, SICHERUNG])).toBe(vorher);
    expect((await zurueckPruefung()).geloest).toBe(false);
  }, 300_000);

  it('T12-0: Lösungsweg B, Inhalt vor Akte, mit falscher Person ohne Sperre', async () => {
    await frischerLauf();
    await alsAzubi(tippLoesung('inhalt', 'kasse-zeilen'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ inhalt: 1 });
    await alsAzubi(tippLoesung('akte', 'kasse-meta'));
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['kasse-meta', 'kasse-zeilen']);
    const falsch = pruefeVorwurf(episode0, zustand, {
      verdaechtigeId: 'timo',
      belegIds: ['kasse-meta', 'kasse-zeilen'],
    });
    expect(falsch.ergebnis).toBe('falsche-person');
    expect(falsch.zustand.sperreBis).toBeNull();
    const richtig = pruefeVorwurf(episode0, falsch.zustand, {
      verdaechtigeId: 'kaffee',
      belegIds: ['kasse-meta', 'kasse-zeilen'],
    });
    expect(richtig.ergebnis).toBe('richtig');
  }, 300_000);

  it('T12-0: Lösungsweg C, beide Belege vorab, der Besitzer folgt als Antwort', async () => {
    await frischerLauf();
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ akte: 1, inhalt: 1 });
    expect(zustand.belegeErkannt).toEqual(['kasse-meta', 'kasse-zeilen']);
    // Die Spur Akte endet erst mit der Antwort; ein Vorwurf ist trotzdem schon möglich.
    const richtig = pruefeVorwurf(episode0, zustand, {
      verdaechtigeId: 'kaffee',
      belegIds: ['kasse-meta', 'kasse-zeilen'],
    });
    expect(richtig.ergebnis).toBe('richtig');
  }, 300_000);

  it('T12-0: Diagnose beim halben Beleg, einmal je Text, ohne einen Schritt zu erledigen', async () => {
    await frischerLauf();
    const vorher = await hashes([LISTE, SICHERUNG]);
    await alsAzubi(`ls -l ${LISTE} > ~/belege/kasse-meta.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([`akte/kasse-meta: ${MELDUNG.bakFehlt}`]);
    expect(zustand.erledigt).toEqual({});
    await pruefLauf();
    expect(diagnosen()).toEqual([]);

    await alsAzubi(`ls -l ${SICHERUNG} > ~/belege/kasse-meta.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([`akte/kasse-meta: ${MELDUNG.csvFehlt}`]);

    await alsAzubi(tippLoesung('akte', 'kasse-meta'));
    await pruefLauf();
    expect(diagnosen()).toEqual([]);
    expect(zustand.erledigt).toEqual({ akte: 1 });
    expect(await hashes([LISTE, SICHERUNG])).toBe(vorher);
  }, 300_000);

  it('T12-0: Diagnose beim abgetippten Beleg', async () => {
    await frischerLauf();
    await alsAzubi(
      `echo 'kaffeekasse.csv kaffeekasse.bak kaffee -rw-r--r--' > ~/belege/kasse-meta.txt`
    );
    await pruefLauf();
    expect(diagnosen()).toEqual([`akte/kasse-meta: ${MELDUNG.abgetippt}`]);
    expect(zustand.erledigt).toEqual({});
  }, 120_000);

  it('T12-0: Diagnose, wenn nur eine der beiden Zeilen im Beleg steht', async () => {
    await frischerLauf();
    await alsAzubi(`grep 0.50 ${LISTE} > ~/belege/kasse-zeilen.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([`inhalt/kasse-zeilen: ${MELDUNG.sicherungFehlt}`]);
    expect(zustand.erledigt).toEqual({});

    // Die zweite Zeile mit > überschreibt die erste: Jetzt fehlt die geänderte Zeile.
    await alsAzubi(`grep 2.50 ${SICHERUNG} > ~/belege/kasse-zeilen.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([`inhalt/kasse-zeilen: ${MELDUNG.listeFehlt}`]);

    await alsAzubi(tippLoesung('inhalt', 'kasse-zeilen'));
    await pruefLauf();
    expect(diagnosen()).toEqual([]);
    expect(zustand.erledigt).toEqual({ inhalt: 1 });
  }, 300_000);

  it('T12-0: wiederholtes Setup liefert denselben Zustand und lässt fremde Dateien stehen', async () => {
    await frischerLauf();
    const vorher = await hashes([LISTE, SICHERUNG]);
    await alsAzubi('echo bleibt > ~/belege/eigene-notiz.txt');
    await run(`echo fremd > ${UEBUNG}/fremd.txt`);
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    expect(await belegPruefung()).toEqual({ 'kasse-meta': true, 'kasse-zeilen': true });
    for (let i = 0; i < 2; i++) {
      expect((await setupEpisode()).exitCode).toBe(0);
      expect(await hashes([LISTE, SICHERUNG])).toBe(vorher);
      expect((await run(`ls -A ${BELEGE}`)).output.trim()).toBe('eigene-notiz.txt');
      expect((await run(`cat ${UEBUNG}/fremd.txt`)).output.trim()).toBe('fremd');
      expect(await belegPruefung()).toEqual({ 'kasse-meta': false, 'kasse-zeilen': false });
    }
    await run(`rm -f ${UEBUNG}/fremd.txt ${BELEGE}/eigene-notiz.txt`);
  }, 300_000);

  it('T12-0: ein Zugriff auf den ausgeschlossenen Ordner anderer Episoden ist hier kein Verstoß', async () => {
    await frischerLauf();
    expect((await run(episode0.einsatzrahmen.verstoss)).exitCode).not.toBe(0);
    await alsAzubi('sudo -n /bin/cat /home/nadia/vertraulich.txt');
    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(false);
    expect(ereignisse.map((e) => e.type)).not.toContain('einsatzrahmen-verletzt');
  }, 120_000);
});
