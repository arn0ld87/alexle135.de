// Struktur-Checks für jede Staffel-Datei (#396). Ob setup und verify in der VM funktionieren,
// prüft der VM-Test je Vorfall (#400, #401), nicht dieser Test.
import { describe, expect, it } from 'vitest';
import { FLAG_PATTERN } from '../../lib/missions/missionTypes';
import { vorfallAlsMission, vorfallFlag } from '../../lib/missions/staffel';
import { ABGELOESTE_MISSIONEN } from '../../lib/missions/staffelStore';
import { v86Missions } from '../missions';
import { getStaffelById, staffeln } from '../staffeln';

const EMOJI = /\p{Extended_Pictographic}/u;
const IPV4 = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
// Dokumentationsnetze (RFC 5737) und Loopback; alles andere wäre womöglich echt.
const ERLAUBTE_NETZE = ['192.0.2.', '198.51.100.', '203.0.113.', '127.'];

const unique = (values: string[]) => new Set(values).size === values.length;

describe('staffeln', () => {
  it('kennt als abgelöste Missionen genau die Linux- und Git-Missionen', () => {
    expect(ABGELOESTE_MISSIONEN).toEqual(v86Missions.map((m) => m.id));
  });

  it('hat eindeutige Staffel-IDs und findet sie per ID', () => {
    expect(unique(staffeln.map((s) => s.id))).toBe(true);
    for (const s of staffeln) expect(getStaffelById(s.id)).toBe(s);
    expect(getStaffelById('gibt-es-nicht')).toBeUndefined();
  });
});

describe.each(staffeln.map((s) => [s.id, s] as const))('Staffel %s', (_id, staffel) => {
  const { vorfaelle, abzeichen } = staffel;

  it('hat Titel, Vorfälle und Abzeichen', () => {
    expect(staffel.titel.trim()).not.toBe('');
    expect(vorfaelle.length).toBeGreaterThan(0);
    expect(abzeichen.length).toBeGreaterThan(0);
  });

  it('nummeriert die Vorfälle lückenlos ab 0 und hat eindeutige IDs', () => {
    expect(vorfaelle.map((v) => v.nr)).toEqual(vorfaelle.map((_, i) => i));
    expect(unique(vorfaelle.map((v) => v.id))).toBe(true);
  });

  it('hat höchstens ein Finale, und das steht am Ende', () => {
    const finale = vorfaelle.filter((v) => v.finale);
    expect(finale.length).toBeLessThanOrEqual(1);
    if (finale.length) expect(vorfaelle.at(-1)).toBe(finale[0]);
  });

  it('hat eindeutige Beweisstück-IDs und Codes, die als Flagge taugen', () => {
    expect(unique(vorfaelle.map((v) => v.beweisstueck.id))).toBe(true);
    expect(unique(vorfaelle.map((v) => v.beweisstueck.code))).toBe(true);
    for (const v of vorfaelle) expect(vorfallFlag(v)).toMatch(FLAG_PATTERN);
  });

  it('erzeugt Codes deterministisch: gleiche Daten, gleiche Flagge', () => {
    for (const v of vorfaelle) {
      const a = vorfallAlsMission(v);
      const b = vorfallAlsMission(structuredClone(v));
      expect(a.flag).toBe(b.flag);
      expect(a.flag).toContain(vorfallFlag(v));
      expect(a.flag).not.toMatch(/RANDOM|date|shuf|urandom/);
    }
  });

  it('hat eindeutige Abzeichen-IDs mit Titel und Beschreibung', () => {
    expect(unique(abzeichen.map((a) => a.id))).toBe(true);
    for (const a of abzeichen) {
      expect(a.titel.trim()).not.toBe('');
      expect(a.beschreibung.trim()).not.toBe('');
    }
  });

  describe.each(vorfaelle.map((v) => [v.id, v] as const))('Vorfall %s', (_vid, vorfall) => {
    it('hat Pflichtfelder: Titel, setup, Schritte, Szene, Beweisstück', () => {
      expect(vorfall.titel.trim()).not.toBe('');
      expect(vorfall.setup.trim()).not.toBe('');
      expect(vorfall.schritte.length).toBeGreaterThan(0);
      expect(vorfall.szene.length).toBeGreaterThan(0);
      expect(vorfall.beweisstueck.titel.trim()).not.toBe('');
      expect(vorfall.beweisstueck.beschreibung.trim()).not.toBe('');
    });

    it('hat 3–5 Werkzeuge, je Befehl einmal', () => {
      expect(vorfall.werkzeuge.length).toBeGreaterThanOrEqual(3);
      expect(vorfall.werkzeuge.length).toBeLessThanOrEqual(5);
      expect(unique(vorfall.werkzeuge.map((w) => w.befehl))).toBe(true);
    });

    it('hat je Schritt eindeutige ID, Pager-Text, verify und drei Tippstufen', () => {
      expect(unique(vorfall.schritte.map((s) => s.id))).toBe(true);
      for (const s of vorfall.schritte) {
        expect(s.title.trim()).not.toBe('');
        expect(s.pager.length).toBeGreaterThan(0);
        for (const line of s.pager) expect(line.trim()).not.toBe('');
        expect(s.verify.trim()).not.toBe('');
        expect(s.tipps).toHaveLength(3);
        for (const t of s.tipps) expect(t.trim()).not.toBe('');
      }
    });

    it('enthält keine Emojis und keine TypeScript-Interpolationsreste', () => {
      const text = JSON.stringify(vorfall);
      expect(text).not.toMatch(EMOJI);
      expect(text).not.toContain('undefined');
    });

    it('nutzt nur IPs aus Dokumentationsnetzen', () => {
      for (const [ip] of JSON.stringify(vorfall).matchAll(IPV4)) {
        expect(
          ERLAUBTE_NETZE.some((n) => ip.startsWith(n)),
          ip
        ).toBe(true);
      }
    });
  });
});
