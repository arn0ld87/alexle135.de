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
    titel: `Episode Nummer ${nr}`,
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
// `haelt`: Das Terminal meldet nie „bereit“ (die VM bootet noch oder der Agent antwortet nicht).
const vm = { erfuellt: new Set<string>(), scripts: [] as string[], haelt: false };
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

const resetToHome = vi.fn();
let sendCommand: ((c: MissionCommand) => Promise<MissionReply>) | undefined;
let sendPrompt: ((rot: boolean) => void) | undefined;
let sendPhase: ((kind: 'laden' | 'start' | 'bereit' | 'fehler') => void) | undefined;

vi.mock('../V86Terminal', async () => {
  const { useEffect } = await import('react');
  function StubTerminal({
    onReady,
    onMissionCommand,
    onPrompt,
    onPhase,
  }: {
    onReady?: (c: unknown, shell: unknown) => void;
    onMissionCommand?: (c: MissionCommand) => Promise<MissionReply>;
    onPrompt?: (rot: boolean) => void;
    onPhase?: (kind: 'laden' | 'start' | 'bereit' | 'fehler') => void;
  }) {
    sendCommand = onMissionCommand;
    sendPrompt = onPrompt;
    sendPhase = onPhase;
    useEffect(() => {
      if (!vm.haelt) onReady?.(fakeClient, { resetToHome });
    }, [onReady]);
    return <div data-testid="stub-terminal" />;
  }
  return { default: StubTerminal };
});

import StaffelApp from '../StaffelApp';

const akteKnopf = (name: RegExp) => screen.getByRole('button', { name });
const pagerText = () => screen.getByTestId('pager').textContent ?? '';
// E1.3 (#432): Spielende lesen „Episode“, nie „Vorfall“ – egal welcher Stand.
const keinVorfallWort = () => expect(document.body.textContent).not.toMatch(/Vorfall|Vorfälle/);

async function starte(nr: number) {
  fireEvent.click(akteKnopf(new RegExp(`Episode Nummer ${nr}`)));
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
  vm.haelt = false;
  sendCommand = undefined;
  sendPrompt = undefined;
  sendPhase = undefined;
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
});

// Stand der Teststaffel mit allen Episoden in der Akte, wie ihn der Store aus localStorage liest.
function seedAlleGeloest() {
  const eintrag = { durationMs: 60_000, withSolution: false, hintsUsed: 0, finishedAt: 1 };
  localStorage.setItem(
    'staffeln:v1',
    JSON.stringify({
      test: {
        akte: { v0: eintrag, v1: eintrag, v2: eintrag },
        abzeichen: ['ohne-tipp'],
        rotePrompts: 0,
      },
    })
  );
}

describe('StaffelApp', () => {
  it('zeigt die Akte mit gesperrtem Finale und lädt die VM erst nach der Auswahl', () => {
    render(<StaffelApp />);
    expect(screen.getByTestId('akte-zaehler').textContent).toBe('0/3');
    expect((akteKnopf(/Episode Nummer 2/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('gesperrt, bis die Akte voll ist')).toBeTruthy();
    expect(screen.queryByTestId('stub-terminal')).toBeNull();
    expect(pagerText()).toContain('Wähle in der Akte eine Episode');
  });

  it('zeigt ohne Stand die Titelkarte; ihr Start öffnet Episode 0 im Terminal', async () => {
    render(<StaffelApp />);
    expect(screen.queryByText(/Wähle eine Episode in der Akte/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Teststaffel' })).toBeTruthy();
    expect(screen.getByText(/Danach startet ein echtes Alpine-Linux/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Episode 0 starten' }));
    await screen.findByTestId('stub-terminal');
    await waitFor(() =>
      expect(screen.getByTestId('vorfall-schritt').textContent).toContain('Schritt 1/1')
    );
    expect(vm.scripts.some((s) => s.includes('SETUP_0'))).toBe(true);
    expect(screen.queryByRole('button', { name: /Episode \d starten/ })).toBeNull();
  });

  it('zeigt bei voller Akte die Abschlusskarte statt der Titelkarte', () => {
    seedAlleGeloest();
    render(<StaffelApp />);
    expect(screen.getByRole('heading', { name: 'Teststaffel gelöst' })).toBeTruthy();
    expect(screen.getByText('Gesamtlauf: 2:00 min')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Episode \d starten|Weiter mit Episode/ })
    ).toBeNull();
    expect(screen.queryByTestId('stub-terminal')).toBeNull();
    keinVorfallWort();
  });

  it('setzt den Vorfall auf und schickt den Auftrag in den Pager', async () => {
    render(<StaffelApp />);
    await starte(0);
    expect(vm.scripts.some((s) => s.includes('SETUP_0'))).toBe(true);
    // Der Auftrag kommt aus der Warteschlange des Pagers (#410), nicht im selben Rendern.
    await waitFor(() => expect(pagerText()).toContain('Auftrag 0: Lege projekt an.'));
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
      () => expect(screen.getByTestId('pager-text').textContent).toContain('Episode 0 gelöst'),
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
    expect(reply?.text).toBe('Episode 1: Episode Nummer 1. Der Auftrag steht im Pager.');
    await loese(1);
    await waitFor(() =>
      expect((akteKnopf(/Episode Nummer 2/) as HTMLButtonElement).disabled).toBe(false)
    );
    await act(async () => {
      reply = await sendCommand!('next');
    });
    expect(reply?.text).toBe('Episode 2: Episode Nummer 2. Der Auftrag steht im Pager.');
  });

  it('#426: Beim Wechsel des Vorfalls geht die Shell ins Home, der erste Start setzt nichts zurück', async () => {
    resetToHome.mockClear();
    render(<StaffelApp />);
    await starte(0);
    expect(resetToHome).not.toHaveBeenCalled();
    fireEvent.click(akteKnopf(/Episode Nummer 1/));
    await waitFor(() => expect(pagerText()).toContain('Auftrag 1'));
    expect(resetToHome).toHaveBeenCalledTimes(1);
    // Zweiter Klick auf den laufenden Vorfall: kein weiterer Reset.
    fireEvent.click(akteKnopf(/Episode Nummer 1/));
    expect(resetToHome).toHaveBeenCalledTimes(1);
  });

  it('#428: Neustart eines gelösten Vorfalls setzt die Shell ebenfalls ins Home zurück', async () => {
    render(<StaffelApp />);
    await starte(0);
    await loese(0);
    await waitFor(() => expect(screen.getByTestId('akte-zaehler').textContent).toBe('1/3'));
    resetToHome.mockClear();
    const setups = () => vm.scripts.filter((s) => s.includes('SETUP_0')).length;
    const vorher = setups();
    fireEvent.click(akteKnopf(/Episode Nummer 0/));
    await waitFor(() => expect(setups()).toBe(vorher + 1));
    expect(resetToHome).toHaveBeenCalledTimes(1);
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

  it('Fehler im Terminal ersetzt „Episode wird vorbereitet“; ein Neustart setzt es zurück', async () => {
    vm.haelt = true;
    render(<StaffelApp />);
    fireEvent.click(akteKnopf(/Episode Nummer 0/));
    await screen.findByTestId('stub-terminal');
    const zeile = () => screen.getByTestId('vorfall-schritt').textContent;
    expect(zeile()).toBe('Episode wird vorbereitet …');

    act(() => sendPhase!('fehler'));
    expect(zeile()).toBe('');
    expect(document.body.textContent).not.toContain('wird vorbereitet');

    // „Neu starten“ am Terminal: Die VM lädt wieder, die Episode wird wieder vorbereitet.
    act(() => sendPhase!('laden'));
    expect(zeile()).toBe('Episode wird vorbereitet …');
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

  // E1.3 (#432): Jede sichtbare Zeichenkette spricht von einer Episode, nie von einem Vorfall.
  it('nennt ohne Stand nur Episoden', () => {
    render(<StaffelApp />);
    keinVorfallWort();
  });

  it('nennt mit gestarteter Episode 0 nur Episoden', async () => {
    render(<StaffelApp />);
    await starte(0);
    await waitFor(() => expect(pagerText()).toContain('Episode 0: Episode Nummer 0.'), {
      timeout: 5000,
    });
    keinVorfallWort();
  });

  it('nennt nach gelöster Episode 0 nur Episoden', async () => {
    render(<StaffelApp />);
    await starte(0);
    await loese(0);
    await waitFor(
      () => expect(screen.getByTestId('pager-text').textContent).toContain('Episode 0 gelöst'),
      { timeout: 5000 }
    );
    keinVorfallWort();
  });
});
