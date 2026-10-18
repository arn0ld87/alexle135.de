import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MissionCommand, MissionReply } from '../../../lib/missions/missionTypes';

vi.mock('../../../data/missions', () => ({
  v86Missions: [
    {
      nr: '01',
      id: 'demo',
      track: 'linux',
      title: 'Demo-Mission',
      difficulty: 'einstieg',
      durationMin: 5,
      setup: 'SETUP',
      steps: [
        {
          id: 's1',
          title: 'Ordner anlegen',
          description: 'Lege projekt an.',
          verify: 'VERIFY',
          hints: ['Tipp 1', 'Tipp 2'],
          solution: 'mkdir projekt',
        },
      ],
      flag: 'FLAG_SCRIPT',
    },
    {
      nr: '02',
      id: 'git-demo',
      track: 'git',
      title: 'Git-Demo',
      difficulty: 'profi',
      durationMin: 10,
      setup: 'SETUP',
      steps: [],
      flag: 'FLAG_SCRIPT',
    },
  ],
}));

// Fake-VM: Zustand „erfüllt“ steuert der Test.
const vm = { satisfied: false, scripts: [] as string[] };
const fakeClient = {
  run: vi.fn(async (script: string) => {
    vm.scripts.push(script);
    if (script.includes('VERIFY')) return { exitCode: vm.satisfied ? 0 : 1, output: '' };
    if (script.includes('FLAG_SCRIPT')) return { exitCode: 0, output: 'FLAG{demo1234}\n' };
    return { exitCode: 0, output: '' };
  }),
};

let sendCommand: ((c: MissionCommand) => Promise<MissionReply>) | undefined;

vi.mock('../V86Terminal', async () => {
  const { useEffect } = await import('react');
  function StubTerminal({
    onReady,
    onMissionCommand,
  }: {
    onReady?: (c: unknown) => void;
    onMissionCommand?: (c: MissionCommand) => Promise<MissionReply>;
  }) {
    sendCommand = onMissionCommand;
    useEffect(() => onReady?.(fakeClient), [onReady]);
    return <div data-testid="stub-terminal" />;
  }
  return { default: StubTerminal };
});

import LinuxMissions from '../LinuxMissions';

beforeEach(() => {
  vm.satisfied = false;
  vm.scripts = [];
  sendCommand = undefined;
  localStorage.clear();
});

describe('LinuxMissions', () => {
  it('zeigt die Liste mit Zählern und lädt die VM erst nach der Auswahl', () => {
    render(<LinuxMissions />);
    expect(screen.getByText('Linux 0/1 · Git 0/1')).toBeTruthy();
    expect(screen.getByText('Demo-Mission')).toBeTruthy();
    expect(screen.queryByTestId('stub-terminal')).toBeNull();
  });

  it('setzt die Mission in der VM auf und zeigt den aktuellen Schritt', async () => {
    render(<LinuxMissions />);
    fireEvent.click(screen.getByText('Demo-Mission'));
    await screen.findByTestId('stub-terminal');
    await screen.findByText('Ordner anlegen');
    expect(vm.scripts.some((s) => s.includes('SETUP'))).toBe(true);
    expect(screen.getByText('Schritt 1/1')).toBeTruthy();
    // #397: Auftrag und Begrüßung kommen im Pager, nicht mehr in der motd.
    const pager = screen.getByTestId('pager');
    expect(pager.textContent).toContain('Moin, ich bin Alex.');
    expect(pager.textContent).toContain('Mission 01: Demo-Mission.');
    expect(pager.textContent).toContain('Lege projekt an.');
  });

  it('beantwortet mission-Befehle, zeigt die Flagge und speichert den Fortschritt', async () => {
    render(<LinuxMissions />);
    fireEvent.click(screen.getByText('Demo-Mission'));
    await screen.findByText('Ordner anlegen');

    const hint = await sendCommand!('hint');
    expect(hint.text).toBe('Tipp 1/2: Tipp 1');

    vm.satisfied = true;
    let reply: MissionReply | undefined;
    // Erfolg der stillen Prüfung steht nur im Pager, das Terminal bleibt schlank (D3).
    await act(async () => {
      reply = await sendCommand!('__prompt');
    });
    expect(reply?.text).toBe('');
    expect(screen.getByTestId('pager').textContent).toContain('Mission 01 geschafft.');
    await waitFor(() =>
      expect(screen.getByText(/Geschafft · Flagge FLAG\{demo1234\}/)).toBeTruthy()
    );
    expect(screen.getByText('Linux 1/1 · Git 0/1')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('missionen:v1') ?? '{}').demo.flag).toBe(
      'FLAG{demo1234}'
    );
  });

  it('startet mit mission next die nächste Mission, ohne aktive Mission die erste', async () => {
    render(<LinuxMissions />);
    fireEvent.click(screen.getByText('Demo-Mission'));
    await screen.findByText('Ordner anlegen');

    let reply: MissionReply | undefined;
    await act(async () => {
      reply = await sendCommand!('next');
    });
    expect(reply?.text).toBe('Mission 02: Git-Demo. `mission status` zeigt die Aufgabe.');
    expect(screen.getByRole('heading', { name: 'Git-Demo' })).toBeTruthy();

    await act(async () => {
      reply = await sendCommand!('next');
    });
    expect(reply?.text).toMatch(/letzte Mission/);
  });
});
