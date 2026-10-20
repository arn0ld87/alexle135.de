import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Akte } from '../../../lib/missions/staffel';
import type { Staffel, Vorfall } from '../../../lib/missions/staffelTypes';
import { naechsteEpisode, Titelkarte } from '../Titelkarte';

const vorfall = (nr: number, extra: Partial<Vorfall> = {}): Vorfall => ({
  nr,
  id: `v${nr}`,
  titel: `Episode Nummer ${nr}`,
  setup: `SETUP_${nr}`,
  schritte: [
    {
      id: 'a',
      title: `Aufgabe ${nr}`,
      pager: [`Auftrag ${nr}`],
      verify: `VERIFY_${nr}`,
      tipps: [`Richtung ${nr}`, `Befehl ${nr}`, `loesung ${nr}`],
    },
  ],
  werkzeuge: [{ befehl: 'ls', erklaerung: 'ls erklärt.', beispiel: 'ls' }],
  beweisstueck: { id: `b${nr}`, titel: `Spur ${nr}`, beschreibung: `B ${nr}.`, code: `CODE-${nr}` },
  szene: [`Szene ${nr}`],
  ...extra,
});

const staffel: Staffel = {
  id: 'test',
  titel: 'Fall Kehrwoche',
  vorfaelle: [vorfall(0), vorfall(1), vorfall(2, { finale: true })],
  abzeichen: [],
};

const eintrag = { durationMs: 1, withSolution: false, hintsUsed: 0, finishedAt: 1 };
const akteMit = (...ids: string[]): Akte => Object.fromEntries(ids.map((id) => [id, eintrag]));

const rendern = (akte: Akte, onStart = vi.fn()) =>
  render(
    <Titelkarte
      staffel={staffel}
      akte={akte}
      figurUrl="/missions/figur/alexander-zeigt.webp"
      trailerUrl="/trailer"
      onStart={onStart}
    />
  );

describe('Titelkarte', () => {
  it('zeigt Kicker, Titel und Einleitung', () => {
    rendern({});
    expect(screen.getByText('Ein Linux-Krimi · Staffel 1')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Fall Kehrwoche' })).toBeTruthy();
    expect(
      screen.getByText(
        'Alex ist im Urlaub, und auf seinem Server räumt jemand auf. Du bist sein Azubi.'
      )
    ).toBeTruthy();
  });

  it('startet bei leerer Akte mit Episode 0', () => {
    const onStart = vi.fn();
    rendern({}, onStart);
    fireEvent.click(screen.getByRole('button', { name: 'Episode 0 starten' }));
    expect(onStart).toHaveBeenCalledExactlyOnceWith('v0');
  });

  it('macht mit der nächsten Episode weiter', () => {
    rendern(akteMit('v0'));
    expect(screen.getByRole('button', { name: 'Weiter mit Episode 1' })).toBeTruthy();
  });

  it('gibt das Finale frei, sobald alle anderen in der Akte stehen', () => {
    rendern(akteMit('v0', 'v1'));
    expect(screen.getByRole('button', { name: 'Weiter mit Episode 2' })).toBeTruthy();
  });

  it('zeigt keinen Knopf, wenn nichts mehr zu starten ist', () => {
    rendern(akteMit('v0', 'v1', 'v2'));
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('verlinkt den Trailer und zeigt die Figur mit Alternativtext', () => {
    rendern({});
    expect(screen.getByRole('link', { name: 'Trailer ansehen' }).getAttribute('href')).toBe(
      '/trailer'
    );
    expect(screen.getByAltText('Alex zeigt auf dich').getAttribute('src')).toBe(
      '/missions/figur/alexander-zeigt.webp'
    );
  });
});

describe('naechsteEpisode', () => {
  it('liefert null, wenn alle Episoden in der Akte stehen', () => {
    expect(naechsteEpisode(staffel, akteMit('v0', 'v1', 'v2'))).toBeNull();
  });

  it('sortiert nach nr, nicht nach Array-Reihenfolge', () => {
    const umgekehrt: Staffel = { ...staffel, vorfaelle: [...staffel.vorfaelle].reverse() };
    expect(naechsteEpisode(umgekehrt, {})?.id).toBe('v0');
    expect(naechsteEpisode(umgekehrt, akteMit('v0'))?.id).toBe('v1');
  });

  it('nimmt die niedrigste offene Episode, auch wenn eine spätere gelöst ist', () => {
    expect(naechsteEpisode(staffel, akteMit('v1'))?.id).toBe('v0');
  });
});
