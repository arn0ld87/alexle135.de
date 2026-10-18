// Stand der Staffeln im Browser (localStorage): Akte, Abzeichen, rote Prompts. Kein Konto, keine
// Rangliste. Fehlender oder gesperrter Speicher ist kein Fehler: Lesen liefert einen leeren Stand,
// Schreiben wird still übersprungen. Den alten Missionsstand (`missionen:v1`) verwirft der Store
// beim ersten Anlegen; die Missionen von damals gibt es in der Staffel nicht mehr.
import {
  leererStand,
  neueAbzeichen,
  type Akte,
  type AkteEintrag,
  type StaffelStand,
} from './staffel';
import type { Staffel } from './staffelTypes';

export const STAFFEL_STORE_KEY = 'staffeln:v1';
export const LEGACY_STORE_KEY = 'missionen:v1';

export type StaffelEreignis =
  | { type: 'beweisstueck'; vorfallId: string; beweisstueckId: string; code: string }
  | { type: 'abzeichen'; abzeichenId: string };

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

function isEintrag(v: unknown): v is AkteEintrag {
  return (
    isObject(v) &&
    typeof v.durationMs === 'number' &&
    typeof v.withSolution === 'boolean' &&
    typeof v.hintsUsed === 'number' &&
    typeof v.finishedAt === 'number'
  );
}

// Unbekanntes oder kaputtes JSON fällt feldweise auf den leeren Stand zurück.
function parseStand(v: unknown): StaffelStand {
  if (!isObject(v)) return leererStand();
  const akte: Akte = {};
  if (isObject(v.akte)) {
    for (const [id, e] of Object.entries(v.akte)) if (isEintrag(e)) akte[id] = e;
  }
  const abzeichen = Array.isArray(v.abzeichen)
    ? v.abzeichen.filter((a): a is string => typeof a === 'string')
    : [];
  const rotePrompts =
    typeof v.rotePrompts === 'number' && v.rotePrompts >= 0 ? Math.floor(v.rotePrompts) : 0;
  return { akte, abzeichen, rotePrompts };
}

export function createStaffelStore(storage: StorageLike | null = defaultStorage()) {
  try {
    storage?.removeItem(LEGACY_STORE_KEY);
  } catch {
    // gesperrt: dann bleibt der alte Schlüssel eben liegen
  }

  function readAll(): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(STAFFEL_STORE_KEY) ?? '{}');
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function read(staffelId: string): StaffelStand {
    return parseStand(readAll()[staffelId]);
  }

  function write(staffelId: string, stand: StaffelStand) {
    try {
      storage?.setItem(STAFFEL_STORE_KEY, JSON.stringify({ ...readAll(), [staffelId]: stand }));
    } catch {
      // Speicher voll oder gesperrt: Stand gilt nur für diese Sitzung.
    }
  }

  // Neue Abzeichen vergeben und als Ereignisse melden.
  function award(staffel: Staffel, stand: StaffelStand, lauf?: AkteEintrag): StaffelEreignis[] {
    const neu = neueAbzeichen(staffel, stand, lauf);
    stand.abzeichen.push(...neu);
    return neu.map((abzeichenId) => ({ type: 'abzeichen', abzeichenId }));
  }

  return {
    read,
    /**
     * Trägt einen gelösten Vorfall in die Akte ein. Ein Lauf ohne Lösung ersetzt einen mit Lösung,
     * sonst zählt der schnellere. Das Beweisstück meldet nur der erste Eintrag.
     */
    loese(staffel: Staffel, vorfallId: string, eintrag: AkteEintrag): StaffelEreignis[] {
      const vorfall = staffel.vorfaelle.find((v) => v.id === vorfallId);
      if (!vorfall) return [];
      const stand = read(staffel.id);
      const previous = stand.akte[vorfallId];
      const events: StaffelEreignis[] = [];
      if (!previous) {
        const { id, code } = vorfall.beweisstueck;
        events.push({ type: 'beweisstueck', vorfallId, beweisstueckId: id, code });
      }
      const better =
        !previous ||
        (previous.withSolution && !eintrag.withSolution) ||
        (previous.withSolution === eintrag.withSolution &&
          eintrag.durationMs < previous.durationMs);
      if (better) stand.akte[vorfallId] = eintrag;
      events.push(...award(staffel, stand, eintrag));
      write(staffel.id, stand);
      return events;
    },
    /** Ein Befehl endete mit Exit ≠ 0 (roter Prompt). */
    roterPrompt(staffel: Staffel): StaffelEreignis[] {
      const stand = read(staffel.id);
      stand.rotePrompts += 1;
      const events = award(staffel, stand);
      write(staffel.id, stand);
      return events;
    },
  };
}

export type StaffelStore = ReturnType<typeof createStaffelStore>;
