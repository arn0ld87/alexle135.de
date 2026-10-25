// Bildschirmbedarf (ADR 0008): Nur eine Ermittlung mit `bildschirm: true` lädt V86Bildschirm (und
// damit das Bildschirm-Image); alle anderen bleiben beim unveränderten V86Terminal.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { episode0 } from '../../../data/staffeln/staffel-2/episode-0';
import { episode1 } from '../../../data/staffeln/staffel-2/episode-1';
import { platzhalter } from '../../../data/staffeln/staffel-2/platzhalter';
import type { AgentClient } from '../../../lib/missions/agentClient';
import type { Ermittlung } from '../../../lib/missions/ermittlungTypes';
import ErmittlungApp from '../ErmittlungApp';

const h = vi.hoisted(() => ({
  client: null as unknown as AgentClient,
  standPruefen: null as unknown as () => void,
  erstmals: null as unknown as () => void,
}));

vi.mock('../V86Terminal', async () => {
  const { useEffect } = await import('react');
  return {
    default: function StubTerminal(props: { onReady?: (client: AgentClient) => void }) {
      const { onReady } = props;
      useEffect(() => {
        onReady?.(h.client);
      }, [onReady]);
      return <div data-testid="stub-terminal" />;
    },
  };
});

vi.mock('../V86Bildschirm', async () => {
  const { useEffect } = await import('react');
  return {
    default: function StubBildschirm(props: {
      onReady?: (client: AgentClient) => void;
      onStandPruefen?: () => void;
      onBildschirmErstmals?: () => void;
    }) {
      const { onReady } = props;
      h.standPruefen = props.onStandPruefen as () => void;
      h.erstmals = props.onBildschirmErstmals as () => void;
      useEffect(() => {
        onReady?.(h.client);
      }, [onReady]);
      return <div data-testid="stub-bildschirm" />;
    },
  };
});

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const istBuendel = (skript: string) => skript.startsWith('(');
const pagerText = () => screen.getByTestId('pager').textContent ?? '';

let run: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
  }) as unknown as typeof window.matchMedia;
  run = vi.fn(async (skript: string) =>
    istBuendel(skript)
      ? { exitCode: 0, output: 'pruefung\ts.ankommen.notiz\t0\nende\t1\n' }
      : { exitCode: 0, output: '' }
  );
  h.client = { run } as unknown as AgentClient;
});

const mitBildschirm: Ermittlung = { ...platzhalter, bildschirm: true };

describe('Bildschirmbedarf einer Ermittlung', () => {
  it('ohne Deklaration: nur das Terminal, kein Bildschirm', async () => {
    render(<ErmittlungApp ermittlung={platzhalter} />);
    expect(await screen.findByTestId('stub-terminal')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-bildschirm')).toBeNull();
  });

  it('mit bildschirm: true: Bildschirm statt Terminal', async () => {
    render(<ErmittlungApp ermittlung={mitBildschirm} />);
    expect(await screen.findByTestId('stub-bildschirm')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-terminal')).toBeNull();
  });

  it('„Stand prüfen“ löst einen vollen Prüflauf aus, ohne Prompt', async () => {
    render(<ErmittlungApp ermittlung={mitBildschirm} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(4));
    expect(run.mock.calls.filter((c) => istBuendel(c[0] as string))).toHaveLength(0);

    act(() => h.standPruefen());
    await waitFor(() =>
      expect(run.mock.calls.filter((c) => istBuendel(c[0] as string))).toHaveLength(1)
    );
    await waitFor(() => expect(pagerText()).toContain('Erledigt: Lege eine Notiz an'));
  });

  it('zeigt beim ersten Öffnen des Bildschirms einen Hinweis im Pager', async () => {
    render(<ErmittlungApp ermittlung={mitBildschirm} />);
    await waitFor(() => expect(pagerText()).toContain('Leg in ~/belege'));
    act(() => h.erstmals());
    // Der Pager tippt Nachrichten nacheinander ein; der Hinweis folgt auf den Auftrag.
    await waitFor(() => expect(pagerText()).toContain('Das ist der Bildschirm des Rechners.'), {
      timeout: 15_000,
    });
  });

  it('Episoden 0 und 1 deklarieren keinen Bildschirm', () => {
    expect(episode0.bildschirm).toBeUndefined();
    expect(episode1.bildschirm).toBeUndefined();
  });

  it('nur ErmittlungApp lädt V86Bildschirm; Staffel 1 und V86Terminal kennen es nicht', () => {
    expect(read('src/components/missions/ErmittlungApp.tsx')).toContain(
      "lazy(() => import('./V86Bildschirm'))"
    );
    for (const datei of [
      'src/components/missions/StaffelApp.tsx',
      'src/components/missions/V86Terminal.tsx',
      'src/pages/projekte/terminal-missionen/app.astro',
    ]) {
      expect(read(datei), datei).not.toMatch(/V86Bildschirm|bildschirm\//i);
    }
  });
});
