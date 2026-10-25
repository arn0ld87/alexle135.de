// Stand der Staffeln im Browser (localStorage): Akte, Abzeichen, rote Prompts. Kein Konto, keine
// Rangliste. Fehlender oder gesperrter Speicher ist kein Fehler: Lesen liefert einen leeren Stand,
// Schreiben wird still übersprungen. Aus dem alten Missionsstand (`missionen:v1`) entfernt der Store
// beim Anlegen nur die Linux- und Git-Missionen, die die Staffel ablöst; derselbe Schlüssel hält
// weiter den Fortschritt der Windows-Missionen (Codex-Finding zu #396).
import {
  leererStand,
  neueAbzeichen,
  type Akte,
  type AkteEintrag,
  type StaffelStand,
} from './staffel';
import type { Staffel } from './staffelTypes';

export const STAFFEL_STORE_KEY = 'staffeln:v1';
/** Staffel 2 hält je Episode nur den Abschluss in der Akte, keinen laufenden Stand. */
export const STAFFEL2_ID = 'staffel-2';
export const LEGACY_STORE_KEY = 'missionen:v1';
/** Die Missionen 01–08, die Staffel 1 ersetzt. */
export const ABGELOESTE_MISSIONEN = [
  'linux-basics-1',
  'linux-files-1',
  'linux-ctf-hidden-treasure',
  'linux-ctf-log-detective',
  'linux-ctf-privesc',
  'git-basics-1',
  'git-branching-1',
  'git-ctf-rewind',
];

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
    typeof v.finishedAt === 'number' &&
    (v.vorwurfVersuche === undefined || typeof v.vorwurfVersuche === 'number')
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
  const stand: StaffelStand = { akte, abzeichen, rotePrompts };
  if (typeof v.zurueckgesetztAm === 'number') stand.zurueckgesetztAm = v.zurueckgesetztAm;
  return stand;
}

/** Lauf a ist besser als b: ohne Lösung schlägt mit Lösung, sonst zählt die kürzere Zeit. */
function besser(a: AkteEintrag, b: AkteEintrag): boolean {
  if (a.withSolution !== b.withSolution) return !a.withSolution;
  return a.durationMs < b.durationMs;
}

function vereine(a: StaffelStand, b: StaffelStand): StaffelStand {
  const akte: Akte = { ...a.akte };
  for (const [id, e] of Object.entries(b.akte)) if (!akte[id] || besser(e, akte[id])) akte[id] = e;
  return {
    akte,
    abzeichen: [...new Set([...a.abzeichen, ...b.abzeichen])],
    rotePrompts: Math.max(a.rotePrompts, b.rotePrompts),
  };
}

/**
 * Zwei Stände derselben Staffel vereinen: je Vorfall der bessere Lauf, alle Abzeichen. Hat einer die
 * Staffel gelöscht, gilt von beiden nur, was danach entstand: Akte-Einträge nach dem Zeitstempel, aber
 * Abzeichen und rote Prompts nur vom Stand, der das Löschen kennt (sie lassen sich nicht datieren).
 * So schreibt ein offener zweiter Tab Gelöschtes nicht zurück.
 */
function mergeStand(a: StaffelStand, b: StaffelStand): StaffelStand {
  const t = Math.max(a.zurueckgesetztAm ?? 0, b.zurueckgesetztAm ?? 0);
  if (!t) return vereine(a, b);
  const gilt = (stand: StaffelStand): StaffelStand => {
    const kennt = stand.zurueckgesetztAm === t;
    return {
      akte: Object.fromEntries(Object.entries(stand.akte).filter(([, e]) => e.finishedAt > t)),
      abzeichen: kennt ? stand.abzeichen : [],
      rotePrompts: kennt ? stand.rotePrompts : 0,
    };
  };
  return { ...vereine(gilt(a), gilt(b)), zurueckgesetztAm: t };
}

export function createStaffelStore(storage: StorageLike | null = defaultStorage()) {
  try {
    const raw = storage?.getItem(LEGACY_STORE_KEY);
    if (raw) {
      const legacy: unknown = JSON.parse(raw);
      if (isObject(legacy) && ABGELOESTE_MISSIONEN.some((id) => id in legacy)) {
        const rest = Object.fromEntries(
          Object.entries(legacy).filter(([id]) => !ABGELOESTE_MISSIONEN.includes(id))
        );
        if (Object.keys(rest).length) storage?.setItem(LEGACY_STORE_KEY, JSON.stringify(rest));
        else storage?.removeItem(LEGACY_STORE_KEY);
      }
    }
  } catch {
    // kaputt oder gesperrt: dann bleibt der alte Schlüssel unverändert liegen
  }

  function readAll(): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(STAFFEL_STORE_KEY) ?? '{}');
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  // Der Stand lebt im Speicher und wird nach localStorage gespiegelt. Fehlt localStorage oder ist
  // er voll, gilt er so wenigstens für diese Sitzung (Codex-Finding zu #399): Die Akte füllt sich
  // weiter, das Finale schaltet frei. Gelesen wird beides zusammengeführt, damit ein zweiter Tab
  // nichts überschreibt, was der erste gelöst hat.
  const memory = readAll();

  function read(staffelId: string): StaffelStand {
    const stand = mergeStand(parseStand(readAll()[staffelId]), parseStand(memory[staffelId]));
    // Der Cache übernimmt, was ein anderer Tab geschrieben oder gelöscht hat.
    memory[staffelId] = stand;
    return stand;
  }

  function write(staffelId: string, stand: StaffelStand) {
    memory[staffelId] = stand;
    try {
      storage?.setItem(STAFFEL_STORE_KEY, JSON.stringify({ ...readAll(), [staffelId]: stand }));
    } catch {
      // Speicher voll oder gesperrt: Der Stand bleibt im Speicher.
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
      if (!previous || besser(eintrag, previous)) stand.akte[vorfallId] = eintrag;
      events.push(...award(staffel, stand, eintrag));
      write(staffel.id, stand);
      return events;
    },
    /**
     * Trägt den Abschluss einer Episode ohne Staffel-Definition ein (Staffel 2: keine Beweisstück-
     * Ereignisse, keine Abzeichen). Es gilt dieselbe Regel wie bei `loese`: der bessere Lauf bleibt.
     */
    loeseEpisode(staffelId: string, episodeId: string, eintrag: AkteEintrag) {
      const stand = read(staffelId);
      const previous = stand.akte[episodeId];
      if (!previous || besser(eintrag, previous)) stand.akte[episodeId] = eintrag;
      write(staffelId, stand);
    },
    /**
     * Löscht den Stand einer Staffel; andere Staffeln bleiben unberührt. Der Zeitstempel bleibt
     * stehen, damit ein offener zweiter Tab Gelöschtes nicht zurückschreibt.
     */
    loescheStaffel(staffelId: string) {
      write(staffelId, { ...leererStand(), zurueckgesetztAm: Date.now() });
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
