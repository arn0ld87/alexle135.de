// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { abfrageSkript } from '../abfrage';
import type { AgentResult } from '../agentClient';
import { ABFRAGE_TIMEOUT_MS, erzeugeAbfragen, type AbfrageZustand } from '../ermittlungsAbfragen';
import type { Ansicht } from '../ermittlungTypes';

const raum = (id: string, abfrage: string): Ansicht => ({
  id,
  art: 'raum',
  titel: id,
  abfrage,
});

type Aufruf = {
  skript: string;
  timeoutMs: number;
  fertig: (resultat: AgentResult) => void;
  scheitern: (fehler: Error) => void;
};

function aufbau() {
  const aufrufe: Aufruf[] = [];
  const run = (skript: string, timeoutMs: number) =>
    new Promise<AgentResult>((resolve, reject) => {
      aufrufe.push({ skript, timeoutMs, fertig: resolve, scheitern: reject });
    });
  let gueltig = true;
  let zustand: AbfrageZustand = { status: 'bereit', ansichtId: null, ausgabe: null };
  const geschrieben: AbfrageZustand[] = [];
  const controller = erzeugeAbfragen({
    run,
    istAktuell: () => gueltig,
    schreibeZustand: (neu) => {
      zustand = neu;
      geschrieben.push(neu);
    },
  });
  return {
    controller,
    aufrufe,
    geschrieben,
    lese: () => zustand,
    setzeGueltig: (neu: boolean) => {
      gueltig = neu;
    },
  };
}

const antwort = (werte: Record<string, readonly string[]>): AgentResult => {
  const zeilen = Object.entries(werte).flatMap(([schluessel, liste]) =>
    liste.map((wert) => `${schluessel}\t${wert}`)
  );
  return {
    exitCode: 0,
    output: `${[...zeilen, `ende\t${zeilen.length}\t0`].join('\n')}\n`,
  };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const a = raum('a', "printf 'host\\ta\\n'");
const b = raum('b', "printf 'host\\tb\\n'");

describe('ermittlungsAbfragen', () => {
  it('liest die gewählte Ansicht als Abfrage-Skript mit 20 s Timeout', () => {
    const { controller, aufrufe } = aufbau();
    controller.oeffne(a);

    expect(ABFRAGE_TIMEOUT_MS).toBe(20_000);
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.skript).toBe(abfrageSkript(a.abfrage));
    expect(aufrufe[0]?.timeoutMs).toBe(20_000);
  });

  it('T5-3: eine verspätete Antwort der alten Ansicht überschreibt B nicht', async () => {
    const { controller, aufrufe, lese } = aufbau();
    controller.oeffne(a);
    expect(lese()).toEqual({ status: 'laedt', ansichtId: 'a', ausgabe: null });

    controller.oeffne(b);
    expect(lese()).toEqual({ status: 'laedt', ansichtId: 'b', ausgabe: null });
    expect(aufrufe).toHaveLength(1);

    aufrufe[0]?.fertig(antwort({ host: ['A'] }));
    await tick();
    expect(lese()).toEqual({ status: 'laedt', ansichtId: 'b', ausgabe: null });
    expect(aufrufe).toHaveLength(2);

    aufrufe[1]?.fertig(antwort({ host: ['B'] }));
    await tick();
    expect(lese().status).toBe('geladen');
    expect(lese().ansichtId).toBe('b');
    expect(lese().ausgabe?.werte.host).toEqual(['B']);
  });

  it('T5-4: zehn Aktualisierungen ergeben höchstens einen weiteren Wunsch, Stop verhindert Nachlauf', async () => {
    const { controller, aufrufe, lese } = aufbau();
    controller.oeffne(a);
    expect(aufrufe).toHaveLength(1);

    for (let i = 0; i < 10; i++) controller.aktualisiere();
    expect(aufrufe).toHaveLength(1);

    aufrufe[0]?.fertig(antwort({ host: ['alt'] }));
    await tick();
    expect(aufrufe).toHaveLength(2);

    controller.stoppe();
    controller.stoppe();
    aufrufe[1]?.fertig(antwort({ host: ['neu'] }));
    await tick();
    expect(aufrufe).toHaveLength(2);
    expect(lese().status).toBe('laedt');
  });

  it('aktualisiert ohne offene Ansicht nicht', () => {
    const { controller, aufrufe } = aufbau();
    controller.aktualisiere();
    expect(aufrufe).toHaveLength(0);
  });

  const faelle = [
    {
      name: 'gültig leer',
      antwort: { exitCode: 0, output: 'ende\t0\t0\n' },
      status: 'geladen',
    },
    {
      name: 'fehlende Schlusszeile',
      antwort: { exitCode: 0, output: 'host\tx\n' },
      status: 'fehler',
    },
    {
      name: 'fehlerCode aus su',
      antwort: { exitCode: 0, output: 'host\tx\nende\t1\t2\n' },
      status: 'fehler',
    },
    {
      name: 'Nonzero-Exit des Agenten',
      antwort: { exitCode: 1, output: 'ende\t0\t0\n' },
      status: 'fehler',
    },
    { name: 'abgelehntes RUN', fehler: 'abgelehnt', status: 'fehler' },
  ] as const;

  it.each(faelle)('T5-5: $name wird als $status behandelt', async (fall) => {
    const { controller, aufrufe, lese } = aufbau();
    controller.oeffne(a);
    if ('fehler' in fall) aufrufe[0]?.scheitern(new Error(fall.fehler));
    else aufrufe[0]?.fertig(fall.antwort);
    await tick();

    expect(lese().status).toBe(fall.status);
    if (fall.status === 'geladen') {
      expect(lese().ausgabe).toMatchObject({ vollstaendig: true, fehlerCode: null });
      expect(lese().ausgabe?.werte).toEqual({});
    } else {
      expect(lese().ausgabe).toBeNull();
      expect(JSON.stringify(lese())).not.toContain('abgelehnt');
    }
  });

  it('T5-2: eine ungültige Generation wird vor dem Senden nicht gestartet', async () => {
    const { controller, aufrufe, lese, setzeGueltig } = aufbau();
    setzeGueltig(false);
    controller.oeffne(a);
    await tick();
    expect(aufrufe).toHaveLength(0);
    expect(lese().status).toBe('laedt');
  });
});
