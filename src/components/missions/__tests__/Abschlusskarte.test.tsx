import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatDuration } from '../../../lib/missions/missionEngine';
import type { StaffelStand } from '../../../lib/missions/staffel';
import type { Staffel, Vorfall } from '../../../lib/missions/staffelTypes';
import { Abschlusskarte, gesamtlaufMs } from '../Abschlusskarte';

const vorfall = (nr: number): Vorfall => ({
  nr,
  id: `v${nr}`,
  titel: `Episode Nummer ${nr}`,
  setup: '',
  schritte: [],
  werkzeuge: [],
  beweisstueck: {
    id: `b${nr}`,
    titel: `Spur ${nr}`,
    beschreibung: `Beschreibung ${nr}.`,
    code: `C${nr}`,
  },
  szene: [],
});

const staffel: Staffel = {
  id: 'test',
  titel: 'Fall Kehrwoche',
  vorfaelle: [vorfall(0), vorfall(1), vorfall(2)],
  abzeichen: [
    { id: 'erstes', titel: 'Erstes Abzeichen', beschreibung: 'b', regel: { art: 'ohne-tipp' } },
    { id: 'zweites', titel: 'Zweites Abzeichen', beschreibung: 'b', regel: { art: 'nie-loesung' } },
  ],
};

const eintrag = (durationMs: number) => ({
  durationMs,
  withSolution: false,
  hintsUsed: 0,
  finishedAt: 0,
});

const stand = (abzeichen: string[]): StaffelStand => ({
  akte: { v0: eintrag(60_000), v1: eintrag(120_000), v2: eintrag(30_000) },
  abzeichen,
  rotePrompts: 0,
});

const renderKarte = (abzeichen: string[]) =>
  render(
    <Abschlusskarte
      staffel={staffel}
      stand={stand(abzeichen)}
      figurUrl="/figur/urlaub.webp"
      projektUrl="/projekte/linux-krimi"
    />
  );

describe('Abschlusskarte', () => {
  it('zeigt die Überschrift mit dem Staffeltitel', () => {
    renderKarte([]);
    expect(screen.getByRole('heading', { name: 'Fall Kehrwoche gelöst' })).toBeTruthy();
    expect(screen.getByText('Ein Linux-Krimi · Staffel 1')).toBeTruthy();
  });

  it('gesamtlaufMs lässt Nummer 0 weg und zählt nur Akte der Staffel', () => {
    expect(gesamtlaufMs(staffel, stand([]).akte)).toBe(150_000);
    expect(gesamtlaufMs(staffel, { ...stand([]).akte, fremd: eintrag(999_000) })).toBe(150_000);
  });

  it('zeigt den Gesamtlauf formatiert', () => {
    renderKarte([]);
    expect(screen.getByText(`Gesamtlauf: ${formatDuration(150_000)}`)).toBeTruthy();
  });

  it('listet verdiente Abzeichen in der Reihenfolge des Standes', () => {
    renderKarte(['zweites', 'unbekannt', 'erstes']);
    const titel = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(titel).toEqual(['Zweites Abzeichen', 'Erstes Abzeichen']);
  });

  it('zeigt ohne Abzeichen den Ersatzsatz', () => {
    renderKarte([]);
    expect(screen.getByText('Noch keine Abzeichen. Beim nächsten Lauf vielleicht.')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('verlinkt die Projektseite und kündigt Staffel 2 an', () => {
    renderKarte([]);
    expect(screen.getByRole('link', { name: 'Zur Projektseite' }).getAttribute('href')).toBe(
      '/projekte/linux-krimi'
    );
    expect(screen.getByText(/Staffel 2 folgt/)).toBeTruthy();
  });

  it('zeigt die Figur mit Alt-Text und zeigt kein „Vorfall“', () => {
    const { container } = renderKarte(['erstes']);
    const img = screen.getByAltText('Alex im Urlaub mit Cocktail');
    expect(img.getAttribute('src')).toBe('/figur/urlaub.webp');
    expect(container.textContent).not.toContain('Vorfall');
  });
});
