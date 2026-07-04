import { render, screen } from '@testing-library/react';
import { Tabs } from '../Tabs';

describe('Tabs – A11y-Semantik (Filter-Schalter)', () => {
  const items = ['Alle', 'Web', 'Backend'];

  it('Container hat role="group"', () => {
    const { container } = render(<Tabs items={items} value="Alle" />);
    expect(container.querySelector('[role="group"]')).not.toBeNull();
  });

  it('Container hat aria-label', () => {
    const { container } = render(<Tabs items={items} value="Alle" />);
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBeTruthy();
  });

  it('aria-label kann überschrieben werden', () => {
    const { container } = render(<Tabs items={items} value="Alle" aria-label="Projekt-Filter" />);
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Projekt-Filter'
    );
  });

  it('aktiver Button hat aria-pressed="true"', () => {
    render(<Tabs items={items} value="Web" />);
    const webBtn = screen.getByRole('button', { name: 'Web' });
    expect(webBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('inaktive Buttons haben aria-pressed="false"', () => {
    render(<Tabs items={items} value="Web" />);
    expect(screen.getByRole('button', { name: 'Alle' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Backend' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
  });

  it('keine tab-Rolle mehr auf den Buttons', () => {
    const { container } = render(<Tabs items={items} value="Alle" />);
    expect(container.querySelector('[role="tab"]')).toBeNull();
  });

  it('kein tablist mehr auf dem Container', () => {
    const { container } = render(<Tabs items={items} value="Alle" />);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });
});
