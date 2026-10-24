import { describe, expect, it, vi } from 'vitest';
import { platzhalter } from '../../../data/staffeln/staffel-2/platzhalter';
import { startZustand } from '../ermittlung';
import type { AgentResult } from '../agentClient';
import { erzeugePruefLauf, type PruefLauf } from '../pruefLauf';
import { erstelleFrischPruef } from '../vorwurfAblauf';

function aufbau(run: (skript: string, timeoutMs: number) => Promise<AgentResult>) {
  let generation = 1;
  let state = startZustand();
  let rueck = { sequenz: 0, generation: 1, vollstaendig: false };
  const lauf = erzeugePruefLauf({
    ermittlung: platzhalter,
    run,
    leseZustand: () => state,
    schreibeZustand: (neu, ereignisse) => {
      state = neu;
      rueck = {
        sequenz: rueck.sequenz + 1,
        generation,
        vollstaendig: !ereignisse.some((e) => e.type === 'pruefung-unvollstaendig'),
      };
    },
    meldeFehler: () => {
      rueck = { sequenz: rueck.sequenz + 1, generation, vollstaendig: false };
    },
  });
  const optionen = {
    ermittlung: platzhalter,
    run,
    leseZustand: () => state,
    schreibeZustand: () => {},
    getPruefLauf: () => lauf,
    getGeneration: () => 1,
    getSetupVersion: () => generation,
    leseRueckmeldung: () => rueck,
  };
  return {
    lauf,
    pruefe: () => erstelleFrischPruef(optionen)(),
    wechsel: () => {
      generation++;
    },
    rueck: () => rueck,
  };
}

describe('Frischprüfung des Vorwurfs', () => {
  it('lehnt Agentfehler ab, obwohl leerlauf erfüllt wird', async () => {
    const h = aufbau(async () => {
      throw new Error('Agent-Timeout');
    });
    expect(await h.pruefe()).toBe(false);
  });

  it('lehnt eine unvollständige Bündelantwort ab', async () => {
    const h = aufbau(async () => ({ exitCode: 0, output: '' }));
    expect(await h.pruefe()).toBe(false);
  });

  it('verlangt eine tatsächliche Rückmeldung nach dem neuen Anstoß', async () => {
    const lauf: PruefLauf = {
      anstossen: vi.fn(),
      stoppe: vi.fn(),
      laeuft: () => false,
      leerlauf: async () => {},
    };
    const pruefe = erstelleFrischPruef({
      getPruefLauf: () => lauf,
      getGeneration: () => 1,
      getSetupVersion: () => 1,
      leseRueckmeldung: () => ({ sequenz: 4, generation: 1, vollstaendig: true }),
    });
    expect(await pruefe()).toBe(false);
  });

  it('akzeptiert vollständige Prüfung auch ohne neue Ereignisse', async () => {
    const h = aufbau(async () => ({ exitCode: 0, output: 'ende\t0\n' }));
    expect(await h.pruefe()).toBe(true);
    expect(h.rueck().sequenz).toBe(1);
  });

  it('verlangt nach dem alten Lauf einen zweiten vollständigen Lauf', async () => {
    let freigeben!: (r: AgentResult) => void;
    const run = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AgentResult>((resolve) => {
            freigeben = resolve;
          })
      )
      .mockResolvedValue({ exitCode: 0, output: 'ende\t0\n' });
    const h = aufbau(run);
    h.lauf.anstossen();
    const antwort = h.pruefe();
    expect(run).toHaveBeenCalledTimes(1);
    freigeben({ exitCode: 0, output: 'ende\t0\n' });
    expect(await antwort).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
    expect(h.rueck().sequenz).toBe(2);
  });

  it('stößt nach Generationwechsel während des alten Laufs keinen neuen an', async () => {
    let freigeben!: (r: AgentResult) => void;
    const run = vi.fn(
      () =>
        new Promise<AgentResult>((resolve) => {
          freigeben = resolve;
        })
    );
    const h = aufbau(run);
    h.lauf.anstossen();
    const antwort = h.pruefe();
    h.wechsel();
    freigeben({ exitCode: 0, output: 'ende\t0\n' });
    expect(await antwort).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('übernimmt keinen nach dem neuen Anstoß abgelösten Lauf', async () => {
    let freigeben!: (r: AgentResult) => void;
    const h = aufbau(
      () =>
        new Promise<AgentResult>((resolve) => {
          freigeben = resolve;
        })
    );
    const antwort = h.pruefe();
    await Promise.resolve();
    h.wechsel();
    freigeben({ exitCode: 0, output: 'ende\t0\n' });
    expect(await antwort).toBe(false);
  });
});
