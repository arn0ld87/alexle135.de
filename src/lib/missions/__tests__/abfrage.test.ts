// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  ABFRAGE_MAX_BYTES,
  ABFRAGE_MAX_ZEILEN,
  SPIELERKONTO,
  abfrageSkript,
  leseAbfrage,
} from '../abfrage';

// Führt das erzeugte Skript ohne root aus: `su` wird im Test ersetzt, nicht im Modul.
const SU = `su -s /bin/bash ${SPIELERKONTO} -c`;
const lauf = (abfrage: string): string => {
  const skript = abfrageSkript(abfrage);
  expect(skript).toContain(SU);
  return execFileSync('bash', ['-c', skript.replace(SU, 'bash -c')], { encoding: 'utf8' });
};

describe('leseAbfrage', () => {
  it('sammelt mehrere Werte je Schlüssel in Reihenfolge', () => {
    expect(leseAbfrage('konto\ta\nkonto\tb\nende\t2\n')).toEqual({
      werte: { konto: ['a', 'b'] },
      vollstaendig: true,
      fehlerCode: null,
    });
  });

  it('trennt nur am ersten TAB', () => {
    expect(leseAbfrage('x\ta\tb\tc\nende\t1\n').werte.x).toEqual(['a\tb\tc']);
  });

  it('entfernt Steuerzeichen, behält aber TAB', () => {
    expect(leseAbfrage('x\ta\x01b\x0bc\x7fd\nende\t1\n').werte.x).toEqual(['abcd']);
  });

  it('ignoriert Zeilen ohne TAB, mit ungültigem Schlüssel und ende ohne Ziffern', () => {
    const roh = 'rauschen\nohne-tab\nGroß\twert\nende\tabc\nx\tok\nende\t1\n';
    expect(leseAbfrage(roh)).toEqual({ werte: { x: ['ok'] }, vollstaendig: true, fehlerCode: null });
  });

  it('ist ohne passende Schlusszeile unvollständig', () => {
    expect(leseAbfrage('x\ta\n').vollstaendig).toBe(false);
    expect(leseAbfrage('x\ta\nende\t2\n').vollstaendig).toBe(false);
  });

  it('liest CRLF', () => {
    expect(leseAbfrage('x\ta\r\nende\t1\r\n')).toEqual({
      werte: { x: ['a'] },
      vollstaendig: true,
      fehlerCode: null,
    });
  });

  // T1: Schlüssel mit Prototyp-Namen dürfen nichts kaputt machen.
  it('liest Prototyp-Schlüssel als normale Schlüssel', () => {
    const gelesen = leseAbfrage('constructor\tA\n__proto__\tB\nende\t2\n');
    expect(Object.hasOwn(gelesen.werte, 'constructor')).toBe(true);
    expect(gelesen.werte['constructor']).toEqual(['A']);
    expect(Object.hasOwn(gelesen.werte, '__proto__')).toBe(true);
    expect(gelesen.werte['__proto__']).toEqual(['B']);
    expect(gelesen.vollstaendig).toBe(true);
  });

  // T2: Nur das exakte `ende` ist reserviert; endezeit ist ein normaler Schlüssel.
  it('liest endezeit als Schlüssel und ignoriert nur das exakte ende', () => {
    expect(leseAbfrage('endezeit\t12:00\nende\tabc\nende\t1\n')).toEqual({
      werte: { endezeit: ['12:00'] },
      vollstaendig: true,
      fehlerCode: null,
    });
  });

  // T2: Eine Abfrage darf keine falsche Schlusszeile einschleusen.
  it('filtert eine von der Abfrage eingeschleuste Schlusszeile', () => {
    const gelesen = leseAbfrage(lauf(`printf 'a\\t1\\nende\\t5\\n'`));
    expect(Object.hasOwn(gelesen.werte, 'ende')).toBe(false);
    expect(gelesen.werte.a).toEqual(['1']);
    expect(gelesen.vollstaendig).toBe(true);
  });

  // T3-5: Die Schlusszeile trägt den Exit-Status von su; 0 und 141 (SIGPIPE) sind kein Fehler.
  it('liest den Exit-Status aus der Schlusszeile', () => {
    expect(leseAbfrage('x\ta\nende\t1\t0\n').fehlerCode).toBeNull();
    expect(leseAbfrage('ende\t0\t1\n')).toEqual({
      werte: {},
      vollstaendig: true,
      fehlerCode: 1,
    });
    expect(leseAbfrage('x\ta\nende\t1\t141\n').fehlerCode).toBeNull();
    expect(leseAbfrage('x\ta\nende\t1\n').fehlerCode).toBeNull();
  });

  it('erkennt eine Schlusszeile mit ungültigem Exit-Status nicht', () => {
    expect(leseAbfrage('x\ta\nende\t1\tx\n').vollstaendig).toBe(false);
  });
});

describe('abfrageSkript', () => {
  it('führt die Abfrage aus, filtert Rauschen und zählt die Datenzeilen', () => {
    const abfrage = `printf 'host\\t%s\\n' srv; printf 'konto\\ta\\nkonto\\tb\\n'; echo 'rauschen'`;
    expect(leseAbfrage(lauf(abfrage))).toEqual({
      werte: { host: ['srv'], konto: ['a', 'b'] },
      vollstaendig: true,
      fehlerCode: null,
    });
  });

  it('deckelt die Zahl der Zeilen und bleibt dabei vollständig', () => {
    const ausgabe = lauf(`for i in $(seq 1 1000); do printf 'k\\t%s\\n' "$i"; done`);
    const gelesen = leseAbfrage(ausgabe);
    expect(gelesen.werte.k).toHaveLength(ABFRAGE_MAX_ZEILEN);
    expect(gelesen.werte.k[0]).toBe('1');
    expect(gelesen.werte.k.at(-1)).toBe('400');
    expect(gelesen.vollstaendig).toBe(true);
  });

  // T3: Ein NUL-Byte darf grep nicht in den Binärmodus werfen.
  it('bricht bei einem NUL-Byte nicht ab', () => {
    const gelesen = leseAbfrage(lauf(`printf 'a\\tx\\0y\\nb\\tz\\n'`));
    expect(gelesen.werte.b).toEqual(['z']);
    expect(gelesen.vollstaendig).toBe(true);
  });

  // T4/T3-4: Gekürzt wird nur an ganzen Zeilen, und zwar exakt an der Byte-Grenze.
  it('kürzt 100 Zeilen à 1002 Byte auf genau 59 Zeilen', () => {
    const wert = 'x'.repeat(999);
    const gelesen = leseAbfrage(
      lauf(`for i in $(seq 1 100); do printf 'k\\t%s\\n' '${wert}'; done`)
    );
    expect(gelesen.werte.k).toHaveLength(59);
    for (const gelesenWert of gelesen.werte.k) expect(gelesenWert).toHaveLength(999);
    expect(gelesen.werte.k.length * 1002).toBeLessThanOrEqual(ABFRAGE_MAX_BYTES);
    expect(gelesen.vollstaendig).toBe(true);
  });

  // T3-4: Die Grenze zählt Bytes, nicht Zeichen: 999 `ä` sind 1998 Byte je Wert.
  it('zählt bei Mehrbyte-Zeichen die Byte-Länge, nicht die Zeichenzahl', () => {
    const wert = 'ä'.repeat(999);
    const gelesen = leseAbfrage(
      lauf(`for i in $(seq 1 100); do printf 'k\\t%s\\n' '${wert}'; done`)
    );
    expect(gelesen.werte.k).toHaveLength(29);
    for (const gelesenWert of gelesen.werte.k) expect(gelesenWert).toHaveLength(999);
    expect(gelesen.werte.k.length * 2001).toBeLessThanOrEqual(ABFRAGE_MAX_BYTES);
    expect(gelesen.vollstaendig).toBe(true);
  });

  it('transportiert Sonderzeichen unverändert', () => {
    const ausgabe = lauf(`printf 'x\\t%s\\n' 'a'\\''b"c$d\\e'`);
    expect(leseAbfrage(ausgabe).werte.x).toEqual(['a\'b"c$d\\e']);
  });

  it('wirft bei einem ungültigen Konto', () => {
    expect(() => abfrageSkript('true', 'root;rm')).toThrow(/Konto/);
    expect(() => abfrageSkript('true', 'Root')).toThrow(/Konto/);
  });

  it('erkennt eine abgeschnittene Ausgabe als unvollständig', () => {
    const ausgabe = lauf(
      `printf 'host\\t%s\\n' srv; printf 'konto\\ta\\nkonto\\tb\\n'; echo 'rauschen'`
    );
    const gekuerzt = ausgabe.slice(0, Math.floor((ausgabe.length * 2) / 3));
    expect(leseAbfrage(gekuerzt).vollstaendig).toBe(false);
  });

  // T3-6: Ein Fehler der Abfrage wird als Exit-Status gemeldet, nicht als leere Abfrage.
  it('meldet den Exit-Status einer fehlgeschlagenen Abfrage', () => {
    expect(leseAbfrage(lauf('exit 3'))).toEqual({
      werte: {},
      vollstaendig: true,
      fehlerCode: 3,
    });
  });

  it('meldet keinen Fehler, wenn die Abfrage gelingt', () => {
    const gelesen = leseAbfrage(lauf(`printf 'a\\t1\\n'`));
    expect(gelesen.werte.a).toEqual(['1']);
    expect(gelesen.fehlerCode).toBeNull();
  });
});
