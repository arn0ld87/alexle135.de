// Abfragen der Ansichten (Konzept §4, ADR 0004): Der Agent führt das Skript als root aus, die
// Abfrage selbst läuft als Spielerkonto und liest nur. Hier entstehen Skript und Parser; beide
// kennen kein DOM, keine Uhr und keinen Zufall.
import { encodeBase64 } from './agentProtocol';
import type { AbfrageAusgabe } from './ermittlungTypes';

export const SCHLUESSEL_MUSTER = /^[a-z0-9_.-]{1,40}$/;
export const ABFRAGE_MAX_ZEILEN = 400;
export const ABFRAGE_MAX_BYTES = 60_000; // unter der Agent-Grenze von 65 536 Zeichen (SPIKE M7)
export const SPIELERKONTO = 'azubi';

/** Bash-Skript für eine Ansicht: Abfrage als Spielerkonto, gefiltert und gekürzt. */
export function abfrageSkript(abfrage: string, konto: string = SPIELERKONTO): string {
  if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(konto)) throw new Error(`Ungültiges Konto: ${konto}`);
  return `__a=$(printf '%s' '${encodeBase64(abfrage)}' | base64 -d)
__o=$(su -s /bin/bash ${konto} -c "$__a" 2>/dev/null </dev/null \\
  | grep -a -E $'^[a-z0-9_.-]{1,40}\\t' | grep -a -v -E $'^ende\\t' \\
  | head -n ${ABFRAGE_MAX_ZEILEN} \\
  | LC_ALL=C awk -v max=${ABFRAGE_MAX_BYTES} '{ n += length($0) + 1; if (n > max) exit; print }')
[ -n "$__o" ] && printf '%s\\n' "$__o"
printf 'ende\\t%s\\n' "$(printf '%s' "$__o" | grep -c '')"
`;
}

/** Liest `schluessel<TAB>wert`-Zeilen; vollständig nur mit passender Schlusszahl. */
export function leseAbfrage(text: string): AbfrageAusgabe {
  const werte = Object.create(null) as Record<string, string[]>;
  let gelesen = 0;
  let schluss: number | null = null;
  for (const roh of text.split('\n')) {
    const zeile = roh.endsWith('\r') ? roh.slice(0, -1) : roh;
    const tab = zeile.indexOf('\t');
    if (tab === -1) continue;
    const schluessel = zeile.slice(0, tab);
    const wert = zeile.slice(tab + 1);
    // Nur das exakte `ende` ist reserviert: mit Ziffern die Schlusszeile, sonst ignoriert.
    if (schluessel === 'ende') {
      if (/^\d+$/.test(wert)) schluss = Number(wert);
      continue;
    }
    if (!SCHLUESSEL_MUSTER.test(schluessel)) continue;
    // eslint-disable-next-line no-control-regex
    const sauber = wert.replace(/[\x00-\x08\x0a-\x1f\x7f]/g, '');
    (werte[schluessel] ??= []).push(sauber);
    gelesen++;
  }
  return { werte, vollstaendig: schluss !== null && schluss === gelesen };
}
