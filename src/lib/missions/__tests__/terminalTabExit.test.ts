import { describe, expect, it } from 'vitest';
import { createTabExitHandler } from '../terminalTabExit';

const key = (k: string, init: KeyboardEventInit = {}, type = 'keydown') =>
  new KeyboardEvent(type, { key: k, ...init });

describe('createTabExitHandler', () => {
  it('lässt Tab ohne vorheriges Esc der Shell', () => {
    const handler = createTabExitHandler();
    expect(handler(key('Tab'))).toBe(true);
  });

  it('gibt Tab nach Esc dem Browser, damit der Fokus das Terminal verlässt', () => {
    const handler = createTabExitHandler();
    expect(handler(key('Escape'))).toBe(true);
    expect(handler(key('Tab'))).toBe(false);
  });

  it('verbraucht das Vormerken: der nächste Tab geht wieder an die Shell', () => {
    const handler = createTabExitHandler();
    handler(key('Escape'));
    handler(key('Tab'));
    expect(handler(key('Tab'))).toBe(true);
  });

  it('hebt das Vormerken bei einer anderen Taste dazwischen auf', () => {
    const handler = createTabExitHandler();
    handler(key('Escape'));
    handler(key('a'));
    expect(handler(key('Tab'))).toBe(true);
  });

  it('ignoriert reine Modifikatortasten und keyup', () => {
    const handler = createTabExitHandler();
    handler(key('Escape'));
    handler(key('Shift'));
    handler(key('Escape', {}, 'keyup'));
    expect(handler(key('Tab'))).toBe(false);
  });

  it('lässt Shift+Tab unberührt', () => {
    const handler = createTabExitHandler();
    handler(key('Escape'));
    expect(handler(key('Tab', { shiftKey: true }))).toBe(true);
  });
});
