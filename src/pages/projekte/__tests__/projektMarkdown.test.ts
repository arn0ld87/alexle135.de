// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

// #381: Projekteinträge sind reines Markdown im Systemwerk-/Logbuch-Design. Das Layout kommt aus
// [...slug].astro und V2Layout, nicht aus HTML im Body. Dieser Test hält die Form fest.

const PROJEKTE = 'src/content/projects';
const eintraege = readdirSync(PROJEKTE)
  .filter((datei) => datei.endsWith('.md'))
  .sort();

// Die Abschnittsfolge von terminal-missionen (Was das ist, Was drinsteckt, Wie es gebaut ist,
// Was ich dabei gelernt habe) gilt für diese Einträge. agora und terminal-missionen haben
// eigene, ältere Abschnitte (Herkunft, Stand, Episoden) und gehören nicht dazu.
const ABSCHNITTE = [
  'Was das ist',
  'Was drinsteckt',
  'Wie es gebaut ist',
  'Was ich dabei gelernt habe',
];
const STANDARD_EINTRAEGE = [
  'compose-builder',
  'csharp-trainer',
  'ihk-radar',
  'ki-nachrichten-portal',
  'm2-schnittstelle',
  'roi-rechner',
  'ticket-routing',
  'windows-terminal-missionen',
];

const text = (datei: string) => matter(readFileSync(join(PROJEKTE, datei), 'utf8'));

// Codeblöcke und Inline-Code dürfen spitze Klammern enthalten, der Rest des Bodys nicht.
function ohneCode(rumpf: string): string {
  return rumpf.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '').replace(/`[^`\n]*`/g, '');
}

function ueberschriften(rumpf: string): { ebene: number; titel: string }[] {
  return [...ohneCode(rumpf).matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((m) => ({
    ebene: m[1].length,
    titel: m[2],
  }));
}

describe('Projekteinträge: Bestand', () => {
  it.each([...STANDARD_EINTRAEGE, 'agora', 'terminal-missionen'])('%s ist noch da', (slug) => {
    expect(eintraege).toContain(`${slug}.md`);
  });
});

describe('Projekteinträge: reines Markdown', () => {
  it.each(eintraege)('%s enthält kein rohes Block-HTML', (datei) => {
    const body = ohneCode(text(datei).content);
    const treffer = body.match(
      /<\/?(div|section|article|aside|header|footer|nav|main|h[1-6]|ul|ol|li|p|table|svg|span|a|button|img|figure|details)\b/i
    );
    expect(treffer?.[0], `Rohes HTML in ${datei}`).toBeUndefined();
  });

  it.each(eintraege)('%s hat keine Klassen, Inline-Styles oder ds-Bausteine im Body', (datei) => {
    const body = ohneCode(text(datei).content);
    expect(body).not.toMatch(/\b(class|style)=/);
    expect(body).not.toMatch(/\bds-(card|tag|note|kicker|meta)\b/);
  });

  it.each(eintraege)('%s hat keine Emojis oder Häkchen-Symbole im Body', (datei) => {
    expect(text(datei).content).not.toMatch(/\p{Extended_Pictographic}|[✓✔✗✘]/u);
  });
});

describe('Projekteinträge: Überschriften', () => {
  it.each(eintraege)('%s beginnt bei H2 und überspringt keine Ebene', (datei) => {
    const liste = ueberschriften(text(datei).content);
    expect(liste.length, `${datei} braucht Abschnitte`).toBeGreaterThan(0);
    // Die H1 liefert die Detailseite aus dem Titel, der Body darf keine zweite setzen.
    expect(liste[0].ebene, `${datei} muss mit H2 beginnen`).toBe(2);
    liste.forEach((h, i) => {
      if (i === 0) return;
      expect(h.ebene, `${datei}: Sprung vor „${h.titel}“`).toBeLessThanOrEqual(
        liste[i - 1].ebene + 1
      );
    });
  });

  it.each(STANDARD_EINTRAEGE)('%s folgt der Abschnittsfolge aus terminal-missionen', (slug) => {
    const h2 = ueberschriften(text(`${slug}.md`).content)
      .filter((h) => h.ebene === 2)
      .map((h) => h.titel);
    expect(h2).toEqual(ABSCHNITTE);
  });

  it.each(STANDARD_EINTRAEGE)('%s füllt jeden Abschnitt mit Text', (slug) => {
    const abschnitte = ohneCode(text(`${slug}.md`).content).split(/^## .+$/m).slice(1);
    expect(abschnitte).toHaveLength(ABSCHNITTE.length);
    for (const abschnitt of abschnitte) expect(abschnitt.trim().length).toBeGreaterThan(40);
  });
});

describe('Projekteinträge: keine unbelegten Aussagen', () => {
  // Jede Zahl oder jedes Versprechen braucht einen Beleg im Repo. Diese Muster standen früher in
  // den Einträgen und hatten keinen (kein Messlauf, keine Tests, kein Superlativ ohne Grund).
  const UNBELEGT: [string, RegExp][] = [
    ['Prozentangabe ohne Messgrundlage', /\b\d{1,3}\s?%/],
    ['„korrekt kategorisiert“', /korrekt kategorisiert/i],
    ['„sofort einsatzbereit“', /sofort einsatzbereit/i],
    ['„getestet und …“', /getestet und/i],
    ['„Perfekt für …“', /perfekt für/i],
  ];

  it.each(eintraege)('%s enthält keine der bekannten unbelegten Aussagen', (datei) => {
    const { content, data } = text(datei);
    const gesamt = `${data.summary}\n${data.meinTeil}\n${content}`;
    for (const [name, muster] of UNBELEGT) {
      expect(gesamt, `${name} in ${datei}`).not.toMatch(muster);
    }
  });
});
