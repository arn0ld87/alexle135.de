import type { Page } from '@playwright/test';
import { platzhalter } from '../../src/data/staffeln/staffel-2/platzhalter';
import type { Ermittlung } from '../../src/lib/missions/ermittlungTypes';
import { STAFFEL2_E0 } from './staffel2';

// Test-Ermittlung für den Bildschirm (Ticket 13, ADR 0008). Es gibt dafür keine Route: Der Test
// lädt die echte Staffel-2-Seite und tauscht nur die Props der Staffel2Seite-Insel aus.

export const GESEHEN = '4711';
export const BILDSCHIRM_ERLEDIGT = 'Erledigt: Notiere die Zahl vom Zettel';

export const bildschirmErmittlung: Ermittlung = {
  ...platzhalter,
  id: 'bildschirm-probe',
  titel: 'Bildschirm-Probe',
  bildschirm: true,
  // Bildbeleg wie in einer echten Episode: Text nur als Pixel, Besitzer setzt das setup.
  setup: `set -e
install -d -o azubi -g azubi -m 755 /home/azubi/fotos
bildbeleg /home/azubi/fotos/zettel.png <<'EOF'
Zahl für die Probe:
${GESEHEN}
EOF
chown azubi:azubi /home/azubi/fotos/zettel.png
install -o azubi -g azubi -m 644 /dev/null /home/azubi/belege/gesehen.txt`,
  spuren: [
    {
      id: 'zettel',
      titel: 'Zettel',
      schritte: [
        {
          art: 'bearbeiten',
          id: 'gesehen',
          title: 'Notiere die Zahl vom Zettel',
          pager: ['Schreib die Zahl vom Zettel mit dem Editor in ~/belege/gesehen.txt.'],
          // Inhalt und Besitz: Der Editor auf dem Bildschirm schreibt als azubi.
          verify: `grep -qx ${GESEHEN} /home/azubi/belege/gesehen.txt && [ "$(stat -c %U /home/azubi/belege/gesehen.txt)" = azubi ]`,
          tipps: [
            'Der Zettel liegt in ~/fotos.',
            'mousepad ~/belege/gesehen.txt',
            `printf '${GESEHEN}\\n' > ~/belege/gesehen.txt`,
          ],
        },
      ],
    },
  ],
};

// Props wie Astros serializeProps (astro/dist/runtime/server/serialize.js): jeder Wert als
// [Typ, Wert], Typ 0 für Werte und Objekte, 1 für Arrays.
type Serialisiert = [number, unknown?];
function serialisiere(wert: unknown): Serialisiert {
  if (Array.isArray(wert)) return [1, wert.map(serialisiere)];
  if (wert === undefined) return [0];
  if (wert !== null && typeof wert === 'object') {
    return [0, Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, serialisiere(v)]))];
  }
  return [0, wert];
}

const attribut = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Lädt die Staffel-2-Seite mit `ermittlung` als einziger Episode der Staffel2Seite-Insel. */
export async function oeffneMitErmittlung(page: Page, ermittlung: Ermittlung): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith('/projekte/terminal-missionen/app/staffel-2'),
    async (route) => {
      const antwort = await route.fetch();
      const html = await antwort.text();
      const href = `/projekte/terminal-missionen/app/staffel-2?episode=${ermittlung.nr}`;
      const props = attribut(
        JSON.stringify(
          serialisiere({
            episoden: [{ ermittlung, werkzeuge: [] }],
            uebersicht: [{ nr: ermittlung.nr, id: ermittlung.id, titel: ermittlung.titel, href }],
            gewaehlt: ermittlung.nr,
            startHref: href,
          })[1]
        )
      );
      let getauscht = 0;
      const neu = html.replace(
        /<astro-island\b[^>]*component-url="[^"]*Staffel2Seite[^"]*"[^>]*>/,
        (insel) =>
          insel.replace(/ props="[^"]*"/, () => {
            getauscht++;
            return ` props="${props}"`;
          })
      );
      if (getauscht !== 1) throw new Error('Staffel2Seite-Insel nicht gefunden');
      await route.fulfill({ response: antwort, body: neu });
    }
  );
  await page.goto(STAFFEL2_E0);
}
