export const meta = {
  name: 'b1-build',
  description: 'Batch B1 (foundation): four clusters with separate file ownership (tokens, test-spine, headroom, lead-tools), each built by one agent and then reviewed against the spec by a second agent; commits only, CI proves them afterwards',
  phases: [
    { title: 'Build', detail: 'one agent per cluster writes code and its tests and commits its own files' },
    { title: 'Review', detail: 'a second, high-effort agent re-checks each cluster against the spec and parity rule and fixes defects' },
  ],
}

const WT = '/home/user/resume-writter/.claude/worktrees/ui-rebuild'
const D = WT + '/docs/tracking/ui-redesign'
const BASE = args && args.base ? args.base : '65521a0'

const COMMON = `
You work in the git worktree ${WT} (branch worktree-ui-rebuild; it tracks the shared branch claude/wonderful-maxwell-vu8xqw). Stay inside it; never cd to /home/user/resume-writter itself. Run git as plain, separate commands (no long compound shell lines: the sandbox refuses ones it cannot verify stay inside the worktree).
READ FIRST: ${D}/PARITY-RULE.md (the owner's binding rule: UI only, every live function stays), ${D}/batches/B1.md (the FULL spec of this batch; your cluster's section is the contract), ${D}/BRIEF.md (visual system and tokens), and the parts of ${D}/parity/_constraints.md, _tests.md and _ci.md that concern your files. CLAUDE.md and CONTRIBUTING.md are already in your context.
HARD RULES: (1) NEVER run tests, yarn install, a dev server or a build on this machine (tests run only on CI; the lead dispatches them). Reading files and small node scripts that only read and print are fine. (2) Edit ONLY the files your cluster owns (and create only its new files). If you need a change in a file you do not own, do NOT make it: report it in "needsFromOthers". (3) Commit as the repo's configured identity (sairamgudiputi <sairamgudiputi8@gmail.com>; already set). The commit message states what changed and why; NO Co-Authored-By trailer, NO "Generated with" line, NO session trailer, NO mention of Claude or AI. (4) Commit with explicit paths: git add <your files> then git commit (never git add -A or .; other agents edit other files in the same worktree at the same time; if git reports index.lock, wait 5 seconds and retry). Never amend, rebase, reset, stash or force anything. After each commit run: git push -q origin HEAD:claude/wonderful-maxwell-vu8xqw (retry up to 4 times with 2, 4, 8, 16 s waits only on a network error). Never push to master. (5) Every src change needs a test that FAILS without it and passes with it; put each src change and its test in the SAME commit, one commit per src change (the lead proves each with the CI failfirst input, which reverses a commit's src/ changes and requires its named tests to fail). (6) Stale tests are updated to the intended behaviour, never weakened, skipped or deleted; say why in the commit message. (7) Accessibility is deferred: do not add or fix aria, roles, contrast or focus work. (8) The start-up path (src/main entry, AppRoutes, Dashboard and what it imports) has about 0 kB spare (tests/pdf/71-startup-chunks): add as few bytes as possible to files on it, and report every start-up file you touched. (9) Code style: match the surrounding code (comment density, naming, idiom); no new dependencies.
Write down only what you verified by reading code. If a requirement in the spec is unclear or impossible as written, make the smallest safe choice, and list it in "decisions".
`

const RESULT = {
  type: 'object',
  properties: {
    cluster: { type: 'string' },
    commits: { type: 'array', items: { type: 'object', properties: { sha: { type: 'string' }, message: { type: 'string' }, srcFiles: { type: 'array', items: { type: 'string' } }, tests: { type: 'array', items: { type: 'string' } } }, required: ['sha', 'message', 'srcFiles', 'tests'] } },
    testsAdded: { type: 'array', items: { type: 'string' } },
    testsUpdated: { type: 'array', items: { type: 'string' } },
    startupFilesTouched: { type: 'array', items: { type: 'string' } },
    decisions: { type: 'array', items: { type: 'string' } },
    needsFromOthers: { type: 'array', items: { type: 'string' } },
    notVerified: { type: 'array', items: { type: 'string' } },
    done: { type: 'boolean' },
  },
  required: ['cluster', 'commits', 'testsAdded', 'testsUpdated', 'startupFilesTouched', 'decisions', 'needsFromOthers', 'notVerified', 'done'],
}

const CLUSTERS = [
  {
    key: 'tokens',
    prompt: `YOUR CLUSTER: "tokens" (owns src/index.css only; new tests tests/unit/ui-b1-design-tokens.unit.mjs and tests/unit/ui-b1-token-repoint.unit.mjs).
Do it in TWO commits, each with its own test file in the same commit: (1) the ADDITIVE cv-* tokens and the @layer components classes; test tests/unit/ui-b1-design-tokens.unit.mjs. (2) the CSS-only re-point of the VALUES of the legacy kit tokens to the cv values (names, defaults, heights and radii unchanged); test tests/unit/ui-b1-token-repoint.unit.mjs. Read src/index.css, the BRIEF.md palette and type, and the existing kit unit tests (tests/unit/ui-kit.unit.mjs, ui-overlays, ui-helpers, ui-shell) to see what they pin so you do not break it; read how other unit tests read index.css as text (grep tests for index.css) and follow that. Use the exact hex values in the B1 spec; for values the spec leaves open (surface, soft fills, good/warn/bad and their soft fills) take them from BRIEF.md and the canvas conventions it documents, never invent a different palette. Do NOT add a web-font link (parked). Tailwind's own --font-sans must not be redefined. Cost on the start-up path must be 0 bytes (CSS is outside the 1,100 kB JS cap).`,
  },
  {
    key: 'test-spine',
    prompt: `YOUR CLUSTER: "test-spine" (owns the files listed in B1.md for it). Add the no-visual-change data-testid hooks and make every helper select through them: the testids listed in the spec; keep all existing data-testid values and the preview data attributes; move tests/pdf/resume-tab.mjs and tests/pdf/165-perf4-editor-render-count.test.mjs off class-and-structure selectors to the new testids WITHOUT changing what they assert; add byRole(container, role, name) to tests/pdf/fake-dom.mjs; make the Cypress helpers openDesign(), openAts(), switchTo('resume'|'letter'), openExportMenu() and the Playwright openDesignPanel each delegate to ONE function per runner (a later batch changes only those bodies); create tests/pdf/ui-selectors.mjs (tests only), tests/pdf/178-ui-b1-test-hooks.test.mjs (mounts EditorResumeTab and ResumeCard: every testid present and unique) and tests/playwright/phone-reach.spec.mjs (375x812, hasTouch, isMobile; tap-only reachability; a per-surface list of testids that later batches append to; a case that a control made hover-only would fail; the mutation proof run is made later by the lead, so write the spec so such a mutation is easy: say how in a header comment). Mind PERF-4: no router hook or <Link> in memoised editor parts, no new props that change identity every render, tests 165 and 173 must stay green (read tests/pdf/173 and 165 before touching anything they cover). ResumeCard.jsx is on the START-UP path: a data-testid costs a few bytes; add only the two the spec names. Put the src change (the testids) and test 178-ui-b1-test-hooks in ONE commit; helper/test migrations that need no src change go in a second commit.`,
  },
  {
    key: 'headroom',
    prompt: `YOUR CLUSTER: "headroom" (owns src/pages/Dashboard.jsx and the new tests tests/pdf/178-ui-b1-startup-headroom.test.mjs and tests/pdf/178-ui-b1-lazy-fallbacks.test.mjs; you may also update, in place, the existing tests the spec lists under "tests mounting NewLetterModal or CareerHistoryPanel through the Dashboard", only to await the lazy boundary while still asserting the same behaviour; you do NOT own tests/pdf/fake-dom.mjs or tests/pdf/resume-tab.mjs: if you need a helper, write it in your own new test file or report it in needsFromOthers).
GOAL: create start-up headroom: make NewLetterModal (with the Dialog, useFocusTrap, placement, useScrollLock, usePresence, Portal closure, as far as nothing else on the start-up path imports them) and CareerHistoryPanel (+ careerHistory.js) lazy, each in its own ErrorBoundary with the in-entry fallback the spec describes, plus the prefetch (idle-time and on hover/focus, once). FIRST read tests/pdf/71-startup-chunks.test.mjs and its helper (startup-modules.mjs or similar) and compute with a read-only node script the static import closure of the start-up entry before your change and after (list which modules leave the path and their source sizes); put the numbers in "decisions". Verify that no OTHER module on the start-up path imports Dialog or the others: if one does, say which and what that means for the gain. Do not apply the reserve offset (jsonResumeImport) yet: the lead decides after the CI measurement; say in decisions how large the gain is expected to be. Keep every function: New cover letter (the three cases, the once-per-visit guard), Career History open/navigate, file import. Never use the lazyPage reload guard for these in-page pieces. The src change (Dashboard.jsx) and its new tests go in ONE commit; each updated existing test goes in the same commit.`,
  },
  {
    key: 'lead-tools',
    prompt: `YOUR CLUSTER: "lead-tools" (docs and tools only; no src, no tests, no CI; you own docs/tracking/ui-redesign/tools/brief.mjs and tools/label-inventory.mjs; do NOT edit batches/B1.md (the lead generates it) nor any parity file).
Build tools/brief.mjs exactly as the spec describes: it reads plan-work/final.json and the 7 parity files (reuse the row parser of batches/coverage-check.mjs; read it first; also tools/make-batch-spec.mjs), and for a batch id (sub-batch ids such as B5a accepted) writes batches/<id>.md: the spec (as make-batch-spec.mjs does) PLUS every parity row the batch owns (ID, live behaviour, board placement, status, Fix), the catch-all rows computed from the final files, DO NOT BUILD AS DRAWN flags for rows that touch the parked list, the layout-deltas table, and the 'tests that go red' list computed by grepping the batch's touched files and visible labels across tests/ and cypress/ (it prints a failure line when a hit is not in the batch's testsToUpdate). Rewrite a Fix that begins 'Draw' as 'Build from the live behaviour; no board, or the board differs: design from tokens' beside the live-behaviour cell; a Fix of only Same./Keep./Draw. is replaced by the live-behaviour cell. Add a --coverage mode that proves every row of the 7 files has exactly one owner and prints the same totals as batches/coverage-findings.md. Add a --master-sync mode that lists parity-file and src changes that arrived from origin/master since a given commit (git log/diff only; it must not modify anything). Build tools/label-inventory.mjs: an inventory of title / aria-label / placeholder / visible button text of changed src files, base vs head (git show for the base; a regex-level scan is fine, state its limits in the file's header comment). Then RUN brief.mjs in coverage mode and for B2..B17 (read-only generation into batches/; these are plain node scripts reading files, allowed) and read two generated briefs to check them. Commit the tools and the generated briefs (explicit paths) in one commit. Return the totals the coverage mode printed.`,
  },
]

phase('Build')
const results = await pipeline(
  CLUSTERS,
  (c) => agent(`${COMMON}\n${c.prompt}\nWhen finished return the schema (commits: the sha of each commit you made, found with git log).`, { label: `build:${c.key}`, phase: 'Build', schema: RESULT, effort: 'medium' }),
  (built, c) => agent(`${COMMON}
YOUR ROLE: independent REVIEWER of cluster "${c.key}". The builder reported: ${JSON.stringify(built || 'NO RESULT: inspect the worktree yourself (git log ${BASE}..HEAD) and judge what exists')}.
Inspect the real commits (git log ${BASE}..HEAD, git show <sha> for each commit that touched this cluster's files; plain separate commands). Verify against ${D}/batches/B1.md's section for this cluster and ${D}/PARITY-RULE.md:
 - every requirement of the spec is met, nothing outside the cluster's files is touched, nothing PARKED is built, no live function is lost or changed;
 - each src commit has a test in the same commit that really FAILS without the src change (read the test: would it pass on the parent? if so it proves nothing: fix it) and passes with it; the test asserts behaviour, not only that a string exists, and cannot pass for the wrong reason (selectors matching nothing, awaiting nothing);
 - bugs: read the changed code line by line like a compiler and a hostile user (imports that do not exist, wrong paths, JSX/Tailwind v4 syntax errors, hooks rules, memo/PERF-4 rules from parity/_constraints.md section on render performance, tests/pdf/165 and 173 assumptions, effects cleanup, SSR/fake-dom compatibility of the test mounts, lint rules of oxlint: unused variables/imports);
 - the commit messages carry no trailer and no mention of Claude or AI; the identity is sairamgudiputi;
 - start-up bytes: list any start-up-path file touched and the bytes added.
Fix every real defect yourself with NEW commits (explicit paths, same rules as the builder; push after each). Do not rewrite history. Return the schema (cluster, commits = your fix commits only, decisions = what you found and fixed, notVerified = anything you could not check by reading).`, { label: `review:${c.key}`, phase: 'Review', schema: RESULT, effort: 'high' }),
)

return results
