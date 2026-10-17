import { describe, expect, it } from 'vitest';
import { formatBuildLine, getBuildInfo } from '../buildInfo';

describe('getBuildInfo', () => {
  it('liefert Kurz-SHA, Datum und deutsche Darstellung', () => {
    const info = getBuildInfo({
      PUBLIC_BUILD_SHA: '0123abc4567d',
      PUBLIC_BUILD_DATE: '2026-10-13',
    });
    expect(info).toEqual({ sha: '0123abc', date: '2026-10-13', dateDisplay: '13.10.2026' });
  });

  it('kürzt einen 40-stelligen SHA auf die ersten 7 Zeichen', () => {
    const full = '0123abc4567d89ef0123456789abcdef01234567';
    expect(full).toHaveLength(40);
    expect(getBuildInfo({ PUBLIC_BUILD_SHA: full, PUBLIC_BUILD_DATE: '2026-10-13' }).sha).toBe(
      '0123abc'
    );
  });

  it('akzeptiert einen genau 7-stelligen SHA unverändert', () => {
    expect(getBuildInfo({ PUBLIC_BUILD_SHA: '0123abc' }).sha).toBe('0123abc');
  });

  describe('SHA fehlt oder ist ungültig', () => {
    it.each([
      ['fehlend', undefined],
      ['leer', ''],
      ['zu kurz', 'abc'],
      ['sechs Zeichen', '0123ab'],
      ['Großbuchstaben', 'ABCDEF1'],
      ['länger als 40 Zeichen', 'a'.repeat(41)],
      ['mit Markup', '0123abc<script>'],
      ['nur Leerzeichen', '       '],
      ['keine Zeichenkette', 1234567],
    ])('%s ergibt null', (_label, value) => {
      expect(
        getBuildInfo({ PUBLIC_BUILD_SHA: value, PUBLIC_BUILD_DATE: '2026-10-13' }).sha
      ).toBeNull();
    });

    it('lässt das Datum bei ungültigem SHA unberührt', () => {
      const info = getBuildInfo({ PUBLIC_BUILD_SHA: 'xyz', PUBLIC_BUILD_DATE: '2026-10-13' });
      expect(info.date).toBe('2026-10-13');
      expect(info.dateDisplay).toBe('13.10.2026');
    });
  });

  describe('Datum fehlt oder ist ungültig', () => {
    it.each([
      ['fehlend', undefined],
      ['leer', ''],
      ['deutsches Format', '13.10.2026'],
      ['mit Uhrzeit', '2026-10-13T10:00:00Z'],
      ['Monat 13', '2026-13-01'],
      ['Tag 00', '2026-10-00'],
      ['mit Markup', '2026-10-1<b>'],
      ['keine Zeichenkette', 20261013],
    ])('%s ergibt null', (_label, value) => {
      const info = getBuildInfo({ PUBLIC_BUILD_SHA: '0123abc', PUBLIC_BUILD_DATE: value });
      expect(info.date).toBeNull();
      expect(info.dateDisplay).toBeNull();
    });
  });

  it('gibt keine anderen Umgebungswerte weiter', () => {
    const info = getBuildInfo({
      PUBLIC_BUILD_SHA: '0123abc4567d',
      PUBLIC_BUILD_DATE: '2026-10-13',
      HOSTNAME: 'meinserver',
      DATABASE_URL: 'postgres://geheim',
    });
    expect(Object.keys(info).sort()).toEqual(['date', 'dateDisplay', 'sha']);
    expect(JSON.stringify(info)).not.toMatch(/meinserver|geheim/);
  });

  it('erzeugt ohne Argument ein Ergebnis mit den erwarteten Feldern', () => {
    const info = getBuildInfo();
    expect(Object.keys(info).sort()).toEqual(['date', 'dateDisplay', 'sha']);
  });
});

describe('formatBuildLine', () => {
  it('nennt SHA und Datum', () => {
    expect(formatBuildLine({ sha: '0123abc', date: '2026-10-13', dateDisplay: '13.10.2026' })).toBe(
      'Build 0123abc · 13.10.2026'
    );
  });

  it('fällt ohne SHA auf das Datum zurück', () => {
    expect(formatBuildLine({ sha: null, date: '2026-10-13', dateDisplay: '13.10.2026' })).toBe(
      'Build 13.10.2026'
    );
  });

  it('liefert eine leere Zeichenkette, wenn beides fehlt', () => {
    expect(formatBuildLine({ sha: null, date: null, dateDisplay: null })).toBe('');
  });

  it('zeigt einen SHA ohne Datum allein an', () => {
    expect(formatBuildLine({ sha: '0123abc', date: null, dateDisplay: null })).toBe(
      'Build 0123abc'
    );
  });
});
