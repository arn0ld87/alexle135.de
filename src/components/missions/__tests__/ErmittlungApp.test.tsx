import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platzhalter } from '../../../data/staffeln/staffel-2/platzhalter';
import type { AgentClient, AgentResult } from '../../../lib/missions/agentClient';
import { pruefeDaten } from '../../../lib/missions/ermittlung';
import type { Ermittlung } from '../../../lib/missions/ermittlungTypes';
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
    await act(async () => {
      await h.sendCommand('__prompt');
    });
    expect(run).toHaveBeenCalledTimes(teil === 'rahmen' ? 1 : 2);
  });

  it.each(['rahmen', 'episode'])('verwirft das nach Unmount endende %s-Setup', async (teil) => {
    let freigeben!: (resultat: AgentResult) => void;
    const blockiert = new Promise<AgentResult>((fertig) => {
      freigeben = fertig;
    });
    if (teil === 'episode') run.mockResolvedValueOnce({ exitCode: 0, output: '' });
    run.mockImplementationOnce(() => blockiert);
    const view = render(<ErmittlungApp ermittlung={platzhalter} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(teil === 'rahmen' ? 1 : 2));
    await act(async () => {
      await h.sendCommand('__prompt');
    });
    view.unmount();

    await act(async () => {
      freigeben({ exitCode: 0, output: '' });
      await blockiert;
    });
    expect(run).toHaveBeenCalledTimes(teil === 'rahmen' ? 1 : 2);
  });

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
      await h.ready({ run: neuerRun } as unknown as AgentClient);
    });
    expect(neuerRun).toHaveBeenCalledTimes(2);

    await act(async () => {
      freigeben({ exitCode: 0, output: '' });
      await blockiert;
    });
    await act(async () => {
      await h.sendCommand('__prompt');
    });
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
      await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
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

  it('hängt das Terminal beim Umschalten nicht aus', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);
    const terminal = await screen.findByTestId('stub-terminal');

    await act(async () => {
      screen.getByRole('button', { name: 'Ansicht' }).click();
    });
    expect(screen.getByRole('button', { name: 'Ansicht' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
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

const schrittFixture = (id: string, title: string, pager: string[]) => ({
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
        schrittFixture('abschluss', 'Ergänze fertig in notiz.txt', ['A2: Ergänze fertig.']),
      ],
    },
    {
      id: 'protokoll',
      titel: 'Protokoll',
      schritte: [
        schrittFixture('protokoll', 'Lege ein Protokoll an', ['B1: Lege protokoll.txt an.']),
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
  const zeilen = ALLE_PRUEFUNGEN.map(
    (id) => `pruefung\t${id}\t${bestanden.has(id) ? 0 : 1}`
  );
  return `${zeilen.join('\n')}\nende\t${ALLE_PRUEFUNGEN.length}\n`;
};

describe('ErmittlungApp: freie Spurenwahl (T4)', () => {
  let run: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
    }) as unknown as typeof window.matchMedia;
    run = vi.fn(async () => ({ exitCode: 0, output: '' }));
    h.client = { run } as unknown as AgentClient;
  });

  const spurButton = (name: string) => screen.getByRole('button', { name });

  // Zählt Pager-Nachrichten, nicht Textvorkommen: Die aktuelle Nachricht steht zusätzlich
  // im Screenreader-Bereich, ältere im Verlauf.
  const pagerErfolge = (titel: string): number => {
    const pager = screen.getByTestId('pager');
    const aktuell = pager.querySelector('[aria-live="polite"]');
    const verlauf = pager.querySelector('[data-testid="pager-verlauf"]');
    const historie = verlauf
      ? Array.from(verlauf.querySelectorAll('li')).filter((li) =>
          li.textContent?.includes(titel)
        ).length
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
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  };

  const starteMit = async (client: AgentClient, mock: ReturnType<typeof vi.fn>) => {
    h.client = client;
    render(<ErmittlungApp ermittlung={zweiSpuren} />);
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
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
    await waitFor(
      () => expect(pagerText()).toContain('Erledigt: Lege ein Protokoll an'),
      { timeout: 4000 }
    );
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
      expect(
        spurButton('Protokoll, 2 von 2 Schritten erledigt, abgeschlossen')
      ).toBeInTheDocument()
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
      expect(
        spurButton('Ankommen, 2 von 2 Schritten erledigt, abgeschlossen')
      ).toBeInTheDocument()
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
    await waitFor(
      () => expect(pagerText()).toContain('Erledigt: Lege ein Protokoll an'),
      { timeout: 4000 }
    );

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
    await waitFor(() => expect(run.mock.calls.length).toBe(3));
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
      expect(
        spurButton('Ankommen, 2 von 2 Schritten erledigt, abgeschlossen')
      ).toBeInTheDocument()
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
    expect(run).toHaveBeenCalledTimes(3);
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
      expect(screen.getByRole('status').textContent).toContain(
        'Prüfung gerade nicht erreichbar'
      )
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
    await waitFor(() => expect(run.mock.calls.length).toBe(3));
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
    expect(run).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Ansicht' }));
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(terminal.parentElement?.className).toContain('hidden');

    await user.click(spurButton('Ankommen, 0 von 2 Schritten erledigt'));
    await user.click(screen.getByRole('button', { name: 'Terminal' }));
    expect(screen.getByTestId('stub-terminal')).toBe(terminal);
    expect(run).toHaveBeenCalledTimes(2);
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
    expect(alterRun).toHaveBeenCalledTimes(3);

    const neueBestanden = new Set<string>();
    const neuerRun = vi.fn(async (skript: string) =>
      skript.startsWith('(')
        ? { exitCode: 0, output: buendel(neueBestanden) }
        : { exitCode: 0, output: '' }
    );
    await act(async () => {
      await h.ready({ run: neuerRun } as unknown as AgentClient);
    });
    expect(neuerRun).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );

    await act(async () => {
      freigeben({ exitCode: 0, output: buendel(new Set(['s.ankommen.notiz'])) });
      await altesBuendel;
    });
    expect(spurButton('Ankommen, 0 von 2 Schritten erledigt')).toBeInTheDocument();
    expect(alterRun).toHaveBeenCalledTimes(3);

    await prompt();
    await waitFor(() => expect(neuerRun).toHaveBeenCalledTimes(3));
    const letztesSkript = neuerRun.mock.calls[2]?.[0] as string;
    expect(letztesSkript).toContain("'s.ankommen.notiz'");

    neueBestanden.add('s.ankommen.notiz');
    await prompt();
    await waitFor(() =>
      expect(spurButton('Ankommen, 1 von 2 Schritten erledigt')).toBeInTheDocument()
    );
  });
});
