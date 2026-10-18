// Missionsformat für echte Linux-Missionen (v86). Prüfung über Zustand, nicht über den
// getippten Befehl: `setup` stellt den Ausgangszustand her, je Schritt entscheidet `verify`
// (Exit-Code 0 = erfüllt). Alle Skripte laufen als root über den Agenten in der VM, mit
// /home/azubi als Arbeitsverzeichnis; Dateien für den Azubi legt `setup` selbst mit
// passendem Eigentümer an. Das Format kennt keine Browser-Details, damit später eine
// Server-Sandbox dieselben Missionen ausführen kann.

export type MissionTrack = 'linux' | 'git';
export type MissionDifficulty = 'einstieg' | 'fortgeschritten' | 'profi';

export interface MissionStep {
  id: string;
  title: string;
  description: string;
  /** Bash; Exit-Code 0 = Schritt erfüllt. Darf den Zustand nicht ändern. */
  verify: string;
  /** Gestufte Tipps, vom Groben zum Genauen; keiner verrät den kompletten Befehl. */
  hints: string[];
  /** Ein möglicher Lösungsweg, nur über `mission solve` (mit Rückfrage). */
  solution: string;
  /** Knappe Rückmeldung bei `mission check`, wenn der Zustand noch nicht stimmt. */
  failMessage?: string;
}

export interface V86Mission {
  id: string;
  track: MissionTrack;
  title: string;
  difficulty: MissionDifficulty;
  /** Geschätzte Dauer in Minuten. */
  durationMin: number;
  /** Bash; stellt den Ausgangszustand her. */
  setup: string;
  steps: MissionStep[];
  /**
   * Bash; läuft erst, wenn alle Schritte erfüllt sind, und gibt die Flagge `FLAG{...}` aus.
   * Sie soll aus dem Zielzustand entstehen (Datei, Commit-Historie o. Ä.).
   */
  flag: string;
}

export const FLAG_PATTERN = /^FLAG\{[A-Za-z0-9_-]{4,64}\}$/;

/** Befehle von `mission` in der VM; `__prompt` ist die stille Prüfung nach jedem Befehl. */
export const MISSION_COMMANDS = ['status', 'hint', 'check', 'solve', 'flag', '__prompt'] as const;
export type MissionCommand = (typeof MISSION_COMMANDS)[number];

export interface MissionReply {
  /** Exit-Code von `mission` in der Shell: 0 = ok, 1 = (noch) nicht erfüllt. */
  exitCode: number;
  text: string;
}
