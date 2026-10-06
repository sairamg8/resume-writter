export const meta = {
  name: 'b1-fix',
  description: 'Batch B1 fixes for the confirmed bug-hunt findings: the button pressed colour (src/index.css) and three Dashboard.jsx fixes (module-level lazy components, a Reload page notice after a failed retry, a stale New Cover fallback), each src change with a fail-first test in the same commit, each reviewed by a second agent',
  phases: [
    { title: 'Fix', detail: 'one agent for the CSS finding, one for the three Dashboard findings (single owner of Dashboard.jsx)' },
    { title: 'Review', detail: 'an independent high-effort review of each, fixing what it finds in new commits' },
  ],
}

const WT = '/home/user/resume-writter/.claude/worktrees/ui-rebuild'
const D = WT + '/docs/tracking/ui-redesign'
const BASE = args.base

const COMMON = `
You work in the git worktree ${WT} (branch worktree-ui-rebuild; it tracks the shared branch claude/wonderful-maxwell-vu8xqw). Stay inside it; never cd to /home/user/resume-writter itself. Run git as plain, separate commands (no long compound shell lines: the sandbox refuses ones it cannot verify stay inside the worktree).
READ FIRST: ${D}/PARITY-RULE.md (UI only, every live function stays), ${D}/batches/B1.md (the batch spec), and the files named below. CLAUDE.md and CONTRIBUTING.md are in your context.
HARD RULES: (1) NEVER run tests, yarn install, a dev server or a build here (CI is the only place tests run; the lead dispatches them). Reading files and small read-only node scripts are fine. (2) Edit ONLY the files named for you. If you need another file, report it in "needsFromOthers" instead. (3) Commits are authored as the repo's configured identity (sairamgudiputi <sairamgudiputi8@gmail.com>, already set); NO Co-Authored-By trailer, NO "Generated with" line, NO session trailer, NO mention of Claude or AI in a message. (4) Commit with explicit paths (git add <files>, git commit; never git add -A or .; another agent edits other files at the same time; if git says index.lock, wait 5 s and retry). Never amend, rebase, reset, stash or force. After each commit run: git push -q origin HEAD:claude/wonderful-maxwell-vu8xqw (retry up to 4 times with 2, 4, 8, 16 s waits only on a network error). Never push to master. (5) One commit per src change, and in the SAME commit a test that FAILS without that src change and passes with it (the lead proves each with CI failfirst, which reverses the commit's src/ changes and requires its named tests to fail, then restores them and requires a pass; so a test must really depend on the change, and must not depend on timing luck: poll with a bounded wait, never a fixed tick count). (6) Stale tests are updated to the intended behaviour, never weakened, skipped or deleted; say why in the commit message. (7) Accessibility is deferred: add no aria, role, contrast or focus work. (8) Dashboard.jsx is on the start-up path (tests/pdf/71-startup-chunks has 18.0 kB spare now: keep every added byte small and report the bytes added). (9) Match the surrounding code style (comment density, naming); no new dependencies.
Write down only what you verified by reading code.
`
const RESULT = {
  type: 'object',
  properties: {
    cluster: { type: 'string' },
    commits: { type: 'array', items: { type: 'object', properties: { sha: { type: 'string' }, message: { type: 'string' }, srcFiles: { type: 'array', items: { type: 'string' } }, tests: { type: 'array', items: { type: 'string' } } }, required: ['sha', 'message', 'srcFiles', 'tests'] } },
    startupBytesAdded: { type: 'string' },
    decisions: { type: 'array', items: { type: 'string' } },
    needsFromOthers: { type: 'array', items: { type: 'string' } },
    notVerified: { type: 'array', items: { type: 'string' } },
    done: { type: 'boolean' },
  },
  required: ['cluster', 'commits', 'startupBytesAdded', 'decisions', 'needsFromOthers', 'notVerified', 'done'],
}

const CLUSTERS = [
  {
    key: 'css',
    prompt: `CLUSTER "css" (owns src/index.css, tests/unit/ui-b1-token-repoint.unit.mjs and one new test file tests/unit/ui-b1-brand-pressed.unit.mjs).
FINDING B1-H1-9 (confirmed by two skeptics): the re-point (commit 13696fe) set --color-brand-hover and --color-brand-pressed to the same value (#1e45d6); before they were #0055cc and #09326c. src/components/ui/Button.jsx:21 uses 'hover:bg-brand-hover active:bg-brand-pressed' for the primary variant, so the press feedback is gone. tests/unit/ui-b1-token-repoint.unit.mjs line ~21 pins 'brand-pressed' equal to cv 'brand-text', which pins the collapse.
FIX: give the pressed step its own value, darker than hover, in the same hue family (the canvas brand is #2B59FF, hover/text #1E45D6; take a pressed step about as much darker than #1E45D6 as the old #09326c was than #0055cc, i.e. compute it, e.g. with a small read-only node script, and state the hex and your arithmetic). Add it as an additive cv token (for example --color-cv-brand-pressed) so the "legacy value equals a cv value" rule of the re-point test still holds, and point the legacy --color-brand-pressed at it. Update tests/unit/ui-b1-token-repoint.unit.mjs for the intended behaviour (pressed maps to the new cv token) with the reason in the commit message, and add tests/unit/ui-b1-brand-pressed.unit.mjs asserting: the legacy pressed value differs from hover, is darker than hover (compare relative luminance or the RGB channels), and equals the new cv token; it must fail on the parent of your commit. One commit (src/index.css + both test files). Nothing else in index.css changes.`,
  },
  {
    key: 'dashboard',
    prompt: `CLUSTER "dashboard" (owns src/pages/Dashboard.jsx; new test files tests/pdf/179-ui-b1-lazy-remount.test.mjs, tests/pdf/179-ui-b1-lazy-reload-notice.test.mjs and tests/pdf/179-ui-b1-letter-stale-fallback.test.mjs; you may edit tests/pdf/178-ui-b1-lazy-fallbacks.test.mjs and tests/pdf/178-ui-b1-startup-headroom.test.mjs ONLY if a change of yours makes an existing assertion stale, keeping its intent; follow the helper style of 178-ui-b1-lazy-fallbacks.test.mjs: its dashboard() harness, the _lazyForTest seam, and its bounded 'until' polling).
Read src/pages/Dashboard.jsx fully first. THREE confirmed bug-hunt findings, three commits in this order, each with its own new test file in the same commit:
(1) B1-H2-12 + B1-H2-18: Lazy builds a new React.lazy() object inside useMemo at every mount, so on every Dashboard mount (a Back navigation too) React suspends once and commits Suspense fallback null: Career History is absent from the first commit even when its chunk is loaded, and the restored scroll offset can be clamped. FIX: create the lazy component ONCE per loader key at module level (a small Map, or lazily-initialised variables) and reuse it on later mounts, so a remount renders a loaded piece synchronously; Try again must still work: React.lazy caches a rejection for good, so a retry replaces that key's entry with a fresh lazy() (and the boundary resets as today). Keep the idle/hover prefetch and the _lazyForTest seam working (the tests clear 'warmed' and replace loaders[key]; make sure a replaced loader is honoured by the cache: key the cache entry by the loader function identity, or expose a reset in _lazyForTest, and keep both 178 test files' usage valid). Test 179-ui-b1-lazy-remount: mount the real Dashboard with several résumés, wait until Career History's panel text is on screen, unmount, mount again: the panel must be in the FIRST commit after mount (no polling, no waiting: read right after mount); it must fail on the parent.
(2) B1-H2-13 + B1-H2-14: after a deploy replaced the hashed chunk files, a tab opened before it asks for a file that is gone, so Career History's Try again can never succeed and the notice only says 'Check your connection'. The spec forbids an AUTOMATIC reload for these in-page pieces (it would drop a draft), but a reload the person chooses drops nothing. FIX: when Try again fails again (the retry count is above zero) show an extra, second sentence/state 'The app may have been updated.' with a 'Reload page' button that calls window.location.reload(); keep Try again and keep the first notice text exactly as today for the first failure. Use the same notice style as today (no new design). Test 179-ui-b1-lazy-reload-notice: first failure shows no Reload page; after a Try again that fails again, 'Reload page' is shown and pressing it calls the page-reload stub exactly once (the 178 harness counts reloads through globalThis.location); and Try again still recovers when the network is back; it must fail on the parent.
(3) B1-H2-15: a New Cover click abandoned while the picker chunk is slow can fire much later: the picker import rejects, LetterFallback's effect runs make() and creates a stray letter and navigates away from whatever the person has since done. FIX: stamp the time of each New Cover request (a ref set in startLetter); the fallback makes the letter only if the failure arrives within 10 seconds of that request; a later failure just closes the request (setLetterModalOpen(false)) and makes nothing (the next New Cover starts a fresh request). Keep every other fallback behaviour (once-per-visit guard, letter from letterSourceList[0], no reload) unchanged. Test 179-ui-b1-letter-stale-fallback: the picker loader rejects only after the test moves the clock (stub Date.now through a small seam you add to _lazyForTest or a module-level function, kept tiny) beyond 10 s: no letter is made; a rejection within the window still makes one letter from the first source; it must fail on the parent.
Do NOT touch findings you are not given (the letter picker's retry after a failed import, the first-paint fetch of Career History: skeptics split on them; they are documented as known limits).`,
  },
]

phase('Fix')
const results = await pipeline(
  CLUSTERS,
  (c) => agent(`${COMMON}\n${c.prompt}\nWhen finished return the schema (commits: the sha of each commit you made, found with git log).`, { label: `fix:${c.key}`, phase: 'Fix', schema: RESULT, effort: 'medium' }),
  (built, c) => agent(`${COMMON}
YOUR ROLE: independent REVIEWER of cluster "${c.key}". The builder reported: ${JSON.stringify(built || 'NO RESULT: inspect the worktree yourself (git log ${BASE}..HEAD) and judge what exists')}.
Inspect the real commits (git log ${BASE}..HEAD; git show <sha> for each commit touching this cluster's files; plain separate commands). Verify: the fix really resolves its finding for the scenario described; no live function is lost or changed (PARITY-RULE.md: the Dashboard's New Cover flow in its three cases and once-per-visit guard, Career History open/navigate, import, the letter fallback, Try again); each src commit has a test in the same commit that really FAILS on the parent (read it: would it pass on the parent? then it proves nothing: fix it) and passes with it, with bounded polling and no timing luck; no PERF-4 or start-up regression (bytes added are small and reported); React rules (hooks order, effect cleanup, StrictMode double effects, a module-level cache surviving test teardown and the tests' loader replacement via _lazyForTest, React.lazy rejection caching); the commit messages carry no trailer and no AI mention. Read the changed code line by line like a compiler and a hostile user (imports, syntax, oxlint rules: no unused variables). Fix every real defect with NEW commits (explicit paths, push after each; no history rewrites). Return the schema (commits = your fix commits only, decisions = what you found and fixed).`,
    { label: `review:${c.key}`, phase: 'Review', schema: RESULT, effort: 'high' }),
)
return results
