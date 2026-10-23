// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Die App-Seite heißt wie das Spiel: „Ein Linux-Krimi · Staffel 1 · Fall Kehrwoche“.
// Alte Namen („Terminal-Missionen“, „Krimi auf Alex' Server“) und das Wort
// „Vorfälle“ dürfen im sichtbaren Text der Seite nicht mehr auftauchen (E1.2).
describe('projekte: App-Seite „Ein Linux-Krimi“', () => {
  const app = readFileSync('src/pages/projekte/terminal-missionen/app.astro', 'utf8');

  it('nennt den Fall Kehrwoche', () => {
    expect(app).toContain('Fall Kehrwoche');
  });

  it('nennt den Namen Ein Linux-Krimi', () => {
    expect(app).toContain('Ein Linux-Krimi');
  });

  it('verwendet den alten Staffelnamen nicht mehr', () => {
    expect(app).not.toContain('Krimi auf Alex');
  });

  it('verwendet den alten Seitennamen nicht mehr', () => {
    expect(app).not.toContain('Terminal-Missionen');
  });

  it('spricht nicht mehr von Vorfällen', () => {
    expect(app).not.toContain('Vorfälle');
  });
});
