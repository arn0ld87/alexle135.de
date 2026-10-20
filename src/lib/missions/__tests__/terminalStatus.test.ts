import { describe, expect, it } from 'vitest';
import {
  episodenStatusText,
  terminalBeschaeftigt,
  terminalStatusText,
  type EpisodenStatusEingabe,
  type TerminalPhase,
} from '../terminalStatus';

describe('terminalStatusText', () => {
  it('nennt Laden mit und ohne Fortschritt, Start und Bereitschaft', () => {
    expect(terminalStatusText({ kind: 'laden', percent: null })).toBe('Linux wird geladen …');
    expect(terminalStatusText({ kind: 'laden', percent: 45 })).toBe('Linux wird geladen … 45 %');
    expect(terminalStatusText({ kind: 'start' })).toBe('Linux startet …');
    expect(terminalStatusText({ kind: 'bereit' })).toBe('echtes Linux · Alpine · ohne Netzwerk');
  });

  it('nennt im Fehlerfall Ursache und Wiederholungsaktion, genau einmal', () => {
    const text = terminalStatusText({ kind: 'fehler', message: 'Linux antwortet nicht' });
    expect(text).toBe('Fehler: Linux antwortet nicht. Mit „Neu starten“ noch einmal versuchen.');
  });

  it('doppelt den Schlusspunkt einer Fehlermeldung nicht', () => {
    const text = terminalStatusText({ kind: 'fehler', message: 'Kein WebAssembly.' });
    expect(text).toBe('Fehler: Kein WebAssembly. Mit „Neu starten“ noch einmal versuchen.');
  });
});

describe('terminalBeschaeftigt', () => {
  it('sperrt „Neu starten“ nur beim Laden und Starten, nicht im Fehlerfall', () => {
    const phasen: Array<[TerminalPhase, boolean]> = [
      [{ kind: 'laden', percent: null }, true],
      [{ kind: 'start' }, true],
      [{ kind: 'bereit' }, false],
      [{ kind: 'fehler', message: 'x' }, false],
    ];
    for (const [phase, erwartet] of phasen) {
      expect(terminalBeschaeftigt(phase), phase.kind).toBe(erwartet);
    }
  });
});

describe('episodenStatusText', () => {
  const ohneEpisode: EpisodenStatusEingabe = {
    startFehler: null,
    terminalFehler: false,
    vorfallNr: null,
    snapshot: null,
    schrittTitel: null,
  };
  const gewaehlt: EpisodenStatusEingabe = { ...ohneEpisode, vorfallNr: 0 };
  const imSchritt: EpisodenStatusEingabe = {
    ...gewaehlt,
    snapshot: { stepIndex: 0, stepCount: 3, finishedAt: null, withSolution: false },
    schrittTitel: 'Ordner anlegen',
  };

  it('zeigt ohne gewählte Episode nichts', () => {
    expect(episodenStatusText(ohneEpisode)).toBeNull();
  });

  it('meldet die Vorbereitung, solange die Episode nicht aufgesetzt ist', () => {
    expect(episodenStatusText(gewaehlt)).toBe('Episode wird vorbereitet …');
  });

  it('ersetzt die Vorbereitungsmeldung, sobald das Terminal im Fehler steht', () => {
    const text = episodenStatusText({ ...gewaehlt, terminalFehler: true });
    expect(text).toBeNull();
  });

  it('meldet nach einem Neustart des Terminals wieder die Vorbereitung', () => {
    const imFehler = episodenStatusText({ ...gewaehlt, terminalFehler: true });
    const nachNeustart = episodenStatusText({ ...gewaehlt, terminalFehler: false });
    expect(imFehler).toBeNull();
    expect(nachNeustart).toBe('Episode wird vorbereitet …');
  });

  it('lässt den Startfehler der Episode auch bei einem Terminalfehler stehen', () => {
    const text = episodenStatusText({
      ...gewaehlt,
      startFehler: 'Agent-Timeout',
      terminalFehler: true,
    });
    expect(text).toBe('Episode ließ sich nicht starten: Agent-Timeout');
  });

  it('zeigt den Schritt, nach dem Lösen die Gesamtmeldung', () => {
    expect(episodenStatusText(imSchritt)).toBe('Schritt 1/3: Ordner anlegen');
    const fertig = {
      ...imSchritt,
      snapshot: { stepIndex: 2, stepCount: 3, finishedAt: 5, withSolution: false },
    };
    expect(episodenStatusText(fertig)).toBe('Episode 0 gelöst');
    const mitLoesung = {
      ...fertig,
      snapshot: { stepIndex: 2, stepCount: 3, finishedAt: 5, withSolution: true },
    };
    expect(episodenStatusText(mitLoesung)).toBe('Episode 0 gelöst · mit Lösung');
  });
});
