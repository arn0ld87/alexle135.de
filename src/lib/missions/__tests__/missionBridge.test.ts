import { describe, expect, it } from 'vitest';
import { activeMarkerScript, parseMissionRequest } from '../missionBridge';

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

describe('activeMarkerScript', () => {
  it('setzt und entfernt die Markierung', () => {
    expect(activeMarkerScript(true)).toBe('touch /run/mission/active');
    expect(activeMarkerScript(false)).toBe('rm -f /run/mission/active');
  });
});
