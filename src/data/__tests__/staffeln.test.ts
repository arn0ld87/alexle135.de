// Struktur-Checks für jede Staffel-Datei (#396). Ob setup und verify in der VM funktionieren,
// prüft der VM-Test je Vorfall (#400, #401), nicht dieser Test.
import { describe, expect, it } from 'vitest';
import { FLAG_PATTERN } from '../../lib/missions/missionTypes';
import {
  istFreigegeben,
  vorfallAlsMission,
  vorfallFlag,
  type Akte,
} from '../../lib/missions/staffel';
import { ABGELOESTE_MISSIONEN } from '../../lib/missions/staffelStore';
import { v86Missions } from '../missions';
import { getStaffelById, staffeln } from '../staffeln';
import { staffel1 } from '../staffeln/staffel-1';

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

describe('Staffel 1', () => {
  // #401: Das Finale (Vorfall 8) öffnet sich erst, wenn 0–7 in der Akte stehen.
  it('sperrt das Finale, bis alle anderen Vorfälle gelöst sind', () => {
    expect(staffel1.vorfaelle.map((v) => v.nr)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const finale = staffel1.vorfaelle.at(-1)!;
    expect(finale.finale).toBe(true);
    const akte: Akte = {};
    for (const v of staffel1.vorfaelle.slice(0, -1)) {
      expect(istFreigegeben(staffel1, akte, finale.id), `vor ${v.id}`).toBe(false);
      expect(istFreigegeben(staffel1, akte, v.id)).toBe(true);
      akte[v.id] = { durationMs: 1, withSolution: false, hintsUsed: 0, finishedAt: 1 };
    }
    expect(istFreigegeben(staffel1, akte, finale.id)).toBe(true);
  });

  it('trägt den Staffeltitel „Fall Kehrwoche“', () => {
    expect(staffel1.titel).toBe('Fall Kehrwoche');
  });

  it('nennt die Episoden 4 und 8 wie im Trailer', () => {
    const titel = (nr: number) => staffel1.vorfaelle.find((v) => v.nr === nr)?.titel;
    expect(titel(4)).toBe('Konto sperren, Spur sichern');
    expect(titel(8)).toBe('Finale: Wer steckt dahinter?');
  });

  // Im Spiel heißt es „Episode“; `vorfall` bleibt nur als Bezeichner im Code (ADR 0002).
  it('nennt in keiner Zeichenkette mehr „Vorfall“', () => {
    const texte: string[] = [];
    const sammeln = (wert: unknown): void => {
      if (typeof wert === 'string') texte.push(wert);
      else if (Array.isArray(wert)) wert.forEach(sammeln);
      else if (wert && typeof wert === 'object')
        Object.values(wert as Record<string, unknown>).forEach(sammeln);
    };
    sammeln(staffel1);
    expect(texte.filter((t) => /Vorfall|Vorfälle/.test(t))).toEqual([]);
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

  // PRD #395, D1: „Antwort in Datei schreiben“ höchstens einmal je Staffel.
  it('hat höchstens eine Aufgabe „Antwort in Datei schreiben“', () => {
    const antworten = vorfaelle.flatMap((v) =>
      v.schritte.filter((s) => s.verify.includes('fileis ')).map((s) => `${v.id}/${s.id}`)
    );
    expect(antworten.length, antworten.join(', ')).toBeLessThanOrEqual(1);
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
