// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { startZustand } from '../ermittlung';
import { erzeugePruefLauf, type PruefFehler, type PruefLaufOptionen } from '../pruefLauf';
import type { Ermittlung, ErmittlungsEreignis, ErmittlungsZustand } from '../ermittlungTypes';
import type { VorfallSchritt } from '../staffelTypes';
import { bashAntwort, fakeAgentClient, type FakeAntwort } from './fakeAgent';

const schritt = (id: string, verify: string): VorfallSchritt => ({
  id,
  title: `Schritt ${id}`,
  pager: [`Schritt ${id}`],
  verify,
  tipps: ['Richtung', 'Befehl', 'Lösung'],
});

const fixture: Ermittlung = {
  nr: 2,
  id: 'pruef-fixture',
  titel: 'Prüfbündel',
  hostname: 'test',
  setup: 'true',
  ansichten: [
    { id: 'raum', art: 'raum', titel: 'Raum', abfrage: "printf 'x\\ty\\n'" },
  ],
  spuren: [
    { id: 'a', titel: 'A', schritte: [schritt('s1', 'true')] },
    { id: 'b', titel: 'B', schritte: [schritt('s1', 'false')] },
  ],
  vorwurf: {
    verdaechtige: [
      { id: 'timo', name: 'Timo', rolle: 'Admin', portraet: '/timo.webp' },
      { id: 'nadia', name: 'Nadia', rolle: 'Praktikantin', portraet: '/nadia.webp' },
      { id: 'margit', name: 'Margit', rolle: 'Chefin', portraet: '/margit.webp' },
    ],
    taeterId: 'timo',
    belege: [
      { id: 'b1', beschreibung: 'Beleg 1', spurId: 'a', stuetzt: 'timo', verify: 'true' },
      { id: 'b2', beschreibung: 'Beleg 2', spurId: 'b', stuetzt: 'timo', verify: 'false' },
    ],
    mindestBelege: 2,
    jedeSpur: true,
    antworten: {
      richtig: ['richtig'],
      falschePerson: ['falsch'],
      zuWenigBelege: ['zu wenig'],
      gesperrt: ['gesperrt'],
    },
  },
  einsatzrahmen: { text: ['nur lesen'], verstoss: 'false', folge: ['verstoß'] },
  beweisstueck: { id: 'beweis', titel: 'Beweis', beschreibung: 'Beweis', code: 'X' },
  szene: ['Szene'],
};

type Geschrieben = { zustand: ErmittlungsZustand; ereignisse: ErmittlungsEreignis[] };

function aufbau(
  antwort: (skript: string, id: string) => FakeAntwort | Promise<FakeAntwort>,
  teil: Partial<PruefLaufOptionen> = {}
) {
  const { client, gesendet } = fakeAgentClient(antwort);
  let zustand: ErmittlungsZustand = startZustand();
  const geschrieben: Geschrieben[] = [];
  const fehler: PruefFehler[] = [];
  const lauf = erzeugePruefLauf({
    ermittlung: fixture,
    run: (skript, timeoutMs) => client.run(skript, timeoutMs),
    leseZustand: () => zustand,
    schreibeZustand: (neu, ereignisse) => {
      geschrieben.push({ zustand: neu, ereignisse });
      zustand = neu;
    },
    meldeFehler: (f) => fehler.push(f),
    ...teil,
  });
  return {
    lauf,
    gesendet,
    geschrieben,
    fehler,
    lese: () => zustand,
    setze: (neu: ErmittlungsZustand) => {
      zustand = neu;
    },
  };
}

const runZeilen = (gesendet: string[]) => gesendet.filter((zeile) => zeile.startsWith('RUN '));

/** Ein Promise, das der Test von Hand auflöst; für Antworten, die zurückgehalten werden. */
function halter(): { warten: Promise<void>; freigeben: () => void } {
  let freigeben!: () => void;
  const warten = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  return { warten, freigeben };
}

describe('pruefLauf', () => {
  it('führt das Bündel mit Bash aus und wendet das Ergebnis an', async () => {
    const a = aufbau(bashAntwort);
    a.lauf.anstossen();
    expect(a.lauf.laeuft()).toBe(true);
    await a.lauf.leerlauf();
    expect(a.lauf.laeuft()).toBe(false);

    expect(a.geschrieben).toHaveLength(1);
    const { zustand, ereignisse } = a.geschrieben[0];
    expect(zustand.erledigt.a).toBe(1);
    expect(zustand.erledigt.b).toBeUndefined();
    expect(ereignisse).toContainEqual({
      type: 'schritt-erledigt',
      spurId: 'a',
      schrittId: 's1',
    });
    expect(ereignisse).toContainEqual({ type: 'spur-erledigt', spurId: 'a' });
  });

  it('schickt genau ein RUN je Lauf', async () => {
    const a = aufbau(bashAntwort);
    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(runZeilen(a.gesendet)).toHaveLength(1);
  });

  it('merkt genau einen Nachlauf vor statt eine Schlange zu bilden', async () => {
    const erste = halter();
    const zweite = halter();
    let aufrufe = 0;
    const a = aufbau(async () => {
      aufrufe += 1;
      await (aufrufe === 1 ? erste.warten : zweite.warten);
      return { art: 'res', exitCode: 0, output: '' };
    });

    for (let i = 0; i < 5; i++) a.lauf.anstossen();
    await vi.waitFor(() => expect(runZeilen(a.gesendet)).toHaveLength(1));
    expect(a.lauf.laeuft()).toBe(true);

    erste.freigeben();
    await vi.waitFor(() => expect(runZeilen(a.gesendet)).toHaveLength(2));
    expect(a.lauf.laeuft()).toBe(true);

    zweite.freigeben();
    await a.lauf.leerlauf();
    expect(a.lauf.laeuft()).toBe(false);
    expect(runZeilen(a.gesendet)).toHaveLength(2);
  });

  it('startet keinen Lauf, wenn nichts offen ist', async () => {
    const a = aufbau(() => ({ art: 'res', exitCode: 0, output: '' }));
    a.setze({ ...startZustand(), geloest: true });
    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(a.gesendet).toEqual([]);
    expect(a.geschrieben).toHaveLength(0);
  });

  it('wendet das Ergebnis auf den Zustand zum Antwortzeitpunkt an', async () => {
    const halte = halter();
    const a = aufbau(async () => {
      await halte.warten;
      return { art: 'res', exitCode: 0, output: '' };
    });

    a.lauf.anstossen();
    a.setze({ ...startZustand(), geloest: true });
    halte.freigeben();
    await a.lauf.leerlauf();

    expect(a.geschrieben).toHaveLength(1);
    expect(a.geschrieben[0].zustand.geloest).toBe(true);
    expect(a.geschrieben[0].ereignisse).toEqual([]);
  });

  it('meldet einen Agent-Fehler und schreibt nichts', async () => {
    const a = aufbau(() => ({ art: 'err', grund: 'bad-base64' }));
    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(a.fehler).toHaveLength(1);
    expect(a.fehler[0].type).toBe('agent');
    expect(a.fehler[0].meldung).toContain('bad-base64');
    expect(a.geschrieben).toHaveLength(0);
    expect(a.lauf.laeuft()).toBe(false);
  });

  it('meldet einen Timeout und schreibt nichts', async () => {
    vi.useFakeTimers();
    try {
      const a = aufbau(() => ({ art: 'still' }), { timeoutMs: 1000 });
      a.lauf.anstossen();
      await vi.advanceTimersByTimeAsync(1000);
      await a.lauf.leerlauf();
      expect(a.fehler).toHaveLength(1);
      expect(a.fehler[0].type).toBe('agent');
      expect(a.fehler[0].meldung).toContain('Agent-Timeout');
      expect(a.geschrieben).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('schreibt bei unvollständiger Ausgabe den unveränderten Zustand', async () => {
    const a = aufbau(() => ({
      art: 'res',
      exitCode: 0,
      output: 'pruefung\ts.a.x\t0\n',
    }));
    const vorher = startZustand();
    a.setze(vorher);
    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(a.geschrieben).toHaveLength(1);
    expect(a.geschrieben[0].zustand).toEqual(vorher);
    expect(a.geschrieben[0].ereignisse).toEqual([{ type: 'pruefung-unvollstaendig' }]);
  });

  it('wendet nach stoppe nichts mehr an und startet keinen Nachlauf', async () => {
    const halte = halter();
    const a = aufbau(async () => {
      await halte.warten;
      return { art: 'res', exitCode: 0, output: '' };
    });

    a.lauf.anstossen();
    a.lauf.anstossen();
    a.lauf.stoppe();
    halte.freigeben();
    await a.lauf.leerlauf();
    expect(a.geschrieben).toHaveLength(0);
    expect(runZeilen(a.gesendet)).toHaveLength(1);

    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(runZeilen(a.gesendet)).toHaveLength(1);
  });

  it('meldet einen Skriptfehler ohne RUN', async () => {
    const kaputt: Ermittlung = {
      ...fixture,
      spuren: [{ ...fixture.spuren[0], id: 'A' }, fixture.spuren[1]],
    };
    const a = aufbau(() => ({ art: 'res', exitCode: 0, output: '' }), { ermittlung: kaputt });
    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(a.fehler).toHaveLength(1);
    expect(a.fehler[0].type).toBe('skript');
    expect(a.gesendet).toEqual([]);
    expect(a.geschrieben).toHaveLength(0);
  });

  it('fängt einen werfenden schreibeZustand ab und läuft weiter', async () => {
    const a = aufbau(bashAntwort, {
      schreibeZustand: () => {
        throw new Error('kaputt');
      },
    });
    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(a.lauf.laeuft()).toBe(false);

    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(runZeilen(a.gesendet)).toHaveLength(2);
  });

  it('reicht die Zeitgrenze an run weiter', async () => {
    const a = aufbau(() => ({ art: 'res', exitCode: 0, output: '' }));
    a.lauf.anstossen();
    await a.lauf.leerlauf();
    expect(a.gesendet[0]).toMatch(/ 19\n$/);

    const b = aufbau(() => ({ art: 'res', exitCode: 0, output: '' }), { timeoutMs: 5000 });
    b.lauf.anstossen();
    await b.lauf.leerlauf();
    expect(b.gesendet[0]).toMatch(/ 4\n$/);
  });

  it('erfüllt leerlauf vor jedem Lauf sofort', async () => {
    const a = aufbau(() => ({ art: 'res', exitCode: 0, output: '' }));
    let zustand: 'offen' | 'bereit' | 'abgelehnt' = 'offen';
    const p = a.lauf.leerlauf();
    p.then(
      () => (zustand = 'bereit'),
      () => (zustand = 'abgelehnt')
    );
    await Promise.resolve();
    expect(zustand).toBe('bereit');
    await p;
  });
});
