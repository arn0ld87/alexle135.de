import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MissionTool } from '../../../lib/missions/missionTypes';
import type { VorfallSchritt } from '../../../lib/missions/staffelTypes';
import ErmittlungsHilfe from '../ErmittlungsHilfe';

const schritt = (id: string, titel: string): VorfallSchritt => ({
  id,
  title: titel,
  pager: ['Auftrag'],
  verify: 'true',
  tipps: [`Richtung ${id}`, `Werkzeug ${id}`, `Lösung: befehl ${id}`],
});

const werkzeuge: MissionTool[] = [
  { befehl: 'grep', erklaerung: 'Sucht Zeilen.', beispiel: 'grep root /etc/passwd' },
  { befehl: 'stat', erklaerung: 'Zeigt Details.', beispiel: 'stat /etc/hostname' },
];

const eins = schritt('eins', 'Erster');
const zwei = schritt('zwei', 'Zweiter');

describe('ErmittlungsHilfe', () => {
  it('T9-10: zeigt zunächst keinen Tipp und hält den Werkzeugkasten geschlossen', () => {
    render(<ErmittlungsHilfe spurId="a" schritt={eins} werkzeuge={werkzeuge} />);
    const kasten = screen.getByText('Werkzeugkasten').closest('details');
    expect(kasten).not.toHaveAttribute('open');
    expect(screen.queryByText('Richtung eins')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ersten Tipp zeigen' })).toBeInTheDocument();
  });

  it('T9-10: öffnet den Werkzeugkasten per Klick und zeigt Karten als Text', async () => {
    const user = userEvent.setup();
    render(<ErmittlungsHilfe spurId="a" schritt={eins} werkzeuge={werkzeuge} />);
    await user.click(screen.getByText('Werkzeugkasten'));
    expect(screen.getByText('Werkzeugkasten').closest('details')).toHaveAttribute('open');
    expect(screen.getByText('grep')).toBeInTheDocument();
    expect(screen.getByText('Sucht Zeilen.')).toBeInTheDocument();
    expect(screen.getByText('stat /etc/hostname')).toBeInTheDocument();
  });

  it('T9-10: lässt ohne Werkzeuge keinen leeren Kasten stehen', () => {
    render(<ErmittlungsHilfe spurId="a" schritt={eins} />);
    expect(screen.queryByText('Werkzeugkasten')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ersten Tipp zeigen' })).toBeInTheDocument();
  });

  it('T9-10: zeigt die Tipps stufenweise und kennzeichnet Stufe 3 als Lösung', async () => {
    const user = userEvent.setup();
    render(<ErmittlungsHilfe spurId="a" schritt={eins} werkzeuge={werkzeuge} />);

    await user.click(screen.getByRole('button', { name: 'Ersten Tipp zeigen' }));
    expect(screen.getByText('Richtung eins')).toBeInTheDocument();
    expect(screen.queryByText('Werkzeug eins')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nächsten Tipp zeigen' }));
    expect(screen.getByText('Werkzeug eins')).toBeInTheDocument();
    expect(screen.queryByText(/befehl eins/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lösung zeigen' }));
    expect(screen.getByText('Lösung: befehl eins')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Tipps' }).textContent).toContain('Tipp 3 (Lösung)');
    expect(screen.queryByRole('button', { name: /Tipp zeigen|Lösung zeigen/ })).toBeNull();
  });

  it('T9-10: merkt den Fortschritt je Spur und Schritt und verrät keine Folgeaufträge', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ErmittlungsHilfe spurId="a" schritt={eins} />);
    await user.click(screen.getByRole('button', { name: 'Ersten Tipp zeigen' }));
    await user.click(screen.getByRole('button', { name: 'Nächsten Tipp zeigen' }));

    // Andere Spur: eigener Fortschritt bei null, kein Tipp der ersten Spur.
    rerender(<ErmittlungsHilfe spurId="b" schritt={zwei} />);
    expect(screen.queryByText('Richtung zwei')).not.toBeInTheDocument();
    expect(screen.queryByText('Richtung eins')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ersten Tipp zeigen' })).toBeInTheDocument();

    // Zurück: Stufe 2 steht noch da.
    rerender(<ErmittlungsHilfe spurId="a" schritt={eins} />);
    expect(screen.getByText('Richtung eins')).toBeInTheDocument();
    expect(screen.getByText('Werkzeug eins')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lösung zeigen' })).toBeInTheDocument();

    // Gleiche Spur, nächster Schritt: eigener Zähler, die Tipps des erledigten Schritts verschwinden.
    rerender(<ErmittlungsHilfe spurId="a" schritt={zwei} />);
    expect(screen.queryByText('Richtung eins')).not.toBeInTheDocument();
    expect(screen.queryByText('Richtung zwei')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ersten Tipp zeigen' })).toBeInTheDocument();
  });

  it('T9-10: öffnet beim Spurwechsel weder Werkzeugkasten noch Tipps von selbst', () => {
    const { rerender } = render(
      <ErmittlungsHilfe spurId="a" schritt={eins} werkzeuge={werkzeuge} />
    );
    rerender(<ErmittlungsHilfe spurId="b" schritt={zwei} werkzeuge={werkzeuge} />);
    expect(screen.getByText('Werkzeugkasten').closest('details')).not.toHaveAttribute('open');
    expect(screen.queryByRole('list', { name: 'Tipps' })).not.toBeInTheDocument();
  });

  it('T9-10: zeigt Texte nur als Text, nie als Markup', async () => {
    const user = userEvent.setup();
    const gefaehrlich = '<img src=x onerror="alert(1)"><b>fett</b>';
    const { container } = render(
      <ErmittlungsHilfe
        spurId="a"
        schritt={{ ...eins, tipps: [gefaehrlich, 'Zwei', 'Lösung: drei'] }}
        werkzeuge={[{ befehl: gefaehrlich, erklaerung: gefaehrlich, beispiel: gefaehrlich }]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Ersten Tipp zeigen' }));
    expect(screen.getAllByText(gefaehrlich).length).toBeGreaterThan(0);
    expect(container.querySelector('img, b')).toBeNull();
  });

  it('T9-10: zeigt ohne offenen Schritt keine Tipps', () => {
    render(<ErmittlungsHilfe spurId="a" schritt={null} werkzeuge={werkzeuge} />);
    expect(screen.queryByRole('button', { name: /Tipp zeigen|Lösung zeigen/ })).toBeNull();
    expect(screen.getByText('Werkzeugkasten')).toBeInTheDocument();
  });
});
