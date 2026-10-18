import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentClient } from '../agentClient';
import { encodeBase64 } from '../agentProtocol';

describe('AgentClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ordnet Antworten per ID zu, auch außer der Reihe', async () => {
    const sent: string[] = [];
    const client = new AgentClient((line) => sent.push(line));
    const first = client.run('echo eins');
    const second = client.run('echo zwei');
    expect(sent).toEqual([
      `RUN m1 ${encodeBase64('echo eins')}\n`,
      `RUN m2 ${encodeBase64('echo zwei')}\n`,
    ]);

    client.feed(`RES m2 1 ${encodeBase64('zwei')}\n`);
    client.feed(`RES m1 0 ${encodeBase64('eins')}\n`);

    await expect(first).resolves.toEqual({ exitCode: 0, output: 'eins' });
    await expect(second).resolves.toEqual({ exitCode: 1, output: 'zwei' });
  });

  it('lehnt bei ERR des Agenten ab', async () => {
    const client = new AgentClient(() => {});
    const result = client.run('true');
    client.feed('ERR m1 bad-base64\n');
    await expect(result).rejects.toThrow('bad-base64');
  });

  it('lehnt nach Timeout ab und ignoriert die späte Antwort', async () => {
    const client = new AgentClient(() => {});
    const result = client.run('sleep 99', 1000);
    const assertion = expect(result).rejects.toThrow('Timeout');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(() => client.feed('RES m1 0 -\n')).not.toThrow();
  });

  it('ignoriert unbekannte IDs und HELLO', () => {
    const client = new AgentClient(() => {});
    expect(() => client.feed('HELLO 1\nRES zz 0 -\nERR - bad-id\n')).not.toThrow();
  });

  it('waitReady wiederholt PING bis zur ersten Antwort', async () => {
    const sent: string[] = [];
    const client = new AgentClient((line) => sent.push(line));
    const ready = client.waitReady({ intervalMs: 100, attempts: 5 });

    await vi.advanceTimersByTimeAsync(250);
    expect(sent).toEqual(['PING m1\n', 'PING m2\n', 'PING m3\n']);

    client.feed('RES m3 0 -\n');
    await expect(ready).resolves.toBeUndefined();
  });

  it('waitReady gibt nach allen Versuchen auf', async () => {
    const client = new AgentClient(() => {});
    const ready = client.waitReady({ intervalMs: 100, attempts: 2 });
    const assertion = expect(ready).rejects.toThrow('antwortet nicht');
    await vi.advanceTimersByTimeAsync(300);
    await assertion;
  });
});
