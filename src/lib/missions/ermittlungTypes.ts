// Episoden von Staffel 2 (Konzept .planning/staffel-2/KONZEPT.md §4, ADR 0007): reine Daten.
// Eine Ermittlung hat Spuren in freier Reihenfolge, Ansichten, die echten VM-Zustand nur lesen
// (ADR 0004), und einen Vorwurf, der mit Belegen aus ~/belege/ gestützt werden muss.
import type { Pose } from './pager';
import type { Beweisstueck, VorfallSchritt } from './staffelTypes';

export type AnsichtArt = 'raum' | 'aktenwand';

/** Anklickbare Stelle in einem Bauplan; Koordinaten in viewBox-Einheiten der Zeichnung. */
export interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Schlüssel der Abfrage-Ausgabe, dessen Werte die Detailkarte zeigt. */
  schluessel: string;
}

export interface Ansicht {
  id: string;
  art: AnsichtArt;
  titel: string;
  /** Bash; läuft als Spielerkonto, liest nur; gibt Zeilen `schluessel<TAB>wert` aus. */
  abfrage: string;
  hotspots?: readonly Hotspot[];
}

export type Schrittart =
  'sichern' | 'eingreifen' | 'reparieren' | 'ablesen' | 'ordnen' | 'bearbeiten';

export interface AntwortFrage {
  /** Sichtbare Frage über dem Feld, z. B. „Wann beginnt die Lücke? (HH:MM)“ */
  frage: string;
  /** Hinweis zum Format, als Platzhalter und aria-describedby. */
  format: string;
  /** Bash als root; die Antwort steht in $ANTWORT. Exit 0 = passt zum VM-Zustand. Ändert nichts. */
  pruefung: string;
}

/**
 * Schritt einer Ermittlung (ADR 0009). Außer `ablesen` sind alle Arten reine `verify`-Skripte;
 * die Art kennzeichnet sie nur. Ein Ablesen-Schritt hat `verify: 'false'` oder ein verify, das
 * schon ohne Antwort beweisbar ist (z. B. über einen Folgezustand).
 */
export interface ErmittlungsSchritt extends VorfallSchritt {
  art: Schrittart;
  /** Pflicht genau bei art === 'ablesen'. */
  antwort?: AntwortFrage;
}

/** Ermittlungsstrang; die Schritte einer Spur sind linear, die Spuren untereinander frei. */
export interface Spur {
  id: string;
  titel: string;
  schritte: readonly ErmittlungsSchritt[];
}

export interface Verdaechtige {
  id: string;
  name: string;
  rolle: string;
  /** Pfad unter public/, z. B. /missions/staffel-2/portraet-timo.webp */
  portraet: string;
}

/** Ein Beleg zählt, wenn `verify` (Bash als root) mit Exit 0 endet. */
export interface BelegRegel {
  id: string;
  beschreibung: string;
  /** Spur, aus der der Beleg stammt. */
  spurId: string;
  /** Verdächtige, gegen die dieser Beleg spricht. */
  stuetzt: string;
  verify: string;
}

export interface VorwurfAntworten {
  richtig: readonly string[];
  falschePerson: readonly string[];
  zuWenigBelege: readonly string[];
  gesperrt: readonly string[];
}

export interface VorwurfRegel {
  verdaechtige: readonly Verdaechtige[];
  taeterId: string;
  belege: readonly BelegRegel[];
  /** So viele erkannte Belege gegen die Täterin oder den Täter muss ein Vorwurf nennen. */
  mindestBelege: number;
  /** true: unter den genannten Belegen gegen den Täter ist mindestens einer aus jeder Spur. */
  jedeSpur: boolean;
  antworten: VorwurfAntworten;
}

export interface Einsatzrahmen {
  /** Pager-Text zu Beginn: was erlaubt ist und was nicht. */
  text: readonly string[];
  /** Bash als root; Exit 0 = Verstoß erkannt. */
  verstoss: string;
  /** Pager-Text, wenn der Verstoß zum ersten Mal erkannt wird. */
  folge: readonly string[];
}

export interface Ermittlung {
  nr: number;
  id: string;
  titel: string;
  hostname: string;
  /** Bash als root; legt den Ausgangszustand an. */
  setup: string;
  ansichten: readonly Ansicht[];
  spuren: readonly Spur[];
  vorwurf: VorwurfRegel;
  einsatzrahmen: Einsatzrahmen;
  beweisstueck: Beweisstueck;
  szene: readonly string[];
  szenePose?: Pose;
}

/** Laufzeitzustand einer Ermittlung im Browser. */
export interface ErmittlungsZustand {
  /** Je Spur-ID: Anzahl erledigter Schritte (von vorn). Fehlt ein Eintrag, gilt 0. */
  erledigt: Readonly<Record<string, number>>;
  /** IDs der Belegregeln, deren verify bei der letzten vollständigen Prüfung Exit 0 hatte; sortiert. */
  belegeErkannt: readonly string[];
  einsatzrahmenVerletzt: boolean;
  /** Ein Vorwurf ist erst wieder möglich, wenn belegeErkannt.length >= sperreBis; null = frei. */
  sperreBis: number | null;
  /** Vollständige Prüfungen, nach denen eine aktive Sperre spätestens endet; 0 = keine Sperre. */
  sperreRestPruefungen: number;
  vorwurfVersuche: number;
  geloest: boolean;
  /** Je Schritt (`spurId/schrittId`) die zuletzt gemeldete Diagnose; fehlt, solange keine steht. */
  letzteDiagnose?: Readonly<Record<string, string>>;
}

export type ErmittlungsEreignis =
  | { type: 'schritt-erledigt'; spurId: string; schrittId: string }
  | { type: 'spur-erledigt'; spurId: string }
  | { type: 'beleg-erkannt'; belegId: string }
  | { type: 'beleg-verloren'; belegId: string }
  | { type: 'einsatzrahmen-verletzt' }
  | { type: 'sperre-aufgehoben' }
  | { type: 'diagnose'; spurId: string; schrittId: string; text: string }
  | { type: 'pruefung-unvollstaendig' };

export type VorwurfErgebnis =
  | 'richtig'
  | 'falsche-person'
  | 'zu-wenig-belege'
  | 'gesperrt'
  | 'beleg-unbekannt'
  | 'bereits-geloest';

/** Eine Prüfung im Bündel; `id` ist im Bündel eindeutig. */
export interface Pruefung {
  id: string;
  skript: string;
  /** true: Das Skript liefert eine Meldung statt eines Ergebnisses (Diagnose, ändert nichts). */
  diagnose?: boolean;
}

export interface PruefungsAusgabe {
  /** id → bestanden (Exit 0). Nur IDs, die in der Ausgabe stehen. */
  ergebnisse: Readonly<Record<string, boolean>>;
  /** id → bereinigte Meldung einer Diagnose; nur gesetzt, wenn die Ausgabe welche enthält. */
  diagnosen?: Readonly<Record<string, string>>;
  /** true nur, wenn die Schlusszeile da ist und ihre Zahl der Anzahl gelesener Prüfzeilen entspricht. */
  vollstaendig: boolean;
}

export interface AbfrageAusgabe {
  /** schluessel → Werte in Ausgabereihenfolge. */
  werte: Readonly<Record<string, readonly string[]>>;
  vollstaendig: boolean;
  /** Exit-Status von `su`, wenn er weder 0 noch 141 (SIGPIPE durch die Kürzung) ist; sonst null. */
  fehlerCode: number | null;
}
