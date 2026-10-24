import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platzhalter } from '../../../data/staffeln/staffel-2/platzhalter';
import type { AgentClient, AgentResult } from '../../../lib/missions/agentClient';
import type { MissionCommand, MissionReply } from '../../../lib/missions/missionTypes';
import { rahmenSetupSkript } from '../../../lib/missions/staffel2Rahmen';
import ErmittlungApp from '../ErmittlungApp';

const h = vi.hoisted(() => ({
  client: null as unknown as AgentClient,
  ready: null as unknown as (client: AgentClient) => Promise<void>,
  sendCommand: null as unknown as (command: MissionCommand) => Promise<MissionReply>,
}));

vi.mock('../V86Terminal', async () => {
  const { useEffect } = await import('react');
  return {
    default: function StubTerminal(props: {
      onReady?: (client: AgentClient) => void;
      onMissionCommand?: (command: MissionCommand) => Promise<MissionReply>;
    }) {
      const { onReady, onMissionCommand } = props;
      h.ready = onReady as (client: AgentClient) => Promise<void>;
      h.sendCommand = onMissionCommand as (command: MissionCommand) => Promise<MissionReply>;
      useEffect(() => {
        onReady?.(h.client);
      }, [onReady]);
      return <div data-testid="stub-terminal" />;
    },
  };
});

const pagerText = () => screen.getByTestId('pager').textContent ?? '';

describe('ErmittlungApp', () => {
  let run: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
    }) as unknown as typeof window.matchMedia;
    run = vi.fn(async (_skript: string) => ({ exitCode: 0, output: '' }));
    h.client = { run } as unknown as AgentClient;
  });

  it('setzt den Rahmen vor dem Episoden-Setup und zeigt den Auftrag', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);

    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(run.mock.calls[0]?.[0]).toBe(rahmenSetupSkript());
    expect(run.mock.calls[0]?.[1]).toBe(60_000);
    expect(run.mock.calls[1]?.[0]).toBe(platzhalter.setup);
    expect(run.mock.calls[1]?.[1]).toBe(60_000);
    await waitFor(() => expect(pagerText()).toContain('Leg in ~/belege'));
  });

  it.each(['rahmen', 'episode'])('meldet einen fehlgeschlagenen %s-Exitcode', async (teil) => {
    if (teil === 'episode') run.mockResolvedValueOnce({ exitCode: 0, output: '' });
    run.mockResolvedValue({ exitCode: 17, output: 'fehlgeschlagen' });
    render(<ErmittlungApp ermittlung={platzhalter} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(run).toHaveBeenCalledTimes(teil === 'rahmen' ? 1 : 2);
    expect(pagerText()).not.toContain('Leg in ~/belege');
    await act(async () => { await h.sendCommand('__prompt'); });
    expect(run).toHaveBeenCalledTimes(teil === 'rahmen' ? 1 : 2);
  });

  it.each(['rahmen', 'episode'])('verwirft das nach Unmount endende %s-Setup', async (teil) => {
    let freigeben!: (resultat: AgentResult) => void;
    const blockiert = new Promise<AgentResult>((fertig) => { freigeben = fertig; });
    if (teil === 'episode') run.mockResolvedValueOnce({ exitCode: 0, output: '' });
    run.mockImplementationOnce(() => blockiert);
    const view = render(<ErmittlungApp ermittlung={platzhalter} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(teil === 'rahmen' ? 1 : 2));
    await act(async () => { await h.sendCommand('__prompt'); });
    view.unmount();

    await act(async () => { freigeben({ exitCode: 0, output: '' }); await blockiert; });
    expect(run).toHaveBeenCalledTimes(teil === 'rahmen' ? 1 : 2);
  });

  it('lässt ein altes Setup keinen neueren Prüflauf ersetzen', async () => {
    let freigeben!: (resultat: AgentResult) => void;
    const blockiert = new Promise<AgentResult>((fertig) => { freigeben = fertig; });
    run.mockImplementationOnce(() => blockiert);
    render(<ErmittlungApp ermittlung={platzhalter} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const neuerRun = vi.fn(async () => ({ exitCode: 0, output: '' }));
    await act(async () => { await h.ready({ run: neuerRun } as unknown as AgentClient); });
    expect(neuerRun).toHaveBeenCalledTimes(2);

    await act(async () => { freigeben({ exitCode: 0, output: '' }); await blockiert; });
    await act(async () => { await h.sendCommand('__prompt'); });
    expect(run).toHaveBeenCalledTimes(1);
    expect(neuerRun).toHaveBeenCalledTimes(3);
  });

  it('antwortet auf __prompt, ohne auf das Prüfbündel zu warten', async () => {
    run.mockImplementation(async (skript: string) => {
      if (skript.startsWith('(')) return new Promise<never>(() => {});
      return { exitCode: 0, output: '' };
    });
    render(<ErmittlungApp ermittlung={platzhalter} />);

    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    let antwort: MissionReply | undefined;
    await act(async () => {
      antwort = await h.sendCommand('__prompt');
    });
    expect(antwort).toEqual({ exitCode: 0, text: '' });
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('holt einen Prompt nach, der während des Setups eintrifft', async () => {
    let freigeben = () => {};
    const blockiert = new Promise<void>((fertig) => {
      freigeben = fertig;
    });
    run.mockImplementation(async (skript: string) => {
      if (skript === platzhalter.setup) await blockiert;
      if (skript.startsWith('(')) {
        return { exitCode: 0, output: 'pruefung\ts.ankommen.notiz\t0\nende\t1\n' };
      }
      return { exitCode: 0, output: '' };
    });
    render(<ErmittlungApp ermittlung={platzhalter} />);

    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await act(async () => {
      await h.sendCommand('__prompt');
    });
    expect(run).toHaveBeenCalledTimes(2);

    await act(async () => {
      freigeben();
      await blockiert;
    });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(3));
    expect(run.mock.calls[2]?.[0]?.startsWith('(')).toBe(true);
    await waitFor(() => expect(pagerText()).toContain('Erledigt: Lege eine Notiz an'), {
      timeout: 6000,
    });
  });

  it('meldet einen bestandenen Schritt im Pager', async () => {
    run.mockImplementation(async (skript: string) => {
      if (skript.startsWith('(')) {
        return { exitCode: 0, output: 'pruefung\ts.ankommen.notiz\t0\nende\t1\n' };
      }
      return { exitCode: 0, output: '' };
    });
    render(<ErmittlungApp ermittlung={platzhalter} />);

    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await act(async () => {
      await h.sendCommand('__prompt');
    });
    await waitFor(() => expect(pagerText()).toContain('Erledigt: Lege eine Notiz an'), {
      timeout: 6000,
    });
  });

  it('zeigt eine Statuszeile, wenn das Prüfbündel scheitert', async () => {
    run.mockImplementation(async (skript: string) => {
      if (skript.startsWith('(')) throw new Error('weg');
      return { exitCode: 0, output: '' };
    });
    render(<ErmittlungApp ermittlung={platzhalter} />);

    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await act(async () => {
      await h.sendCommand('__prompt');
    });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Prüfung gerade nicht erreichbar')
    );
  });

  it('hängt das Terminal beim Umschalten nicht aus', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);
    const terminal = await screen.findByTestId('stub-terminal');

    await act(async () => {
      screen.getByRole('button', { name: 'Ansicht' }).click();
    });
    expect(screen.getByRole('button', { name: 'Ansicht' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(terminal.parentElement?.className).toContain('hidden');
  });

  it('weist andere mission-Befehle mit Exit 1 ab', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));

    let antwort: MissionReply | undefined;
    await act(async () => {
      antwort = await h.sendCommand('status');
    });
    expect(antwort).toEqual({
      exitCode: 1,
      text: 'In Staffel 2 gibt es mission noch nicht. Schau in den Pager.',
    });
  });
});
