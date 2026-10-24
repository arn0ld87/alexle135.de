import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EinsatzrahmenHinweis from '../EinsatzrahmenHinweis';

const text = ['Diagnose ist erlaubt.', '/home/nadia/ ist ausgeschlossen.'];

describe('EinsatzrahmenHinweis', () => {
  it('T8-9: bleibt zunächst geschlossen und zeigt keinen Status', () => {
    render(<EinsatzrahmenHinweis text={text} verletzt={false} gesperrt={false} />);
    const bereich = screen.getByText('Einsatzrahmen').closest('details');
    expect(bereich).not.toHaveAttribute('open');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('T8-9: lässt sich per Tastatur öffnen, ohne den Fokus zu verlieren', async () => {
    const user = userEvent.setup();
    render(<EinsatzrahmenHinweis text={text} verletzt={false} gesperrt={false} />);
    await user.tab();
    const zusammenfassung = screen.getByText('Einsatzrahmen');
    expect(zusammenfassung).toHaveFocus();

    // jsdom wandelt Enter/Leertaste auf summary nicht um; Browser lösen dafür genau diesen Klick aus.
    await user.click(zusammenfassung);
    expect(zusammenfassung.closest('details')).toHaveAttribute('open');
    expect(zusammenfassung).toHaveFocus();
    expect(screen.getByText('/home/nadia/ ist ausgeschlossen.')).toBeInTheDocument();

    await user.click(zusammenfassung);
    expect(zusammenfassung.closest('details')).not.toHaveAttribute('open');
    expect(zusammenfassung).toHaveFocus();
  });

  it('T8-9: zeigt Texte nur als Text, nie als Markup', () => {
    const gefaehrlich = '<img src=x onerror="alert(1)"><b>fett</b>';
    const { container } = render(
      <EinsatzrahmenHinweis text={[gefaehrlich]} verletzt={false} gesperrt={false} />
    );
    expect(screen.getByText(gefaehrlich)).toBeInTheDocument();
    expect(container.querySelector('img, b')).toBeNull();
  });

  it('zeigt nach erkanntem Verstoß den Status außerhalb des geschlossenen Bereichs', () => {
    render(<EinsatzrahmenHinweis text={text} verletzt gesperrt={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Einsatzrahmen verletzt.');
    expect(screen.getByRole('status')).not.toHaveTextContent('gesperrt');
    expect(screen.getByRole('status').closest('details')).toBeNull();
  });

  it('nennt die vorübergehende Sperre nur, solange sie besteht', () => {
    const { rerender } = render(<EinsatzrahmenHinweis text={text} verletzt gesperrt />);
    expect(screen.getByRole('status')).toHaveTextContent('vorübergehend gesperrt');
    rerender(<EinsatzrahmenHinweis text={text} verletzt gesperrt={false} />);
    expect(screen.getByRole('status')).not.toHaveTextContent('gesperrt');
  });
});
