import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { parseJsonBody, parseWithSchema } from '../parseRequest';

const schema = z.object({ title: z.string().min(1, 'title ist erforderlich.') });

function makeRequest(body: unknown): Request {
  return new Request('https://alexle135.de/api/admin/example', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('parseJsonBody', () => {
  it('returns the parsed data on a valid body', async () => {
    const result = await parseJsonBody(makeRequest({ title: 'Hallo' }), schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ title: 'Hallo' });
  });

  it('returns a 400 response with the schema message on an invalid body', async () => {
    const result = await parseJsonBody(makeRequest({ title: '' }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toEqual({ error: 'title ist erforderlich.' });
    }
  });

  it('returns a 400 with a dedicated message on unparseable JSON', async () => {
    const badRequest = new Request('https://alexle135.de/api/admin/example', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const result = await parseJsonBody(badRequest, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toEqual({ error: 'Ungültiges JSON-Format.' });
    }
  });

  it('returns a 400 with a dedicated message on an empty body', async () => {
    const emptyRequest = new Request('https://alexle135.de/api/admin/example', {
      method: 'POST',
    });
    const result = await parseJsonBody(emptyRequest, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toEqual({ error: 'Ungültiges JSON-Format.' });
    }
  });
});

describe('parseWithSchema', () => {
  it('validates a single value against a schema', () => {
    const result = parseWithSchema('Hallo', z.string().min(1));
    expect(result.ok).toBe(true);
  });

  it('returns a 400 response for an invalid value', () => {
    const result = parseWithSchema(null, z.string().min(1, 'ungueltig.'));
    expect(result.ok).toBe(false);
  });
});
