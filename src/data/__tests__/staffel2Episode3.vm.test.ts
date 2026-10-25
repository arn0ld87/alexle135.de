// @vitest-environment node
// Episode 3 „Die Lücke im Log“ in der echten VM (v86 headless, Assets aus public/missions/linux/).
// Läuft nur mit MISSION_VM=1, auf gns3 bzw. in einer Umgebung mit gebauten Assets:
//   MISSION_VM=1 pnpm exec vitest run src/data/__tests__/staffel2Episode3.vm.test.ts
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
import { LOESUNG } from '../staffeln/staffel-2/episode-1';
import { episode3 } from '../staffeln/staffel-2/episode-3';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = join(root, 'public/missions/linux');
const enabled = process.env.MISSION_VM === '1';

const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';

const LOG = '/var/log/rechenwerk-auth.log';
const KOPIE = '/srv/rechenwerk/log-spiegel/rechenwerk-auth.log';
const WARTUNG = '/srv/rechenwerk/wartung';
const BIN = `${WARTUNG}/bin`;
const SKRIPT = `${BIN}/logkuerzen.sh`;
const ARCHIV = `${WARTUNG}/archiv/logkuerzen.sh.sicherung`;
const BELEGE = '/home/azubi/belege';
const Q = '/home/azubi/quarantaene';
const T8_DROPIN = '/etc/sudoers.d/90-staffel2-rahmen';
const T8_LOG = '/var/log/staffel2-sudo.log';
const T8_BEFEHL = '/bin/cat /home/nadia/vertraulich.txt';

const BELEG_IDS = ['luecke-zeilen', 'konten-zaehlung'] as const;
type BelegId = (typeof BELEG_IDS)[number];

/** Das Lesemanifest: Metadaten, Inhalte und Links unter /home, /etc und /srv sowie das Anmeldelog. */
const MANIFEST = `set -e
cd /
__m=$(mktemp)
{
  printf 'META\\n'
  { find home etc srv -type f; echo var/log/rechenwerk-auth.log; } | LC_ALL=C sort | xargs stat -c '%n\\t%a\\t%u\\t%g\\t%s'
  printf 'INHALT\\n'
  { find home etc srv -type f; echo var/log/rechenwerk-auth.log; } | LC_ALL=C sort | xargs sha256sum
  printf 'LINKS\\n'
  find home etc srv -type l | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s\\t%s\\n' "$f" "$(readlink "$f")"
  done
} > "$__m"
printf 'manifest\\t%s\\n' "$(sha256sum "$__m" | cut -d' ' -f1)"
printf 'anzahl\\t%s\\n' "$(wc -l < "$__m")"
rm -f "$__m"
`;

/** Der geprüfte Lösungsweg, den die dritte Tipp-Stufe nennt. */
const tippLoesung = (spurId: string, schrittId: string): string => {
  const schritt = episode3.spuren
    .find((spur) => spur.id === spurId)
    ?.schritte.find((eintrag) => eintrag.id === schrittId);
  const tipp = schritt?.tipps[2] ?? '';
  expect(tipp.startsWith(LOESUNG)).toBe(true);
  return tipp.slice(LOESUNG.length);
};

/** Gleichwertige Lösungswege je Beleg: jeder muss denselben gültigen Beleg erzeugen. */
const WEGE: Record<BelegId, { name: string; befehl: string }[]> = {
  'luecke-zeilen': [
    { name: 'Tipp', befehl: tippLoesung('luecke', 'luecke-zeilen') },
    { name: 'diff', befehl: `diff ${LOG} ${KOPIE} > ~/belege/luecke-zeilen.txt || true` },
    { name: 'diff -u', befehl: `diff -u ${LOG} ${KOPIE} > ~/belege/luecke-zeilen.txt || true` },
    {
      name: 'comm',
      befehl: `comm -13 <(sort ${LOG}) <(sort ${KOPIE}) > ~/belege/luecke-zeilen.txt`,
    },
    {
      name: 'awk',
      befehl: `awk 'NR==FNR { a[$0]; next } !($0 in a)' ${LOG} ${KOPIE} > ~/belege/luecke-zeilen.txt`,
    },
    {
      name: 'sed nach Zeilennummern',
      befehl: `sed -n '13,19p' ${KOPIE} > ~/belege/luecke-zeilen.txt`,
    },
    {
      name: 'echo plus grep',
      befehl: `{ echo 'Fund auf rw-srv01'; grep -vxFf ${LOG} ${KOPIE}; } > ~/belege/luecke-zeilen.txt`,
    },
  ],
  'konten-zaehlung': [
    { name: 'Tipp', befehl: tippLoesung('zaehlung', 'konten-zaehlung') },
    {
      name: 'awk plus sort',
      befehl: `grep -vxFf ${LOG} ${KOPIE} | awk '{print $2}' | sort | uniq -c > ~/belege/konten-zaehlung.txt`,
    },
    {
      name: 'awk-Zähler',
      befehl: `grep -vxFf ${LOG} ${KOPIE} | awk '{ c[$2]++ } END { for (k in c) print k, c[k] }' > ~/belege/konten-zaehlung.txt`,
    },
    {
      name: 'Zeitfenster mit awk',
      befehl: `awk '$1 >= "2026-04-18T02:14" && $1 <= "2026-04-18T03:10" { print $2 }' ${KOPIE} | sort | uniq -c | sort -rn > ~/belege/konten-zaehlung.txt`,
    },
    {
      name: 'grep -c je Konto',
      befehl: `for k in nadia margit timo; do echo "$k $(grep -vxFf ${LOG} ${KOPIE} | grep -c " $k ")"; done > ~/belege/konten-zaehlung.txt`,
    },
  ],
};

describe.skipIf(!enabled)('Episode 3 „Die Lücke im Log“ in der echten VM', () => {
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
  /** Neuer Quarantäneordner und frische Skripte, ohne die Quellen von Log und Kopie anzufassen. */
  const frischQuarantaene = async () => {
    await run(`rm -rf ${Q} ${BIN}/zweit.sh`);
    expect((await run(episode3.setup)).exitCode).toBe(0);
  };

  const setupAlles = async () => {
    const rahmen = await run(rahmenSetupSkript());
    expect(rahmen.exitCode, rahmen.output).toBe(0);
    const einsatz = await run(einsatzrahmenSetupSkript(episode3.einsatzrahmen.sudoBefehle));
    expect(einsatz.exitCode, einsatz.output).toBe(0);
    const episode = await run(episode3.setup);
    expect(episode.exitCode, episode.output).toBe(0);
  };
  const setupEpisode = () => run(episode3.setup);

  const belegPruefung = async (): Promise<Record<BelegId, boolean>> => {
    const buendel = buendelSkript(
      episode3.vorwurf.belege.map((beleg) => ({ id: `b.${beleg.id}`, skript: beleg.verify }))
    );
    const ausgabe = leseBuendelAusgabe((await run(buendel)).output);
    expect(ausgabe.vollstaendig).toBe(true);
    return Object.fromEntries(
      BELEG_IDS.map((id) => [id, ausgabe.ergebnisse[`b.${id}`] === true])
    ) as Record<BelegId, boolean>;
  };
  const nurBeleg = (id: BelegId): Record<BelegId, boolean> => ({
    'luecke-zeilen': id === 'luecke-zeilen',
    'konten-zaehlung': id === 'konten-zaehlung',
  });
  const keinBeleg: Record<BelegId, boolean> = { 'luecke-zeilen': false, 'konten-zaehlung': false };

  // Prüfung einer einzelnen Skript-Zeile (verify des Schritts): Exit 0 = bestanden.
  const exitVon = async (skript: string) => (await run(`(\n${skript}\n) >/dev/null 2>&1`)).exitCode;
  const antwortPasst = async (text: string) => {
    const schritt = episode3.spuren[0].schritte[0];
    const antwort = await run(antwortSkript(schritt.antwort!.pruefung, text));
    return antwort.exitCode === 0;
  };
  const ordnenVerify = episode3.spuren[1].schritte[1].verify;

  // Ein vollständiger Prüflauf wie im Spiel: Bündel in der VM, Ergebnis in die Engine.
  let zustand: ErmittlungsZustand = startZustand();
  let ereignisse: ErmittlungsEreignis[] = [];
  const pruefLauf = async () => {
    const buendel = buendelSkript(offenePruefungen(episode3, zustand));
    const antwort = await run(buendel);
    const neu = wendePruefungAn(episode3, zustand, leseBuendelAusgabe(antwort.output));
    zustand = neu.zustand;
    ereignisse = neu.ereignisse;
    return neu;
  };
  /** Beantwortet das Ablesen wie die App: Prüfung in der VM, bei Treffer weiter in die Engine. */
  const antworte = async (text: string) => {
    const richtig = await antwortPasst(text);
    const neu = wendeAntwortAn(episode3, zustand, 'luecke', 'zeitraum', richtig);
    zustand = neu.zustand;
    ereignisse = neu.ereignisse;
    return richtig;
  };
  const frischerLauf = async () => {
    await run(`rm -rf ${Q}`);
    await frischBelege();
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

  it('Setup: legt Quellen, Skripte und Konten mit Soll-Rechten und fester Zeitlinie an', async () => {
    const rechte = await run(`stat -c '%n %U:%G %a %y' ${LOG} ${KOPIE} ${SKRIPT}`);
    expect(rechte.output.trim().split('\n')).toEqual([
      `${LOG} root:root 644 2026-04-18 06:30:00.000000000 +0000`,
      `${KOPIE} root:root 644 2026-04-18 06:30:00.000000000 +0000`,
      `${SKRIPT} nadia:nadia 755 2026-04-16 21:10:00.000000000 +0000`,
    ]);
    expect((await run(`stat -c '%U:%G:%a' ${ARCHIV}`)).output.trim()).toBe('root:root:644');
    const zahlen = await run(`wc -l < ${LOG}; wc -l < ${KOPIE}; ls ${BIN}`);
    expect(zahlen.output.trim().split('\n')).toEqual([
      '17',
      '24',
      'backup.sh',
      'logkuerzen.sh',
      'logrotate-woechentlich.sh',
    ]);
    // Die Lücke ist genau die Differenz: sieben Zeilen, nur in der Kopie.
    const luecke = await run(`grep -vxFf ${LOG} ${KOPIE}`);
    expect(luecke.output.trim().split('\n')).toHaveLength(7);
    expect(luecke.output.split('\n')[0]).toMatch(/^2026-04-18T02:14:21Z nadia login /);
    expect((await run(`grep -vxFf ${KOPIE} ${LOG} | wc -l`)).output.trim()).toBe('0');
    expect((await run(`stat -c '%U:%G:%a' ${BIN}`)).output.trim()).toBe('azubi:azubi:755');
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
    // Die Werkzeuge aus der Hilfe gibt es im Image (BusyBox oder Coreutils).
    const werkzeuge = await alsAzubi(
      `for w in awk cut sort uniq diff comm cmp mv mkdir grep; do command -v $w >/dev/null || echo "fehlt $w"; done; echo "a b c" | awk '{print $2}'; echo "x y" | cut -d' ' -f2`
    );
    expect(werkzeuge.text.trim().split('\n')).toEqual(['b', 'y']);
  }, 180_000);

  it('Quellen sind für azubi lesbar, aber nicht veränderbar; im Wartungsordner nur bin/ beschreibbar', async () => {
    for (const pfad of [LOG, KOPIE, SKRIPT, ARCHIV]) {
      expect((await alsAzubi(`cat ${pfad} >/dev/null`)).rc, pfad).toBe(0);
    }
    const vorher = await hashes([LOG, KOPIE, SKRIPT, ARCHIV], true);
    for (const versuch of [
      `echo x >> ${LOG}`,
      `rm -f ${LOG}`,
      `mv ${LOG} /tmp/anders`,
      `echo x >> ${KOPIE}`,
      `rm -f ${KOPIE}`,
      `: > ${KOPIE}`,
      `echo x >> ${SKRIPT}`,
      `echo x >> ${ARCHIV}`,
      `rm -f ${ARCHIV}`,
      `mkdir ${WARTUNG}/neu`,
      `touch ${WARTUNG}/neu.txt`,
    ]) {
      expect((await alsAzubi(versuch)).rc, versuch).not.toBe(0);
    }
    expect(await hashes([LOG, KOPIE, SKRIPT, ARCHIV], true)).toBe(vorher);
    // Das Skript tut nichts außer einer Ausgabe.
    expect((await alsAzubi(`sh ${SKRIPT} 1 2`)).text).toContain('tut nichts');
    // azubi hat keine neuen sudo-Rechte.
    const liste = await alsAzubi('sudo -n -l');
    expect(liste.text).not.toMatch(/NOPASSWD: ALL|\(ALL(:ALL)?\) (NOPASSWD: )?ALL/);
    expect(liste.text.match(/\(root\) NOPASSWD:/g)).toHaveLength(2);
    expect(liste.text).toContain(T8_BEFEHL);
    expect((await run(episode3.einsatzrahmen.verstoss)).exitCode).not.toBe(0);
  }, 180_000);

  it('Ausgangszustand: kein Beleg, kein Schritt, keine Antwort und kein Verstoß ist erfüllt', async () => {
    await frischerLauf();
    expect(await belegPruefung()).toEqual(keinBeleg);
    const buendel = buendelSkript(offenePruefungen(episode3, startZustand()));
    const ausgabe = leseBuendelAusgabe((await run(buendel)).output);
    expect(ausgabe.vollstaendig).toBe(true);
    expect(Object.values(ausgabe.ergebnisse).every((ok) => ok === false)).toBe(true);
    expect(await exitVon(ordnenVerify)).not.toBe(0);
    for (const falsch of ['', '02:07-04:05', '02:14', '02:14-03:10', '03:09-02:14', '0214-0309']) {
      expect(await antwortPasst(falsch), `Antwort "${falsch}"`).toBe(false);
    }
    await pruefLauf();
    expect(zustand.erledigt).toEqual({});
    expect(ereignisse.filter((e) => e.type === 'diagnose')).toEqual([]);
  }, 300_000);

  it('Ablesen: Erste und letzte fehlende Uhrzeit lösen den Schritt, auch mit Leerzeichen', async () => {
    await frischerLauf();
    expect(await antwortPasst('02:14-03:09')).toBe(true);
    expect(await antwortPasst(' 02:14 - 03:09 ')).toBe(true);
    // Die Prüfung liest den Zustand: Mit einem weiteren Eintrag in der Kopie ändert sich die Antwort.
    await run(`cp ${KOPIE} /tmp/kopie.sicher`);
    await run(`printf '%s\\n' '2026-04-18T03:30:00Z nadia logout result=ok' >> ${KOPIE}`);
    expect(await antwortPasst('02:14-03:09')).toBe(false);
    expect(await antwortPasst('02:14-03:30')).toBe(true);
    await run(
      `cp /tmp/kopie.sicher ${KOPIE}; touch -d '2026-04-18 06:30:00 UTC' ${KOPIE}; rm -f /tmp/kopie.sicher`
    );
    expect(await antwortPasst('02:14-03:09')).toBe(true);
  }, 300_000);

  for (const id of BELEG_IDS) {
    it(`verschiedene Terminal-Lösungswege erzeugen denselben gültigen Beleg ${id}`, async () => {
      for (const weg of WEGE[id]) {
        await frischBelege();
        const antwort = await alsAzubi(weg.befehl);
        expect(antwort.rc, `${weg.name}: ${weg.befehl}\n${antwort.text}`).toBe(0);
        expect(await belegPruefung(), `${weg.name}: ${weg.befehl}`).toEqual(nurBeleg(id));
      }
    }, 600_000);
  }

  it('Belege: leere, falsche, teilweise, fremde und als Symlink angelegte Belege sind negativ', async () => {
    const faelle: { id: BelegId; name: string; befehl: string; asRoot?: boolean }[] = [
      { id: 'luecke-zeilen', name: 'leer', befehl: ': > ~/belege/luecke-zeilen.txt' },
      {
        id: 'luecke-zeilen',
        name: 'ganze Kopie',
        befehl: `cp ${KOPIE} ~/belege/luecke-zeilen.txt`,
      },
      {
        id: 'luecke-zeilen',
        name: 'ganzes Log',
        befehl: `cp ${LOG} ~/belege/luecke-zeilen.txt`,
      },
      {
        id: 'luecke-zeilen',
        name: 'nur Nadias Zeilen',
        befehl: `grep nadia ${KOPIE} > ~/belege/luecke-zeilen.txt`,
      },
      {
        id: 'luecke-zeilen',
        name: 'nur die ersten drei fehlenden',
        befehl: `grep -vxFf ${LOG} ${KOPIE} | head -n 3 > ~/belege/luecke-zeilen.txt`,
      },
      {
        id: 'luecke-zeilen',
        name: 'Kopie ohne die fehlenden Zeilen',
        befehl: `cp ${LOG} ~/belege/luecke-zeilen.txt`,
      },
      {
        id: 'luecke-zeilen',
        name: 'Symlink auf die Kopie',
        befehl: `ln -s ${KOPIE} ~/belege/luecke-zeilen.txt`,
      },
      {
        id: 'luecke-zeilen',
        name: 'Symlink auf einen gültigen Beleg',
        befehl: `grep -vxFf ${LOG} ${KOPIE} > ~/gut.txt; ln -s ~/gut.txt ~/belege/luecke-zeilen.txt`,
      },
      {
        id: 'luecke-zeilen',
        name: 'fremde Datei (root)',
        befehl: `grep -vxFf ${LOG} ${KOPIE} > ~/belege/luecke-zeilen.txt && chown root:root ~/belege/luecke-zeilen.txt`,
        asRoot: true,
      },
      { id: 'konten-zaehlung', name: 'leer', befehl: ': > ~/belege/konten-zaehlung.txt' },
      {
        id: 'konten-zaehlung',
        name: 'das ganze Log gezählt',
        befehl: `cut -d' ' -f2 ${KOPIE} | sort | uniq -c > ~/belege/konten-zaehlung.txt`,
      },
      {
        id: 'konten-zaehlung',
        name: 'nur das Log gezählt',
        befehl: `cut -d' ' -f2 ${LOG} | sort | uniq -c > ~/belege/konten-zaehlung.txt`,
      },
      {
        id: 'konten-zaehlung',
        name: 'falsche Zahlen',
        befehl: `printf '%s\\n' '3 nadia' '2 margit' '1 timo' > ~/belege/konten-zaehlung.txt`,
      },
      {
        id: 'konten-zaehlung',
        name: 'nur ein Konto',
        befehl: `printf '%s\\n' '4 nadia' > ~/belege/konten-zaehlung.txt`,
      },
      {
        id: 'konten-zaehlung',
        name: 'zusätzliches fremdes Konto',
        befehl: `printf '%s\\n' '4 nadia' '2 margit' '1 timo' '1 azubi' > ~/belege/konten-zaehlung.txt`,
      },
      {
        id: 'konten-zaehlung',
        name: 'nur die Zeilen, nicht gezählt',
        befehl: `grep -vxFf ${LOG} ${KOPIE} > ~/belege/konten-zaehlung.txt`,
      },
      {
        id: 'konten-zaehlung',
        name: 'Symlink auf einen gültigen Beleg',
        befehl: `grep -vxFf ${LOG} ${KOPIE} | cut -d' ' -f2 | sort | uniq -c > ~/gut.txt; ln -s ~/gut.txt ~/belege/konten-zaehlung.txt`,
      },
      {
        id: 'konten-zaehlung',
        name: 'fremde Datei (root)',
        befehl: `printf '%s\\n' '4 nadia' '2 margit' '1 timo' > ~/belege/konten-zaehlung.txt && chown root:root ~/belege/konten-zaehlung.txt`,
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
      const ergebnis = await belegPruefung();
      expect(ergebnis[fall.id], `${fall.id}: ${fall.name}`).toBe(false);
    }
    await run('rm -f /home/azubi/gut.txt');
  }, 900_000);

  it('Ordnen: verschiedene Wege führen zum Zustand, Fehlversuche nicht', async () => {
    const gueltig: { name: string; befehl: string }[] = [
      { name: 'Tipp', befehl: tippLoesung('zaehlung', 'skript-quarantaene') },
      {
        name: 'mv mit neuem Namen',
        befehl: `mkdir ~/quarantaene && mv ${SKRIPT} ~/quarantaene/gefunden.sh`,
      },
      {
        name: 'cp und rm',
        befehl: `mkdir -p ~/quarantaene && cp ${SKRIPT} ~/quarantaene/ && rm ${SKRIPT}`,
      },
      {
        name: 'mv aus dem Ordner heraus',
        befehl: `mkdir -p ~/quarantaene && cd ${BIN} && mv logkuerzen.sh ~/quarantaene`,
      },
      {
        name: 'mv plus zweite Kopie in der Quarantäne',
        befehl: `mkdir -p ~/quarantaene && mv ${SKRIPT} ~/quarantaene/ && cp ~/quarantaene/logkuerzen.sh ~/quarantaene/zweit.sh`,
      },
      {
        name: 'Archivkopie nach Löschen',
        befehl: `mkdir -p ~/quarantaene && rm ${SKRIPT} && cp ${ARCHIV} ~/quarantaene/logkuerzen.sh`,
      },
    ];
    for (const weg of gueltig) {
      await frischQuarantaene();
      const antwort = await alsAzubi(weg.befehl);
      expect(antwort.rc, `${weg.name}: ${antwort.text}`).toBe(0);
      expect(await exitVon(ordnenVerify), weg.name).toBe(0);
    }
    const ungueltig: { name: string; befehl: string }[] = [
      { name: 'nur Ordner angelegt', befehl: 'mkdir ~/quarantaene' },
      { name: 'nur kopiert', befehl: `mkdir ~/quarantaene && cp ${SKRIPT} ~/quarantaene/` },
      {
        name: 'Kopie zurück nach bin/',
        befehl: `mkdir ~/quarantaene && mv ${SKRIPT} ~/quarantaene/ && cp ~/quarantaene/logkuerzen.sh ${BIN}/zweit.sh`,
      },
      {
        name: 'alle Skripte verschoben',
        befehl: `mkdir ~/quarantaene && mv ${BIN}/* ~/quarantaene/`,
      },
      {
        name: 'falsches Skript verschoben',
        befehl: `mkdir ~/quarantaene && mv ${BIN}/backup.sh ~/quarantaene/`,
      },
      { name: 'nur gelöscht', befehl: `rm ${SKRIPT}` },
      { name: 'ins Home statt in die Quarantäne', befehl: `mv ${SKRIPT} ~/` },
      {
        name: 'verändert',
        befehl: `mkdir ~/quarantaene && { cat ${SKRIPT}; echo '# x'; } > ~/quarantaene/logkuerzen.sh && rm ${SKRIPT}`,
      },
      {
        name: 'Symlink statt Datei',
        befehl: `mv ${SKRIPT} ~/anders.sh && mkdir ~/quarantaene && ln -s ~/anders.sh ~/quarantaene/logkuerzen.sh`,
      },
    ];
    for (const weg of ungueltig) {
      await frischQuarantaene();
      await run('rm -f /home/azubi/anders.sh /home/azubi/logkuerzen.sh');
      const antwort = await alsAzubi(weg.befehl);
      expect(antwort.rc, `${weg.name}: ${antwort.text}`).toBe(0);
      expect(await exitVon(ordnenVerify), weg.name).not.toBe(0);
    }
    await run('rm -f /home/azubi/anders.sh /home/azubi/logkuerzen.sh');
    await frischQuarantaene();
  }, 900_000);

  it('Spuren in beliebiger Reihenfolge: jede Spur linear, Fortschritt je Prüfbündel', async () => {
    await frischerLauf();
    // Zählung vor Lücke; das zweite Ziel der Zählung-Spur erst nach dem ersten.
    await alsAzubi(tippLoesung('zaehlung', 'skript-quarantaene'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({});
    await alsAzubi(tippLoesung('zaehlung', 'konten-zaehlung'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ zaehlung: 1 });
    expect(zustand.belegeErkannt).toEqual(['konten-zaehlung']);
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ zaehlung: 2 });
    expect(typen()).toContain('spur-erledigt');

    // Zweite Spur: Das Sichern vorab zählt erst nach dem Ablesen.
    await alsAzubi(tippLoesung('luecke', 'luecke-zeilen'));
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ zaehlung: 2 });
    expect(zustand.belegeErkannt).toEqual(['konten-zaehlung', 'luecke-zeilen']);
    expect(await antworte('02:07-04:05')).toBe(false);
    expect(zustand.erledigt).toEqual({ zaehlung: 2 });
    expect(await antworte('02:14-03:09')).toBe(true);
    expect(zustand.erledigt).toEqual({ zaehlung: 2, luecke: 1 });
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ zaehlung: 2, luecke: 2 });

    // Alles Weitere ist ein Vorwurf: Nach allen Schritten bleiben keine offenen Spuren.
    const offen = offenePruefungen(episode3, zustand).map((p) => p.id);
    expect(offen).toEqual(['b.konten-zaehlung', 'b.luecke-zeilen', 'e.verstoss']);
  }, 600_000);

  it('Vorwurf: falsche Personen bleiben aufholbar, die richtige schließt die Episode ab', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['luecke-zeilen'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['luecke-zeilen']);

    // Timo mit dem einen Beleg: falsche Person, der Vorwurf ist gesperrt, bis ein weiterer Beleg da ist.
    const timo = pruefeVorwurf(episode3, zustand, {
      verdaechtigeId: 'timo',
      belegIds: ['luecke-zeilen'],
    });
    expect(timo.ergebnis).toBe('falsche-person');
    expect(timo.antwort).toEqual(episode3.vorwurf.antworten.falschePerson);
    zustand = timo.zustand;
    expect(istGesperrt(zustand)).toBe(true);
    const gesperrt = pruefeVorwurf(episode3, zustand, {
      verdaechtigeId: 'nadia',
      belegIds: ['luecke-zeilen'],
    });
    expect(gesperrt.ergebnis).toBe('gesperrt');
    expect(gesperrt.antwort).toEqual(episode3.vorwurf.antworten.gesperrt);

    await alsAzubi(WEGE['konten-zaehlung'][0].befehl);
    await pruefLauf();
    expect(typen()).toContain('sperre-aufgehoben');
    expect(istGesperrt(zustand)).toBe(false);
    expect(zustand.belegeErkannt).toEqual(['konten-zaehlung', 'luecke-zeilen']);

    // Margit mit beiden Belegen: falsche Person, bei allen erkannten Belegen keine neue Sperre.
    const margit = pruefeVorwurf(episode3, zustand, {
      verdaechtigeId: 'margit',
      belegIds: ['konten-zaehlung', 'luecke-zeilen'],
    });
    expect(margit.ergebnis).toBe('falsche-person');
    expect(istGesperrt(margit.zustand)).toBe(false);
    zustand = margit.zustand;

    // Nadia mit nur einem Beleg: richtige Person, aber die Begründung trägt nicht.
    const zuWenig = pruefeVorwurf(episode3, zustand, {
      verdaechtigeId: 'nadia',
      belegIds: ['luecke-zeilen'],
    });
    expect(zuWenig.ergebnis).toBe('zu-wenig-belege');
    expect(zuWenig.antwort).toEqual(episode3.vorwurf.antworten.zuWenigBelege);
    zustand = zuWenig.zustand;
    expect(zustand.geloest).toBe(false);

    // Richtige Person mit beiden Belegen, aber Spuren offen: der Vorwurf sitzt, der Fall noch nicht.
    const offen = pruefeVorwurf(episode3, zustand, {
      verdaechtigeId: 'nadia',
      belegIds: ['konten-zaehlung', 'luecke-zeilen'],
    });
    expect(offen.ergebnis).toBe('richtig-offen');
    expect(offen.antwort.join(' ')).toContain('fehlt noch');
    expect(offen.antwort.join(' ')).toContain('Verschiebe das Löschskript in die Quarantäne');
    zustand = offen.zustand;
    expect(zustand.vorwurfRichtig).toBe(true);
    expect(zustand.geloest).toBe(false);

    // Die Schritte laufen weiter; mit dem letzten schließt der Fall von selbst.
    expect(await antworte('02:14-03:09')).toBe(true);
    await alsAzubi(tippLoesung('zaehlung', 'skript-quarantaene'));
    for (let i = 0; i < 4 && !zustand.geloest; i++) await pruefLauf();
    expect(zustand.geloest).toBe(true);
    expect(typen()).toContain('fall-geloest');
    expect(
      pruefeVorwurf(episode3, zustand, { verdaechtigeId: 'nadia', belegIds: [] }).ergebnis
    ).toBe('bereits-geloest');
  }, 600_000);

  it('Beleg verloren: ein vorher gültiger Beleg, der gelöscht wird, zählt nicht mehr', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['konten-zaehlung'][0].befehl);
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual(['konten-zaehlung']);
    await alsAzubi('rm ~/belege/konten-zaehlung.txt');
    await pruefLauf();
    expect(zustand.belegeErkannt).toEqual([]);
    expect(ereignisse.filter((e) => e.type === 'beleg-verloren')).toEqual([
      { type: 'beleg-verloren', belegId: 'konten-zaehlung' },
    ]);
  }, 300_000);

  it('Diagnosen nennen halben, falschen und fehlerhaften Stand und erledigen nichts', async () => {
    await frischerLauf();
    const quellen = await hashes([LOG, KOPIE], true);
    const diagnosen = () =>
      ereignisse.flatMap((e) =>
        e.type === 'diagnose' ? [`${e.spurId}/${e.schrittId}: ${e.text}`] : []
      );
    // Lücke-Spur: erst Ablesen. Die Diagnose des Sichern-Schritts greift erst, wenn er dran ist.
    expect(await antworte('02:14-03:09')).toBe(true);
    await alsAzubi(`cp ${LOG} ~/belege/luecke-zeilen.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'luecke/luecke-zeilen: Im Beleg steht keine der fehlenden Zeilen. Sie stehen nur in der Kopie, nicht im Log.',
    ]);
    await alsAzubi(`grep nadia ${KOPIE} > ~/belege/luecke-zeilen.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'luecke/luecke-zeilen: Es fehlen noch Zeilen aus der Kopie. Mit >> hängst du an, statt zu überschreiben.',
    ]);
    await alsAzubi(`cp ${KOPIE} ~/belege/luecke-zeilen.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'luecke/luecke-zeilen: Dein Beleg enthält auch viele Zeilen, die im Log stehen. Sichere nur die fehlenden.',
    ]);
    expect(zustand.erledigt).toEqual({ luecke: 1 });
    await alsAzubi(tippLoesung('luecke', 'luecke-zeilen'));
    await pruefLauf();
    expect(diagnosen()).toEqual([]);
    expect(zustand.erledigt).toEqual({ luecke: 2 });

    // Zählung-Spur.
    await alsAzubi(`printf '%s\\n' hallo > ~/belege/konten-zaehlung.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'zaehlung/konten-zaehlung: Im Beleg steht keine Zählung. Pro Konto eine Zeile mit Anzahl und Name, zum Beispiel von uniq -c.',
    ]);
    await alsAzubi(`cut -d' ' -f2 ${KOPIE} | sort | uniq -c > ~/belege/konten-zaehlung.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'zaehlung/konten-zaehlung: Eine Zahl oder ein Konto stimmt nicht. Zähle nur die fehlenden Zeilen, nicht das ganze Log.',
    ]);
    await alsAzubi(`printf '%s\\n' '4 nadia' '2 margit' > ~/belege/konten-zaehlung.txt`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'zaehlung/konten-zaehlung: Es fehlt noch ein Konto in deiner Zählung. Mit >> hängst du an, statt zu überschreiben.',
    ]);
    await alsAzubi(tippLoesung('zaehlung', 'konten-zaehlung'));
    await pruefLauf();
    expect(diagnosen()).toEqual([]);
    expect(zustand.erledigt).toEqual({ luecke: 2, zaehlung: 1 });

    // Ordnen-Schritt: kopiert, zu viel verschoben, Original ohne Ziel gelöscht.
    await pruefLauf();
    expect(diagnosen()).toEqual([]);
    await alsAzubi(`mkdir ~/quarantaene && cp ${SKRIPT} ~/quarantaene/`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'zaehlung/skript-quarantaene: Das Original liegt noch im Wartungsordner. Verschieben heißt: Danach ist es dort weg.',
    ]);
    await run(`rm -rf ${Q}`);
    await setupEpisode();
    await alsAzubi(`mkdir ~/quarantaene && mv ${BIN}/backup.sh ~/quarantaene/`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'zaehlung/skript-quarantaene: In ~/quarantaene/ liegt auch ein anderes Skript. Nur das aus der Lücke gehört dorthin.',
    ]);
    await run(`rm -rf ${Q}`);
    await setupEpisode();
    await alsAzubi(`rm ${SKRIPT}`);
    await pruefLauf();
    expect(diagnosen()).toEqual([
      'zaehlung/skript-quarantaene: Das Skript ist aus bin/ verschwunden, liegt aber nicht unverändert in ~/quarantaene/. Im Archiv liegt eine Sicherung.',
    ]);
    expect(zustand.erledigt).toEqual({ luecke: 2, zaehlung: 1 });
    expect(await hashes([LOG, KOPIE], true)).toBe(quellen);
    // Lösung nach dem Löschen aus der Archivkopie: gültig.
    await alsAzubi(`mkdir -p ~/quarantaene && cp ${ARCHIV} ~/quarantaene/logkuerzen.sh`);
    await pruefLauf();
    expect(zustand.erledigt).toEqual({ luecke: 2, zaehlung: 2 });
  }, 900_000);

  it('Setup: wiederholt liefert denselben frischen Datensatz und lässt Einsatzrahmen und eigene Dateien in Ruhe', async () => {
    await frischerLauf();
    const quellen = [LOG, KOPIE];
    const rahmen = [T8_DROPIN, '/etc/sudoers', '/etc/sudoers.d/azubi'];
    const quellenVorher = await hashes(quellen, true);
    const archivVorher = await hashes([ARCHIV]);
    const passwdVorher = (await run('grep -E "^(timo|nadia|margit):" /etc/passwd /etc/shadow'))
      .output;
    const rahmenVorher = await hashes(rahmen);
    const nadiaVorher = await hashes(['/home/nadia/vertraulich.txt']);

    // Alles gelöst: Belege, Quarantäne; dazu eigene Dateien, die bleiben müssen.
    await alsAzubi('echo bleibt > ~/belege/eigene-notiz.txt');
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    await alsAzubi(tippLoesung('zaehlung', 'skript-quarantaene'));
    await alsAzubi('echo eigene > ~/quarantaene/eigene.txt');
    expect(await belegPruefung()).toEqual({ 'luecke-zeilen': true, 'konten-zaehlung': true });
    expect(await exitVon(ordnenVerify)).toBe(0);

    for (let i = 0; i < 2; i++) {
      const wieder = await setupEpisode();
      expect(wieder.exitCode, wieder.output).toBe(0);
      expect(await hashes(quellen, true)).toBe(quellenVorher);
      expect(await hashes([ARCHIV])).toBe(archivVorher);
      expect((await run('grep -E "^(timo|nadia|margit):" /etc/passwd /etc/shadow')).output).toBe(
        passwdVorher
      );
      expect(await hashes(rahmen)).toBe(rahmenVorher);
      expect(await hashes(['/home/nadia/vertraulich.txt'])).toBe(nadiaVorher);
      expect((await run(`ls -A ${BELEGE}`)).output.trim()).toBe('eigene-notiz.txt');
      expect((await run(`ls -A ${Q}`)).output.trim()).toBe('eigene.txt');
      expect(await belegPruefung()).toEqual(keinBeleg);
      expect(await exitVon(ordnenVerify)).not.toBe(0);
      expect((await run(`ls ${BIN}`)).output.trim().split('\n')).toEqual([
        'backup.sh',
        'logkuerzen.sh',
        'logrotate-woechentlich.sh',
      ]);
      expect((await run(`stat -c '%U:%G:%a' ${SKRIPT}`)).output.trim()).toBe('nadia:nadia:755');
    }
    await alsAzubi('rm -f ~/belege/eigene-notiz.txt');
    await run(`rm -rf ${Q}`);
  }, 600_000);

  it('Einsatzrahmen: Lösungswege lösen keinen Verstoß aus, der Verstoß sperrt und lässt sich aufholen', async () => {
    await frischerLauf();
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    await alsAzubi(tippLoesung('zaehlung', 'skript-quarantaene'));
    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(false);

    const direkt = await alsAzubi('cat /home/nadia/vertraulich.txt');
    expect(direkt.rc).not.toBe(0);
    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(false);

    const erlaubt = await alsAzubi(`sudo -n ${T8_BEFEHL}`);
    expect(erlaubt.rc, erlaubt.text).toBe(0);
    const protokoll = (await run(`cat ${T8_LOG}`)).output;
    expect(protokoll).toContain(`COMMAND=${T8_BEFEHL}`);
    // Ein erneutes Episoden-Setup lässt das Protokoll in Ruhe (es räumt aber die Belege ab).
    expect((await setupEpisode()).exitCode).toBe(0);
    expect((await run(`cat ${T8_LOG}`)).output).toBe(protokoll);
    for (const id of BELEG_IDS) await alsAzubi(WEGE[id][0].befehl);
    await pruefLauf();
    expect(zustand.einsatzrahmenVerletzt).toBe(true);
    expect(typen()).toContain('einsatzrahmen-verletzt');
    expect(istGesperrt(zustand)).toBe(false);

    // Mit nur einem erkannten Beleg sperrt der Verstoß; ein weiterer hebt die Sperre auf.
    await frischerLauf();
    await alsAzubi(WEGE['luecke-zeilen'][0].befehl);
    await alsAzubi(`sudo -n ${T8_BEFEHL}`);
    await pruefLauf();
    expect(typen()).toContain('einsatzrahmen-verletzt');
    expect(istGesperrt(zustand)).toBe(true);
    await alsAzubi(WEGE['konten-zaehlung'][0].befehl);
    await pruefLauf();
    expect(typen()).toContain('sperre-aufgehoben');
    expect(istGesperrt(zustand)).toBe(false);
  }, 900_000);

  it('Raumansicht und Aktenwand liefern echte Gastwerte und lassen das Lesemanifest unverändert', async () => {
    await frischerLauf();
    await alsAzubi(WEGE['luecke-zeilen'][0].befehl);
    const raum = episode3.ansichten.find((ansicht) => ansicht.art === 'raum');
    expect(raum).toBeDefined();
    const vorher = await manifest();
    expect(vorher.hash).toMatch(/^[0-9a-f]{64}$/);

    for (let i = 0; i < 3; i++) {
      const roh = await client.run(abfrageSkript(raum!.abfrage), 20_000);
      expect(roh.exitCode).toBe(0);
      const gelesen = leseAbfrage(roh.output);
      expect(gelesen.vollstaendig).toBe(true);
      expect(gelesen.fehlerCode).toBeNull();
      expect(gelesen.werte.host).toEqual(['rw-srv01']);
      expect(gelesen.werte.konten).toEqual(
        expect.arrayContaining([
          'timo (UID 1101), Timo Kessler',
          'nadia (UID 1102), Nadia Brem',
          'margit (UID 1103), Margit Ostwind',
        ])
      );
      expect(gelesen.werte.logs).toEqual([
        'Anmeldelog auf dem Server: 17 Zeilen',
        'Kopie auf dem Logserver: 24 Zeilen',
      ]);
      expect(gelesen.werte.laufzeit?.[0]).toMatch(/^Laufzeit seit Neustart: \d+ Std\. \d+ Min\.$/);
      expect(roh.output).not.toMatch(/:x:|:!:|\$\d\$|root:/);
      if (i === 0) console.log(`E3-VM Raum:\n${roh.output.trim()}`);

      const akte = await client.run(abfrageSkript(AKTENWAND_ABFRAGE), 20_000);
      const inhalt = leseAktenwand(leseAbfrage(akte.output));
      expect(inhalt.dateien.map((datei) => datei.name)).toEqual(['luecke-zeilen.txt']);
    }
    expect(await manifest()).toEqual(vorher);
  }, 900_000);
});
