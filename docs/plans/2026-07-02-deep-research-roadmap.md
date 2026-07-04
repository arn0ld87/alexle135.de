# Deep Research Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `/Volumes/T7/Offload/Downloads/deep-research-report.md` into a prioritized PR roadmap that improves trust signals, repo hygiene, test evidence, documentation, and the two highest-value product features.

**Architecture:** Treat the report as an external audit, not as absolute truth. First reconcile inaccurate or outdated findings with the current Astro 6 SSR, Node 22, PostgreSQL, Better Auth, Vitest, Docker, and Traefik setup, then implement only narrowly scoped changes per PR.

**Tech Stack:** Astro 6.4 SSR, React 19, Tailwind CSS 4, Astro Content Collections with Zod, Better Auth, PostgreSQL, Vitest 4, Testing Library, ESLint, Prettier, Docker, Traefik.

---

## Priority Order

1. **PR 1: Stack truth and architecture docs** - highest leverage because the report's biggest trust issue is conflicting public evidence.
2. **PR 2: Repo hygiene and generated artifact policy** - removes noisy signals and prevents repeat regressions.
3. **PR 3: Test evidence for risky paths** - converts existing tests into visible, repeatable confidence for contact, auth, admin, and persistence.
4. **PR 4: Security and production hardening evidence** - documents and verifies headers, secrets handling, CSRF, rate limit, and runtime env boundaries.
5. **PR 5: Public search and filters** - highest-value user-facing feature from the report.
6. **PR 6: Admin contact inbox workflow** - useful product improvement, but only after the underlying trust work is stable.
7. **PR 7: Public changelog or roadmap surface** - low-risk credibility feature after docs and deployment truth are aligned.

## PR 1: Stack Truth And Architecture Docs

**Why:** The report flags the largest credibility gap as mixed deployment and architecture signals. Current repo already has SSR, Docker, Traefik, PostgreSQL, Better Auth, Vitest, and deployment workflow files, while old `netlify.toml`/`vercel.json` are absent.

**Files:**

- Create: `docs/architecture.md`
- Modify: `README.md`
- Reference: `astro.config.mjs`
- Reference: `Dockerfile`
- Reference: `docker-compose.prod.yml`
- Reference: `.github/workflows/deploy.yml`
- Reference: `src/middleware.ts`
- Reference: `src/pages/api/contact.ts`
- Reference: `src/lib/auth.ts`
- Reference: `src/lib/db/client.ts`

### Task 1: Capture The Real Runtime Model

**Step 1: Draft architecture sections**

Create `docs/architecture.md` with these sections:

- `Runtime`: Astro SSR with `@astrojs/node` standalone on Node 22.
- `Public app`: pages, content collections, V2 layout, interactive tools.
- `Admin`: `/admin/*`, `/api/admin/*`, Better Auth/session model, CSRF boundary.
- `Data`: PostgreSQL runtime dependency, migrations, verification scripts.
- `Contact flow`: origin check, honeypot, rate limit, insert into `contact_messages`.
- `Deployment`: Docker image, Traefik routing, runtime env, GitHub Actions.
- `Quality gates`: local commands and CI-equivalent checks.
- `Legacy/non-goals`: explicitly state Netlify/Vercel static deploy are not active unless reintroduced deliberately.

**Step 2: Align README**

Modify `README.md` so the quickstart and production sections point to the same runtime truth:

- Use `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm start`.
- Name Docker/Traefik as production path.
- Name PostgreSQL and Better Auth as runtime requirements.
- Link to `docs/architecture.md`.
- Remove or rewrite any static-only `dist/` wording if it implies the production app is purely static.

**Step 3: Verify docs against source**

Run:

```bash
pnpm lint
pnpm check
```

Expected: both commands pass, or failures are pre-existing and unrelated to docs.

**Step 4: Commit**

```bash
git add README.md docs/architecture.md
git commit -m "docs: document production architecture"
```

## PR 2: Repo Hygiene And Artifact Policy

**Why:** The report complains about root-level clutter. Current repo is already cleaner than the report suggests, but the policy should prevent `playwright-report/`, `test-results/`, scratch folders, and generated reports from reappearing.

**Files:**

- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `package.json`
- Create: `scripts/check-repo-hygiene.mjs`
- Test: add script execution to existing quality workflow if appropriate

### Task 1: Add A Hygiene Guard

**Step 1: Write failing guard**

Create `scripts/check-repo-hygiene.mjs` that fails when forbidden generated paths are present:

- `playwright-report/`
- `test-results/`
- `coverage/`
- `jules-scratch/`
- `memory-bank/`
- root-level `*-report.md` unless explicitly allowlisted

The script should print only path names, never file contents.

**Step 2: Wire package script**

Add:

```json
"check:hygiene": "node scripts/check-repo-hygiene.mjs"
```

**Step 3: Update ignore policy**

Ensure `.gitignore` ignores generated test output and scratch output.

**Step 4: Run guard**

```bash
pnpm check:hygiene
```

Expected: PASS on a clean repo.

**Step 5: Commit**

```bash
git add .gitignore package.json scripts/check-repo-hygiene.mjs README.md
git commit -m "chore: guard repo hygiene"
```

## PR 3: Risk-Focused Test Evidence

**Why:** The report says testing is not visible enough. Current repo already has many Vitest tests, including contact, admin auth, middleware, DB repositories, and API tests. The useful work is to close gaps and make the evidence easy to run.

**Files:**

- Modify: `src/pages/api/__tests__/contact.test.ts`
- Modify: `src/pages/api/auth/__tests__/login.test.ts`
- Modify: `src/pages/api/admin/__tests__/messages.test.ts`
- Modify: `src/lib/db/__tests__/repositories.test.ts`
- Modify: `src/middleware.test.ts`
- Modify: `README.md`
- Optional Modify: `vitest.config.ts`
- Optional Modify: `vitest.integration.config.ts`

### Task 1: Build A Risk Test Matrix

**Step 1: Add README table**

Document a compact matrix:

| Risk path                                      | Test file                                        | Command                                                               |
| ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Contact form validation/rate limit/persistence | `src/pages/api/__tests__/contact.test.ts`        | `pnpm exec vitest run src/pages/api/__tests__/contact.test.ts`        |
| Auth login/logout                              | `src/pages/api/auth/__tests__/login.test.ts`     | `pnpm exec vitest run src/pages/api/auth/__tests__/login.test.ts`     |
| Admin message mutations                        | `src/pages/api/admin/__tests__/messages.test.ts` | `pnpm exec vitest run src/pages/api/admin/__tests__/messages.test.ts` |
| Middleware protection                          | `src/middleware.test.ts`                         | `pnpm exec vitest run src/middleware.test.ts`                         |
| DB repository behavior                         | `src/lib/db/__tests__/repositories.test.ts`      | `pnpm exec vitest run src/lib/db/__tests__/repositories.test.ts`      |

**Step 2: Run focused tests**

```bash
pnpm exec vitest run src/pages/api/__tests__/contact.test.ts
pnpm exec vitest run src/pages/api/auth/__tests__/login.test.ts
pnpm exec vitest run src/pages/api/admin/__tests__/messages.test.ts
pnpm exec vitest run src/middleware.test.ts
pnpm exec vitest run src/lib/db/__tests__/repositories.test.ts
```

Expected: all pass, or failures become follow-up tasks inside this PR.

**Step 3: Add missing assertions only where gaps are real**

Check for these behaviors and add tests only when absent:

- Contact rejects invalid origin.
- Contact ignores honeypot submissions.
- Contact rate limit blocks repeated submissions.
- Contact persistence writes expected fields without logging secrets.
- Admin API rejects unauthenticated writes.
- Admin API rejects missing/invalid CSRF on mutations.
- Middleware protects `/admin/*` and `/api/admin/*`.

**Step 4: Run broader gate**

```bash
pnpm test:run
pnpm lint
```

Expected: both pass.

**Step 5: Commit**

```bash
git add README.md src/pages/api/__tests__/contact.test.ts src/pages/api/auth/__tests__/login.test.ts src/pages/api/admin/__tests__/messages.test.ts src/lib/db/__tests__/repositories.test.ts src/middleware.test.ts vitest.config.ts vitest.integration.config.ts
git commit -m "test: document and harden risky paths"
```

## PR 4: Security And Production Hardening Evidence

**Why:** The report credits the app for CSRF, honeypot, rate limit, Better Auth, TLS, and Cloudflare, but says hardening evidence is not visible enough. Do not change CSP/COEP/COOP without manually testing both terminal missions.

**Files:**

- Modify: `docs/architecture.md`
- Modify: `README.md`
- Reference: `astro.config.mjs`
- Reference: `src/middleware.ts`
- Reference: `src/pages/api/contact.ts`
- Reference: `src/lib/adminAuth.ts`
- Reference: `src/lib/adminSession.ts`

### Task 1: Document Security Guarantees

**Step 1: Add security section**

In `docs/architecture.md`, document:

- Runtime env variables are provided at container runtime.
- `PUBLIC_GA_MEASUREMENT_ID` is optional and public.
- `DATABASE_URL`, `BETTER_AUTH_SECRET`, and server secrets are not build args.
- Admin mutations go through CSRF-protected API paths.
- Contact API applies origin check, honeypot, rate limit, and persistence boundaries.
- CSP/COEP/COOP exist for WebContainer pages and must be tested manually before changes.

**Step 2: Add verification commands**

Add commands to README:

```bash
pnpm check
pnpm test:run
pnpm test:integration
pnpm build
pnpm check:dist
pnpm check:bundle
```

**Step 3: Run risk-appropriate checks**

```bash
pnpm test:run
pnpm build
pnpm check:dist
pnpm check:bundle
```

Expected: all pass for hardening/documentation PRs.

**Step 4: Commit**

```bash
git add README.md docs/architecture.md
git commit -m "docs: document security hardening"
```

## PR 5: Public Search And Filters

**Why:** The report's highest-priority feature recommendation is a unified search/filter layer across blog, projects, and apps. This should be built after the trust/docs work because it touches public navigation and content models.

**Files:**

- Modify: `src/pages/api/search.json.ts`
- Modify: `src/pages/api/__tests__/search.json.test.ts`
- Modify: `src/components/home/Blog.tsx`
- Modify: `src/content.config.ts`
- Modify or Create: public search UI component under `src/components/v2/`
- Modify: relevant public pages for blog/projects/apps

### Task 1: Define Search Contract

**Step 1: Write failing API test**

Extend `src/pages/api/__tests__/search.json.test.ts` to assert that results include:

- `title`
- `slug`
- `type` as `blog`, `project`, or `app`
- `summary`
- `tags`
- `url`

**Step 2: Run test**

```bash
pnpm exec vitest run src/pages/api/__tests__/search.json.test.ts
```

Expected: FAIL until the API contract is complete.

**Step 3: Implement minimal API shape**

Update `src/pages/api/search.json.ts` to aggregate only existing content collections first. Do not add a search dependency unless local filtering becomes insufficient.

**Step 4: Add UI filters**

Add a compact public search/filter control with:

- text input
- type segmented control
- tag filter
- empty state
- keyboard-accessible result links

**Step 5: Verify**

```bash
pnpm exec vitest run src/pages/api/__tests__/search.json.test.ts
pnpm test:run
pnpm lint
pnpm build
pnpm check:dist
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/pages/api/search.json.ts src/pages/api/__tests__/search.json.test.ts src/components/home/Blog.tsx src/components/v2 src/content.config.ts
git commit -m "feat: add public content search"
```

## PR 6: Admin Contact Inbox Workflow

**Why:** The report's second feature recommendation is a real workflow for persisted contact messages. This is product-useful but touches admin writes, so it must stay behind existing auth and CSRF boundaries.

**Files:**

- Modify: `src/pages/admin/messages/index.astro`
- Modify: `src/pages/api/admin/messages.ts`
- Modify: `src/pages/api/admin/__tests__/messages.test.ts`
- Modify: `src/lib/adminClient.ts`
- Modify: `src/lib/db/repositories.ts`
- Modify: `src/lib/db/__tests__/repositories.test.ts`
- Optional Modify: `db/migrations/*`

### Task 1: Add Message Status Workflow

**Step 1: Write failing repository tests**

Assert support for:

- `open`
- `answered`
- `spam`
- `follow_up`

**Step 2: Add migration if schema lacks status**

Create a small PostgreSQL migration only if `contact_messages` does not already have workflow fields.

**Step 3: Add API tests**

Extend `src/pages/api/admin/__tests__/messages.test.ts` for:

- authenticated status update
- unauthenticated rejection
- CSRF rejection
- invalid status rejection

**Step 4: Implement minimal UI**

Update `src/pages/admin/messages/index.astro` with:

- status filter
- status update action
- visible updated timestamp if available
- no client-side bypass around `src/lib/adminClient.ts`

**Step 5: Verify**

```bash
pnpm exec vitest run src/pages/api/admin/__tests__/messages.test.ts
pnpm exec vitest run src/lib/db/__tests__/repositories.test.ts
pnpm test:integration
pnpm lint
pnpm build
```

Expected: all pass.

**Step 6: Commit**

```bash
git add db src/pages/admin/messages/index.astro src/pages/api/admin/messages.ts src/pages/api/admin/__tests__/messages.test.ts src/lib/adminClient.ts src/lib/db/repositories.ts src/lib/db/__tests__/repositories.test.ts
git commit -m "feat: add admin message workflow"
```

## PR 7: Public Changelog Or Roadmap Surface

**Why:** This is low-risk and supports the report's trust recommendation, but it should come after architecture truth is already documented.

**Files:**

- Create: `src/content/changelog/*` or `src/content/roadmap/*`
- Modify: `src/content.config.ts`
- Create: `src/pages/changelog.astro` or `src/pages/roadmap.astro`
- Modify: navigation component if the route should be public

### Task 1: Add Minimal Changelog

**Step 1: Extend content schema**

Add a small Zod schema with:

- `title`
- `date`
- `summary`
- `type`
- optional `links`

**Step 2: Add first entries**

Create entries for:

- production architecture alignment
- repo hygiene policy
- risky-path test evidence

**Step 3: Add page**

Use `src/layouts/V2Layout.astro`. Keep the page content-focused, not a marketing landing page.

**Step 4: Verify**

```bash
pnpm check
pnpm test:run
pnpm build
pnpm check:dist
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/content.config.ts src/content src/pages/changelog.astro
git commit -m "feat: add public changelog"
```

## Final Merge Gate

Run before merging the full roadmap:

```bash
pnpm check
pnpm test:run
pnpm test:integration
pnpm lint
pnpm build
pnpm check:dist
pnpm check:bundle
pnpm db:migrate
pnpm db:verify
```

Expected: all pass. For UI-affecting PRs, manually inspect desktop and mobile layouts and verify that text does not overflow compact controls.

## Notes From Report Reconciliation

- The report's claim that testing is barely visible is partly outdated: the repo currently contains Vitest tests for contact, auth, admin APIs, middleware, DB repositories, search, components, and interactive tools.
- The report's claim about `netlify.toml` and `vercel.json` is not true for the current working tree; both files are absent.
- The criticism about unclear public trust signals is still valid because README, architecture docs, and verification evidence should make the current production model obvious.
- Do not edit `dist/`.
- Do not change CSP/COEP/COOP unless the terminal mission flows are manually verified.
- Do not expose `.env` or secret values in logs, docs, commits, or screenshots.
