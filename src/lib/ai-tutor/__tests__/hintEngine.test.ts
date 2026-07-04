import { describe, it, expect } from 'vitest';
import { getSmartHint } from '../hintEngine';

describe('Smart Hint Engine', () => {
  it('should detect typo in command', () => {
    const hint = getSmartHint('mkdirr', { missionId: 'linux-basics-1', errors: [] });
    expect(hint).toContain('mkdir');
  });

  it('should provide syntax help for incomplete command', () => {
    const hint = getSmartHint('mkdir', { missionId: 'linux-basics-1', errors: [] });
    expect(hint).toContain('Syntax');
  });

  it('should provide context-aware hint', () => {
    const hint = getSmartHint('ls', {
      missionId: 'linux-basics-1',
      missionStep: { title: 'Verzeichnis erstellen', description: '' },
      errors: [],
    });
    expect(hint).toContain('erstellen');
  });

  it('should return null if no hint available', () => {
    const hint = getSmartHint('xyz123', { missionId: 'unknown', errors: [] });
    expect(hint).toBeNull();
  });
});
