// Aktenwand (Ticket 6): liest ausschließlich reguläre Dateien direkt unter ~/belege/.
// Das Skript liefert Base64-Felder, damit Dateinamen und Vorschauen keine Shell- oder
// Markup-Semantik bekommen. Der Parser prüft jedes Feld und macht Fehler sichtbar.
import type { AbfrageAusgabe, BelegRegel } from './ermittlungTypes';

export const AKTENWAND_MAX_DATEIEN = 50;
export const AKTENWAND_MAX_VORSCHAU_BYTES = 192;

/**
 * Feste Abfrage für die Aktenwand. Läuft als Spielerkonto und liest nur.
 * NUL-Enumeration und durchgehendes Quoting halten Sonderzeichen in Dateinamen als Daten.
 * Symlinks, FIFOs und Unterordner werden weder verfolgt noch geöffnet.
 */
export const AKTENWAND_ABFRAGE = `set -u
set -o pipefail
export LC_ALL=C
belege="$HOME/belege"
[ -e "$belege" ] || exit 0
[ -d "$belege" ] || exit 1
[ -L "$belege" ] && exit 0
[ -r "$belege" ] && [ -x "$belege" ] || exit 1
liste=$(mktemp) || exit 1
meta=$(mktemp) || exit 1
trap 'rm -f "$liste" "$meta"' EXIT HUP INT TERM
find "$belege" -mindepth 1 -maxdepth 1 -type f -print0 | LC_ALL=C sort -z > "$liste" || exit 1
if [ -s "$liste" ]; then
  xargs -0 stat -c '%s' -- < "$liste" > "$meta" || exit 1
fi
mapfile -t groessen < "$meta"
mapfile -d '' -t dateien < "$liste"
weitere=0
if [ "\${#dateien[@]}" -gt ${AKTENWAND_MAX_DATEIEN} ]; then weitere=1; fi
i=0
while [ "$i" -lt "\${#dateien[@]}" ] && [ "$i" -lt ${AKTENWAND_MAX_DATEIEN} ]; do
  pfad=\${dateien[$i]}
  groesse=\${groessen[$i]}
  [ -n "$groesse" ] || exit 1
  if [ ! -f "$pfad" ] || [ -L "$pfad" ]; then i=$((i + 1)); continue; fi
  name=\${pfad##*/}
  auszug=$(head -c ${AKTENWAND_MAX_VORSCHAU_BYTES} -- "$pfad" | base64 -w0) || exit 1
  name64=$(printf '%s' "$name" | base64 -w0) || exit 1
  printf 'datei\\t%s\\t%s\\t%s\\n' "$name64" "$groesse" "$auszug"
  i=$((i + 1))
done
if [ "$weitere" -eq 1 ]; then printf 'hinweis\\tweitere-dateien\\n'; fi
exit 0
`;

export interface AktenDatei {
  name: string;
  bytes: number;
  vorschau: string;
}

export interface AktenInhalt {
  dateien: readonly AktenDatei[];
  weitereDateien: boolean;
  hinweis: string | null;
}

export interface BelegEintrag {
  datei: AktenDatei;
  regel: BelegRegel | null;
  erkannt: boolean;
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
// Steuerzeichen sind hier Anzeige- und Binärerkennung, kein Steuerformat.
// eslint-disable-next-line no-control-regex
const STEUERZEICHEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
// eslint-disable-next-line no-control-regex
const STEUERZEICHEN_GLOBAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const UTF8 = new TextDecoder('utf-8', { fatal: false });

function dekodiereBase64(wert: string): Uint8Array | null {
  if (!BASE64.test(wert)) return null;
  try {
    const roh = atob(wert);
    const bytes = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function leseGroesse(wert: string): number | null {
  if (!/^\d+$/.test(wert)) return null;
  const groesse = Number(wert);
  return Number.isSafeInteger(groesse) ? groesse : null;
}

function bereinigeVorschau(bytes: Uint8Array): string {
  const text = UTF8.decode(bytes.slice(0, AKTENWAND_MAX_VORSCHAU_BYTES));
  const ersatz = (text.match(/\uFFFD/g) ?? []).length;
  const binaer = STEUERZEICHEN.test(text) || (text.length > 0 && ersatz / text.length > 0.1);
  const sauber = text.replace(STEUERZEICHEN_GLOBAL, '');
  if (!binaer) return sauber;
  return sauber ? `[Nichttextuelle Daten] ${sauber}` : '[Nichttextuelle Daten]';
}

/** Liest die Transportzeilen der Aktenwand; fehlerhafte Datensätze werden sichtbar übersprungen. */
export function leseAktenwand(ausgabe: AbfrageAusgabe): AktenInhalt {
  const dateien: AktenDatei[] = [];
  const namen = new Set<string>();
  const hinweise = new Set<string>();
  let weitereDateien = false;
  let fehlerhaft = 0;
  let doppelt = 0;

  for (const wert of ausgabe.werte.datei ?? []) {
    if (dateien.length >= AKTENWAND_MAX_DATEIEN) {
      weitereDateien = true;
      break;
    }
    const felder = wert.split('\t');
    if (felder.length !== 3) {
      fehlerhaft++;
      continue;
    }
    const [name64, groesseRoh, vorschau64] = felder;
    const nameBytes = dekodiereBase64(name64);
    const groesse = leseGroesse(groesseRoh);
    const vorschauBytes = dekodiereBase64(vorschau64);
    if (!nameBytes || !vorschauBytes || groesse === null) {
      fehlerhaft++;
      continue;
    }
    const name = UTF8.decode(nameBytes);
    if (!name || name.includes('\u0000')) {
      fehlerhaft++;
      continue;
    }
    if (namen.has(name)) {
      doppelt++;
      continue;
    }
    namen.add(name);
    dateien.push({
      name,
      bytes: groesse,
      vorschau: bereinigeVorschau(vorschauBytes),
    });
  }

  for (const wert of ausgabe.werte.hinweis ?? []) {
    if (wert === 'weitere-dateien') weitereDateien = true;
    else hinweise.add('Unbekannter Hinweis aus der Dateiliste.');
  }
  if (fehlerhaft > 0) {
    hinweise.add('Einige Dateieinträge waren ungültig und wurden übersprungen.');
  }
  if (doppelt > 0) {
    hinweise.add('Doppelte Dateinamen wurden nur einmal übernommen.');
  }
  if (!ausgabe.vollstaendig) {
    hinweise.add('Die Dateiliste ist unvollständig.');
  }
  if (ausgabe.fehlerCode !== null) {
    hinweise.add('Die Dateiliste konnte nicht vollständig gelesen werden.');
  }

  return {
    dateien,
    weitereDateien,
    hinweis: hinweise.size ? [...hinweise].join(' ') : null,
  };
}

/** Eine Belegregel gehört genau zur Datei <id>.txt direkt unter ~/belege/. */
export function regelFuerDatei(name: string, regeln: readonly BelegRegel[]): BelegRegel | null {
  for (const regel of regeln) {
    if (name === `${regel.id}.txt`) return regel;
  }
  return null;
}

/** Ordnet Dateien Regeln zu; Regeln ohne Datei erzeugen keinen Eintrag. */
export function ordneBelege(
  inhalt: AktenInhalt,
  regeln: readonly BelegRegel[],
  erkannte: readonly string[]
): readonly BelegEintrag[] {
  const erkannt = new Set(erkannte);
  return inhalt.dateien.map((datei) => {
    const regel = regelFuerDatei(datei.name, regeln);
    return { datei, regel, erkannt: regel !== null && erkannt.has(regel.id) };
  });
}
