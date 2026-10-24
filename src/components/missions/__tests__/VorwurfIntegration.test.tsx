import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platzhalter } from '../../../data/staffeln/staffel-2/platzhalter';
import type { AgentClient, AgentResult } from '../../../lib/missions/agentClient';
import type { MissionCommand, MissionReply } from '../../../lib/missions/missionTypes';
import ErmittlungApp from '../ErmittlungApp';

const h = vi.hoisted(() => ({
  client: null as unknown as AgentClient,
  ready: null as unknown as (client: AgentClient) => Promise<void>,
  prompt: null as unknown as (c: MissionCommand) => Promise<MissionReply>,
}));
vi.mock('../V86Terminal', async () => {
  const { useEffect } = await import('react');
  return {
    default: function Terminal({
      onReady,
      onMissionCommand,
    }: {
      onReady: (c: AgentClient) => Promise<void>;
      onMissionCommand: (c: MissionCommand) => Promise<MissionReply>;
    }) {
      h.ready = onReady;
      h.prompt = onMissionCommand;
      useEffect(() => {
        void onReady(h.client);
      }, [onReady]);
      return <div data-testid="terminal-erhalten" />;
    },
  };
});

const belege = (protokoll = true) => ({
  exitCode: 0,
  output: `pruefung\tb.notiz\t0\npruefung\tb.protokoll\t${protokoll ? 0 : 1}\nende\t2\n`,
});
const dateien =
  ['notiz', 'protokoll'].map((id) => `datei\t${btoa(id + '.txt')}\t1\teA==`).join('\n') +
  '\nende\t2\t0\n';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

async function starten(protokoll = true) {
  let pruefung: () => Promise<AgentResult> = async () => belege(protokoll);
  let dateiAusgabe = protokoll ? dateien : 'datei\tbm90aXoudHh0\t1\teA==\nende\t1\t0\n';
  const run = vi.fn(async (skript: string) => {
    if (skript.startsWith('(')) return pruefung();
    if (skript.startsWith('__a=')) return { exitCode: 0, output: dateiAusgabe };
    return { exitCode: 0, output: '' };
  });
  h.client = { run } as unknown as AgentClient;
  const view = render(<ErmittlungApp ermittlung={platzhalter} />);
  await waitFor(() => expect(run).toHaveBeenCalledTimes(3));
  await act(async () => {
    await h.prompt('__prompt');
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Aktenwand' }));
  await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(protokoll ? 2 : 1));
  for (const box of screen.getAllByRole('checkbox')) await user.click(box);
  await user.click(screen.getByRole('button', { name: 'Vorwurf erheben' }));
  await user.click(screen.getByRole('radio', { name: /Person A/ }));
  return {
    user,
    run,
    view,
    pruefung: (fn: () => Promise<AgentResult>) => {
      pruefung = fn;
    },
    dateien: (ausgabe: string) => {
      dateiAusgabe = ausgabe;
    },
  };
}

describe('Vorwurf am tatsächlichen Prüflauf', () => {
  it('behält neu erkannte Belege trotz altem Dateisnapshot auswählbar', async () => {
    const t = await starten(false);
    await t.user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    t.pruefung(async () => belege());
    await act(async () => {
      await h.prompt('__prompt');
    });
    await t.user.click(screen.getByRole('button', { name: 'Vorwurf erheben' }));
    const dialog = screen.getByRole('dialog');
    const neu = dialog.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement;
    await t.user.click(neu);
    expect(neu).toBeChecked();
    await act(async () => {
      await h.prompt('__prompt');
    });
    expect(neu).toBeChecked();
    // Erst ein neuer erfolgreicher Snapshot darf die fehlende Datei entfernen.
    await t.user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await t.user.click(screen.getByRole('button', { name: 'Aktualisieren', exact: true }));
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(1));
    await t.user.click(screen.getByRole('button', { name: 'Vorwurf erheben' }));
    expect(
      screen.getByRole('dialog').querySelectorAll('input[type="checkbox"]')[1]
    ).not.toBeChecked();
  });

  it('bereinigt verlorene Erkennung auch bei ausgehängter Aktenwand', async () => {
    const t = await starten();
    await t.user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await t.user.click(screen.getByRole('button', { name: 'Büro', exact: true }));
    t.pruefung(async () => belege(false));
    await act(async () => {
      await h.prompt('__prompt');
    });
    t.pruefung(async () => belege());
    await act(async () => {
      await h.prompt('__prompt');
    });
    await t.user.click(screen.getByRole('button', { name: 'Aktenwand', exact: true }));
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
  });

  it.each(['fehlerhaft', 'begrenzt', 'abfragefehler'])(
    'behält Auswahl bei %s statt Dateiabwesenheit zu unterstellen',
    async (art) => {
      const t = await starten();
      await t.user.click(screen.getByRole('button', { name: 'Abbrechen' }));
      if (art === 'abfragefehler') t.run.mockRejectedValueOnce(new Error('Agent-Timeout'));
      else {
        t.dateien(
          art === 'fehlerhaft'
            ? 'datei\tungueltig\nende\t1\t0\n'
            : 'hinweis\tweitere-dateien\nende\t1\t0\n'
        );
      }
      await t.user.click(screen.getByRole('button', { name: 'Aktualisieren', exact: true }));
      await screen.findByText(
        art === 'abfragefehler'
          ? 'Ansicht konnte nicht gelesen werden. Bitte erneut aktualisieren.'
          : art === 'fehlerhaft'
            ? 'Einige Dateieinträge waren ungültig und wurden übersprungen.'
            : /auf 50 Dateien begrenzt/
      );
      t.dateien(dateien);
      await t.user.click(screen.getByRole('button', { name: 'Aktualisieren', exact: true }));
      await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
      expect(screen.getAllByRole('checkbox')[1]).toBeChecked();
    }
  );

  it.each(['agent', 'unvollstaendig'])(
    'wertet bei %s keine alten Belege als Erfolg',
    async (art) => {
      const h = await starten();
      h.pruefung(async () => {
        if (art === 'agent') throw new Error('Agent-Timeout');
        return { exitCode: 0, output: '' };
      });
      await h.user.click(screen.getByRole('button', { name: 'Absenden' }));
      await waitFor(
        () =>
          expect(screen.getByTestId('pager')).toHaveTextContent(
            'Belege konnten gerade nicht geprüft werden'
          ),
        { timeout: 4000 }
      );
      expect(screen.queryByRole('heading', { name: 'Fall gelöst' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Vorwurf erheben' })).toBeEnabled();
    }
  );

  it('verwirft den beim Submit ausgewählten, frisch verlorenen Beleg nicht still', async () => {
    const h = await starten();
    h.pruefung(async () => belege(false));
    await h.user.click(screen.getByRole('button', { name: 'Absenden' }));
    await waitFor(
      () =>
        expect(screen.getByTestId('pager')).toHaveTextContent(
          'Ein ausgewählter Beleg ist nicht mehr gültig'
        ),
      { timeout: 4000 }
    );
    expect(screen.queryByRole('heading', { name: 'Fall gelöst' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vorwurf erheben' })).toBeEnabled();
  });

  it('zeigt Busy, erlaubt Abbrechen und liefert einen begonnenen Erfolg genau einmal', async () => {
    const t = await starten();
    const terminal = screen.getByTestId('terminal-erhalten');
    let fertig!: (r: AgentResult) => void;
    t.pruefung(
      () =>
        new Promise<AgentResult>((resolve) => {
          fertig = resolve;
        })
    );
    const vorher = t.run.mock.calls.length;
    const form = screen.getByRole('button', { name: 'Absenden' }).closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(screen.getByText('Belege werden geprüft …')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Absenden' })).toBeDisabled();
    await t.user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => {
      fertig(belege());
    });
    const titel = await screen.findByRole('heading', { name: 'Fall gelöst' });
    expect(titel).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Vorwurf erheben' })).not.toBeInTheDocument();
    expect(screen.getByTestId('terminal-erhalten')).toBe(terminal);
    const anzahl = t.run.mock.calls.length;
    expect(anzahl).toBe(vorher + 1);
    await act(async () => {
      await h.prompt('__prompt');
    });
    expect(t.run).toHaveBeenCalledTimes(anzahl);
  });

  it('übernimmt nach einem neuen Setup keinen alten Vorwurf', async () => {
    const t = await starten();
    let fertig!: (r: AgentResult) => void;
    t.pruefung(
      () =>
        new Promise<AgentResult>((resolve) => {
          fertig = resolve;
        })
    );
    await t.user.click(screen.getByRole('button', { name: 'Absenden' }));
    const neuerRun = vi.fn(async () => ({ exitCode: 0, output: dateien }));
    await act(async () => {
      const setup = h.ready({ run: neuerRun } as unknown as AgentClient);
      fertig(belege());
      await setup;
    });
    expect(screen.queryByRole('heading', { name: 'Fall gelöst' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(neuerRun).toHaveBeenCalledTimes(3);
  });
});
