import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tippDauer, type PagerNachricht } from '../../../lib/missions/pager';
import Pager from '../Pager';

const n = (id: number, zeilen: string[]): PagerNachricht => ({ id, art: 'auftrag', zeilen });
const text = () => screen.getByTestId('pager-text').textContent ?? '';

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as never;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  setReducedMotion(false);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Pager', () => {
  it('zeigt ohne Nachricht einen Hinweis und die Figur neutral', () => {
    const { container } = render(<Pager nachrichten={[]} />);
    expect(screen.getByText('Noch keine Nachricht.')).toBeTruthy();
    const img = container.querySelector('img[data-figur]')!;
    expect(img.getAttribute('src')).toBe('/missions/figur/alexander-neutral.svg');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('wählt die Pose je Nachricht, sonst die Standardpose der Art', () => {
    setReducedMotion(true);
    const { container, rerender } = render(<Pager nachrichten={[n(1, ['x'])]} />);
    const src = () => container.querySelector('img[data-figur]')!.getAttribute('src');
    expect(src()).toBe('/missions/figur/alexander-zeigt.svg');
    rerender(<Pager nachrichten={[n(1, ['x']), { id: 2, art: 'szene', zeilen: ['y'] }]} />);
    expect(src()).toBe('/missions/figur/alexander-urlaub.svg');
    rerender(<Pager nachrichten={[{ id: 3, art: 'auftrag', zeilen: ['z'], pose: 'haare' }]} />);
    expect(src()).toBe('/missions/figur/alexander-haare.svg');
  });

  it('tippt eine neue Nachricht ein und gibt Screenreadern sofort den ganzen Text', () => {
    const { rerender } = render(<Pager nachrichten={[]} />);
    const zeilen = ['Moin, ich bin Alex.', 'Leg einen Ordner an.'];
    rerender(<Pager nachrichten={[n(1, zeilen)]} />);
    expect(screen.getByText('Moin, ich bin Alex. Leg einen Ordner an.')).toBeTruthy();
    expect(text()).not.toContain('Leg einen');
    act(() => void vi.advanceTimersByTime(tippDauer(zeilen) + 100));
    expect(text()).toBe('Moin, ich bin Alex.Leg einen Ordner an.');
  });

  it('tippt eine zweite Nachricht nach einer fertigen von vorn ein', () => {
    const { rerender } = render(<Pager nachrichten={[n(1, ['erste Nachricht'])]} />);
    rerender(<Pager nachrichten={[n(1, ['erste Nachricht']), n(2, ['zweite Nachricht'])]} />);
    expect(text()).not.toContain('zweite');
    act(() => void vi.advanceTimersByTime(tippDauer(['zweite Nachricht']) + 100));
    expect(text()).toBe('zweite Nachricht');
  });

  it('zeigt bei reduzierter Bewegung den Text sofort', () => {
    setReducedMotion(true);
    const { rerender } = render(<Pager nachrichten={[]} />);
    rerender(<Pager nachrichten={[n(1, ['Sofort da.'])]} />);
    expect(text()).toBe('Sofort da.');
  });

  it('legt ältere Nachrichten in den aufklappbaren Verlauf, die neueste zuerst', () => {
    setReducedMotion(true);
    render(<Pager nachrichten={[n(1, ['eins']), n(2, ['zwei']), n(3, ['drei'])]} />);
    expect(screen.getByText('Verlauf (2)')).toBeTruthy();
    const items = screen.getByTestId('pager-verlauf').querySelectorAll('li');
    expect([...items].map((li) => li.textContent)).toEqual(['zwei', 'eins']);
    expect(text()).toBe('drei');
  });

  it('merkt sich den Ton-Schalter', () => {
    render(<Pager nachrichten={[]} />);
    const button = screen.getByRole('button', { name: 'Ton an' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Ton aus' })).toBeTruthy();
    expect(localStorage.getItem('pager:ton')).toBe('aus');
  });
});
