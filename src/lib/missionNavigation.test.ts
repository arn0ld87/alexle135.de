import { describe, expect, it } from 'vitest';
import { installMissionNavigationGuard, needsFullNavigation } from './missionNavigation';

const url = (path: string, origin = 'https://alex-schneider.dev') => new URL(path, origin);
const APP = '/projekte/terminal-missionen/app/';
const WIN_APP = '/projekte/windows-terminal-missionen/app';

describe('needsFullNavigation', () => {
  it('erzwingt den vollen Aufruf beim Betreten einer Missions-Route', () => {
    expect(needsFullNavigation(url('/projekte/terminal-missionen/'), url(APP))).toBe(true);
    expect(needsFullNavigation(url('/'), url(WIN_APP))).toBe(true);
  });

  it('erzwingt den vollen Aufruf beim Verlassen einer Missions-Route', () => {
    expect(needsFullNavigation(url(APP), url('/projekte/'))).toBe(true);
  });

  it('erzwingt ihn auch zwischen zwei Missions-Routen', () => {
    expect(needsFullNavigation(url(APP), url(WIN_APP))).toBe(true);
  });

  it('lässt normale Seitenwechsel beim ClientRouter', () => {
    expect(needsFullNavigation(url('/'), url('/blog/'))).toBe(false);
    expect(needsFullNavigation(url('/projekte/terminal-missionen/'), url('/projekte/'))).toBe(
      false
    );
  });

  it('ignoriert Wechsel auf derselben Seite und fremde Origins', () => {
    expect(needsFullNavigation(url(APP), url(`${APP}?x=1#a`))).toBe(false);
    expect(needsFullNavigation(url('/'), url(APP, 'https://example.org'))).toBe(false);
  });
});

describe('installMissionNavigationGuard', () => {
  const dispatch = (from: string, to: string) => {
    const event = new Event('astro:before-preparation', { cancelable: true });
    Object.assign(event, { from: url(from), to: url(to) });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('bricht die client-seitige Vorbereitung nur für Missions-Wechsel ab', () => {
    installMissionNavigationGuard(document);
    expect(dispatch('/projekte/terminal-missionen/', APP)).toBe(true);
    expect(dispatch('/', '/blog/')).toBe(false);
  });
});
