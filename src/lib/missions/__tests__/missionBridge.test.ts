import { describe, expect, it } from 'vitest';
import { decodeBase64 } from '../agentProtocol';
import { activeMarkerScript, parseMissionRequest, replyScript } from '../missionBridge';

describe('parseMissionRequest', () => {
  it('liest Anfrage-ID und Befehl', () => {
    expect(parseMissionRequest('r123x45;hint')).toEqual({ requestId: 'r123x45', command: 'hint' });
    expect(parseMissionRequest('r1;__prompt')).toEqual({ requestId: 'r1', command: '__prompt' });
  });

  it('verwirft unbekannte Befehle und unsaubere IDs', () => {
    expect(parseMissionRequest('r1;rm')).toBeNull();
    expect(parseMissionRequest('r1')).toBeNull();
    expect(parseMissionRequest('r1;hint;extra')).toBeNull();
    expect(parseMissionRequest("r1';x;hint")).toBeNull();
    expect(parseMissionRequest('a b;hint')).toBeNull();
  });
});

describe('replyScript', () => {
  it('legt Exit-Code und Text atomar ab', () => {
    const script = replyScript('r9', { exitCode: 1, text: "Noch nicht: 'x' $(id)" });
    const payload = /printf %s '([A-Za-z0-9+/=]+)'/.exec(script)?.[1] ?? '';
    expect(decodeBase64(payload)).toBe("1\nNoch nicht: 'x' $(id)");
    expect(script).toContain('> /run/mission/reply.r9.tmp');
    expect(script).toContain('mv /run/mission/reply.r9.tmp /run/mission/reply.r9');
  });

  it('lehnt unsaubere IDs ab', () => {
    expect(() => replyScript('../x', { exitCode: 0, text: '' })).toThrow();
  });
});

describe('activeMarkerScript', () => {
  it('setzt und entfernt die Markierung', () => {
    expect(activeMarkerScript(true)).toBe('touch /run/mission/active');
    expect(activeMarkerScript(false)).toBe('rm -f /run/mission/active');
  });
});
