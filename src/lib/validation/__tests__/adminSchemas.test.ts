import { describe, expect, it } from 'vitest';
import {
  contactMessageStatusSchema,
  optionalUrlSchema,
  patchMessageSchema,
  postCreateSchema,
  postUpdateSchema,
  projectCreateSchema,
  projectStatusSchema,
  projectUpdateSchema,
  slugSchema,
  uuidSchema,
} from '../adminSchemas';

const VALID_UUID = '66af4f34-b7f1-41d7-83d1-21fecb9c52e9';

describe('uuidSchema', () => {
  it('accepts a valid uuid', () => {
    expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true);
  });

  it.each(['not-a-uuid', '', '123', 'post-1', VALID_UUID.slice(0, -1)])(
    'rejects invalid uuid %s',
    (value) => {
      expect(uuidSchema.safeParse(value).success).toBe(false);
    }
  );

  it('rejects non-string values', () => {
    expect(uuidSchema.safeParse(123).success).toBe(false);
    expect(uuidSchema.safeParse(undefined).success).toBe(false);
    expect(uuidSchema.safeParse(null).success).toBe(false);
  });

  it('reports the German message when the id is missing or malformed', () => {
    for (const value of [undefined, null, 42, 'not-a-uuid']) {
      const result = uuidSchema.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe('Ungültige ID.');
    }
  });
});

describe('slugSchema', () => {
  it.each(['test-post', 'projekt', 'a1-b2-c3', 'x'])('accepts valid slug %s', (value) => {
    expect(slugSchema.safeParse(value).success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = slugSchema.safeParse('  test-post  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('test-post');
  });

  it.each([
    '',
    ' ',
    'Test-Post',
    'test_post',
    'test post',
    '-test',
    'test-',
    'test--post',
    'ä-umlaut',
  ])('rejects invalid slug %s', (value) => {
    expect(slugSchema.safeParse(value).success).toBe(false);
  });

  it('rejects slugs longer than 200 characters', () => {
    const long = 'a'.repeat(201);
    expect(slugSchema.safeParse(long).success).toBe(false);
  });

  it('accepts a slug at exactly 200 characters', () => {
    const max = 'a'.repeat(200);
    expect(slugSchema.safeParse(max).success).toBe(true);
  });

  it('reports the German message when the slug is missing or not a string', () => {
    for (const value of [undefined, null, 42]) {
      const result = slugSchema.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe('slug ist erforderlich.');
    }
  });
});

describe('optionalUrlSchema', () => {
  it('accepts undefined and null', () => {
    expect(optionalUrlSchema.safeParse(undefined).success).toBe(true);
    expect(optionalUrlSchema.safeParse(null).success).toBe(true);
  });

  it('accepts a valid absolute url', () => {
    expect(optionalUrlSchema.safeParse('https://example.com/project').success).toBe(true);
  });

  it.each(['not-a-url', 'no-scheme-at-all', '   ', 'test post'])(
    'rejects malformed url %s',
    (value) => {
      expect(optionalUrlSchema.safeParse(value).success).toBe(false);
    }
  );

  it('normalizes an empty string to null (field reset)', () => {
    const result = optionalUrlSchema.safeParse('');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });
});

describe('contactMessageStatusSchema', () => {
  it.each(['open', 'answered', 'spam', 'follow_up'])('accepts %s', (value) => {
    expect(contactMessageStatusSchema.safeParse(value).success).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(contactMessageStatusSchema.safeParse('done-ish').success).toBe(false);
  });
});

describe('projectStatusSchema', () => {
  it.each(['planning', 'in-progress', 'completed', 'archived'])('accepts %s', (value) => {
    expect(projectStatusSchema.safeParse(value).success).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(projectStatusSchema.safeParse('invalid').success).toBe(false);
  });
});

describe('postCreateSchema', () => {
  const validPost = {
    title: 'Test Post',
    slug: 'test-post',
    summary: 'Eine kurze Zusammenfassung',
    content: '# Inhalt',
    published: false,
    tags: ['vitest', 'integration'],
  };

  it('accepts a fully valid payload', () => {
    expect(postCreateSchema.safeParse(validPost).success).toBe(true);
  });

  it('requires title and slug', () => {
    expect(postCreateSchema.safeParse({ slug: 'missing-title' }).success).toBe(false);
    expect(postCreateSchema.safeParse({ title: 'Missing slug' }).success).toBe(false);
  });

  it('reports German messages for missing title and slug', () => {
    const noTitle = postCreateSchema.safeParse({ slug: 'missing-title' });
    expect(noTitle.success).toBe(false);
    if (!noTitle.success) {
      expect(noTitle.error.issues[0]?.message).toBe('title ist erforderlich.');
    }

    const noSlug = postCreateSchema.safeParse({ title: 'Missing slug' });
    expect(noSlug.success).toBe(false);
    if (!noSlug.success) {
      expect(noSlug.error.issues[0]?.message).toBe('slug ist erforderlich.');
    }
  });

  it('rejects a title over 300 characters', () => {
    expect(postCreateSchema.safeParse({ ...validPost, title: 'a'.repeat(301) }).success).toBe(
      false
    );
  });

  it('rejects more than 30 tags', () => {
    const tooManyTags = Array.from({ length: 31 }, (_, i) => `tag-${i}`);
    expect(postCreateSchema.safeParse({ ...validPost, tags: tooManyTags }).success).toBe(false);
  });

  it('rejects non-string tag entries', () => {
    expect(postCreateSchema.safeParse({ ...validPost, tags: ['ok', 42] }).success).toBe(false);
  });
});

describe('postUpdateSchema', () => {
  it('requires a valid uuid id', () => {
    expect(postUpdateSchema.safeParse({ id: VALID_UUID, title: 'Updated' }).success).toBe(true);
    expect(postUpdateSchema.safeParse({ id: 'post-1', title: 'Updated' }).success).toBe(false);
  });

  it('allows partial payloads besides id', () => {
    expect(postUpdateSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });
});

describe('projectCreateSchema', () => {
  const validProject = {
    title: 'Projekt',
    slug: 'projekt',
    summary: 'Kurz',
    description: 'Lang',
    status: 'planning',
    demo_url: null,
    repo_url: 'https://github.com/example/project',
    featured: true,
  };

  it('accepts a fully valid payload', () => {
    expect(projectCreateSchema.safeParse(validProject).success).toBe(true);
  });

  it('rejects an invalid status', () => {
    expect(projectCreateSchema.safeParse({ ...validProject, status: 'invalid' }).success).toBe(
      false
    );
  });

  it('rejects a malformed demo_url', () => {
    expect(projectCreateSchema.safeParse({ ...validProject, demo_url: 'not-a-url' }).success).toBe(
      false
    );
  });

  it('reports German messages for missing title and slug', () => {
    const noTitle = projectCreateSchema.safeParse({ slug: 'projekt' });
    expect(noTitle.success).toBe(false);
    if (!noTitle.success) {
      expect(noTitle.error.issues[0]?.message).toBe('title ist erforderlich.');
    }

    const noSlug = projectCreateSchema.safeParse({ title: 'Projekt' });
    expect(noSlug.success).toBe(false);
    if (!noSlug.success) {
      expect(noSlug.error.issues[0]?.message).toBe('slug ist erforderlich.');
    }
  });

  it('normalizes an empty demo_url string to null', () => {
    const result = projectCreateSchema.safeParse({ ...validProject, demo_url: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.demo_url).toBeNull();
  });
});

describe('projectUpdateSchema', () => {
  it('requires a valid uuid id', () => {
    expect(projectUpdateSchema.safeParse({ id: VALID_UUID, featured: false }).success).toBe(true);
    expect(projectUpdateSchema.safeParse({ id: 'project-1', featured: false }).success).toBe(false);
  });
});

describe('patchMessageSchema', () => {
  it('accepts an id with an optional status', () => {
    expect(patchMessageSchema.safeParse({ id: VALID_UUID, status: 'spam' }).success).toBe(true);
  });

  it('accepts an id with an optional handled flag, defaulting handled elsewhere', () => {
    expect(patchMessageSchema.safeParse({ id: VALID_UUID, handled: false }).success).toBe(true);
    expect(patchMessageSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it('rejects an invalid status', () => {
    expect(patchMessageSchema.safeParse({ id: VALID_UUID, status: 'done-ish' }).success).toBe(
      false
    );
  });

  it('requires an id', () => {
    expect(patchMessageSchema.safeParse({ handled: true }).success).toBe(false);
  });
});
