// Bausteine für `ErmittlungsSchritt.diagnose` (Ticket 12): Bash als root, nur lesend, höchstens
// eine Zeile Ausgabe. Die App meldet sie nur, solange das `verify` desselben Schritts scheitert.

const sh = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** Der Beleg liegt als eigene, kleine, echte Datei vor; sonst endet die Diagnose stumm. */
export const diagnoseBelegAnfang = (beleg: string) => String.raw`export LC_ALL=C
set -f
f=${sh(beleg)}
[ -f "$f" ] && [ ! -L "$f" ] && [ -s "$f" ] || exit 0
[ "$(stat -c %s "$f")" -le 65536 ] || exit 0
IFS= read -r -d '' inhalt < "$f"
`;

/** Meldung, sobald der Beleg als echte Datei da ist, ohne seinen Inhalt zu beurteilen. */
export function diagnoseBelegDa(beleg: string, meldung: string): string {
  return String.raw`f=${sh(beleg)}
[ -f "$f" ] && [ ! -L "$f" ] && printf '%s\n' ${sh(meldung)}
exit 0
`;
}

/**
 * Ein Beleg soll die Angaben zu zwei Dateien enthalten. Ohne eine Zeile im Format von `ls -l`
 * (oder `stat`) heißt es „abgetippt“, sonst nennt die Meldung die erste fehlende Datei.
 */
export function diagnoseZweiDateien(beleg: string, erste: string, zweite: string): string {
  return `${diagnoseBelegAnfang(beleg)}${String.raw`re='^[-dlcbps][-rwxsStT]{9}[.+]?[[:space:]]'
echt=
while IFS= read -r z; do
  if [[ $z =~ $re || $z == *'File: '* ]]; then echt=1; break; fi
done <<< "$inhalt"
if [ -z "$echt" ]; then
  printf '%s\n' ${sh('Der Beleg sieht abgetippt aus. Leite die echte Ausgabe von ls -l um.')}
elif [[ $inhalt != *${sh(erste)}* ]]; then
  printf '%s\n' ${sh(`In deinem Beleg fehlt noch ${erste}. Beide Dateien gehören in denselben Beleg.`)}
elif [[ $inhalt != *${sh(zweite)}* ]]; then
  printf '%s\n' ${sh(`In deinem Beleg fehlt noch ${zweite}. Beide Dateien gehören in denselben Beleg.`)}
fi
exit 0
`}`;
}
