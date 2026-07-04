export const meta = {
  name: 'alexle-vsco-open-posten-analysis',
  description:
    'Analyze open cleanup items: media dup-audit, projekte legacy refs, tools/indexer relocation, favicon-original deletion',
  phases: [{ title: 'Analyze' }],
};

const REPO =
  typeof args !== 'undefined' && args && typeof args.repo === 'string'
    ? args.repo
    : '/Volumes/T7/Projekte/alexle-vsco';

const MEDIA_SCHEMA = {
  type: 'object',
  properties: {
    rootCount: { type: 'integer' },
    publicCount: { type: 'integer' },
    referencedPaths: {
      type: 'array',
      items: { type: 'string' },
      description: '/media/... paths referenced in src/content or src/pages',
    },
    missingInPublic: {
      type: 'array',
      items: { type: 'string' },
      description:
        'referenced paths that exist in root media/ but NOT in public/media/ — must copy before deleting root',
    },
    duplicates: {
      type: 'array',
      items: { type: 'string' },
      description: 'files identical (same name) in both root media/ and public/media/',
    },
    copyList: {
      type: 'array',
      items: { type: 'string' },
      description: 'root media/ files to copy into public/media/',
    },
    deleteList: {
      type: 'array',
      items: { type: 'string' },
      description: 'root media/ files safe to delete after copy',
    },
    notes: { type: 'string' },
  },
  required: [
    'rootCount',
    'publicCount',
    'referencedPaths',
    'missingInPublic',
    'copyList',
    'deleteList',
    'notes',
  ],
};

const PROJEKTE_SCHEMA = {
  type: 'object',
  properties: {
    rootContent: {
      type: 'array',
      items: { type: 'string' },
      description: 'top-level entries in root projekte/',
    },
    filesystemRefs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          snippet: { type: 'string' },
        },
        required: ['file', 'snippet'],
      },
      description:
        'refs to root projekte/ by filesystem path (EXCLUDE src/pages/projekte/ routes and src/content/projects)',
    },
    datepullRefs: { type: 'array', items: { type: 'string' } },
    archivePlan: { type: 'string' },
    safeToDelete: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['rootContent', 'filesystemRefs', 'archivePlan', 'safeToDelete', 'notes'],
};

const TOOLS_SCHEMA = {
  type: 'object',
  properties: {
    indexerContent: { type: 'array', items: { type: 'string' } },
    refsFound: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          snippet: { type: 'string' },
        },
        required: ['file', 'snippet'],
      },
      description:
        'refs to tools/ in src, package.json, Dockerfile, CI, astro.config (EXCLUDE .gitignore)',
    },
    relocationPlan: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['indexerContent', 'refsFound', 'relocationPlan', 'notes'],
};

const FAVICON_SCHEMA = {
  type: 'object',
  properties: {
    refsFound: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          snippet: { type: 'string' },
        },
        required: ['file', 'snippet'],
      },
    },
    safeToDelete: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['refsFound', 'safeToDelete', 'notes'],
};

phase('Analyze');

const mediaPrompt = [
  'Duplikat-Audit for ' + REPO + ': root media/ (154 files) vs public/media/ (63 files).',
  'Use mcp__plugin_context-mode_context-mode__ctx_execute with language shell.',
  'Step 1: ls -1 media/ | wc -l and ls -1 public/media/ | wc -l (count files, recurse if subdirs).',
  'Step 2: find all /media/... paths referenced in src/content and src/pages:',
  "git grep -hoE '/media/[A-Za-z0-9._/-]+' -- 'src/content/**' 'src/pages/**' | sort -u",
  'Step 3: for each referenced path, check if the file exists in public/media (publicDir) vs only in root media/.',
  'Step 4: list files that exist in BOTH (duplicates by name) and files only in root media/.',
  'Output: referencedPaths, missingInPublic (referenced but only in root media — MUST copy to public/media before deleting root), copyList, deleteList.',
  'CRITICAL: do not recommend deleting any root media file that is referenced and missing from public/media without first copying it. Broken-image risk.',
].join(' ');

const projektePrompt = [
  'Analyze root projekte/ in ' + REPO + ' for archival + deletion.',
  'Use mcp__plugin_context-mode_context-mode__ctx_execute with language shell.',
  'Step 1: ls -la projekte/ and git ls-files projekte/ | head -50 to see content.',
  'Step 2: find filesystem refs to root projekte/ (EXCLUDE the active Astro routes src/pages/projekte/ and content src/content/projects):',
  "git grep -nE '(^|[^/])projekte/' -- 'src/**' 'docs/**' 'Dockerfile' 'docker-compose*.yml' '.github/**' 'astro.config.mjs' 'package.json' | grep -vE 'src/pages/projekte|src/content/projects'",
  'Step 3: check datepull/datepull-api refs: git grep -nE "datepull" .',
  'Determine: archivePlan (move to docs/projekte-legacy/ or note external archive), safeToDelete (true only if no filesystem refs to root projekte/ remain).',
  'Note: Astro serves projekte via src/pages/projekte/ + src/content/projects, NOT root projekte/. Confirm.',
].join(' ');

const toolsPrompt = [
  'Analyze tools/indexer/ in ' + REPO + ' for relocation.',
  'Use mcp__plugin_context-mode_context-mode__ctx_execute with language shell.',
  'Step 1: git ls-files tools/ | head -40 and ls -la tools/indexer/ to see content.',
  'Step 2: find refs to tools/ (EXCLUDE .gitignore):',
  "git grep -nE 'tools/' -- 'src/**' 'package.json' 'Dockerfile' 'docker-compose*.yml' '.github/**' 'astro.config.mjs' | grep -v '.gitignore'",
  'Step 3: check if tools/indexer has its own package/reqs (requirements.txt) — it is Python, unrelated to the Astro pnpm stack.',
  'Output: indexerContent, refsFound, relocationPlan (move to scripts/indexer/ via git mv, or recommend separate repo).',
].join(' ');

const faviconPrompt = [
  'Confirm public/favicon-original.{ico,png,webp} in ' +
    REPO +
    ' are unreferenced and safe to delete.',
  'Use mcp__plugin_context-mode_context-mode__ctx_execute with language shell.',
  "git grep -nE 'favicon-original' -- 'src/**' 'public/**/*.html' 'docs/**' 'astro.config.mjs'",
  'Also check the V2Layout icon refs to confirm they point at /icons/favicon-* (not favicon-original):',
  "git grep -nE 'favicon' -- 'src/layouts/**' 'src/components/**'",
  'Output refsFound (should be empty) and safeToDelete.',
].join(' ');

const [media, projekte, tools, favicon] = await parallel([
  () => agent(mediaPrompt, { label: 'media-dup-audit', phase: 'Analyze', schema: MEDIA_SCHEMA }),
  () =>
    agent(projektePrompt, {
      label: 'projekte-ref-check',
      phase: 'Analyze',
      schema: PROJEKTE_SCHEMA,
    }),
  () => agent(toolsPrompt, { label: 'tools-indexer-plan', phase: 'Analyze', schema: TOOLS_SCHEMA }),
  () =>
    agent(faviconPrompt, { label: 'favicon-confirm', phase: 'Analyze', schema: FAVICON_SCHEMA }),
]);

return { media: media, projekte: projekte, tools: tools, favicon: favicon };
