import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MissionCommand, MissionReply } from '../../../lib/missions/missionTypes';
import type { Staffel, Vorfall } from '../../../lib/missions/staffelTypes';

// vi.mock wird nach oben gezogen; die Teststaffel entsteht deshalb in vi.hoisted.
const { testStaffel } = vi.hoisted(() => {
  const werkzeug = (befehl: string) => ({
    befehl,
    erklaerung: `${befehl} erklärt.`,
    beispiel: befehl,
  });
  const vorfall = (nr: number, extra: Partial<Vorfall> = {}): Vorfall => ({
    nr,
    id: `v${nr}`,
    titel: `Vorfall Nummer ${nr}`,
    setup: `SETUP_${nr}`,
    schritte: [
      {
        id: 'a',
        title: `Aufgabe ${nr}`,
        pager: [`Auftrag ${nr}: Lege projekt an.`],
        verify: `VERIFY_${nr}`,
        tipps: [`Richtung ${nr}`, `Befehl ${nr}`, `loesung ${nr}`],
      },
    ],
    werkzeuge: [werkzeug('ls'), werkzeug('mkdir'), werkzeug(`cmd${nr}`)],
    beweisstueck: {
      id: `b${nr}`,
      titel: `Spur ${nr}`,
      beschreibung: `Beschreibung ${nr}.`,
      code: `CODE-${nr}`,
    },
    szene: [`Szene ${nr}`],
    ...extra,
  });
  const testStaffel: Staffel = {
    id: 'test',
    titel: 'Teststaffel',
    vorfaelle: [vorfall(0), vorfall(1), vorfall(2, { finale: true })],
    abzeichen: [
      {
        id: 'ohne-tipp',
        titel: 'Ohne Spickzettel',
        beschreibung: 'b',
        regel: { art: 'ohne-tipp' },
      },
      { id: 'rot', titel: 'Rot', beschreibung: 'b', regel: { art: 'rote-prompts', anzahl: 2 } },
    ],
  };
  return { testStaffel };
});

vi.mock('../../../data/staffeln/staffel-1', () => ({ staffel1: testStaffel }));

// Fake-VM: welche Prüfung besteht, steuert der Test.
const vm = { erfuellt: new Set<string>(), scripts: [] as string[] };
const fakeClient = {
  run: vi.fn(async (script: string) => {
    vm.scripts.push(script);
    const flag = script.match(/FLAG\{(CODE-\d)\}/);
    if (flag) return { exitCode: 0, output: `FLAG{${flag[1]}}\n` };
    const verify = script.match(/VERIFY_\d/);
    if (verify) return { exitCode: vm.erfuellt.has(verify[0]) ? 0 : 1, output: '' };
    return { exitCode: 0, output: '' };
  }),
};

let sendCommand: ((c: MissionCommand) => Promise<MissionReply>) | undefined;
let sendPrompt: ((rot: boolean) => void) | undefined;

vi.mock('../V86Terminal', async () => {
  const { useEffect } = await import('react');
  function StubTerminal({
    onReady,
    onMissionCommand,
    onPrompt,
  }: {
    onReady?: (c: unknown) => void;
    onMissionCommand?: (c: MissionCommand) => Promise<MissionReply>;
    onPrompt?: (rot: boolean) => void;
  }) {
    sendCommand = onMissionCommand;
    sendPrompt = onPrompt;
    useEffect(() => onReady?.(fakeClient), [onReady]);
    return <div data-testid="stub-terminal" />;
  }
  return { default: StubTerminal };
});

import StaffelApp from '../StaffelApp';

const akteKnopf = (name: RegExp) => screen.getByRole('button', { name });
const pagerText = () => screen.getByTestId('pager').textContent ?? '';

async function starte(nr: number) {
  fireEvent.click(akteKnopf(new RegExp(`Vorfall Nummer ${nr}`)));
  await screen.findByTestId('stub-terminal');
  await waitFor(() =>
    expect(screen.getByTestId('vorfall-schritt').textContent).toContain('Schritt 1/1')
  );
}

async function loese(nr: number) {
  vm.erfuellt.add(`VERIFY_${nr}`);
  await act(async () => {
    await sendCommand!('__prompt');
  });
}

beforeEach(() => {
  vm.erfuellt.clear();
  vm.scripts = [];
  sendCommand = undefined;
  sendPrompt = undefined;
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
});

describe('StaffelApp', () => {
  it('zeigt die Akte mit gesperrtem Finale und lädt die VM erst nach der Auswahl', () => {
    render(<StaffelApp />);
    expect(screen.getByTestId('akte-zaehler').textContent).toBe('0/3');
    expect((akteKnopf(/Vorfall Nummer 2/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('gesperrt, bis die Akte voll ist')).toBeTruthy();
    expect(screen.queryByTestId('stub-terminal')).toBeNull();
    expect(pagerText()).toContain('Wähle in der Akte einen Vorfall');
  });

  it('setzt den Vorfall auf und schickt den Auftrag in den Pager', async () => {
    render(<StaffelApp />);
    await starte(0);
    expect(vm.scripts.some((s) => s.includes('SETUP_0'))).toBe(true);
    expect(pagerText()).toContain('Auftrag 0: Lege projekt an.');
    expect(screen.getByTestId('vorfall-schritt').textContent).toBe('Schritt 1/1: Aufgabe 0');
  });

  it('trägt einen gelösten Vorfall mit Beweisstück und Abzeichen in die Akte ein', async () => {
    render(<StaffelApp />);
    await starte(0);
    await loese(0);
    await waitFor(() => expect(screen.getByTestId('akte-zaehler').textContent).toBe('1/3'));
    expect(screen.getByText(/Spur 0 · /)).toBeTruthy();
    expect(screen.getByTestId('abzeichen-ohne-tipp').textContent).toContain('■');
    // Erst die Erledigt-Meldung mit grinsender Figur (#410), die Szene kommt danach.
    // Der Auftrag davor hat noch seine Lesepause; danach kommt die Erledigt-Meldung.
    await waitFor(
      () => expect(screen.getByTestId('pager-text').textContent).toContain('Vorfall 0 gelöst'),
      { timeout: 5000 }
    );
    const figur = () => screen.getByTestId('pager').querySelector('img')!.dataset.figur;
    expect(figur()).toBe('grinst');
    expect(pagerText()).not.toContain('Szene 0');
    // Szene zuletzt, Beweisstück und Abzeichen im Verlauf.
    await waitFor(() => expect(screen.getByTestId('pager-text').textContent).toContain('Szene 0'), {
      timeout: 5000,
    });
    const verlauf = screen.getByTestId('pager-verlauf').textContent ?? '';
    expect(verlauf).toContain('Neues Beweisstück für die Akte: Spur 0.');
    expect(verlauf).toContain('Abzeichen: Ohne Spickzettel.');
  });

  it('Alex fragen: zwei Tipps, dann die Lösung, und der Vorfall zählt „mit Lösung“', async () => {
    render(<StaffelApp />);
    await starte(1);
    const knopf = () => screen.getByRole('button', { name: /Alex fragen/ });
    expect(knopf().textContent).toContain('Tipp 1/3');
    fireEvent.click(knopf());
    await waitFor(() =>
      expect(screen.getByTestId('alex-tipp').textContent).toContain('Richtung 1')
    );
    fireEvent.click(knopf());
    await waitFor(() => expect(screen.getByTestId('alex-tipp').textContent).toContain('Befehl 1'));
    expect(knopf().textContent).toContain('Lösung');
    fireEvent.click(knopf());
    await waitFor(() => expect(screen.getByTestId('alex-tipp').textContent).toContain('loesung 1'));
    await loese(1);
    await waitFor(() => expect(screen.getByText(/Spur 1 · .* · mit Lösung/)).toBeTruthy());
    expect(screen.getByTestId('abzeichen-ohne-tipp').textContent).toContain('□');
  });

  it('schreibt stille Erfolge nur in den Pager, nicht ins Terminal', async () => {
    render(<StaffelApp />);
    await starte(0);
    vm.erfuellt.add('VERIFY_0');
    let reply: MissionReply | undefined;
    await act(async () => {
      reply = await sendCommand!('__prompt');
    });
    expect(reply?.text).toBe('');
    await waitFor(() => expect(pagerText()).toContain('Szene 0'), { timeout: 5000 });
  });

  it('zählt rote Prompts und vergibt das Abzeichen', async () => {
    render(<StaffelApp />);
    await starte(0);
    act(() => sendPrompt!(false));
    act(() => sendPrompt!(true));
    expect(screen.getByTestId('abzeichen-rot').textContent).toContain('□');
    act(() => sendPrompt!(true));
    expect(screen.getByTestId('abzeichen-rot').textContent).toContain('■');
  });

  it('mission next startet den nächsten offenen Vorfall; das Finale erst bei voller Akte', async () => {
    render(<StaffelApp />);
    await starte(0);
    await loese(0);
    let reply: MissionReply | undefined;
    await act(async () => {
      reply = await sendCommand!('next');
    });
    expect(reply?.text).toBe('Vorfall 1: Vorfall Nummer 1. Der Auftrag steht im Pager.');
    await loese(1);
    await waitFor(() =>
      expect((akteKnopf(/Vorfall Nummer 2/) as HTMLButtonElement).disabled).toBe(false)
    );
    await act(async () => {
      reply = await sendCommand!('next');
    });
    expect(reply?.text).toBe('Vorfall 2: Vorfall Nummer 2. Der Auftrag steht im Pager.');
  });

  it('zeigt Werkzeugkarten und das Glossar der gelernten Befehle', async () => {
    render(<StaffelApp />);
    await starte(0);
    fireEvent.click(screen.getByRole('button', { name: 'Werkzeuge' }));
    const bereich = document.getElementById('werkzeuge-desktop')!;
    expect(within(bereich).getAllByText('cmd0').length).toBeGreaterThan(0);
    expect(within(bereich).getByText(/Glossar: alle gelernten Befehle \(0\)/)).toBeTruthy();
    await loese(0);
    await waitFor(() =>
      expect(within(bereich).getByText(/Glossar: alle gelernten Befehle \(3\)/)).toBeTruthy()
    );
  });

  it('wechselt mobil zwischen den Reitern Terminal, Akte und Werkzeuge', async () => {
    render(<StaffelApp />);
    const tab = (name: string) => screen.getByRole('tab', { name });
    expect(tab('Akte').getAttribute('aria-selected')).toBe('true');
    await starte(0);
    expect(tab('Terminal').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tab('Werkzeuge'));
    expect(tab('Werkzeuge').getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('bereich-werkzeuge')!.className).not.toContain('hidden lg');
    expect(document.getElementById('bereich-terminal')!.className).toContain('hidden');
    // Das Terminal bleibt eingehängt, damit die VM weiterläuft.
    expect(screen.getByTestId('stub-terminal')).toBeTruthy();
  });
});
