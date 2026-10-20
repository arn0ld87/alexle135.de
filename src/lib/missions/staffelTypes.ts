// Staffeln der Terminal-Missionen (#395): reine Daten, eine Datei je Staffel unter
// src/data/staffeln/. Ein Vorfall ist eine Mission auf Alex' Server; geprüft wird wie bisher
// der Zustand (verify je Schritt), die Engine führt ihn über `vorfallAlsMission` aus.
import type { MissionTool } from './missionTypes';
import type { Pose } from './pager';

/** Gestufte Tipps über „Alex fragen“: Richtung → Befehl → Lösung (markiert „mit Lösung“). */
export type GestufteTipps = readonly [richtung: string, befehl: string, loesung: string];

export interface VorfallSchritt {
  id: string;
  title: string;
  /** Pager-Nachrichten, Zeile für Zeile; die erste erscheint, sobald der Schritt aktuell wird. */
  pager: string[];
  /** Bash als root; Exit-Code 0 = Zustand erreicht. Ändert nichts. */
  verify: string;
  tipps: GestufteTipps;
  /** Bash; erkennt typische Fehler und gibt eine Meldung aus (leer = keine Diagnose). */
  diagnose?: string;
  /** Artefakt relativ zum Home, an dem ein Fehlversuch erkennbar ist (Fast-Meldung). */
  target?: string;
  /** Meldung, wenn der Zustand noch nicht stimmt und keine Diagnose greift. */
  failMessage?: string;
  /** Pose der Figur zu diesem Auftrag (#402); sonst „zeigt“. */
  pose?: Pose;
}

export interface Beweisstueck {
  id: string;
  titel: string;
  /** Ein Satz für die Akte: Welche Spur hat der Vorfall gelegt? */
  beschreibung: string;
  /** Fester Code der Karte, Teil der Flagge `FLAG{code}`; je Staffel eindeutig. */
  code: string;
}

export interface Vorfall {
  /** 0–8; bestimmt die Reihenfolge in der Akte. */
  nr: number;
  id: string;
  titel: string;
  /** Bash als root; legt den kaputten Ausgangszustand an. */
  setup: string;
  schritte: VorfallSchritt[];
  /** 3–5 Befehlskarten; Einträge aus dem Glossar (glossar.ts). */
  werkzeuge: MissionTool[];
  beweisstueck: Beweisstueck;
  /** Urlaubs- oder Krimiszene im Pager nach der Lösung. */
  szene: string[];
  /** Pose zur Szene; sonst „urlaub“. */
  szenePose?: Pose;
  /** Nur das Finale: gesperrt, bis alle anderen Vorfälle in der Akte stehen. */
  finale?: boolean;
}

export type AbzeichenRegel =
  /** Vorfall ohne einen einzigen Tipp gelöst. */
  | { art: 'ohne-tipp' }
  /** Vorfall schneller gelöst als `ms`. */
  | { art: 'schnell'; ms: number }
  /** Ganze Akte ohne Lösung (Tippstufe 3 oder `mission solve`). */
  | { art: 'nie-loesung' }
  /** So viele rote Prompts (Befehl mit Exit ≠ 0) insgesamt. */
  | { art: 'rote-prompts'; anzahl: number };

export interface Abzeichen {
  id: string;
  titel: string;
  beschreibung: string;
  regel: AbzeichenRegel;
}

export interface Staffel {
  id: string;
  titel: string;
  vorfaelle: Vorfall[];
  abzeichen: Abzeichen[];
}
