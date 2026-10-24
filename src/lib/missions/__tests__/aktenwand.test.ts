// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SPIELERKONTO, abfrageSkript, leseAbfrage } from '../abfrage';
import {
  AKTENWAND_ABFRAGE,
  AKTENWAND_MAX_DATEIEN,
  AKTENWAND_MAX_VORSCHAU_BYTES,
  leseAktenwand,
  ordneBelege,
  regelFuerDatei,
} from '../aktenwand';
import type { BelegRegel } from '../ermittlungTypes';

// Führt das echte Abfrage-Skript ohne root aus: `su` wird nur im Test ersetzt.
const SU = `su -s /bin/bash ${SPIELERKONTO} -c`;
const haeuser: string[] = [];

const neuesHaus = (): string => {
  const haus = mkdtempSync(join(tmpdir(), 'aktenwand-'));
  haeuser.push(haus);
  return haus;
};

const belegeOrdner = (haus: string): string => {
  const ordner = join(haus, 'belege');
  mkdirSync(ordner, { recursive: true });
  return ordner;
};

const lauf = (haus: string): string => {
  const skript = abfrageSkript(AKTENWAND_ABFRAGE);
  expect(skript).toContain(SU);
  return execFileSync('bash', ['-c', skript.replace(SU, 'bash -c')], {
    encoding: 'utf8',
    env: { ...process.env, HOME: haus },
    timeout: 15_000,
  });
};

const lies = (haus: string) => leseAktenwand(leseAbfrage(lauf(haus)));

const b64 = (wert: string | Uint8Array): string => Buffer.from(wert).toString('base64');
const sortiereC = (a: string, b: string): number =>
  Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

const regeln: readonly BelegRegel[] = [
  {
    id: 'notiz',
    beschreibung: 'Eine Notiz.',
    spurId: 'ankommen',
    stuetzt: 'person-a',
    verify: 'true',
  },
  {
    id: 'protokoll',
    beschreibung: 'Ein Protokoll.',
    spurId: 'protokoll',
    stuetzt: 'person-a',
    verify: 'true',
  },
];

afterEach(() => {
  for (const haus of haeuser.splice(0)) rmSync(haus, { recursive: true, force: true });
});

describe('Aktenwand: Skript und Parser (T6)', () => {
  it('T6-1: fehlender und leerer Ordner sind gültig leer, Unterordner zählen nicht', () => {
    const ohneOrdner = neuesHaus();
    expect(lies(ohneOrdner)).toEqual({ dateien: [], weitereDateien: false, hinweis: null });

    const haus = neuesHaus();
    const ordner = belegeOrdner(haus);
    expect(lies(haus).dateien).toEqual([]);

    writeFileSync(join(ordner, 'a.txt'), 'a');
    writeFileSync(join(ordner, 'b.txt'), 'bb');
    mkdirSync(join(ordner, 'unter'));
    writeFileSync(join(ordner, 'unter', 'c.txt'), 'ccc');

    const inhalt = lies(haus);
    expect(inhalt.dateien.map((datei) => datei.name)).toEqual(['a.txt', 'b.txt']);
    expect(inhalt.dateien.map((datei) => datei.bytes)).toEqual([1, 2]);
    expect(inhalt.dateien.map((datei) => datei.vorschau)).toEqual(['a', 'bb']);
    expect(inhalt.hinweis).toBeNull();
  });

  it('T6-1: unlesbarer bestehender Ordner und belege als Datei sind Fehler, nicht leer', () => {
    const gesperrt = neuesHaus();
    const ordner = belegeOrdner(gesperrt);
    chmodSync(ordner, 0o000);
    const gelesen = leseAbfrage(lauf(gesperrt));
    expect(gelesen.fehlerCode).not.toBeNull();
    expect(leseAktenwand(gelesen).hinweis).toMatch(/nicht vollständig gelesen/i);
    chmodSync(ordner, 0o700);

    const datei = neuesHaus();
    writeFileSync(join(datei, 'belege'), 'kein Verzeichnis');
    expect(leseAbfrage(lauf(datei)).fehlerCode).toBe(1);
  });

  it('T6-2: Leerzeichen, Unicode, Tabs, Zeilenumbrüche und Shell-Zeichen bleiben Daten', () => {
    const haus = neuesHaus();
    const ordner = belegeOrdner(haus);
    const namen = [
      'mit leerzeichen.txt',
      'Ümlaut-ä.txt',
      'tab\tname.txt',
      'zeile\numbruch.txt',
      '-führend.txt',
      '$(touch pwned).txt',
      'quote"name.txt',
      "single'name.txt",
      'stern*.txt',
      'semi;colon.txt',
      'back`tick.txt',
    ];
    for (const name of namen) writeFileSync(join(ordner, name), `inhalt:${name}`);

    const inhalt = lies(haus);
    expect(inhalt.dateien.map((datei) => datei.name)).toEqual([...namen].sort(sortiereC));
    for (const datei of inhalt.dateien) expect(datei.vorschau).toBe(`inhalt:${datei.name}`);
    expect(existsSync(join(haus, 'pwned'))).toBe(false);
  });

  it('T6-3: Symlinks, Symlink-Ordner und FIFO werden nicht verfolgt oder blockierend gelesen', () => {
    const haus = neuesHaus();
    const ordner = belegeOrdner(haus);
    writeFileSync(join(ordner, 'echt.txt'), 'echt');
    symlinkSync('/etc/passwd', join(ordner, 'passwd.txt'));

    const ziel = join(haus, 'ziel');
    mkdirSync(ziel);
    writeFileSync(join(ziel, 'geheim.txt'), 'geheim');
    symlinkSync(ziel, join(ordner, 'ordner'));
    execFileSync('mkfifo', [join(ordner, 'pipe')]);

    const inhalt = lies(haus);
    expect(inhalt.dateien.map((datei) => datei.name)).toEqual(['echt.txt']);
    expect(inhalt.dateien[0]?.vorschau).toBe('echt');

    const verlinkt = neuesHaus();
    symlinkSync(ordner, join(verlinkt, 'belege'));
    expect(lies(verlinkt).dateien).toEqual([]);
  });

  it('T6-4: 51 Dateien und eine große Binärdatei bleiben begrenzt', () => {
    const haus = neuesHaus();
    const ordner = belegeOrdner(haus);
    writeFileSync(join(ordner, '000-gross.bin'), Buffer.alloc(1024 * 1024, 0xff));
    for (let i = 0; i < 50; i++) {
      writeFileSync(join(ordner, `datei-${String(i).padStart(2, '0')}.txt`), `x${i}`);
    }

    const roh = lauf(haus);
    expect(Buffer.byteLength(roh, 'utf8')).toBeLessThan(60_000);
    const inhalt = leseAktenwand(leseAbfrage(roh));
    expect(inhalt.dateien).toHaveLength(AKTENWAND_MAX_DATEIEN);
    expect(inhalt.weitereDateien).toBe(true);

    const gross = inhalt.dateien.find((datei) => datei.name === '000-gross.bin');
    expect(gross).toBeDefined();
    expect(gross?.vorschau).toContain('[Nichttextuelle Daten]');
    expect(gross?.vorschau.length).toBeLessThanOrEqual(AKTENWAND_MAX_VORSCHAU_BYTES + 40);
    expect(inhalt.dateien.some((datei) => datei.name === 'datei-49.txt')).toBe(false);
  });

  it('T6-5: ungültige Felder und doppelte Namen werden sichtbar und robust behandelt', () => {
    const name = b64('notiz.txt');
    const vorschau = b64('text');
    const roh = [
      `datei\t${name}\t5\t${vorschau}`,
      `datei\t${name}\t5\t${vorschau}`,
      `datei\t${b64('kaputt.txt')}\t5\t!!!`,
      `datei\t${b64('negativ.txt')}\t-1\t${vorschau}`,
      `datei\t${b64('kurz.txt')}\t5`,
      `datei\t${b64('lang.txt')}\t5\t${vorschau}\tzu-viel`,
      'hinweis\tweitere-dateien',
    ].join('\n');
    const inhalt = leseAktenwand(leseAbfrage(`${roh}\nende\t7\t0\n`));

    expect(inhalt.dateien).toHaveLength(1);
    expect(inhalt.dateien[0]).toEqual({ name: 'notiz.txt', bytes: 5, vorschau: 'text' });
    expect(inhalt.weitereDateien).toBe(true);
    expect(inhalt.hinweis).toMatch(/ungültig/i);
  });

  it('T6-5: unvollständige Abfrage und Fehlerstatus werden nicht als vollständig ausgegeben', () => {
    expect(
      leseAktenwand({ werte: {}, vollstaendig: false, fehlerCode: null }).hinweis
    ).toMatch(/unvollständig/i);
    expect(
      leseAktenwand({ werte: {}, vollstaendig: true, fehlerCode: 2 }).hinweis
    ).toMatch(/nicht vollständig gelesen/i);
  });

  it('T6-6: nur <id>.txt wird einer Regel zugeordnet, Regeln ohne Datei bleiben unsichtbar', () => {
    expect(regelFuerDatei('notiz.txt', regeln)?.id).toBe('notiz');
    expect(regelFuerDatei('notiz.txt.bak', regeln)).toBeNull();
    expect(regelFuerDatei('falsch.txt', regeln)).toBeNull();

    const inhalt = {
      dateien: [{ name: 'falsch.txt', bytes: 1, vorschau: 'x' }],
      weitereDateien: false,
      hinweis: null,
    };
    const eintraege = ordneBelege(inhalt, regeln, ['notiz', 'protokoll']);
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.regel).toBeNull();
    expect(eintraege[0]?.erkannt).toBe(false);

    const mitNotiz = {
      ...inhalt,
      dateien: [{ name: 'notiz.txt', bytes: 5, vorschau: 'notiz' }],
    };
    expect(ordneBelege(mitNotiz, regeln, ['notiz'])[0]).toMatchObject({
      regel: regeln[0],
      erkannt: true,
    });
    expect(ordneBelege(mitNotiz, regeln, [])[0]?.erkannt).toBe(false);
    expect(ordneBelege({ ...inhalt, dateien: [] }, regeln, ['notiz'])).toEqual([]);
  });
});
