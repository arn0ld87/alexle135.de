// Struktur-Checks für die V86-Missionen. Ob Setup, verify und Flagge in der VM tatsächlich
// funktionieren, prüft der Durchlauf in der Alpine-VM, nicht dieser Test.
import { describe, expect, it } from 'vitest';
import { getV86MissionById, v86Missions } from '../v86Missions';

const EMOJI = /\p{Extended_Pictographic}/u;
const DIFFICULTIES = ['einstieg', 'fortgeschritten', 'profi'];

const EXPECTED_IDS = [
  'linux-basics-1',
  'linux-files-1',
  'linux-ctf-hidden-treasure',
  'linux-ctf-log-detective',
  'linux-ctf-privesc',
  'git-basics-1',
  'git-branching-1',
  'git-ctf-rewind',
];

describe('v86Missions', () => {
  it('enthält die erwarteten Missionen in dieser Reihenfolge', () => {
    expect(v86Missions.map((m) => m.id)).toEqual(EXPECTED_IDS);
  });

  it('hat eindeutige Mission-IDs', () => {
    const ids = v86Missions.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('kennt nur die Tracks linux und git', () => {
    for (const mission of v86Missions) {
      expect(['linux', 'git']).toContain(mission.track);
    }
  });

  it('ordnet die Tracks passend zur ID zu', () => {
    for (const mission of v86Missions) {
      expect(mission.id.startsWith(`${mission.track}-`)).toBe(true);
    }
  });

  it('setzt gültige Schwierigkeit und Dauer', () => {
    for (const mission of v86Missions) {
      expect(DIFFICULTIES).toContain(mission.difficulty);
      expect(Number.isInteger(mission.durationMin)).toBe(true);
      expect(mission.durationMin).toBeGreaterThan(0);
    }
  });

  it('liefert pro Mission Titel, Setup, Schritte und ein Flaggen-Skript', () => {
    for (const mission of v86Missions) {
      expect(mission.title.trim(), mission.id).not.toBe('');
      expect(mission.setup.trim(), mission.id).not.toBe('');
      expect(mission.steps.length, mission.id).toBeGreaterThanOrEqual(3);
      expect(mission.flag.trim(), mission.id).not.toBe('');
      expect(mission.flag, mission.id).toContain('FLAG{');
    }
  });

  it('hat je Mission eindeutige Schritt-IDs', () => {
    for (const mission of v86Missions) {
      const ids = mission.steps.map((s) => s.id);
      expect(new Set(ids).size, mission.id).toBe(ids.length);
    }
  });

  describe.each(v86Missions.map((m) => [m.id, m] as const))('%s', (_id, mission) => {
    it('gibt jedem Schritt Texte, verify, 2 bis 3 Tipps und eine Lösung', () => {
      for (const step of mission.steps) {
        const where = `${mission.id}/${step.id}`;
        expect(step.title.trim(), where).not.toBe('');
        expect(step.description.trim(), where).not.toBe('');
        expect(step.verify.trim(), where).not.toBe('');
        expect(step.solution.trim(), where).not.toBe('');
        expect(step.hints.length, where).toBeGreaterThanOrEqual(2);
        expect(step.hints.length, where).toBeLessThanOrEqual(3);
        for (const hint of step.hints) {
          expect(hint.trim(), where).not.toBe('');
        }
      }
    });

    it('verrät in keinem Tipp die vollständige Lösung', () => {
      for (const step of mission.steps) {
        for (const hint of step.hints) {
          expect(hint.includes(step.solution), `${mission.id}/${step.id}`).toBe(false);
        }
      }
    });

    it('nutzt in Lösungen keine Platzhalter wie <Hash>', () => {
      for (const step of mission.steps) {
        expect(/<[\p{L} ]+>/u.test(step.solution), `${mission.id}/${step.id}`).toBe(false);
      }
    });

    it('enthält keine Emojis in den Texten', () => {
      const texts = [
        mission.title,
        ...mission.steps.flatMap((s) => [
          s.title,
          s.description,
          s.solution,
          s.failMessage ?? '',
          ...s.hints,
        ]),
      ];
      for (const text of texts) {
        expect(EMOJI.test(text), text).toBe(false);
      }
    });

    it('lässt keine Template-Reste in den Skripten', () => {
      const scripts = [mission.setup, mission.flag, ...mission.steps.map((s) => s.verify)];
      for (const script of scripts) {
        expect(script).not.toContain('undefined');
        expect(script).not.toContain('[object');
      }
    });
  });

  describe('getV86MissionById', () => {
    it('findet jede Mission über ihre ID', () => {
      for (const mission of v86Missions) {
        expect(getV86MissionById(mission.id)).toBe(mission);
      }
    });

    it('liefert für unbekannte IDs undefined', () => {
      expect(getV86MissionById('gibt-es-nicht')).toBeUndefined();
    });
  });
});
