export const meta = {
  name: 'dependabot-remediation-safe',
  description:
    'Patch root + datepull-api security advisories as isolated PRs, dual-lockfile sync, adversarially verified',
  phases: [
    {
      title: 'Patch',
      detail: 'Per-task: bump deps, regen lockfile(s), gate, push, open PR (worktree-isolated)',
    },
    {
      title: 'Verify',
      detail: 'Adversarial diff review per PR: no forbidden files, no major bumps',
    },
  ],
};

const REPO = 'arn0ld87/alexle-vsco';
const DATE = '20260613';

const PATCH_SCHEMA = {
  type: 'object',
  required: [
    'task',
    'branch',
    'prUrl',
    'prNumber',
    'patched',
    'deferred',
    'gates',
    'filesChanged',
    'notes',
  ],
  properties: {
    task: { type: 'string' },
    branch: { type: 'string' },
    prUrl: { type: 'string' },
    prNumber: { type: ['integer', 'string'] },
    patched: { type: 'array', items: { type: 'string' } },
    deferred: { type: 'array', items: { type: 'string' } },
    gates: {
      type: 'object',
      properties: {
        install: { type: 'string' },
        test: { type: 'string' },
        lint: { type: 'string' },
        build: { type: 'string' },
      },
    },
    filesChanged: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
};

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['ok', 'forbiddenFilesTouched', 'majorBumps', 'issues', 'recommendation'],
  properties: {
    ok: { type: 'boolean' },
    forbiddenFilesTouched: { type: 'array', items: { type: 'string' } },
    majorBumps: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string' },
  },
};

const TASKS = [
  {
    key: 'root-sec',
    model: 'sonnet',
    label: 'patch:root-security',
    branch: `fix/deps-root-transitive-sec-${DATE}`,
    prompt: `You are a release-engineering subagent in an ISOLATED git worktree of the repo ${REPO}. The worktree is yours; NEVER touch the main checkout at /Volumes/T7/projects/alexle-vsco (it has another agent's uncommitted changes). Produce ONE pull request that patches security advisories in the ROOT Astro project, regenerating BOTH lockfiles in sync.

CONTEXT: Root has dual lockfiles. Dockerfile builds PROD with \`npm install\` + package-lock.json. CI uses \`pnpm install --frozen-lockfile\` + pnpm-lock.yaml. BOTH must be regenerated and committed.

STEPS:
1. git fetch origin main && git switch -c ${`fix/deps-root-transitive-sec-${DATE}`} origin/main
2. In package.json bump the ONE direct devDependency: vitest "^4.0.14" -> "^4.1.0" (critical). Change NOTHING else. NO major bumps.
3. Regenerate npm lockfile: \`npm install --no-audit --no-fund\`, then \`npm update fast-xml-parser fast-xml-builder minimatch picomatch flatted defu devalue h3 rollup svgo vite\`, then \`npm install --no-audit --no-fund\` to finalize package-lock.json.
4. Regenerate pnpm lockfile: \`rm -rf node_modules\`, then \`pnpm install\`, then \`pnpm update fast-xml-parser fast-xml-builder minimatch picomatch flatted defu devalue h3 rollup svgo vite\`, then \`pnpm install\` to finalize pnpm-lock.yaml.
5. esbuild >=0.28.1 and vite 7.x need a MAJOR sweep — OUT OF SCOPE. Do NOT force them. If a package cannot leave its vulnerable range without a major, record it in \`deferred\` with the reason.
6. Quality gates (pnpm, to match CI): run \`pnpm run test:run\`, then \`pnpm run lint\`. Then attempt \`pnpm run build\`. NOTE: build inlines PUBLIC_SUPABASE_* envs; if build fails ONLY because those env vars are missing, set gates.build = "skipped-missing-env" (NOT a failure). Any other failure: fix it or report honestly in notes.
7. Confirm fixes landed: for vitest, fast-xml-parser, minimatch, picomatch, flatted, defu, devalue, h3, rollup, svgo run \`npm ls <pkg>\` (and/or grep both lockfiles) and verify resolved version >= the patched version. Put confirmed in \`patched\`, still-vulnerable in \`deferred\`.
8. Stage ONLY: package.json, package-lock.json, pnpm-lock.yaml. FORBIDDEN to modify or stage: src/middleware.ts, astro.config.mjs, anything CSP/COEP/COOP, src/pages/api/contact.ts, Dockerfile.
9. Commit (conventional; NEVER use --no-verify / --force / --no-gpg-sign):
   "fix(deps): patch transitive + vitest security advisories (root)

   Regenerates package-lock.json and pnpm-lock.yaml in sync. Supersedes #100, #101.

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
10. git push -u origin <branch>. Then: gh pr create --repo ${REPO} --base main --head <branch> --label dependencies --title "fix(deps): root transitive security patches" --body "<list patched + deferred; note: supersedes #100, #101; both lockfiles regenerated in sync>".
11. Return the structured result (prNumber as integer from the created PR URL).

If a step hard-fails unrecoverably, still return with gates/notes reflecting reality. Do NOT bypass hooks or force anything.`,
  },
  {
    key: 'datepull',
    model: 'sonnet',
    label: 'patch:datepull-api',
    branch: `fix/deps-datepull-sec-${DATE}`,
    prompt: `You are a release-engineering subagent in an ISOLATED git worktree of ${REPO}. NEVER touch the main checkout at /Volumes/T7/projects/alexle-vsco. Produce ONE PR patching security advisories in the standalone Express API at projekte/datepull-api (its OWN npm package-lock.json; it is NOT part of root CI or the deploy).

STEPS:
1. git fetch origin main && git switch -c ${`fix/deps-datepull-sec-${DATE}`} origin/main
2. cd projekte/datepull-api. In its package.json bump multer "^2.0.2" -> "^2.1.1" (fixes multer DoS and pulls patched transitive path-to-regexp / body-parser / qs). NO other range changes, NO majors.
3. \`npm install --no-audit --no-fund\` to regenerate projekte/datepull-api/package-lock.json. Required transitive outcomes: path-to-regexp >= 8.4.0, body-parser patched, qs patched, and jws (under jsonwebtoken) >= 3.2.3 — if jws is still < 3.2.3 run \`npm update jws\` (keep jsonwebtoken as-is).
4. Gate: \`npm test\` (runs \`node --test\`). Report pass/fail honestly.
5. Verify: \`npm ls path-to-regexp multer jws qs body-parser\` — confirm patched versions. Run \`npm audit --omit=dev\` and capture remaining high/critical count.
6. Stage ONLY projekte/datepull-api/package.json and projekte/datepull-api/package-lock.json. Commit (no --no-verify/--force/--no-gpg-sign):
   "fix(deps): patch datepull-api security advisories

   multer ^2.1.1 + regenerated lockfile (path-to-regexp, body-parser, qs, jws).

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
7. git push -u origin <branch>; gh pr create --repo ${REPO} --base main --head <branch> --label dependencies --title "fix(deps): datepull-api security patches" --body "<patched list + audit result>". Return structured result.`,
  },
  {
    key: 'dependabot-cfg',
    model: 'haiku',
    label: 'config:dependabot-group',
    branch: `chore/dependabot-transitive-group-${DATE}`,
    prompt: `You are a subagent in an ISOLATED git worktree of ${REPO}. NEVER touch the main checkout at /Volumes/T7/projects/alexle-vsco. Produce ONE config-only PR. Edit ONLY .github/dependabot.yml.

STEPS:
1. git fetch origin main && git switch -c ${`chore/dependabot-transitive-group-${DATE}`} origin/main
2. Open .github/dependabot.yml. Find the FIRST \`package-ecosystem: "npm"\` block (the one whose directories are "/" and "/projekte/datepull-api"). Under its existing \`groups:\` map (where you see groups like \`astro-stack:\` indented by 6 spaces), ADD this new group with IDENTICAL indentation, immediately after the last existing group in that block:

      transitive-security:
        applies-to: "version-updates"
        patterns:
          - "minimatch"
          - "fast-xml-parser"
          - "fast-xml-builder"
          - "picomatch"
          - "devalue"
          - "flatted"
          - "brace-expansion"
          - "smol-toml"
          - "yaml"
          - "defu"
          - "svgo"
          - "h3"
          - "rollup"
        update-types:
          - "minor"
          - "patch"

   Do NOT modify any other group, block, or line.
3. Validate: \`python3 -c "import yaml; yaml.safe_load(open('.github/dependabot.yml')); print('YAML OK')"\` — must print "YAML OK". If it errors, fix indentation until it parses.
4. Stage ONLY .github/dependabot.yml. Commit "chore(dependabot): add transitive-security group" with trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" (no --no-verify/--force).
5. git push -u origin <branch>; gh pr create --repo ${REPO} --base main --head <branch> --label dependencies --title "chore(dependabot): add transitive-security group" --body "Batches transitive security patches into one weekly PR.". Return structured result (gates.install/test/lint/build = "n/a").`,
  },
];

phase('Patch');
log(
  `Starte ${TASKS.length} isolierte Patch-Tasks (root=sonnet, datepull=sonnet, dependabot-cfg=haiku)`
);

const results = await pipeline(
  TASKS,
  (t) =>
    agent(t.prompt, {
      label: t.label,
      phase: 'Patch',
      model: t.model,
      isolation: 'worktree',
      schema: PATCH_SCHEMA,
    }),
  (res, t) => {
    if (!res || !res.prNumber) return res;
    const verifyPrompt = `Adversarial config reviewer. A subagent opened PR #${res.prNumber} (branch ${res.branch}) on ${REPO} for task "${t.key}". Independently VERIFY it is safe. Run these read-only checks:
- \`gh pr diff ${res.prNumber} --repo ${REPO} --name-only\` -> list of changed files.
- FORBIDDEN files (any of these in the diff => ok=false): src/middleware.ts, astro.config.mjs, src/pages/api/contact.ts, Dockerfile, docker-compose.prod.yml, any file under src/components/, any *.css.
- Allowed per task: root-sec => {package.json, package-lock.json, pnpm-lock.yaml}; datepull => only projekte/datepull-api/{package.json,package-lock.json}; dependabot-cfg => only .github/dependabot.yml.
- For root-sec: confirm BOTH package-lock.json AND pnpm-lock.yaml are present in the diff. Run \`gh pr diff ${res.prNumber} --repo ${REPO} -- package.json\` and confirm NO MAJOR version bump (only vitest minor expected; flag any astro/@astrojs/node/react major).
- For datepull: \`gh pr diff ${res.prNumber} --repo ${REPO} -- projekte/datepull-api/package.json\` and confirm only multer changed, no majors.
- For dependabot-cfg: confirm only .github/dependabot.yml changed; fetch it from the branch (\`gh api repos/${REPO}/contents/.github/dependabot.yml?ref=${res.branch} --jq .content | base64 -d\`) and validate with python yaml.safe_load.
Return verdict. Default ok=false if anything is unexpected or you could not verify.`;
    return agent(verifyPrompt, {
      label: `verify:${t.key}`,
      phase: 'Verify',
      model: 'haiku',
      schema: VERIFY_SCHEMA,
    }).then((v) => ({ ...res, verify: v }));
  }
);

return results.filter(Boolean);
