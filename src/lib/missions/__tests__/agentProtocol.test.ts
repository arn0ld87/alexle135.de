import { describe, expect, it } from 'vitest';
import {
  createAgentParser,
  decodeBase64,
  encodeBase64,
  encodePing,
  encodeReply,
  encodeRun,
  isValidId,
} from '../agentProtocol';

describe('Base64 (UTF-8)', () => {
  it.each(['', 'echo hi', 'echo "Größe: ä ö ü ß €"\n', 'x'.repeat(100_000)])(
    'Roundtrip für %#',
    (text) => {
      expect(decodeBase64(encodeBase64(text))).toBe(text);
    }
  );

  it('kodiert Mehrzeiler ohne Zeilenumbruch', () => {
    expect(encodeBase64('a\nb\nc\n')).not.toMatch(/[\s]/);
  });
});

describe('Encoder', () => {
  it('PING ist eine Zeile', () => {
    expect(encodePing('m1')).toBe('PING m1\n');
  });

  it('RUN enthält ID und Base64-Skript', () => {
    expect(encodeRun('m2', 'test -d /home/azubi && git --version')).toBe(
      `RUN m2 ${btoa('test -d /home/azubi && git --version')}\n`
    );
  });

  it.each(['', 'a b', 'a\nb', 'x'.repeat(33), 'ä'])('weist ID %j ab', (id) => {
    expect(isValidId(id)).toBe(false);
    expect(() => encodePing(id)).toThrow();
    expect(() => encodeRun(id, 'true')).toThrow();
  });

  it('REPLY trägt Anfrage-ID und Exit-Code, der Text ist der Rest der Zeile', () => {
    expect(encodeReply('m7', 'r12x3', { exitCode: 1, text: 'Tipp: `ls -a` „äö“' })).toBe(
      'REPLY m7 r12x3:1 Tipp: `ls -a` „äö“\n'
    );
    expect(encodeReply('m7', 'r1x1', { exitCode: 0, text: '' })).toBe('REPLY m7 r1x1:0 \n');
  });

  it('REPLY kodiert Zeilenumbrüche als \\x1e und entfernt Steuerzeichen', () => {
    expect(encodeReply('m7', 'r1x2', { exitCode: 0, text: 'a\r\nb\nc\x07\x1bd' })).toBe(
      'REPLY m7 r1x2:0 a\x1eb\x1ecd\n'
    );
    expect(() => encodeReply('m7', '../x', { exitCode: 0, text: '' })).toThrow();
  });

  it('akzeptiert ID-Zeichen A-Z a-z 0-9 _ -', () => {
    expect(isValidId('Ab_9-z')).toBe(true);
    expect(isValidId('x'.repeat(32))).toBe(true);
  });
});

describe('Parser', () => {
  it('liest HELLO', () => {
    expect(createAgentParser().push('HELLO 1\n')).toEqual([{ type: 'hello', version: 1 }]);
  });

  it('liest ein Ergebnis mit Exit-Code und Ausgabe', () => {
    const line = `RES m1 3 ${encodeBase64('git version 2.47\nzweite Zeile\n')}\n`;
    expect(createAgentParser().push(line)).toEqual([
      { type: 'result', id: 'm1', exitCode: 3, output: 'git version 2.47\nzweite Zeile\n' },
    ]);
  });

  it('liest leere Ausgabe (-)', () => {
    expect(createAgentParser().push('RES m1 0 -\n')).toEqual([
      { type: 'result', id: 'm1', exitCode: 0, output: '' },
    ]);
  });

  it('liest Fehlermeldungen mit und ohne ID', () => {
    expect(createAgentParser().push('ERR m4 bad-base64\nERR - bad-id\n')).toEqual([
      { type: 'error', id: 'm4', reason: 'bad-base64' },
      { type: 'error', id: null, reason: 'bad-id' },
    ]);
  });

  it('setzt zerstückelte Zeilen zusammen (Byte für Byte)', () => {
    const parser = createAgentParser();
    const wire = `RES m7 0 ${encodeBase64('ok')}\n`;
    const messages = [...wire].flatMap((char) => parser.push(char));
    expect(messages).toEqual([{ type: 'result', id: 'm7', exitCode: 0, output: 'ok' }]);
  });

  it('liefert mehrere Nachrichten in einem Chunk und behält den Rest', () => {
    const parser = createAgentParser();
    expect(parser.push('RES a 0 -\nRES b 1 -\nRES c')).toHaveLength(2);
    expect(parser.push(' 2 -\n')).toEqual([{ type: 'result', id: 'c', exitCode: 2, output: '' }]);
  });

  it('akzeptiert CRLF', () => {
    expect(createAgentParser().push('RES m1 0 -\r\n')).toEqual([
      { type: 'result', id: 'm1', exitCode: 0, output: '' },
    ]);
  });

  it('ignoriert Echo, Rauschen und leere Zeilen', () => {
    const parser = createAgentParser();
    const noise = [
      'RUN m1 dGVzdA==',
      'PING m1',
      '',
      'login: ',
      'RES',
      'RES m1',
      'RES m1 x -',
      'RES m1 0 - zuviel',
      'RES bad id 0 -',
      'HELLO',
      'HELLO abc',
      'ERR a b c',
      'ERR ungültig grund',
    ];
    expect(parser.push(noise.join('\n') + '\n')).toEqual([]);
  });

  it('meldet kaputtes Base64 als Fehler statt zu werfen', () => {
    expect(createAgentParser().push('RES m1 0 abc\nRES m2 0 a$bc\n')).toEqual([
      { type: 'error', id: 'm1', reason: 'bad-output' },
      { type: 'error', id: 'm2', reason: 'bad-output' },
    ]);
  });

  it('verwirft überlange Zeilen ohne Zeilenende', () => {
    const parser = createAgentParser();
    expect(parser.push('x'.repeat(200_000))).toEqual([]);
    expect(parser.push('RES m1 0 -\n')).toEqual([
      { type: 'result', id: 'm1', exitCode: 0, output: '' },
    ]);
  });
});
