// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentClient, AgentResult } from '../agentClient';
import { erzeugeErmittlungsRun } from '../ermittlungsRun';

type Aufruf = {
  skript: string;
  timeoutMs: number;
  fertig: (resultat: AgentResult) => void;
  scheitern: (fehler: Error) => void;
};

function fakeClient() {
  const aufrufe: Aufruf[] = [];
  const client = {
    run(skript: string, timeoutMs: number) {
      return new Promise<AgentResult>((resolve, reject) => {
        aufrufe.push({ skript, timeoutMs, fertig: resolve, scheitern: reject });
      });
    },
  } as unknown as AgentClient;
  return { client, aufrufe };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('ermittlungsRun', () => {
  it('T5-1: sendet höchstens einen RUN und startet nach einem Fehler den nächsten', async () => {
    const { client, aufrufe } = fakeClient();
    const queue = erzeugeErmittlungsRun();

    const eins = queue.run(client, 'eins', 1_000, () => true);
    const zwei = queue.run(client, 'zwei', 2_000, () => true);
    const drei = queue.run(client, 'drei', 3_000, () => true);

    expect(aufrufe.map((aufruf) => aufruf.skript)).toEqual(['eins']);
    expect(aufrufe[0]?.timeoutMs).toBe(1_000);

    aufrufe[0]?.fertig({ exitCode: 0, output: 'ok' });
    await expect(eins).resolves.toEqual({ exitCode: 0, output: 'ok' });
    await tick();
    expect(aufrufe.map((aufruf) => aufruf.skript)).toEqual(['eins', 'zwei']);

    aufrufe[1]?.scheitern(new Error('kaputt'));
    await expect(zwei).rejects.toThrow('kaputt');
    await tick();
    expect(aufrufe.map((aufruf) => aufruf.skript)).toEqual(['eins', 'zwei', 'drei']);

    aufrufe[2]?.fertig({ exitCode: 0, output: 'ok' });
    await expect(drei).resolves.toEqual({ exitCode: 0, output: 'ok' });
  });

  it('T5-2: sendet veraltete wartende Aufträge nicht und lässt das neue Setup warten', async () => {
    const { client, aufrufe } = fakeClient();
    const queue = erzeugeErmittlungsRun();
    let alt = true;

    const laufend = queue.run(client, 'alt', 1_000, () => alt);
    const wartend = queue.run(client, 'stale', 1_000, () => alt);
    const neu = queue.run(client, 'neu', 2_000, () => !alt);

    expect(aufrufe.map((aufruf) => aufruf.skript)).toEqual(['alt']);
    alt = false;
    aufrufe[0]?.fertig({ exitCode: 0, output: 'alt' });

    await expect(laufend).rejects.toThrow('nicht mehr aktuell');
    await expect(wartend).rejects.toThrow('nicht mehr aktuell');
    await tick();
    expect(aufrufe.map((aufruf) => aufruf.skript)).toEqual(['alt', 'neu']);
    expect(aufrufe[1]?.timeoutMs).toBe(2_000);

    aufrufe[1]?.fertig({ exitCode: 0, output: 'neu' });
    await expect(neu).resolves.toEqual({ exitCode: 0, output: 'neu' });
  });
});
