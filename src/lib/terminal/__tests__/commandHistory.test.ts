import { describe, it, expect, beforeEach } from 'vitest';
import { CommandHistory } from '../commandHistory';

describe('CommandHistory', () => {
  let history: CommandHistory;

  beforeEach(() => {
    history = new CommandHistory();
  });

  it('should add command to history', () => {
    history.add('ls');
    expect(history.getAll()).toEqual(['ls']);
  });

  it('should not add duplicate consecutive commands', () => {
    history.add('ls');
    history.add('ls');
    expect(history.getAll()).toEqual(['ls']);
  });

  it('should not add empty commands', () => {
    history.add('');
    history.add('  ');
    expect(history.getAll()).toEqual([]);
  });

  it('should navigate to previous command', () => {
    history.add('ls');
    history.add('pwd');
    const prev = history.previous('');
    expect(prev).toBe('pwd');
  });

  it('should navigate through history', () => {
    history.add('ls');
    history.add('pwd');
    history.add('cd /');

    expect(history.previous('')).toBe('cd /');
    expect(history.previous('')).toBe('pwd');
    expect(history.previous('')).toBe('ls');
    expect(history.next()).toBe('pwd');
  });

  it('should preserve current input when navigating', () => {
    history.add('ls');
    const prev = history.previous('current input');
    expect(prev).toBe('ls');
    history.next();
    expect(history.next()).toBe('current input');
  });
});
