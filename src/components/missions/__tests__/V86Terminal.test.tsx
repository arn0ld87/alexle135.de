// Statusanzeige und Neustart des Terminals, ohne echte VM: v86 und xterm sind Attrappen, die
// Antworten des Agenten spielt der Test über die zweite Serielle (serial1) ein.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { FakeV86, FakeTerminal, FakeFitAddon } = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class FakeV86 {
    static instances: FakeV86[] = [];
    private readonly listeners = new Map<string, Listener[]>();
    destroyed = false;
    /** Was die Engine an den Agenten schickt (serial1). */
    readonly serial1: string[] = [];

    constructor(readonly options: unknown) {
      FakeV86.instances.push(this);
    }
    add_listener(name: string, fn: Listener) {
      this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
    }
    emit(name: string, ...args: unknown[]) {
      for (const fn of this.listeners.get(name) ?? []) fn(...args);
    }
    serial_send_bytes(port: number, bytes: Uint8Array) {
      if (port === 1) this.serial1.push(new TextDecoder().decode(bytes));
    }
    destroy() {
      this.destroyed = true;
      return Promise.resolve();
    }
    /** Eine Zeile des Agenten, Byte für Byte wie von der echten Seriellen. */
    agentSagt(line: string) {
      for (const zeichen of line) this.emit('serial1-output-byte', zeichen.charCodeAt(0));
    }
  }

  class FakeTerminal {
    cols = 80;
    rows = 24;
    parser = { registerOscHandler: () => true };
    loadAddon() {}
    open() {}
    write() {}
    focus() {}
    dispose() {}
    onData() {}
    onResize() {}
  }

  class FakeFitAddon {
    fit() {}
  }

  return { FakeV86, FakeTerminal, FakeFitAddon };
});

vi.mock('v86', () => ({ V86: FakeV86 }));
vi.mock('@xterm/xterm', () => ({ Terminal: FakeTerminal }));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: FakeFitAddon }));
vi.mock('v86/build/v86.wasm?url', () => ({ default: '/v86.wasm' }));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

import V86Terminal from '../V86Terminal';

const status = () => screen.getByTestId('v86-status');
const neuStarten = () => screen.getByRole('button', { name: 'Neu starten' });

type Gast = InstanceType<typeof FakeV86>;

async function instanz(nr: number) {
  await waitFor(() => expect(FakeV86.instances).toHaveLength(nr), { timeout: 4_000 });
  return FakeV86.instances[nr - 1];
}

/** Der Agent beantwortet den ersten PING der Engine. */
async function agentAntwortetAufPing(vm: Gast) {
  await waitFor(() => expect(vm.serial1[0]).toBe('PING m1\n'));
  await act(async () => vm.agentSagt('RES m1 0 -\n'));
}

/** Der Agent beantwortet den Lauf der motd, den die Engine nach dem PING schickt. */
async function agentAntwortetAufMotd(vm: Gast) {
  await waitFor(() => expect(vm.serial1.some((zeile) => zeile.startsWith('RUN '))).toBe(true));
  const id = vm.serial1.find((zeile) => zeile.startsWith('RUN '))!.split(' ')[1];
  await act(async () => vm.agentSagt(`RES ${id} 0 -\n`));
}

describe('V86Terminal', () => {
  beforeEach(() => {
    FakeV86.instances.length = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('wird bereit, sobald der Agent auf den PING antwortet', async () => {
    const onReady = vi.fn();
    render(<V86Terminal onReady={onReady} />);
    const vm = await instanz(1);
    expect(status().textContent).toBe('Linux wird geladen …');
    expect(neuStarten()).toBeDisabled();

    act(() => vm.emit('emulator-started'));
    expect(status().textContent).toBe('Linux startet …');
    await agentAntwortetAufPing(vm);
    await agentAntwortetAufMotd(vm);

    await waitFor(() => expect(status().textContent).toBe('echtes Linux · Alpine · ohne Netzwerk'));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(neuStarten()).not.toBeDisabled();
  });

  it('zeigt ohne Antwort des Agenten genau eine Fehlermeldung; „Neu starten“ bootet neu', async () => {
    const onPhase = vi.fn();
    const onReady = vi.fn();
    render(<V86Terminal onPhase={onPhase} onReady={onReady} />);
    const erste = await instanz(1);

    vi.useFakeTimers();
    act(() => erste.emit('emulator-started'));
    expect(status().textContent).toBe('Linux startet …');
    // 120 PINGs im Abstand von 500 ms, keine Antwort.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    vi.useRealTimers();

    // Eine Meldung, die Wiederholungsaktion daneben, die Vorbereitungsmeldung der Überlagerung weg.
    const meldung = screen.getByRole('alert');
    expect(meldung).toBe(status());
    expect(meldung.textContent).toBe(
      'Fehler: Linux antwortet nicht. Mit „Neu starten“ noch einmal versuchen.'
    );
    expect(screen.queryAllByText(/Fehler/)).toHaveLength(1);
    expect(screen.queryByText(/Linux startet/)).toBeNull();
    expect(screen.queryByText(/Linux wird geladen/)).toBeNull();
    expect(neuStarten()).not.toBeDisabled();
    expect(onReady).not.toHaveBeenCalled();

    // Neustart: Die alte VM wird abgeräumt, eine neue bootet, die Anzeige beginnt von vorn.
    fireEvent.click(neuStarten());
    const zweite = await instanz(2);
    expect(erste.destroyed).toBe(true);
    expect(zweite.destroyed).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(status().textContent).toBe('Linux wird geladen …');

    act(() => zweite.emit('emulator-started'));
    expect(status().textContent).toBe('Linux startet …');
    await agentAntwortetAufPing(zweite);
    await agentAntwortetAufMotd(zweite);
    await waitFor(() => expect(status().textContent).toBe('echtes Linux · Alpine · ohne Netzwerk'));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onPhase.mock.calls.map(([kind]) => kind)).toEqual([
      'laden',
      'start',
      'fehler',
      'laden',
      'start',
      'bereit',
    ]);
  });

  it('wird auch bereit, wenn der Agent erst nach dem Wiederholungsintervall antwortet', async () => {
    render(<V86Terminal />);
    const vm = await instanz(1);

    vi.useFakeTimers();
    act(() => vm.emit('emulator-started'));
    // Unter Last braucht der Gast länger als 500 ms; seine Antwort auf den ersten PING zählt.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(status().textContent).toBe('Linux startet …');
    await act(async () => vm.agentSagt('RES m1 0 -\n'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    vi.useRealTimers();

    await agentAntwortetAufMotd(vm);
    await waitFor(() => expect(status().textContent).toBe('echtes Linux · Alpine · ohne Netzwerk'));
  });
});
