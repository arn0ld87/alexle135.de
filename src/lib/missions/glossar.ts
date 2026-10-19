// Glossar der Missionen: ein Satz Ausbilder-Ton und ein Beispiel je Befehl. Einzige Quelle ist
// die Datei im Image (`erklaer` liest sie in der VM); die Website liest dieselbe Datei für den
// Werkzeugkasten. Beispiele lösen nie eine Aufgabe direkt.
import raw from '../../../scripts/mission-image/rootfs-overlay/usr/local/share/mission/glossar.tsv?raw';
import type { MissionTool } from './missionTypes';

export function parseGlossar(text: string): Map<string, MissionTool> {
  const entries = new Map<string, MissionTool>();
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [befehl, erklaerung, beispiel] = line.split('\t');
    if (befehl && erklaerung && beispiel) entries.set(befehl, { befehl, erklaerung, beispiel });
  }
  return entries;
}

export const glossar = parseGlossar(raw);

/** Werkzeugkasten eines Schritts aus Glossar-Einträgen; unbekannte Befehle sind ein Fehler. */
export function tools(...befehle: string[]): MissionTool[] {
  return befehle.map((befehl) => {
    const entry = glossar.get(befehl);
    if (!entry) throw new Error(`Befehl fehlt im Glossar: ${befehl}`);
    return entry;
  });
}
