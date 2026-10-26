import { act, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platzhalter } from '../../../data/staffeln/staffel-2/platzhalter';
import { abfrageSkript } from '../../../lib/missions/abfrage';
import { AKTENWAND_ABFRAGE } from '../../../lib/missions/aktenwand';
import type { AgentClient, AgentResult } from '../../../lib/missions/agentClient';
import { pruefeDaten } from '../../../lib/missions/ermittlung';
import type { Ermittlung, Schrittart } from '../../../lib/missions/ermittlungTypes';
import type { MissionCommand, MissionReply } from '../../../lib/missions/missionTypes';
import { einsatzrahmenSetupSkript } from '../../../lib/missions/einsatzrahmenSetup';
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

const mitBildschirm: Ermittlung = { ...platzhalter, bildschirm: true };
vi.mock('../V86Bildschirm', () => ({
  default: function StubBildschirm() {
    return <div data-testid="stub-bildschirm" />;
  },
}));

// Die Fallakte ist nach dem Einstieg zu (R2); die meisten Tests brauchen sie offen.
const render: typeof rtlRender = (ui, options) => {
  const view = rtlRender(ui, options);
  fireEvent.click(screen.getByRole('button', { name: 'Fallakte' }));
  return view;
};

const pagerText = () => screen.getByTestId('pager').textContent ?? '';
const istBuendel = (skript: string) => skript.startsWith('(');
const istAbfrage = (skript: string) => skript.startsWith('__a=$(printf');
const buendelAufrufe = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.filter((call) => istBuendel(call[0] as string));

// Erfolgreiche Setup-Läufe vor dem jeweils geprüften.
const vorherige: Record<string, number> = { rahmen: 0, einsatzrahmen: 1, episode: 2 };

let run: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
  }) as unknown as typeof window.matchMedia;
  run = vi.fn(async (skript: string) =>
    istAbfrage(skript)
      ? { exitCode: 0, output: 'host\trw-srv01\nende\t1\t0\n' }
      : { exitCode: 0, output: '' }
  );
  h.client = { run } as unknown as AgentClient;
});

describe('ErmittlungApp', () => {
  it('setzt den Rahmen vor dem Episoden-Setup und zeigt den Auftrag', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);

    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
    expect(run.mock.calls[0]?.[0]).toBe(rahmenSetupSkript());
    expect(run.mock.calls[0]?.[1]).toBe(60_000);
    expect(run.mock.calls[1]?.[0]).toBe(einsatzrahmenSetupSkript());
    expect(run.mock.calls[1]?.[1]).toBe(60_000);
    expect(run.mock.calls[2]?.[0]).toBe(platzhalter.setup);
    expect(run.mock.calls[2]?.[1]).toBe(60_000);
    expect(istAbfrage(run.mock.calls[3]?.[0] as string)).toBe(true);
    await waitFor(() => expect(pagerText()).toContain('Leg in ~/belege'));
  });

  it.each(['rahmen', 'einsatzrahmen', 'episode'])(
    'meldet einen fehlgeschlagenen %s-Exitcode',
    async (teil) => {
      for (let i = 0; i < vorherige[teil]; i++) {
        run.mockResolvedValueOnce({ exitCode: 0, output: '' });
      }
      run.mockResolvedValue({ exitCode: 17, output: 'fehlgeschlagen' });
      render(<ErmittlungApp ermittlung={platzhalter} />);

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
      expect(run).toHaveBeenCalledTimes(vorherige[teil] + 1);
      expect(pagerText()).not.toContain('Leg in ~/belege');
      await act(async () => {
        await h.sendCommand('__prompt');
      });
      expect(run).toHaveBeenCalledTimes(vorherige[teil] + 1);
    }
  );

  it.each(['rahmen', 'einsatzrahmen', 'episode'])(
    'verwirft das nach Unmount endende %s-Setup',
    async (teil) => {
      let freigeben!: (resultat: AgentResult) => void;
      const blockiert = new Promise<AgentResult>((fertig) => {
        freigeben = fertig;
      });
      for (let i = 0; i < vorherige[teil]; i++) {
        run.mockResolvedValueOnce({ exitCode: 0, output: '' });
      }
      run.mockImplementationOnce(() => blockiert);
      const view = render(<ErmittlungApp ermittlung={platzhalter} />);
      await waitFor(() => expect(run).toHaveBeenCalledTimes(vorherige[teil] + 1));
      await act(async () => {
        await h.sendCommand('__prompt');
      });
      view.unmount();

      await act(async () => {
        freigeben({ exitCode: 0, output: '' });
        await blockiert;
      });
      expect(run).toHaveBeenCalledTimes(vorherige[teil] + 1);
    }
  );

  it('lässt ein altes Setup keinen neueren Prüflauf ersetzen', async () => {
    let freigeben!: (resultat: AgentResult) => void;
    const blockiert = new Promise<AgentResult>((fertig) => {
      freigeben = fertig;
    });
    run.mockImplementationOnce(() => blockiert);
    render(<ErmittlungApp ermittlung={platzhalter} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const neuerRun = vi.fn(async () => ({ exitCode: 0, output: '' }));
    await act(async () => {
      void h.ready({ run: neuerRun } as unknown as AgentClient);
      await Promise.resolve();
    });
    // Die neue Generation wartet auf das Ende des bereits gesendeten alten RUN.
    expect(neuerRun).not.toHaveBeenCalled();

    await act(async () => {
      freigeben({ exitCode: 0, output: '' });
      await blockiert;
    });
    await waitFor(() => expect(neuerRun).toHaveBeenCalledTimes(4));
    await act(async () => {
      await h.sendCommand('__prompt');
    });
    expect(run).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(neuerRun).toHaveBeenCalledTimes(5));
  });

  it('antwortet auf __prompt, ohne auf das Prüfbündel zu warten', async () => {
    run.mockImplementation(async (skript: string) => {
      if (skript.startsWith('(')) return new Promise<never>(() => {});
      return { exitCode: 0, output: '' };
    });
    render(<ErmittlungApp ermittlung={platzhalter} />);

    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
    let antwort: MissionReply | undefined;
    await act(async () => {
      antwort = await h.sendCommand('__prompt');
    });
    expect(antwort).toEqual({ exitCode: 0, text: '' });
    expect(run).toHaveBeenCalledTimes(5);
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

    await waitFor(() => expect(run).toHaveBeenCalledTimes(3));
    await act(async () => {
      await h.sendCommand('__prompt');
    });
    expect(run).toHaveBeenCalledTimes(3);

    await act(async () => {
      freigeben();
      await blockiert;
    });
    await waitFor(() => expect(buendelAufrufe(run)).toHaveLength(1));
    expect((buendelAufrufe(run)[0]?.[0] as string).startsWith('(')).toBe(true);
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

    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
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

    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
    await act(async () => {
      await h.sendCommand('__prompt');
    });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Prüfung gerade nicht erreichbar')
    );
  });

  it.each([false, true])(
    'zeigt unvollständige Prüfungen an, vorheriger Fehler: %s',
    async (vorherigerFehler) => {
      let vollstaendig = false;
      let fehlerOffen = vorherigerFehler;
      run.mockImplementation(async (skript: string) => {
        if (!skript.startsWith('(')) return { exitCode: 0, output: '' };
        if (fehlerOffen) {
          fehlerOffen = false;
          throw new Error('weg');
        }
        return { exitCode: 0, output: vollstaendig ? 'ende\t0\n' : '' };
      });
      render(<ErmittlungApp ermittlung={platzhalter} />);
      await waitFor(() => expect(run).toHaveBeenCalledTimes(3));
      if (vorherigerFehler) {
        await act(async () => {
          await h.sendCommand('__prompt');
        });
        await waitFor(() =>
          expect(screen.getByText(/Prüfung gerade nicht erreichbar/)).toBeInTheDocument()
        );
      }

      await act(async () => {
        await h.sendCommand('__prompt');
      });
      await waitFor(() =>
        expect(screen.getByText(/Prüfung gerade nicht erreichbar/)).toBeInTheDocument()
      );

      vollstaendig = true;
      await act(async () => {
        await h.sendCommand('__prompt');
      });
      await waitFor(() =>
        expect(screen.queryByText(/Prüfung gerade nicht erreichbar/)).not.toBeInTheDocument()
      );
    }
  );

  it('hängt das Terminal beim Umschalten nicht aus (R1 über alle Tabs)', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);
    const terminal = await screen.findByTestId('stub-terminal');
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    expect(screen.getByRole('tab', { name: 'Serverraum' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(terminal.closest('[role="tabpanel"]')).toHaveAttribute('hidden');

    await user.click(screen.getByRole('tab', { name: 'Terminal' }));
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(terminal.closest('[role="tabpanel"]')).not.toHaveAttribute('hidden');
  });

  it('wechselt die Tabs mit Pfeiltasten, Pos1 und Ende und fokussiert sie', async () => {
    render(<ErmittlungApp ermittlung={mitBildschirm} />);
    await screen.findByTestId('stub-bildschirm');
    const user = userEvent.setup();
    const tab = (name: string) => screen.getByRole('tab', { name });
    expect(tab('Terminal')).toHaveAttribute('aria-selected', 'true');

    tab('Terminal').focus();
    await user.keyboard('{ArrowRight}');
    expect(tab('Bildschirm')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Bildschirm')).toHaveFocus();
    expect(tab('Bildschirm')).toHaveAttribute('tabindex', '0');
    expect(tab('Terminal')).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{End}');
    expect(tab('Serverraum')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(tab('Terminal')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(tab('Serverraum')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tab('Terminal')).toHaveAttribute('aria-selected', 'true');
  });

  it('zeigt den Tab Bildschirm nur bei Episoden mit Bildschirm', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);
    await screen.findByTestId('stub-terminal');
    expect(screen.queryByRole('tab', { name: 'Bildschirm' })).toBeNull();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Terminal',
      'Serverraum',
    ]);
  });

  it('schaltet die Fallakte ein und aus', async () => {
    rtlRender(<ErmittlungApp ermittlung={platzhalter} />);
    await screen.findByTestId('stub-terminal');
    const user = userEvent.setup();
    const schalter = screen.getByRole('button', { name: 'Fallakte' });
    const akte = document.getElementById(schalter.getAttribute('aria-controls')!)!;
    expect(schalter).toHaveAttribute('aria-expanded', 'false');
    expect(akte).not.toBeVisible();
    expect(screen.getByTestId('stub-terminal')).toBeInTheDocument();
    await user.click(schalter);
    expect(schalter).toHaveAttribute('aria-expanded', 'true');
    expect(akte).toBeVisible();
    await user.click(schalter);
    expect(schalter).toHaveAttribute('aria-expanded', 'false');
    expect(akte).toHaveAttribute('hidden');
    expect(screen.getByTestId('stub-terminal')).toBeInTheDocument();
  });

  it('weist andere mission-Befehle mit Exit 1 ab', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));

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

const schrittFixture = (
  id: string,
  title: string,
  pager: string[],
  art: Schrittart = 'sichern'
) => ({
  art,
  id,
  title,
  pager,
  verify: 'true',
  tipps: ['Richtung', 'Befehl', 'Lösung'] as const,
});

const zweiSpuren: Ermittlung = {
  nr: 99,
  id: 'test-zwei-spuren',
  titel: 'Test',
  hostname: 'rw-srv01',
  setup: 'true',
  ansichten: [
    { id: 'raum', art: 'raum', titel: 'Raum', abfrage: "printf 'host\\t%s\\n' rw-srv01" },
  ],
  spuren: [
    {
      id: 'ankommen',
      titel: 'Ankommen',
      schritte: [
        schrittFixture('notiz', 'Lege eine Notiz an', ['A1: Lege notiz.txt an.']),
        schrittFixture(
          'abschluss',
          'Ergänze fertig in notiz.txt',
          ['A2: Ergänze fertig.'],
          'eingreifen'
        ),
      ],
    },
    {
      id: 'protokoll',
      titel: 'Protokoll',
      schritte: [
        schrittFixture(
          'protokoll',
          'Lege ein Protokoll an',
          ['B1: Lege protokoll.txt an.'],
          'reparieren'
        ),
        schrittFixture('abschluss', 'Ergänze fertig in protokoll.txt', ['B2: Ergänze fertig.']),
      ],
    },
  ],
  vorwurf: {
    verdaechtige: [
      { id: 'person-a', name: 'Person A', rolle: 'Rolle A', portraet: '/missions/figur/a.webp' },
      { id: 'person-b', name: 'Person B', rolle: 'Rolle B', portraet: '/missions/figur/b.webp' },
      { id: 'person-c', name: 'Person C', rolle: 'Rolle C', portraet: '/missions/figur/c.webp' },
    ],
    taeterId: 'person-a',
    belege: [
      {
        id: 'notiz',
        beschreibung: 'Eine Notiz.',
        spurId: 'ankommen',
        stuetzt: 'person-a',
        verify: 'true',
      },
      {
        id: 'protokoll',
        beschreibung: 'Ein Protokoll.',
        spurId: 'protokoll',
        stuetzt: 'person-a',
        verify: 'true',
      },
    ],
    mindestBelege: 1,
    jedeSpur: true,
    antworten: {
      richtig: ['Richtig.'],
      falschePerson: ['Falsch.'],
      zuWenigBelege: ['Zu wenig.'],
      gesperrt: ['Gesperrt.'],
    },
  },
  einsatzrahmen: { text: ['Rahmen'], verstoss: 'false', folge: ['Verstoß.'] },
  beweisstueck: { id: 'notiz', titel: 'Notiz', beschreibung: 'Eine Notiz.', code: 'test' },
  szene: ['Szene.'],
};

const zweiAnsichten: Ermittlung = {
  ...zweiSpuren,
  ansichten: [
    {
      id: 'buero',
      art: 'raum',
      titel: 'Büro',
      abfrage: `printf 'host\\t%s\\n' "$(hostname)"`,
      hotspots: [
        { id: 'host', label: 'Hostname', x: 40, y: 40, w: 240, h: 100, schluessel: 'host' },
      ],
    },
    {
      id: 'lager',
      art: 'raum',
      titel: 'Lager',
      abfrage: `printf 'konto\\t%s\\n' "$(id -un)"`,
      hotspots: [
        { id: 'konto', label: 'Konto', x: 320, y: 200, w: 240, h: 100, schluessel: 'konto' },
      ],
    },
  ],
};

const mitAktenwand: Ermittlung = {
  ...zweiAnsichten,
  ansichten: [
    ...zweiAnsichten.ansichten,
    {
      id: 'aktenwand',
      art: 'aktenwand',
      titel: 'Aktenwand',
      abfrage: AKTENWAND_ABFRAGE,
    },
  ],
};

const ALLE_PRUEFUNGEN = [
  's.ankommen.notiz',
  's.ankommen.abschluss',
  's.protokoll.protokoll',
  's.protokoll.abschluss',
  'b.notiz',
  'b.protokoll',
  'e.verstoss',
] as const;

const buendel = (bestanden: ReadonlySet<string>): string => {
  const zeilen = ALLE_PRUEFUNGEN.map((id) => `pruefung\t${id}\t${bestanden.has(id) ? 0 : 1}`);
  return `${zeilen.join('\n')}\nende\t${ALLE_PRUEFUNGEN.length}\n`;
};

const b64 = (text: string): string => Buffer.from(text).toString('base64');
const aktenOutput = (dateien: Array<[string, number, string]>): string => {
  const zeilen = dateien.map(
    ([name, bytes, text]) => `datei\t${b64(name)}\t${bytes}\t${b64(text)}`
  );
  return `${zeilen.join('\n')}\nende\t${zeilen.length}\t0\n`;
};

describe('ErmittlungApp: freie Spurenwahl (T4)', () => {
  const spurButton = (name: string) => screen.getByRole('button', { name });

  // Zählt Pager-Nachrichten, nicht Textvorkommen: Die aktuelle Nachricht steht zusätzlich
  // im Screenreader-Bereich, ältere im Verlauf.
  const pagerErfolge = (titel: string): number => {
    const pager = screen.getByTestId('pager');
    const aktuell = pager.querySelector('[aria-live="polite"]');
    const verlauf = pager.querySelector('[data-testid="pager-verlauf"]');
    const historie = verlauf
      ? Array.from(verlauf.querySelectorAll('li')).filter((li) => li.textContent?.includes(titel))
          .length
      : 0;
    return historie + (aktuell?.textContent?.includes(titel) ? 1 : 0);
  };

  const installiereVm = (bestanden: ReadonlySet<string>) => {
    run.mockImplementation(async (skript: string) =>
      skript.startsWith('(')
        ? { exitCode: 0, output: buendel(bestanden) }
        : { exitCode: 0, output: '' }
    );
  };

  const starte = async () => {
    render(<ErmittlungApp ermittlung={zweiSpuren} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
  };

  const starteMit = async (client: AgentClient, mock: ReturnType<typeof vi.fn>) => {
    h.client = client;
    render(<ErmittlungApp ermittlung={zweiSpuren} />);
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(4));
  };

  const prompt = async () => {
    await act(async () => {
      await h.sendCommand('__prompt');
    });
  };

  it('T4-Daten: Platzhalter und Testfixture erfüllen den Datenvertrag', () => {
    expect(pruefeDaten(platzhalter)).toEqual([]);
    expect(pruefeDaten(zweiSpuren)).toEqual([]);
  });

  it('T4-7: ein vollständiges Bündel bestätigt nur B1, B2 wird zum aktuellen Auftrag', async () => {
    const bestanden = new Set(['s.protokoll.protokoll']);
    installiereVm(bestanden);
    await starte();
    const user = userEvent.setup();
    await user.click(spurButton('Protokoll, 0 von 2 Schritten erledigt'));

    await prompt();

    await waitFor(() =>
      expect(spurButton('Protokoll, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );
    expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toBeInTheDocument();
    expect(screen.getByText('Ergänze fertig in protokoll.txt')).toBeInTheDocument();
    expect(screen.getByText('B2: Ergänze fertig.')).toBeInTheDocument();
    await waitFor(() => expect(pagerText()).toContain('Erledigt: Lege ein Protokoll an'), {
      timeout: 4000,
    });
  });

  it('T4-8: löst zuerst B vollständig und danach A, ohne Reihenfolgezwang', async () => {
    const bestanden = new Set(['s.protokoll.protokoll']);
    installiereVm(bestanden);
    await starte();
    const user = userEvent.setup();
    await user.click(spurButton('Protokoll, 0 von 2 Schritten erledigt'));

    await prompt();
    await waitFor(() =>
      expect(spurButton('Protokoll, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );

    bestanden.add('s.protokoll.abschluss');
    await prompt();
    await waitFor(() =>
      expect(spurButton('Protokoll, 2 von 2 Schritten erledigt, abgeschlossen')).toBeInTheDocument()
    );
    expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toBeInTheDocument();

    bestanden.add('s.ankommen.notiz');
    await prompt();
    await waitFor(() =>
      expect(spurButton('Ankommen, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );

    bestanden.add('s.ankommen.abschluss');
    await prompt();
    await waitFor(() =>
      expect(spurButton('Ankommen, 2 von 2 Schritten erledigt, abgeschlossen')).toBeInTheDocument()
    );
  });

  it('T4-9: ein Bündel lässt A und B je genau einen Schritt steigen, ohne doppelte Pager-Erfolge', async () => {
    const bestanden = new Set(['s.ankommen.notiz', 's.protokoll.protokoll']);
    installiereVm(bestanden);
    await starte();
    const user = userEvent.setup();
    await user.click(spurButton('Protokoll, 0 von 2 Schritten erledigt'));

    await prompt();
    await waitFor(() =>
      expect(spurButton('Protokoll, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );
    expect(spurButton('Ankommen, 1 von 2 Schritten erledigt')).toBeInTheDocument();
    expect(spurButton('Protokoll, 1 von 2 Schritten erledigt')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await waitFor(() => expect(pagerText()).toContain('Erledigt: Lege ein Protokoll an'), {
      timeout: 4000,
    });

    const vorher = run.mock.calls.length;
    await prompt();
    await waitFor(() => expect(run.mock.calls.length).toBe(vorher + 1));

    expect(pagerErfolge('Erledigt: Lege eine Notiz an')).toBe(1);
    expect(pagerErfolge('Erledigt: Lege ein Protokoll an')).toBe(1);
  });

  it('T4-10: eine vorgezogene A2-ID ändert höchstens den aktuellen Schritt', async () => {
    const bestanden = new Set(['s.ankommen.abschluss']);
    installiereVm(bestanden);
    await starte();

    await prompt();
    await waitFor(() => expect(buendelAufrufe(run)).toHaveLength(1));
    expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toBeInTheDocument();

    bestanden.add('s.ankommen.notiz');
    await prompt();
    await waitFor(() =>
      expect(spurButton('Ankommen, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );
    expect(screen.getByText('Ergänze fertig in notiz.txt')).toBeInTheDocument();
    expect(screen.getByText('A2: Ergänze fertig.')).toBeInTheDocument();

    const skripte = run.mock.calls
      .map((call) => call[0] as string)
      .filter((skript) => skript.startsWith('('));
    expect(skripte[1]).not.toContain("'s.ankommen.abschluss'");

    await prompt();
    await waitFor(() =>
      expect(spurButton('Ankommen, 2 von 2 Schritten erledigt, abgeschlossen')).toBeInTheDocument()
    );
  });

  it('T4-11a: hält eine Bündelantwort zurück, ohne den Prompt zu blockieren oder vorzeitig zu zählen', async () => {
    let freigeben!: (resultat: AgentResult) => void;
    const gate = new Promise<AgentResult>((fertig) => {
      freigeben = fertig;
    });
    run.mockImplementation(async (skript: string) =>
      skript.startsWith('(') ? gate : { exitCode: 0, output: '' }
    );
    await starte();

    let antwort: MissionReply | undefined;
    await act(async () => {
      antwort = await h.sendCommand('__prompt');
    });
    expect(antwort).toEqual({ exitCode: 0, text: '' });
    expect(run).toHaveBeenCalledTimes(5);
    expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toBeInTheDocument();
    expect(spurButton('Protokoll, 0 von 2 Schritten erledigt')).toBeInTheDocument();

    await act(async () => {
      freigeben({ exitCode: 0, output: buendel(new Set(['s.ankommen.notiz'])) });
      await gate;
    });
    await waitFor(() =>
      expect(spurButton('Ankommen, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );
  });

  it('T4-11b: ein abgelehntes Bündel zählt nicht, die nächste gültige Antwort aktualisiert', async () => {
    run.mockImplementation(async (skript: string) => {
      if (skript.startsWith('(')) throw new Error('abgelehnt');
      return { exitCode: 0, output: '' };
    });
    await starte();

    await prompt();
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Prüfung gerade nicht erreichbar')
    );
    expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toBeInTheDocument();

    installiereVm(new Set(['s.ankommen.notiz']));
    await prompt();
    await waitFor(() =>
      expect(spurButton('Ankommen, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );
  });

  it('T4-11c: ein unvollständiges Bündel zählt nicht, die nächste gültige Antwort aktualisiert', async () => {
    run.mockImplementation(async (skript: string) =>
      skript.startsWith('(')
        ? { exitCode: 0, output: 'pruefung\ts.ankommen.notiz\t0\n' }
        : { exitCode: 0, output: '' }
    );
    await starte();

    await prompt();
    await waitFor(() => expect(buendelAufrufe(run)).toHaveLength(1));
    expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toBeInTheDocument();

    installiereVm(new Set(['s.ankommen.notiz']));
    await prompt();
    await waitFor(() =>
      expect(spurButton('Ankommen, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );
  });

  it('T4-12: Spur- und Flächenwechsel lassen das Terminal gemountet und lösen keinen Agentenaufruf aus', async () => {
    installiereVm(new Set());
    await starte();
    const terminal = await screen.findByTestId('stub-terminal');
    const user = userEvent.setup();

    await user.click(spurButton('Protokoll, 0 von 2 Schritten erledigt'));
    expect(run).toHaveBeenCalledTimes(4);

    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(terminal.closest('[role="tabpanel"]')).toHaveAttribute('hidden');

    await user.click(spurButton('Ankommen, 0 von 2 Schritten erledigt'));
    await user.click(screen.getByRole('tab', { name: 'Terminal' }));
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('T4-13: ein erneutes Setup setzt Ref und Render-State zurück und verwirft die alte Antwort', async () => {
    let freigeben!: (resultat: AgentResult) => void;
    const altesBuendel = new Promise<AgentResult>((fertig) => {
      freigeben = fertig;
    });
    const alterRun = vi.fn(async (skript: string) =>
      skript.startsWith('(') ? altesBuendel : { exitCode: 0, output: '' }
    );
    await starteMit({ run: alterRun } as unknown as AgentClient, alterRun);
    await prompt();
    expect(alterRun).toHaveBeenCalledTimes(5);

    const neueBestanden = new Set<string>();
    const neuerRun = vi.fn(async (skript: string) =>
      skript.startsWith('(')
        ? { exitCode: 0, output: buendel(neueBestanden) }
        : { exitCode: 0, output: '' }
    );
    let neuesSetup!: Promise<void>;
    await act(async () => {
      neuesSetup = h.ready({ run: neuerRun } as unknown as AgentClient);
      await Promise.resolve();
    });
    expect(neuerRun).not.toHaveBeenCalled();

    await act(async () => {
      freigeben({ exitCode: 0, output: buendel(new Set(['s.ankommen.notiz'])) });
      await altesBuendel;
    });
    void neuesSetup;
    await waitFor(() => expect(neuerRun).toHaveBeenCalledTimes(4));
    await waitFor(() =>
      expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
    expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toBeInTheDocument();
    expect(alterRun).toHaveBeenCalledTimes(5);

    await prompt();
    await waitFor(() => expect(neuerRun).toHaveBeenCalledTimes(5));
    const letztesSkript = buendelAufrufe(neuerRun).at(-1)?.[0] as string;
    expect(letztesSkript).toContain("'s.ankommen.notiz'");

    neueBestanden.add('s.ankommen.notiz');
    await prompt();
    await waitFor(() =>
      expect(spurButton('Ankommen, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );
  });
});

describe('ErmittlungApp: Raumansicht (T5)', () => {
  it('T5-8a: Spurwechsel und reiner Render starten weder Setup noch Abfrage', async () => {
    const view = render(<ErmittlungApp ermittlung={zweiSpuren} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Protokoll, 0 von 2 Schritten erledigt' }));
    view.rerender(<ErmittlungApp ermittlung={zweiSpuren} />);
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('tab', { name: 'Terminal' }));

    expect(run).toHaveBeenCalledTimes(4);
  });

  it('T5-8b: Öffnen und Aktualisieren lösen je genau eine wirksame Abfrage aus', async () => {
    const offen: Array<(resultat: AgentResult) => void> = [];
    run.mockImplementation(async (skript: string) =>
      istAbfrage(skript)
        ? new Promise<AgentResult>((fertig) => offen.push(fertig))
        : { exitCode: 0, output: '' }
    );
    h.client = { run } as unknown as AgentClient;

    render(<ErmittlungApp ermittlung={zweiAnsichten} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
    expect(offen).toHaveLength(1);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('button', { name: 'Lager' }));
    expect(run).toHaveBeenCalledTimes(4);

    offen[0]?.({ exitCode: 0, output: 'host\tALT\nende\t1\t0\n' });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(5));
    expect(offen).toHaveLength(2);

    const aktualisieren = screen.getByRole('button', { name: 'Aktualisieren' });
    for (let i = 0; i < 10; i++) await user.click(aktualisieren);
    expect(run).toHaveBeenCalledTimes(5);

    offen[1]?.({ exitCode: 0, output: 'konto\tazubi\nende\t1\t0\n' });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(6));
    expect(offen).toHaveLength(3);
    offen[2]?.({ exitCode: 0, output: 'konto\tazubi\nende\t1\t0\n' });

    await waitFor(() => expect(screen.getByTestId('hotspot-detail')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Konto' }));
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent('azubi');

    const setupAufrufe = run.mock.calls.filter(
      (call) => call[0] === rahmenSetupSkript() || call[0] === zweiAnsichten.setup
    );
    expect(setupAufrufe).toHaveLength(2);
  });

  it('T5-7: Hotspot-Auswahl ändert weder Fokus noch Terminal-Knoten', async () => {
    render(<ErmittlungApp ermittlung={zweiAnsichten} />);
    await waitFor(() => expect(screen.getByTestId('hotspot-detail')).toBeInTheDocument());

    const terminal = screen.getByTestId('stub-terminal');
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    const hotspot = screen.getByRole('button', { name: 'Hostname' });
    await user.click(hotspot);

    expect(hotspot).toHaveFocus();
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent('rw-srv01');
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('T5-Daten: der Platzhalter liest Host und Konto ohne feste Ergebniswerte', () => {
    const raum = platzhalter.ansichten[0];
    expect(raum.abfrage).toContain('hostname');
    expect(raum.abfrage).toContain('id -un');
    expect(raum.hotspots?.map((eintrag) => eintrag.schluessel)).toEqual(['host', 'konto']);
    expect(pruefeDaten(platzhalter)).toEqual([]);
  });
});

describe('ErmittlungApp: Aktenwand (T6)', () => {
  const prompt = async () => {
    await act(async () => {
      await h.sendCommand('__prompt');
    });
  };

  it('T6-7: Auswahl bleibt bei Ansichtswechsel, wird nach Verlust bereinigt und löst keinen Lauf aus', async () => {
    let dateien: Array<[string, number, string]> = [
      ['notiz.txt', 5, 'notiz'],
      ['protokoll.txt', 8, 'protokoll'],
      ['fremd.txt', 4, 'fremd'],
    ];
    const bestanden = new Set(['s.ankommen.notiz', 'b.notiz']);
    run.mockImplementation(async (skript: string) => {
      if (skript === abfrageSkript(AKTENWAND_ABFRAGE)) {
        return { exitCode: 0, output: aktenOutput(dateien) };
      }
      if (skript.startsWith('(')) return { exitCode: 0, output: buendel(bestanden) };
      if (istAbfrage(skript)) return { exitCode: 0, output: 'host\trw-srv01\nende\t1\t0\n' };
      return { exitCode: 0, output: '' };
    });

    render(<ErmittlungApp ermittlung={mitAktenwand} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
    await prompt();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Ankommen, 1 von 2 Schritten erledigt' })
      ).toBeInTheDocument()
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('button', { name: 'Aktenwand' }));
    await waitFor(() => expect(screen.getByText('notiz.txt')).toBeInTheDocument());
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    const box = screen.getByRole('checkbox', { name: /Eine Notiz.*notiz\.txt/ });
    expect(box).not.toBeChecked();

    const aufrufeVorAuswahl = run.mock.calls.length;
    const buendelVorAuswahl = buendelAufrufe(run).length;
    await user.click(box);
    expect(screen.getByRole('checkbox', { name: /Eine Notiz.*notiz\.txt/ })).toBeChecked();
    expect(run.mock.calls.length).toBe(aufrufeVorAuswahl);
    expect(buendelAufrufe(run).length).toBe(buendelVorAuswahl);

    await user.click(screen.getByRole('button', { name: 'Büro' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Hostname' })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('button', { name: 'Aktenwand' }));
    await waitFor(() => expect(screen.getByText('notiz.txt')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: /Eine Notiz.*notiz\.txt/ })).toBeChecked();

    // Erst Aktualisieren liest die geänderte Liste; danach wird die Auswahl bereinigt.
    dateien = [
      ['protokoll.txt', 8, 'protokoll'],
      ['fremd.txt', 4, 'fremd'],
    ];
    expect(screen.getByText('notiz.txt')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    await waitFor(() => expect(screen.queryByText('notiz.txt')).toBeNull());
    await waitFor(() => expect(screen.getByText('protokoll.txt')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Büro' }));
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('button', { name: 'Aktenwand' }));
    await waitFor(() => expect(screen.getByText('protokoll.txt')).toBeInTheDocument());
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByTestId('stub-terminal')).toBeInTheDocument();
  });

  it('T6-Daten: der Platzhalter hat Raum und Aktenwand ohne neue Belegregeln', () => {
    expect(pruefeDaten(platzhalter)).toEqual([]);
    expect(pruefeDaten(mitAktenwand)).toEqual([]);
    expect(platzhalter.ansichten.map((ansicht) => ansicht.art)).toEqual(['raum', 'aktenwand']);
    expect(platzhalter.ansichten[1]?.abfrage).toBe(AKTENWAND_ABFRAGE);
    expect(platzhalter.vorwurf.belege.map((beleg) => beleg.id)).toEqual(['notiz', 'protokoll']);
  });
});

describe('ErmittlungApp: Einsatzrahmen (T8)', () => {
  const FOLGE = 'Verstoß.';
  const WIEDER = 'Der Vorwurf ist wieder möglich.';
  const GESPERRT = 'Der Vorwurf ist vorübergehend gesperrt.';

  // Zählt Pager-Nachrichten, nicht Textvorkommen (aktuelle Nachricht plus Verlauf).
  const pagerAnzahl = (text: string): number => {
    const pager = screen.getByTestId('pager');
    const aktuell = pager.querySelector('[data-testid="pager-text"]');
    const verlauf = pager.querySelector('[data-testid="pager-verlauf"]');
    const historie = verlauf
      ? Array.from(verlauf.querySelectorAll('li')).filter((li) => li.textContent?.includes(text))
          .length
      : 0;
    return historie + (aktuell?.textContent?.includes(text) ? 1 : 0);
  };
  const verlaufEnthaelt = (text: string): boolean =>
    Array.from(
      screen.getByTestId('pager').querySelectorAll('[data-testid="pager-verlauf"] li')
    ).some((li) => li.textContent?.includes(text));
  const aktuellEnthaelt = (text: string): boolean =>
    screen.getByTestId('pager-text').textContent?.includes(text) ?? false;

  const prompt = async () => {
    await act(async () => {
      await h.sendCommand('__prompt');
    });
  };
  const bundelAnzahl = () => buendelAufrufe(run).length;
  const naechstesBuendel = async () => {
    const vorher = bundelAnzahl();
    await prompt();
    await waitFor(() => expect(bundelAnzahl()).toBe(vorher + 1));
    // Das Ergebnis des Bündels ist angewendet, wenn der Lauf wieder ruht.
    await act(async () => {
      await Promise.resolve();
    });
  };

  let bestanden: Set<string>;
  let ausgabe: (() => string) | null;
  let dateien: Array<[string, number, string]>;

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
    bestanden = new Set();
    ausgabe = null;
    dateien = [
      ['notiz.txt', 5, 'notiz'],
      ['protokoll.txt', 8, 'protokoll'],
    ];
    run.mockImplementation(async (skript: string) => {
      if (skript === abfrageSkript(AKTENWAND_ABFRAGE)) {
        return { exitCode: 0, output: aktenOutput(dateien) };
      }
      if (skript.startsWith('('))
        return { exitCode: 0, output: (ausgabe ?? (() => buendel(bestanden)))() };
      if (istAbfrage(skript)) return { exitCode: 0, output: 'host\trw-srv01\nende\t1\t0\n' };
      return { exitCode: 0, output: '' };
    });
  });

  const starte = async () => {
    render(<ErmittlungApp ermittlung={mitAktenwand} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
  };

  it('T8-1: Einsatzrahmen-Setup läuft zwischen Rahmen und Episode, bei Fehler gibt es keinen Prüflauf', async () => {
    run.mockImplementation(async (skript: string) =>
      skript === einsatzrahmenSetupSkript()
        ? { exitCode: 1, output: 'sudoers-Konfiguration ungueltig' }
        : { exitCode: 0, output: '' }
    );
    render(<ErmittlungApp ermittlung={mitAktenwand} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(run.mock.calls.map((call) => call[0])).toEqual([
      rahmenSetupSkript(),
      einsatzrahmenSetupSkript(),
    ]);
    await prompt();
    expect(run).toHaveBeenCalledTimes(2);
    expect(pagerText()).not.toContain(FOLGE);
  });

  it('T8-9: der Rahmen ist jederzeit lesbar, ohne Fokus, Terminal oder VM zu berühren', async () => {
    await starte();
    const terminal = screen.getByTestId('stub-terminal');
    const zusammenfassung = screen.getByText('Einsatzrahmen');
    expect(zusammenfassung.closest('details')).not.toHaveAttribute('open');

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('button', { name: 'Lager' }));
    run.mockClear();
    zusammenfassung.focus();
    // jsdom wandelt Enter auf summary nicht um; Browser lösen dafür genau diesen Klick aus.
    await user.click(zusammenfassung);

    expect(zusammenfassung.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(mitAktenwand.einsatzrahmen.text[0] as string)).toBeInTheDocument();
    expect(zusammenfassung).toHaveFocus();
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(run).not.toHaveBeenCalled();
  });

  it('T8-6: erst die nächste vollständige Prüfung setzt den Verstoß, die Folge kommt genau einmal', async () => {
    await starte();
    expect(screen.queryByText(/Einsatzrahmen verletzt/)).not.toBeInTheDocument();
    expect(pagerAnzahl(FOLGE)).toBe(0);

    bestanden.add('e.verstoss');
    await naechstesBuendel();
    await waitFor(() => expect(pagerAnzahl(FOLGE)).toBe(1), { timeout: 6000 });
    expect(screen.getByText(/Einsatzrahmen verletzt/)).toBeInTheDocument();

    for (let i = 0; i < 3; i++) await naechstesBuendel();
    await new Promise((fertig) => setTimeout(fertig, 1500));
    expect(pagerAnzahl(FOLGE)).toBe(1);
    expect(pagerAnzahl(GESPERRT)).toBe(0);
  }, 30_000);

  it('T8-6: ein unvollständiges Bündel setzt keinen Verstoß', async () => {
    await starte();
    ausgabe = () => 'pruefung\te.verstoss\t0\n';
    await naechstesBuendel();
    expect(screen.queryByText(/Einsatzrahmen verletzt/)).not.toBeInTheDocument();
    expect(pagerAnzahl(FOLGE)).toBe(0);
  });

  it('T8-7/8: Verstoß mit erkanntem Beleg sperrt den Vorwurf; Ansicht, unvollständige Prüfung und Zeit allein entsperren nicht', async () => {
    await starte();
    bestanden.add('b.notiz');
    bestanden.add('e.verstoss');
    await naechstesBuendel();
    await waitFor(() => expect(screen.getByText(/vorübergehend gesperrt/)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('button', { name: 'Lager' }));
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('button', { name: 'Aktenwand' }));
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(1));
    expect(screen.getByText(/vorübergehend gesperrt/)).toBeInTheDocument();

    ausgabe = () => 'pruefung\tb.notiz\t0\n';
    for (let i = 0; i < 4; i++) await naechstesBuendel();
    expect(screen.getByText(/vorübergehend gesperrt/)).toBeInTheDocument();
    expect(pagerAnzahl(WIEDER)).toBe(0);
  }, 30_000);

  it('T8-8: ein neuer erkannter Beleg hebt die Sperre auf, einmal gemeldet', async () => {
    await starte();
    bestanden.add('b.notiz');
    bestanden.add('e.verstoss');
    await naechstesBuendel();
    await waitFor(() => expect(screen.getByText(/vorübergehend gesperrt/)).toBeInTheDocument());

    bestanden.add('b.protokoll');
    await naechstesBuendel();
    await waitFor(() =>
      expect(screen.queryByText(/vorübergehend gesperrt/)).not.toBeInTheDocument()
    );
    await waitFor(() => expect(pagerAnzahl(WIEDER)).toBe(1), { timeout: 8000 });
    await naechstesBuendel();
    await new Promise((fertig) => setTimeout(fertig, 1500));
    expect(pagerAnzahl(WIEDER)).toBe(1);
    expect(screen.getByText(/Einsatzrahmen verletzt/)).toBeInTheDocument();
  }, 30_000);

  it('T8-8: die dritte vollständige Prüfung hebt die Sperre auf, einmal gemeldet', async () => {
    await starte();
    bestanden.add('b.notiz');
    bestanden.add('e.verstoss');
    await naechstesBuendel();
    await waitFor(() => expect(screen.getByText(/vorübergehend gesperrt/)).toBeInTheDocument());

    await naechstesBuendel();
    await naechstesBuendel();
    expect(screen.getByText(/vorübergehend gesperrt/)).toBeInTheDocument();
    await naechstesBuendel();
    await waitFor(() =>
      expect(screen.queryByText(/vorübergehend gesperrt/)).not.toBeInTheDocument()
    );
    await waitFor(() => expect(pagerAnzahl(WIEDER)).toBe(1), { timeout: 8000 });
  }, 30_000);

  it('T8-7: Ablauf und Neusperre im selben Bündel erscheinen in der Reihenfolge der Engine-Ereignisse', async () => {
    await starte();
    const user = userEvent.setup();
    bestanden.add('b.notiz');
    await prompt();
    await user.click(screen.getByRole('tab', { name: 'Serverraum' }));
    await user.click(screen.getByRole('button', { name: 'Aktenwand' }));
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(1));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Vorwurf erheben' }));
    await user.click(screen.getByRole('radio', { name: /Person B/ }));
    await user.click(screen.getByRole('button', { name: 'Absenden' }));
    // Die falsche Person sperrt den Vorwurf bereits vor dem Verstoß.
    await waitFor(() => expect(screen.getAllByText('Gesperrt.').length).toBeGreaterThan(0), {
      timeout: 8000,
    });

    // Zwei vollständige Prüfungen nach der Frischprüfung des Absendens: Rest 1.
    await naechstesBuendel();
    await naechstesBuendel();
    bestanden.add('e.verstoss');
    await naechstesBuendel();

    await waitFor(() => expect(aktuellEnthaelt(FOLGE)).toBe(true), { timeout: 10_000 });
    expect(verlaufEnthaelt(WIEDER)).toBe(true);
    expect(pagerAnzahl(FOLGE)).toBe(1);
    expect(pagerAnzahl(WIEDER)).toBe(1);
    // Die Engine sperrt im selben Bündel erneut.
    expect(screen.getAllByText(/vorübergehend gesperrt/).length).toBeGreaterThan(0);
  }, 40_000);
});

describe('ErmittlungApp: Episodenkopf und Hilfe (T9)', () => {
  const installiereVm = (bestanden: ReadonlySet<string>) => {
    run.mockImplementation(async (skript: string) =>
      istBuendel(skript) ? { exitCode: 0, output: buendel(bestanden) } : { exitCode: 0, output: '' }
    );
  };

  const werkzeuge = [
    { befehl: 'grep', erklaerung: 'Sucht Zeilen.', beispiel: 'grep root /etc/passwd' },
  ];

  const starte = async (props: { werkzeuge?: typeof werkzeuge } = {}) => {
    render(<ErmittlungApp ermittlung={zweiSpuren} {...props} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
  };

  it('T9-11: zeigt Nummer und Titel der Episode, aber nie die interne ID', () => {
    render(<ErmittlungApp ermittlung={zweiSpuren} />);
    expect(screen.getByRole('heading', { name: /Episode 99.*Test/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('test-zwei-spuren');
  });

  it('T9-10: zeigt Hilfe nur auf Abruf und löst weder Agent noch Fortschritt aus', async () => {
    installiereVm(new Set());
    await starte({ werkzeuge });
    const user = userEvent.setup();
    const aufrufe = run.mock.calls.length;

    expect(screen.queryByText('Richtung')).not.toBeInTheDocument();
    expect(screen.getByText('Werkzeugkasten').closest('details')).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'Ersten Tipp zeigen' }));
    await user.click(screen.getByRole('button', { name: 'Nächsten Tipp zeigen' }));
    await user.click(screen.getByRole('button', { name: 'Lösung zeigen' }));
    await user.click(screen.getByText('Werkzeugkasten'));

    expect(screen.getByText('Lösung')).toBeInTheDocument();
    expect(run).toHaveBeenCalledTimes(aufrufe);
    expect(
      screen.getByRole('button', { name: 'Ankommen, 0 von 2 Schritten erledigt' })
    ).toBeInTheDocument();
    expect(h.sendCommand).toBeDefined();
  });

  it('T9-10: zeigt die Tipps des Schritts der gewählten Spur und wechselt mit ihr', async () => {
    installiereVm(new Set());
    await starte({ werkzeuge });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ersten Tipp zeigen' }));
    expect(screen.getAllByText('Richtung')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Protokoll, 0 von 2 Schritten erledigt' }));
    // Eigene Spur, eigener Schritt, eigener Zähler.
    expect(screen.queryByText('Richtung')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ersten Tipp zeigen' })).toBeInTheDocument();
  });

  it('T9-10: setzt die gezeigten Tipps beim erfolgreichen neuen Setup zurück', async () => {
    installiereVm(new Set());
    await starte();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ersten Tipp zeigen' }));
    expect(screen.getByText('Richtung')).toBeInTheDocument();

    const neuerRun = vi.fn(async () => ({ exitCode: 0, output: '' }));
    await act(async () => {
      await h.ready({ run: neuerRun } as unknown as AgentClient);
    });
    await waitFor(() => expect(screen.queryByText('Richtung')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Ersten Tipp zeigen' })).toBeInTheDocument();
  });

  it('T9-10: lässt Tipps eines gescheiterten Setups stehen', async () => {
    installiereVm(new Set());
    await starte();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ersten Tipp zeigen' }));

    const kaputt = vi.fn(async () => ({ exitCode: 1, output: '' }));
    await act(async () => {
      await h.ready({ run: kaputt } as unknown as AgentClient);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Richtung')).toBeInTheDocument();
  });
});

describe('ErmittlungApp: Schrittart ablesen', () => {
  const frage = 'Wann beginnt die Lücke? (HH:MM)';
  // Fixture im Test: erste Spur beginnt mit einem Ablesen-Schritt, die zweite mit einem Sichern-Schritt.
  const ablesenErmittlung: Ermittlung = {
    ...zweiSpuren,
    spuren: [
      {
        ...zweiSpuren.spuren[0],
        schritte: [
          {
            ...schrittFixture('luecke', 'Lies die Lücke ab', ['A1: Lies die Lücke ab.'], 'ablesen'),
            verify: 'false',
            antwort: { frage, format: 'HH:MM', pruefung: '[ "$ANTWORT" = "02:30" ]' },
          },
          schrittFixture('danach', 'Sichere den Rest', ['A2: Sichere.'], 'eingreifen'),
        ],
      },
      zweiSpuren.spuren[1],
    ],
  };
  const istAntwort = (skript: string) => skript.startsWith('ANTWORT=$(printf');
  const antwortAufrufe = () => run.mock.calls.filter((call) => istAntwort(call[0] as string));
  const feld = () => screen.getByLabelText(frage);
  const antworte = async (text: string) => {
    const user = userEvent.setup();
    await user.clear(feld());
    await user.type(feld(), text);
    await user.click(screen.getByRole('button', { name: 'Antworten' }));
  };

  const starteAblesen = async (antwortExit = 0) => {
    run.mockImplementation(async (skript: string) => {
      if (istAntwort(skript)) return { exitCode: antwortExit, output: '' };
      return istAbfrage(skript)
        ? { exitCode: 0, output: 'host\trw-srv01\nende\t1\t0\n' }
        : { exitCode: 0, output: '' };
    });
    render(<ErmittlungApp ermittlung={ablesenErmittlung} />);
    await waitFor(() => expect(pagerText()).toContain('A1: Lies die Lücke ab.'));
  };

  it('ist ein gültiger Datensatz', () => {
    expect(pruefeDaten(ablesenErmittlung)).toEqual([]);
  });

  it('zeigt das Antwortfeld nur bei aktivem Ablesen-Schritt', async () => {
    await starteAblesen();
    const eingabe = feld();
    expect(eingabe).toHaveAttribute('maxlength', '64');
    expect(eingabe).toHaveAttribute('autocomplete', 'off');
    expect(eingabe).toHaveAttribute('placeholder', 'HH:MM');
    const beschreibung = document.getElementById(eingabe.getAttribute('aria-describedby') ?? '');
    expect(beschreibung?.textContent).toContain('HH:MM');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Protokoll, 0 von 2 Schritten erledigt' }));
    expect(screen.queryByLabelText(frage)).not.toBeInTheDocument();
  });

  it('zeigt kein Antwortfeld bei Schritten anderer Arten', async () => {
    run.mockImplementation(async (skript: string) =>
      istAbfrage(skript)
        ? { exitCode: 0, output: 'host\trw-srv01\nende\t1\t0\n' }
        : { exitCode: 0, output: '' }
    );
    render(<ErmittlungApp ermittlung={zweiSpuren} />);
    await waitFor(() => expect(pagerText()).toContain('A1: Lege notiz.txt an.'));
    expect(screen.queryByRole('button', { name: 'Antworten' })).not.toBeInTheDocument();
  });

  it('startet bei ungültigen Zeichen keinen RUN und sagt warum', async () => {
    await starteAblesen();
    const vorher = run.mock.calls.length;
    await antworte('02:30; rm -rf /');
    await waitFor(() =>
      expect(pagerText()).toContain('Bitte nur Buchstaben, Ziffern und . : _ / -')
    );
    expect(run.mock.calls.length).toBe(vorher);
  });

  it('erledigt den Schritt bei richtiger Antwort', async () => {
    await starteAblesen(0);
    await antworte('  02:30 ');
    await waitFor(() => expect(pagerText()).toContain('Erledigt: Lies die Lücke ab'));
    expect(antwortAufrufe()).toHaveLength(1);
    expect(antwortAufrufe()[0]?.[1]).toBe(10_000);
    expect(antwortAufrufe()[0]?.[0]).toContain(Buffer.from('02:30').toString('base64'));
    expect(screen.queryByLabelText(frage)).not.toBeInTheDocument();
  });

  it('gibt bei falscher Antwort einen freundlichen Hinweis und lässt den Schritt offen', async () => {
    await starteAblesen(1);
    await antworte('03:00');
    await waitFor(() =>
      expect(pagerText()).toContain(
        'Das passt nicht zu dem, was das System zeigt. Schau noch mal genau hin.'
      )
    );
    expect(pagerText()).not.toContain('Erledigt: Lies die Lücke ab');
    expect(feld()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Antworten' })).toBeEnabled();
  });
});
