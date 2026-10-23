import { render, screen } from '@testing-library/react';
import { TerminalBand } from '../TerminalBand';

describe('TerminalBand – stellt den Linux-Krimi vor', () => {
  it('Überschrift nennt „Ein Linux-Krimi“ und „Fall Kehrwoche“', () => {
    render(<TerminalBand />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toContain('Ein Linux-Krimi');
    expect(heading.textContent).toContain('Fall Kehrwoche');
  });

  it('Button „Fall öffnen“ führt auf die Projektseite, nicht in die App', () => {
    render(<TerminalBand />);
    const link = screen.getByRole('link', { name: /Fall öffnen/ });
    expect(link.getAttribute('href')).toBe('/projekte/terminal-missionen/');
  });

  it('beschreibt die Engine richtig: echtes Alpine Linux, Episoden 0 bis 8', () => {
    const { container } = render(<TerminalBand />);
    const text = container.textContent ?? '';
    expect(text).toContain('Alpine Linux');
    expect(text).toContain('ohne Installation');
    expect(text).toContain('ohne Konto');
    expect(text).toContain('Azubi');
    expect(text).toContain('Episoden 0 bis 8');
  });

  it('nennt weder WebContainer noch Mission in sichtbaren Texten', () => {
    const { container } = render(<TerminalBand />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/WebContainer/i);
    expect(text).not.toMatch(/Mission/i);
    expect(text).not.toContain('Powered by');
  });

  it('zeigt den Prompt der VM (azubi@alex-schneider) statt user@mission', () => {
    const { container } = render(<TerminalBand />);
    const text = container.textContent ?? '';
    expect(text).toContain('azubi@alex-schneider');
    expect(text).not.toContain('user@mission');
  });
});
