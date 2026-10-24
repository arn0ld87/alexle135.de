// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  PRUEF_ID_VERSTOSS,
  SPERRE_PRUEFUNGEN,
  aktuellerSchritt,
  buendelSkript,
  istGesperrt,
  leseBuendelAusgabe,
  mitZustandsDefaults,
  naechsteSperre,
  offenePruefungen,
  pruefeDaten,
  pruefeVorwurf,
  pruefIdBeleg,
  pruefIdSchritt,
  startZustand,
  wendePruefungAn,
} from '../ermittlung';
import type {
  Ermittlung,
  ErmittlungsEreignis,
  ErmittlungsZustand,
  Pruefung,
  PruefungsAusgabe,
} from '../ermittlungTypes';
import type { VorfallSchritt } from '../staffelTypes';

// Frei erfundene Episode; kein Import aus src/data/.
const schritt = (id: string, verify: string): VorfallSchritt => ({
  id,
  title: `Schritt ${id}`,
  pager: [`Schritt ${id}`],
  verify,
  tipps: ['Richtung', 'Befehl', 'Lösung'],
});

const fixture: Ermittlung = {
  nr: 1,
  id: 'episode-1',
  titel: 'Fremder Login',
  hostname: 'alex-schneider',
  setup: 'true',
  ansichten: [
    {
      id: 'raum',
      art: 'raum',
      titel: 'Büro',
      abfrage: "printf 'host\\t%s\\n' srv",
      hotspots: [{ id: 'tuer', label: 'Tür', x: 10, y: 20, w: 30, h: 40, schluessel: 'host' }],
    },
  ],
  spuren: [
    { id: 'rechte', titel: 'Rechte', schritte: [schritt('s1', 'true'), schritt('s2', 'false')] },
    { id: 'log', titel: 'Logbuch', schritte: [schritt('s1', 'test -f ~/belege/log')] },
  ],
  vorwurf: {
    verdaechtige: [
      {
        id: 'timo',
        name: 'Timo',
        rolle: 'Admin',
        portraet: '/missions/staffel-2/portraet-timo.webp',
      },
      {
        id: 'nadia',
        name: 'Nadia',
        rolle: 'Praktikantin',
        portraet: '/missions/staffel-2/portraet-nadia.webp',
      },
      {
        id: 'margit',
        name: 'Margit',
        rolle: 'Chefin',
        portraet: '/missions/staffel-2/portraet-margit.webp',
      },
    ],
    taeterId: 'timo',
    belege: [
      {
        id: 'b-sudoers',
        beschreibung: 'Timo steht in der sudoers-Datei.',
        spurId: 'rechte',
        stuetzt: 'timo',
        verify: 'true',
      },
      {
        id: 'b-stat',
        beschreibung: 'Die Datei gehört Timo.',
        spurId: 'rechte',
        stuetzt: 'timo',
        verify: 'test -f ~/belege/stat',
      },
      {
        id: 'b-log',
        beschreibung: 'Der Login steht im Log.',
        spurId: 'log',
        stuetzt: 'timo',
        verify: 'test -f ~/belege/log',
      },
      {
        id: 'b-nadia',
        beschreibung: 'Nadia hat den Schlüssel.',
        spurId: 'log',
        stuetzt: 'nadia',
        verify: 'test -f ~/belege/nadia',
      },
    ],
    mindestBelege: 2,
    jedeSpur: true,
    antworten: {
      richtig: ['Der Vorwurf sitzt.'],
      falschePerson: ['Das war es nicht.'],
      zuWenigBelege: ['Das reicht nicht.'],
      gesperrt: ['Erst weiter ermitteln.'],
    },
  },
  einsatzrahmen: {
    text: ['Nur lesen.'],
    verstoss: 'false',
    folge: ['Grenze überschritten.'],
  },
  beweisstueck: {
    id: 'beweis-1',
    titel: 'Karte',
    beschreibung: 'Eine Karte.',
    code: 'ABC123',
  },
  szene: ['Szene.'],
};

const mit = (teil: Partial<Ermittlung>): Ermittlung => ({ ...fixture, ...teil });

const zustand = (teil: Partial<ErmittlungsZustand> = {}): ErmittlungsZustand => ({
  ...startZustand(),
  ...teil,
});

const ausgabe = (ergebnisse: Record<string, boolean>, vollstaendig = true): PruefungsAusgabe => ({
  ergebnisse,
  vollstaendig,
});

const lauf = (
  e: Ermittlung,
  z: ErmittlungsZustand,
  ergebnisse: Record<string, boolean>
): { zustand: ErmittlungsZustand; ereignisse: ErmittlungsEreignis[] } =>
  wendePruefungAn(e, z, ausgabe(ergebnisse));

describe('pruefeDaten', () => {
  it('prüft und erhöht den Fortschritt einer zulässigen constructor-Spur', () => {
    const e = mit({
      spuren: fixture.spuren.map((spur) =>
        spur.id === 'rechte' ? { ...spur, id: 'constructor' } : spur
      ),
      vorwurf: {
        ...fixture.vorwurf,
        belege: fixture.vorwurf.belege.map((beleg) =>
          beleg.spurId === 'rechte' ? { ...beleg, spurId: 'constructor' } : beleg
        ),
      },
    });
    const z = startZustand();
    const spur = e.spuren[0];
    const id = pruefIdSchritt('constructor', 's1');

    expect(pruefeDaten(e)).toEqual([]);
    expect(aktuellerSchritt(spur, z)?.id).toBe('s1');
    expect(offenePruefungen(e, z).map((pruefung) => pruefung.id)).toContain(id);

    const ergebnis = lauf(e, z, { [id]: true });
    expect(ergebnis.zustand.erledigt['constructor']).toBe(1);
    expect(aktuellerSchritt(spur, ergebnis.zustand)?.id).toBe('s2');
  });

  it('akzeptiert das Fixture', () => {
    expect(pruefeDaten(fixture)).toEqual([]);
  });

  it('meldet eine ungültige Spur-ID', () => {
    const belege = fixture.vorwurf.belege.map((b) =>
      b.spurId === 'rechte' ? { ...b, spurId: 'Rechte!' } : b
    );
    const fehler = pruefeDaten(
      mit({
        spuren: [{ ...fixture.spuren[0], id: 'Rechte!' }, fixture.spuren[1]],
        vorwurf: { ...fixture.vorwurf, belege },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Ungültige ID: Spur "Rechte!"');
  });

  it('meldet eine ungültige Schritt-ID', () => {
    const fehler = pruefeDaten(
      mit({
        spuren: [
          { ...fixture.spuren[0], schritte: [schritt('S1', 'true'), schritt('s2', 'false')] },
          fixture.spuren[1],
        ],
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Ungültige ID: Schritt "S1"');
  });

  it('meldet eine ungültige Beleg-ID', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: {
          ...fixture.vorwurf,
          belege: [
            { ...fixture.vorwurf.belege[0], id: 'B-Sudoers' },
            ...fixture.vorwurf.belege.slice(1),
          ],
        },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Ungültige ID: Belegregel "B-Sudoers"');
  });

  it('meldet eine ungültige Verdächtigen-ID', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: {
          ...fixture.vorwurf,
          taeterId: 'Timo',
          verdaechtige: fixture.vorwurf.verdaechtige.map((p) =>
            p.id === 'timo' ? { ...p, id: 'Timo' } : p
          ),
          belege: fixture.vorwurf.belege.map((b) =>
            b.stuetzt === 'timo' ? { ...b, stuetzt: 'Timo' } : b
          ),
        },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Ungültige ID: Verdächtige "Timo"');
  });

  it('meldet eine ungültige Ansicht-ID', () => {
    const fehler = pruefeDaten(mit({ ansichten: [{ ...fixture.ansichten[0], id: 'Raum' }] }));
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Ungültige ID: Ansicht "Raum"');
  });

  it('meldet eine ungültige Hotspot-ID', () => {
    const fehler = pruefeDaten(
      mit({
        ansichten: [
          {
            ...fixture.ansichten[0],
            hotspots: [{ ...fixture.ansichten[0].hotspots![0], id: 'Tuer' }],
          },
        ],
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Ungültige ID: Hotspot "Tuer"');
  });

  it('meldet eine doppelte Spur-ID', () => {
    const fehler = pruefeDaten(
      mit({ spuren: [fixture.spuren[0], fixture.spuren[0], fixture.spuren[1]] })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Doppelte ID: Spur "rechte"');
  });

  it('meldet eine doppelte Schritt-ID', () => {
    const fehler = pruefeDaten(
      mit({
        spuren: [
          { ...fixture.spuren[0], schritte: [schritt('s1', 'true'), schritt('s1', 'false')] },
          fixture.spuren[1],
        ],
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Doppelte ID: Schritt "s1"');
  });

  it('meldet eine doppelte Beleg-ID', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: {
          ...fixture.vorwurf,
          belege: [...fixture.vorwurf.belege, fixture.vorwurf.belege[0]],
        },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Doppelte ID: Belegregel "b-sudoers"');
  });

  it('meldet eine doppelte Verdächtigen-ID', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: {
          ...fixture.vorwurf,
          verdaechtige: [...fixture.vorwurf.verdaechtige, fixture.vorwurf.verdaechtige[0]],
        },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Doppelte ID: Verdächtige "timo"');
  });

  it('meldet eine doppelte Ansicht-ID', () => {
    const fehler = pruefeDaten(mit({ ansichten: [fixture.ansichten[0], fixture.ansichten[0]] }));
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Doppelte ID: Ansicht "raum"');
  });

  it('meldet eine doppelte Hotspot-ID', () => {
    const fehler = pruefeDaten(
      mit({
        ansichten: [
          {
            ...fixture.ansichten[0],
            hotspots: [fixture.ansichten[0].hotspots![0], fixture.ansichten[0].hotspots![0]],
          },
        ],
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Doppelte ID: Hotspot "tuer"');
  });

  // T9: Eine unbekannte Täter-ID kann von keinem Beleg gestützt werden; Regel 3 und 5
  // melden deshalb zwangsläufig zusammen. Das ist der einzige Fall ohne Einzelmeldung.
  it('meldet eine Täter-ID, die keine Verdächtige ist', () => {
    const fehler = pruefeDaten(
      mit({ vorwurf: { ...fixture.vorwurf, taeterId: 'gibtsnicht', jedeSpur: false } })
    );
    expect(fehler).toHaveLength(2);
    expect(fehler[0]).toContain('Unbekannte Täter-ID: "gibtsnicht"');
    expect(fehler[1]).toContain('mindestBelege muss zwischen 1 und 0 liegen');
  });

  it('meldet einen Beleg, der keine Verdächtige stützt', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: {
          ...fixture.vorwurf,
          belege: [
            { ...fixture.vorwurf.belege[3], stuetzt: 'gibtsnicht' },
            ...fixture.vorwurf.belege.slice(0, 3),
          ],
        },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Beleg "b-nadia" stützt keine Verdächtige: "gibtsnicht"');
  });

  it('meldet einen Beleg aus einer unbekannten Spur', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: {
          ...fixture.vorwurf,
          belege: [
            { ...fixture.vorwurf.belege[0], spurId: 'gibtsnicht' },
            ...fixture.vorwurf.belege.slice(1),
          ],
        },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Beleg "b-sudoers" gehört zu keiner Spur: "gibtsnicht"');
  });

  it('meldet ein unbrauchbares mindestBelege', () => {
    const zuKlein = pruefeDaten(mit({ vorwurf: { ...fixture.vorwurf, mindestBelege: 0 } }));
    expect(zuKlein).toHaveLength(1);
    expect(zuKlein[0]).toContain('mindestBelege muss zwischen 1 und 3 liegen');
    const zuGross = pruefeDaten(mit({ vorwurf: { ...fixture.vorwurf, mindestBelege: 4 } }));
    expect(zuGross).toHaveLength(1);
    expect(zuGross[0]).toContain('mindestBelege muss zwischen 1 und 3 liegen');
  });

  it('meldet jedeSpur, wenn eine Spur keinen Beleg gegen den Täter hat', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: {
          ...fixture.vorwurf,
          belege: [fixture.vorwurf.belege[0], fixture.vorwurf.belege[1], fixture.vorwurf.belege[3]],
        },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain(
      'jedeSpur verlangt einen Beleg gegen den Täter aus jeder Spur; es fehlt: log'
    );
  });

  it('meldet weniger als drei Verdächtige', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: { ...fixture.vorwurf, verdaechtige: fixture.vorwurf.verdaechtige.slice(0, 2) },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Mindestens 3 Verdächtige nötig');
  });

  it('meldet eine leere Abfrage', () => {
    const fehler = pruefeDaten(mit({ ansichten: [{ ...fixture.ansichten[0], abfrage: '   ' }] }));
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Ansicht "raum": leere abfrage');
  });

  it('meldet ein leeres Schritt-Skript', () => {
    const fehler = pruefeDaten(
      mit({
        spuren: [{ ...fixture.spuren[1], schritte: [schritt('s1', '  ')] }, fixture.spuren[0]],
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Schritt "log/s1": leeres verify');
  });

  it('meldet ein leeres Beleg-Skript', () => {
    const fehler = pruefeDaten(
      mit({
        vorwurf: {
          ...fixture.vorwurf,
          belege: [
            { ...fixture.vorwurf.belege[0], verify: '' },
            ...fixture.vorwurf.belege.slice(1),
          ],
        },
      })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Belegregel "b-sudoers": leeres verify');
  });

  it('meldet einen leeren Einsatzrahmen', () => {
    const fehler = pruefeDaten(
      mit({ einsatzrahmen: { ...fixture.einsatzrahmen, verstoss: '\n' } })
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('Einsatzrahmen: leeres verstoss');
  });
});

describe('Zustand und offene Prüfungen', () => {
  it('startet leer', () => {
    expect(startZustand()).toEqual({
      erledigt: {},
      belegeErkannt: [],
      einsatzrahmenVerletzt: false,
      sperreBis: null,
      sperreRestPruefungen: 0,
      vorwurfVersuche: 0,
      geloest: false,
    });
  });

  it('liefert den Schritt am Zähler, sonst null', () => {
    expect(aktuellerSchritt(fixture.spuren[0], startZustand())?.id).toBe('s1');
    expect(aktuellerSchritt(fixture.spuren[0], zustand({ erledigt: { rechte: 2 } }))).toBeNull();
  });

  it('prüft je Spur den aktuellen Schritt, alle Belege und den Einsatzrahmen', () => {
    expect(offenePruefungen(fixture, startZustand()).map((p) => p.id)).toEqual([
      's.rechte.s1',
      's.log.s1',
      'b.b-sudoers',
      'b.b-stat',
      'b.b-log',
      'b.b-nadia',
      'e.verstoss',
    ]);
  });

  it('lässt den Einsatzrahmen nach einem Verstoß aus', () => {
    const ids = offenePruefungen(fixture, zustand({ einsatzrahmenVerletzt: true })).map(
      (p) => p.id
    );
    expect(ids).not.toContain(PRUEF_ID_VERSTOSS);
    expect(ids).toHaveLength(6);
  });

  it('prüft im gelösten Zustand nichts mehr', () => {
    expect(offenePruefungen(fixture, zustand({ geloest: true }))).toEqual([]);
  });
});

describe('buendelSkript', () => {
  it('führt alle Prüfungen in einem Skript aus und liest das Ergebnis', () => {
    const pruefungen: Pruefung[] = [
      { id: 'a', skript: 'true' },
      { id: 'b', skript: 'false' },
      { id: 'c', skript: 'echo laut; exit 3' },
      { id: 'd', skript: 'if true; then\n  exit 0\nfi' },
    ];
    const skript = buendelSkript(pruefungen);
    const ausgeben = execFileSync('bash', ['-c', skript], { encoding: 'utf8' });
    expect(ausgeben.split('\n')).not.toContain('laut');
    expect(leseBuendelAusgabe(ausgeben)).toEqual({
      ergebnisse: { a: true, b: false, c: false, d: true },
      vollstaendig: true,
    });
  });

  it('wirft bei einer ID, die das Quoting brechen würde', () => {
    expect(() => buendelSkript([{ id: 'a b', skript: 'true' }])).toThrow(/Ungültige Prüf-ID/);
    expect(() => buendelSkript([{ id: "a'", skript: 'true' }])).toThrow(/Ungültige Prüf-ID/);
  });

  it('erzeugt für eine leere Liste nur die Schlusszeile', () => {
    const skript = buendelSkript([]);
    expect(skript).toBe("printf 'ende\\t%s\\n' '0'\n");
    const ausgeben = execFileSync('bash', ['-c', skript], { encoding: 'utf8' });
    expect(leseBuendelAusgabe(ausgeben)).toEqual({ ergebnisse: {}, vollstaendig: true });
  });
});

describe('leseBuendelAusgabe', () => {
  it('ignoriert fremde Zeilen', () => {
    expect(
      leseBuendelAusgabe('quatsch\npruefung\ta\t0\nnoch was\npruefung\tb\t1\nende\t2\n')
    ).toEqual({ ergebnisse: { a: true, b: false }, vollstaendig: true });
  });

  it('ist ohne Schlusszeile unvollständig', () => {
    expect(leseBuendelAusgabe('pruefung\ta\t0\n')).toEqual({
      ergebnisse: { a: true },
      vollstaendig: false,
    });
  });

  it('ist bei falscher Schlusszahl unvollständig', () => {
    expect(leseBuendelAusgabe('pruefung\ta\t0\nende\t2\n').vollstaendig).toBe(false);
  });

  it('liest CRLF', () => {
    expect(leseBuendelAusgabe('pruefung\ta\t0\r\nende\t1\r\n')).toEqual({
      ergebnisse: { a: true },
      vollstaendig: true,
    });
  });

  it('nimmt bei doppelter ID die letzte', () => {
    expect(leseBuendelAusgabe('pruefung\ta\t0\npruefung\ta\t1\nende\t2\n')).toEqual({
      ergebnisse: { a: false },
      vollstaendig: true,
    });
  });
});

describe('wendePruefungAn', () => {
  it('rückt eine Spur um genau einen Schritt vor', () => {
    const r = lauf(fixture, startZustand(), { [pruefIdSchritt('rechte', 's1')]: true });
    expect(r.zustand.erledigt.rechte).toBe(1);
    expect(r.ereignisse).toEqual([{ type: 'schritt-erledigt', spurId: 'rechte', schrittId: 's1' }]);
  });

  it('prüft höchstens einen Schritt je Spur und Aufruf', () => {
    const r = lauf(fixture, startZustand(), {
      [pruefIdSchritt('rechte', 's1')]: true,
      [pruefIdSchritt('rechte', 's2')]: true,
    });
    expect(r.zustand.erledigt.rechte).toBe(1);
    expect(r.ereignisse).toHaveLength(1);
  });

  it('meldet den letzten Schritt und danach die ganze Spur', () => {
    const r = lauf(fixture, zustand({ erledigt: { rechte: 1 } }), {
      [pruefIdSchritt('rechte', 's2')]: true,
    });
    expect(r.zustand.erledigt.rechte).toBe(2);
    expect(r.ereignisse).toEqual([
      { type: 'schritt-erledigt', spurId: 'rechte', schrittId: 's2' },
      { type: 'spur-erledigt', spurId: 'rechte' },
    ]);
  });

  it('erkennt Belege, verliert sie wieder und behält sie, wenn sie fehlen', () => {
    const erkannt = lauf(fixture, startZustand(), { [pruefIdBeleg('b-sudoers')]: true });
    expect(erkannt.zustand.belegeErkannt).toEqual(['b-sudoers']);
    expect(erkannt.ereignisse).toEqual([{ type: 'beleg-erkannt', belegId: 'b-sudoers' }]);

    const verloren = lauf(fixture, erkannt.zustand, { [pruefIdBeleg('b-sudoers')]: false });
    expect(verloren.zustand.belegeErkannt).toEqual([]);
    expect(verloren.ereignisse).toEqual([{ type: 'beleg-verloren', belegId: 'b-sudoers' }]);

    const fehlt = lauf(fixture, erkannt.zustand, {});
    expect(fehlt.zustand.belegeErkannt).toEqual(['b-sudoers']);
    expect(fehlt.ereignisse).toEqual([]);
  });

  it('speichert erkannte Belege sortiert', () => {
    const r = lauf(fixture, startZustand(), {
      [pruefIdBeleg('b-sudoers')]: true,
      [pruefIdBeleg('b-log')]: true,
    });
    expect(r.zustand.belegeErkannt).toEqual(['b-log', 'b-sudoers']);
  });

  it('ändert bei unvollständiger Ausgabe nichts', () => {
    const z = startZustand();
    const r = wendePruefungAn(
      fixture,
      z,
      ausgabe({ [pruefIdSchritt('rechte', 's1')]: true }, false)
    );
    expect(r.zustand).toBe(z);
    expect(r.ereignisse).toEqual([{ type: 'pruefung-unvollstaendig' }]);
  });

  it('meldet einen Verstoß genau einmal und setzt die Sperre', () => {
    const r = lauf(fixture, startZustand(), { [PRUEF_ID_VERSTOSS]: true });
    expect(r.zustand.einsatzrahmenVerletzt).toBe(true);
    expect(r.ereignisse).toEqual([{ type: 'einsatzrahmen-verletzt' }]);
    expect(r.zustand.sperreBis).toBe(1);
    expect(r.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);

    const zweite = lauf(fixture, r.zustand, { [PRUEF_ID_VERSTOSS]: true });
    expect(zweite.ereignisse).toEqual([]);
    expect(zweite.zustand.einsatzrahmenVerletzt).toBe(true);
  });

  it('lässt einen gelösten Zustand unangetastet', () => {
    const z = zustand({ geloest: true, erledigt: { rechte: 2 } });
    const r = wendePruefungAn(
      fixture,
      z,
      ausgabe({ [pruefIdSchritt('rechte', 's2')]: true, [PRUEF_ID_VERSTOSS]: true })
    );
    expect(r.zustand).toBe(z);
    expect(r.ereignisse).toEqual([]);
  });

  it('lässt die Eingaben unverändert', () => {
    const e = structuredClone(fixture);
    const z = zustand({ erledigt: { log: 0 }, belegeErkannt: ['b-stat'] });
    const a = ausgabe({
      [pruefIdSchritt('rechte', 's1')]: true,
      [pruefIdBeleg('b-log')]: true,
      [pruefIdBeleg('b-stat')]: false,
      [PRUEF_ID_VERSTOSS]: true,
    });
    const vorherE = structuredClone(e);
    const vorherZ = structuredClone(z);
    const vorherA = structuredClone(a);
    wendePruefungAn(e, z, a);
    expect(e).toEqual(vorherE);
    expect(z).toEqual(vorherZ);
    expect(a).toEqual(vorherA);
  });
});

describe('naechsteSperre und istGesperrt', () => {
  it('setzt die Sperre einen Beleg hinter den Stand', () => {
    expect(naechsteSperre(fixture, startZustand())).toBe(1);
    expect(naechsteSperre(fixture, zustand({ belegeErkannt: ['b-log'], sperreBis: 3 }))).toBe(3);
  });

  it('blockiert nie dauerhaft, wenn kein Beleg mehr übrig ist', () => {
    const alle = zustand({ belegeErkannt: ['b-log', 'b-nadia', 'b-stat', 'b-sudoers'] });
    expect(naechsteSperre(fixture, alle)).toBeNull();
  });

  it('prüft die Sperre gegen die Zahl der erkannten Belege', () => {
    expect(istGesperrt(zustand({ belegeErkannt: ['b-log'], sperreBis: 2 }))).toBe(true);
    expect(istGesperrt(zustand({ belegeErkannt: ['b-log', 'b-stat'], sperreBis: 2 }))).toBe(false);
    expect(istGesperrt(zustand({ sperreBis: null }))).toBe(false);
  });
});

describe('pruefeVorwurf', () => {
  const vorwurf = (z: ErmittlungsZustand, verdaechtigeId: string, belegIds: string[]) =>
    pruefeVorwurf(fixture, z, { verdaechtigeId, belegIds });

  it('meldet einen bereits gelösten Fall', () => {
    const z = zustand({ geloest: true });
    expect(vorwurf(z, 'timo', ['b-sudoers'])).toEqual({
      zustand: z,
      ergebnis: 'bereits-geloest',
      antwort: [],
    });
  });

  it('meldet eine bestehende Sperre', () => {
    const z = zustand({ belegeErkannt: ['b-sudoers'], sperreBis: 2, sperreRestPruefungen: 3 });
    expect(vorwurf(z, 'timo', ['b-sudoers'])).toEqual({
      zustand: z,
      ergebnis: 'gesperrt',
      antwort: fixture.vorwurf.antworten.gesperrt,
    });
  });

  it('meldet einen nicht erkannten Beleg', () => {
    const z = startZustand();
    expect(vorwurf(z, 'timo', ['b-sudoers'])).toEqual({
      zustand: z,
      ergebnis: 'beleg-unbekannt',
      antwort: [],
    });
  });

  it('straft eine falsche Person und sperrt bis zum nächsten Beleg', () => {
    const z = zustand({ belegeErkannt: ['b-sudoers', 'b-log'] });
    const r = vorwurf(z, 'nadia', ['b-sudoers']);
    expect(r.ergebnis).toBe('falsche-person');
    expect(r.antwort).toEqual(fixture.vorwurf.antworten.falschePerson);
    expect(r.zustand.vorwurfVersuche).toBe(1);
    expect(r.zustand.sperreBis).toBe(3);
    expect(r.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);
    expect(istGesperrt(r.zustand)).toBe(true);
    expect(istGesperrt({ ...r.zustand, belegeErkannt: ['b-log', 'b-stat', 'b-sudoers'] })).toBe(
      false
    );
  });

  it('verlangt genug Belege und eine Spur je Beleg', () => {
    const z = zustand({ belegeErkannt: ['b-sudoers', 'b-stat'] });
    const r = vorwurf(z, 'timo', ['b-sudoers', 'b-stat']);
    expect(r.ergebnis).toBe('zu-wenig-belege');
    expect(r.antwort).toEqual(fixture.vorwurf.antworten.zuWenigBelege);
    expect(r.zustand.vorwurfVersuche).toBe(1);
    expect(r.zustand.sperreBis).toBe(3);
    expect(r.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);
  });

  // T5: isoliert die Mengenprüfung, weil jedeSpur hier aus ist.
  it('prüft die Mindestzahl auch ohne jedeSpur', () => {
    const e = mit({ vorwurf: { ...fixture.vorwurf, jedeSpur: false } });
    const z = zustand({ belegeErkannt: ['b-log', 'b-nadia', 'b-stat', 'b-sudoers'] });
    expect(pruefeVorwurf(e, z, { verdaechtigeId: 'timo', belegIds: ['b-sudoers'] }).ergebnis).toBe(
      'zu-wenig-belege'
    );
    expect(
      pruefeVorwurf(e, z, { verdaechtigeId: 'timo', belegIds: ['b-sudoers', 'b-stat'] }).ergebnis
    ).toBe('richtig');
  });

  it('nimmt einen Beleg gegen eine andere Person weder übel noch als Stütze', () => {
    const z = zustand({ belegeErkannt: ['b-sudoers', 'b-log', 'b-nadia'] });
    expect(vorwurf(z, 'timo', ['b-sudoers', 'b-log', 'b-nadia']).ergebnis).toBe('richtig');
    expect(vorwurf(zustand({ belegeErkannt: ['b-nadia'] }), 'timo', ['b-nadia']).ergebnis).toBe(
      'zu-wenig-belege'
    );
  });

  // T7: b-nadia hilft dem Vorwurf gegen timo nicht.
  it('zählt einen Beleg gegen eine andere Person nicht als Stütze', () => {
    const z = zustand({ belegeErkannt: ['b-log', 'b-nadia', 'b-stat', 'b-sudoers'] });
    expect(vorwurf(z, 'timo', ['b-sudoers', 'b-nadia']).ergebnis).toBe('zu-wenig-belege');
  });

  // T6: Duplikate zählen einmal, auch ohne jedeSpur.
  it('zählt doppelt genannte Belege einmal', () => {
    const e = mit({ vorwurf: { ...fixture.vorwurf, jedeSpur: false } });
    const z = zustand({ belegeErkannt: ['b-log', 'b-stat', 'b-sudoers'] });
    expect(
      pruefeVorwurf(e, z, { verdaechtigeId: 'timo', belegIds: ['b-sudoers', 'b-sudoers'] }).ergebnis
    ).toBe('zu-wenig-belege');
  });

  it('löst den Fall mit einem richtigen Vorwurf', () => {
    const z = zustand({ belegeErkannt: ['b-log', 'b-sudoers'] });
    expect(vorwurf(z, 'timo', ['b-sudoers', 'b-log'])).toEqual({
      zustand: {
        ...z,
        vorwurfVersuche: 1,
        sperreBis: null,
        sperreRestPruefungen: 0,
        geloest: true,
      },
      ergebnis: 'richtig',
      antwort: fixture.vorwurf.antworten.richtig,
    });
  });

  it('führt mit allen Belegen nie in eine Sackgasse', () => {
    const z = zustand({ belegeErkannt: ['b-log', 'b-nadia', 'b-stat', 'b-sudoers'] });
    const r = vorwurf(z, 'nadia', ['b-sudoers']);
    expect(r.ergebnis).toBe('falsche-person');
    expect(r.zustand.sperreBis).toBeNull();
    expect(r.zustand.sperreRestPruefungen).toBe(0);
    expect(istGesperrt(r.zustand)).toBe(false);
    expect(vorwurf(r.zustand, 'nadia', ['b-sudoers']).ergebnis).toBe('falsche-person');
  });

  it('lässt die Eingaben unverändert', () => {
    const e = structuredClone(fixture);
    const z = zustand({ belegeErkannt: ['b-log', 'b-sudoers'] });
    const vorherE = structuredClone(e);
    const vorherZ = structuredClone(z);
    pruefeVorwurf(e, z, { verdaechtigeId: 'timo', belegIds: ['b-sudoers', 'b-log'] });
    expect(e).toEqual(vorherE);
    expect(z).toEqual(vorherZ);
  });
});

// T8: Die Sperre endet mit einem neuen Beleg oder nach SPERRE_PRUEFUNGEN Prüfungen.
describe('Sperre ohne Sackgasse', () => {
  const gesperrt = (): ErmittlungsZustand => {
    const r = pruefeVorwurf(fixture, zustand({ belegeErkannt: ['b-sudoers'] }), {
      verdaechtigeId: 'nadia',
      belegIds: ['b-sudoers'],
    });
    expect(r.ergebnis).toBe('falsche-person');
    return r.zustand;
  };

  it('(a) blockiert einen zweiten Vorwurf', () => {
    const z = gesperrt();
    expect(
      pruefeVorwurf(fixture, z, { verdaechtigeId: 'timo', belegIds: ['b-sudoers'] }).ergebnis
    ).toBe('gesperrt');
  });

  it('(b) hebt die Sperre mit einem neuen Beleg auf', () => {
    const r = lauf(fixture, gesperrt(), { [pruefIdBeleg('b-log')]: true });
    expect(r.ereignisse).toEqual([
      { type: 'beleg-erkannt', belegId: 'b-log' },
      { type: 'sperre-aufgehoben' },
    ]);
    expect(r.zustand.sperreBis).toBeNull();
    expect(r.zustand.sperreRestPruefungen).toBe(0);
    expect(
      pruefeVorwurf(fixture, r.zustand, {
        verdaechtigeId: 'timo',
        belegIds: ['b-sudoers', 'b-log'],
      }).ergebnis
    ).toBe('richtig');
  });

  it('(c) hebt die Sperre nach genau drei vollständigen Prüfungen auf', () => {
    const start = gesperrt();
    expect(start.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);

    const eins = lauf(fixture, start, {});
    expect(eins.ereignisse).toEqual([]);
    expect(eins.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN - 1);

    const zwei = lauf(fixture, eins.zustand, {});
    expect(istGesperrt(zwei.zustand)).toBe(true);
    expect(zwei.zustand.sperreRestPruefungen).toBe(1);

    const drei = lauf(fixture, zwei.zustand, {});
    expect(drei.ereignisse).toEqual([{ type: 'sperre-aufgehoben' }]);
    expect(drei.zustand.sperreBis).toBeNull();
    expect(drei.zustand.sperreRestPruefungen).toBe(0);
    expect(istGesperrt(drei.zustand)).toBe(false);
  });

  it('(d) zählt unvollständige Prüfungen nicht mit', () => {
    const z = gesperrt();
    const r = wendePruefungAn(fixture, z, ausgabe({}, false));
    expect(r.zustand).toBe(z);
    expect(r.zustand.sperreBis).toBe(2);
    expect(r.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);
  });

  it('(e) setzt beim Verstoß eine neue Sperre aus dem neuen Zustand', () => {
    const r = lauf(fixture, startZustand(), {
      [pruefIdBeleg('b-log')]: true,
      [PRUEF_ID_VERSTOSS]: true,
    });
    expect(r.zustand.belegeErkannt).toEqual(['b-log']);
    expect(r.zustand.sperreBis).toBe(r.zustand.belegeErkannt.length + 1);
    expect(r.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);
  });

  it('(f) ordnet die Ereignisse: Schritt, Belege in Datenreihenfolge, Verstoß', () => {
    const r = lauf(fixture, startZustand(), {
      [pruefIdSchritt('rechte', 's1')]: true,
      [pruefIdBeleg('b-log')]: true,
      [pruefIdBeleg('b-sudoers')]: true,
      [PRUEF_ID_VERSTOSS]: true,
    });
    expect(r.ereignisse).toEqual([
      { type: 'schritt-erledigt', spurId: 'rechte', schrittId: 's1' },
      { type: 'beleg-erkannt', belegId: 'b-sudoers' },
      { type: 'beleg-erkannt', belegId: 'b-log' },
      { type: 'einsatzrahmen-verletzt' },
    ]);
  });

  it('(g) lässt einen gelösten Zustand auch bei unvollständiger Ausgabe leer', () => {
    const z = zustand({ geloest: true });
    const r = wendePruefungAn(fixture, z, ausgabe({}, false));
    expect(r.zustand).toBe(z);
    expect(r.ereignisse).toEqual([]);
  });

  // T3-1: Ein Verstoß bei laufender Sperre baut erst den Zähler ab. Bleibt er über 0, gibt es
  // kein „aufgehoben“; die neue Sperre startet wieder bei SPERRE_PRUEFUNGEN.
  it('(h) meldet den Verstoß ohne Aufhebung, wenn der Sperrzähler noch trägt', () => {
    const z = { ...gesperrt(), sperreRestPruefungen: 2 };
    const r = lauf(fixture, z, { [PRUEF_ID_VERSTOSS]: true });
    expect(r.ereignisse).toEqual([{ type: 'einsatzrahmen-verletzt' }]);
    expect(r.zustand.sperreBis).toBe(2);
    expect(r.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);
  });

  it('(i) meldet erst die Aufhebung, wenn der Sperrzähler auf 0 fällt', () => {
    const z = { ...gesperrt(), sperreRestPruefungen: 1 };
    const r = lauf(fixture, z, { [PRUEF_ID_VERSTOSS]: true });
    expect(r.ereignisse).toEqual([
      { type: 'sperre-aufgehoben' },
      { type: 'einsatzrahmen-verletzt' },
    ]);
    expect(r.zustand.sperreBis).toBe(2);
    expect(r.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);
  });

  // T3-2: Im selben Aufruf läuft die Sperre ab (dritte Prüfung) und der Verstoß setzt eine neue.
  // Der verlorene Beleg senkt das Ziel auf 1 — ein Vergleich mit dem alten sperreBis (2) wird rot.
  it('(j) berechnet die neue Sperre aus dem abgebauten Zustand', () => {
    const z = { ...gesperrt(), sperreRestPruefungen: 1 };
    const r = lauf(fixture, z, {
      [pruefIdBeleg('b-sudoers')]: false,
      [PRUEF_ID_VERSTOSS]: true,
    });
    expect(r.ereignisse).toEqual([
      { type: 'beleg-verloren', belegId: 'b-sudoers' },
      { type: 'sperre-aufgehoben' },
      { type: 'einsatzrahmen-verletzt' },
    ]);
    expect(r.zustand.belegeErkannt).toEqual([]);
    expect(r.zustand.sperreBis).toBe(1);
    expect(r.zustand.sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);
  });
});

// T3-3: Ältere Spielstände kennen sperreRestPruefungen nicht; der Default richtet sich nach der
// aktiven Sperre und lässt die Eingabe unangetastet.
describe('mitZustandsDefaults', () => {
  const ohneRest = (teil: Partial<Omit<ErmittlungsZustand, 'sperreRestPruefungen'>> = {}) => {
    const basis: ErmittlungsZustand = { ...startZustand(), ...teil };
    const ohne = { ...basis };
    delete (ohne as Partial<ErmittlungsZustand>).sperreRestPruefungen;
    return ohne;
  };

  it('setzt ohne Sperre fehlende oder ungültige Zähler auf 0', () => {
    expect(mitZustandsDefaults(ohneRest()).sperreRestPruefungen).toBe(0);
    expect(
      mitZustandsDefaults({ ...ohneRest(), sperreRestPruefungen: Number.NaN }).sperreRestPruefungen
    ).toBe(0);
    expect(
      mitZustandsDefaults({ ...ohneRest(), sperreRestPruefungen: -1 }).sperreRestPruefungen
    ).toBe(0);
    expect(
      mitZustandsDefaults({ ...ohneRest(), sperreRestPruefungen: 2 }).sperreRestPruefungen
    ).toBe(2);
  });

  it('setzt bei aktiver Sperre fehlende oder ungültige Zähler auf SPERRE_PRUEFUNGEN', () => {
    const gesperrt = ohneRest({ sperreBis: 2, belegeErkannt: ['b-sudoers'] });
    expect(mitZustandsDefaults(gesperrt).sperreRestPruefungen).toBe(SPERRE_PRUEFUNGEN);
    expect(
      mitZustandsDefaults({ ...gesperrt, sperreRestPruefungen: Number.NaN }).sperreRestPruefungen
    ).toBe(SPERRE_PRUEFUNGEN);
    expect(
      mitZustandsDefaults({ ...gesperrt, sperreRestPruefungen: -1 }).sperreRestPruefungen
    ).toBe(SPERRE_PRUEFUNGEN);
    expect(mitZustandsDefaults({ ...gesperrt, sperreRestPruefungen: 2 }).sperreRestPruefungen).toBe(
      2
    );
  });

  it('lässt die Eingabe unverändert und gibt eine Kopie zurück', () => {
    const eingabe = ohneRest({ sperreBis: 2 });
    const kopie = { ...eingabe };
    const ergebnis = mitZustandsDefaults(eingabe);
    expect(eingabe).toEqual(kopie);
    expect(Object.hasOwn(eingabe, 'sperreRestPruefungen')).toBe(false);
    expect(Object.hasOwn(ergebnis, 'sperreRestPruefungen')).toBe(true);
  });
});
