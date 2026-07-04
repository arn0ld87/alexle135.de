import { describe, it, expect } from 'vitest';
import { getCompletions, completeCommand } from '../tabCompletion';

describe('Tab Completion', () => {
  const commands = ['ls', 'cd', 'mkdir', 'cat', 'clear'];

  it('should suggest commands based on prefix', () => {
    const completions = getCompletions('ls', commands);
    expect(completions).toEqual(['ls']);
  });

  it('should suggest multiple commands for partial match', () => {
    const completions = getCompletions('c', commands);
    expect(completions).toEqual(['cat', 'cd', 'clear']);
  });

  it('should return empty array for no matches', () => {
    const completions = getCompletions('xyz', commands);
    expect(completions).toEqual([]);
  });

  it('should complete unique command', () => {
    const result = completeCommand('mkd', commands);
    expect(result).toBe('mkdir');
  });

  it('should return longest common prefix for multiple matches', () => {
    const result = completeCommand('c', commands);
    expect(result).toBe('c'); // No common prefix beyond 'c'
  });

  it('should complete path-like inputs', () => {
    const paths = ['/home/user/documents', '/home/user/downloads'];
    const result = completeCommand('/home/user/d', paths);
    expect(result).toBe('/home/user/do'); // Common prefix
  });
});
