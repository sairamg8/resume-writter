export const meta = {
  name: 'b1-fix2',
  description: 'Batch B1 fixes for hunt round 3: the New Cover abandonment decided by what the person did (Dashboard.jsx) and test-strength fixes (tests only), each reviewed by a second agent',
  phases: [
    { title: 'Fix', detail: 'one agent for the Dashboard.jsx finding, one for the test-strength findings (tests only)' },
    { title: 'Review', detail: 'an independent high-effort review of each, fixing what it finds in new commits' },
  ],
}

const WT = '/home/user/resume-writter/.claude/worktrees/ui-rebuild'
const D = WT + '/docs/tracking/ui-redesign'
const BASE = args.base

const COMMON = `
You work in the git worktree ${WT} (branch worktree-ui-rebuild; it tracks the shared branch claude/wonderful-maxwell-vu8xqw). Stay inside it; never cd to /home/user/resume-writter itself. Run git as plain, separate commands (no long compound shell lines: the sandbox refuses ones it cannot verify stay inside the worktree).
READ FIRST: ${D}/PARITY-RULE.md (UI only, every live function stays), ${D}/batches/B1.md (the batch spec), and the files named below. CLAUDE.md and CONTRIBUTING.md are in your context.
HARD RULES: (1) NEVER run tests, yarn install, a dev server or a build here (CI is the only place tests run; the lead dispatches them). Reading files and small read-only node scripts are fine. (2) Edit ONLY the files named for you. If you need another file, report it in "needsFromOthers" instead. (3) Commits are authored as the repo's configured identity (sairamgudiputi <sairamgudiputi8@gmail.com>, already set); NO Co-Authored-By trailer, NO "Generated with" line, NO session trailer, NO mention of Claude or AI in a message. (4) Commit with explicit paths (git add <files>, git commit; never git add -A or .; another agent edits other files at the same time; if git says index.lock, wait 5 s and retry). Never amend, rebase, reset, stash or force. After each commit run: git push -q origin HEAD:claude/wonderful-maxwell-vu8xqw (retry up to 4 times with 2, 4, 8, 16 s waits only on a network error). Never push to master. (5) One commit per src change, and in the SAME commit a test that FAILS without that src change and passes with it (the lead proves each with CI failfirst, which reverses the commit's src/ changes and requires its named tests to fail, then restores them and requires a pass; so a test must really depend on the change, and must not depend on timing luck: poll with a bounded wait, never a fixed tick count). (6) Stale tests are updated to the intended behaviour, never weakened, skipped or deleted; say why in the commit message. (7) Accessibility is deferred: add no aria, role, contrast or focus work. (8) Dashboard.jsx is on the start-up path (tests/pdf/71-startup-chunks has 17.6 kB spare now: keep every added byte small and report the bytes added). (9) Match the surrounding code style (comment density, naming); no new dependencies.
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
    key: 'dashboard',
    prompt: `CLUSTER "dashboard" (owns src/pages/Dashboard.jsx; owns tests/pdf/179-ui-b1-letter-stale-fallback.test.mjs and one new test file tests/pdf/179-ui-b1-letter-intent.test.mjs; you may NOT edit tests/pdf/178-ui-b1-lazy-fallbacks.test.mjs, 178-ui-b1-startup-headroom.test.mjs or 96-dashboard.test.mjs: another agent owns them; if a change of yours makes one stale, report it in needsFromOthers with the exact assertion).
Read src/pages/Dashboard.jsx fully first (startLetter, askedAt, the Lazy 'letter' boundary and LetterFallback near the end, the clock seam). THREE bug-hunt round-3 findings, all confirmed by two skeptics, one root cause: the abandoned-New-Cover guard added by commit 538469c is a wall-clock window (a picker import that fails more than 10 s after the click makes no letter).
 - B1-H3-1-2: Two or more résumés, the picker chunk stalls, the person just waits and does nothing else; the import rejects after 30 s: no letter is made and nothing is shown (Suspense fallback is null), though the person is still waiting. The offline case must never remove a function (B1 spec).
 - B1-H3-2-8: the person clicks New Cover and then clicks something else (Job Tracker, Projects, a card) while the picker is slow; the picker rejects at 5 s: a stray letter is created and the person is navigated to the editor over whatever they did.
FIX (decide 'abandoned' by what the person did since the click, not by elapsed time): when a New Cover request is open (letterModalOpen true and the picker not yet shown), record any other interaction in a ref: a one-shot capture-phase listener on document for pointerdown and keydown, plus hashchange/popstate on window, registered in an effect that runs only while a request is open and removed in its cleanup. The click that started the request must not count (it is already dispatched before the effect runs; a keyboard activation fires on keydown before the effect too; do not listen to keyup). When the picker import fails, LetterFallback's make(): if the person did something else since the click -> only setLetterModalOpen(false), make nothing; if not (however long the wait was) -> make the letter from letterSourceList[0]?.id ?? null as today. Remove the wall-clock check and its clock seam use if nothing else uses the clock (keep the seam only if the tests of other files still import it: grep tests/ for _lazyForTest and clock before removing anything; if 178 tests use the clock seam, keep the seam exported and unused-safe). Keep every other behaviour (once-per-visit guard, three cases, no reload, no draft loss). Keep added bytes tiny and report them.
TESTS in the same single src commit: update tests/pdf/179-ui-b1-letter-stale-fallback.test.mjs to the new intended behaviour (it pins the 10 s window; rewrite its cases around intent, keep its harness, and say why in the commit message) and add tests/pdf/179-ui-b1-letter-intent.test.mjs: (a) waited 30 s (move the stubbed clock far) with no interaction, the picker rejects: exactly ONE letter is made from the first source; (b) click New Cover, then dispatch a pointerdown on document (or a hashchange), then the picker rejects at once: NO letter is made and the request closes; (c) a keydown does the same as (b); (d) the New Cover click itself does not count: a rejection right after the click makes the letter. Each of (a) and (b)/(c) must fail on the parent of your commit (the parent makes a letter in (b) and no letter in (a)). Use fake-dom's document/window event dispatch as 178-ui-b1-lazy-fallbacks does; poll with bounded waits, never fixed ticks.`,
  },
  {
    key: 'tests',
    prompt: `CLUSTER "tests" (TESTS ONLY, no src change; owns tests/pdf/178-ui-b1-lazy-fallbacks.test.mjs, tests/pdf/178-ui-b1-startup-headroom.test.mjs and tests/pdf/96-dashboard.test.mjs; you must not edit src/ or any other test file). Three bug-hunt round-3 findings about tests that cannot fail. Because there is no src commit to reverse, the lead will prove each test with a throwaway mutation of src/pages/Dashboard.jsx on a scratch branch: so write each test to FAIL under exactly the mutation named, and state the mutation precisely in your commit message (file, line, what is removed or changed).
 - B1-H3-1-1 (major): src/pages/Dashboard.jsx around line 35 deletes a rejected lazy view from the module-level cache in a .catch so that Try again or a remount builds a fresh lazy(); every existing test swaps the loader function at the same time as the retry, so the identity key alone hands out a fresh lazy() and the deletion is never needed. Add to 178-ui-b1-lazy-fallbacks.test.mjs: (i) the SAME loader function (never reassigned, e.g. a counter-backed loaders.career = () => (n++ === 0 ? rejected : real)) fails once, then Try again makes the panel appear; (ii) remount variant: mount, let it fail, unmount, mount again with the same loader: the panel appears with no Try again. Mutation M1: delete the .catch(...) eviction so the entry stays cached after rejection.
 - B1-H3-2-9: nothing fails if the idle/timer cleanup on unmount (return () => (idle ? cancelIdleCallback(id) : clearTimeout(id)) near Dashboard.jsx:97-102) is removed. In 178-ui-b1-startup-headroom.test.mjs record the ids the stubs hand out and the ids cancelled/cleared, unmount before running the queued callback, assert the cancelled id equals the one requested, and that running it afterwards adds no loader calls; cover both the requestIdleCallback branch and the setTimeout fallback branch (stub clearTimeout too). Mutation M2: remove that cleanup return.
 - B1-H3-1-6: tests/pdf/96-dashboard.test.mjs lines ~388 and ~413 assert no picker right after settle(), which now runs before a lazy picker could arrive, so the assertion is vacuous. Replace with a bounded poll that must NEVER see the dialog (a dialogNever(ms) helper beside dialogUp) or assert through the loader call count that the picker's loader was not asked for (as 178-ui-b1-startup-headroom does). Mutation M3: in startLetter change the condition letterSourceList.length > 1 to >= 0 so the picker opens for 0 and 1 résumés; the 'no picker' lines themselves must go red.
Also check the same dead pattern in 178-ui-b1-lazy-fallbacks.test.mjs (finding B1-H3-2-10: the 'no picker' assertion in the picker-unreachable test can never fail) and fix it the same way. One commit per finding, tests only, pushed after each. Read tests/pdf/178-ui-b1-lazy-fallbacks.test.mjs and its harness first; keep bounded polling and no fixed tick counts.`,
  },
]

phase('Fix')
const results = await pipeline(
  CLUSTERS,
  (c) => agent(`${COMMON}\n${c.prompt}\nWhen finished return the schema (commits: the sha of each commit you made, found with git log).`, { label: `fix:${c.key}`, phase: 'Fix', schema: RESULT, effort: 'medium' }),
  (built, c) => agent(`${COMMON}
YOUR ROLE: independent REVIEWER of cluster "${c.key}". The builder reported: ${JSON.stringify(built || 'NO RESULT: inspect the worktree yourself (git log ${BASE}..HEAD) and judge what exists')}.
Inspect the real commits (git log ${BASE}..HEAD; git show <sha> for each commit touching this cluster's files; plain separate commands). Verify: the fix really resolves its finding for the scenario described; no live function is lost or changed (PARITY-RULE.md: the Dashboard's New Cover flow in its three cases and once-per-visit guard, Career History open/navigate, import, the letter fallback, Try again); each src commit has a test in the same commit that really FAILS on the parent (read it: would it pass on the parent? then it proves nothing: fix it); for the tests-only cluster, mentally apply the named mutation to Dashboard.jsx and verify each test would go red and passes with it, with bounded polling and no timing luck; no PERF-4 or start-up regression (bytes added are small and reported); React rules (hooks order, effect cleanup, StrictMode double effects, a module-level cache surviving test teardown and the tests' loader replacement via _lazyForTest, React.lazy rejection caching); the commit messages carry no trailer and no AI mention. Read the changed code line by line like a compiler and a hostile user (imports, syntax, oxlint rules: no unused variables). Fix every real defect with NEW commits (explicit paths, push after each; no history rewrites). Return the schema (commits = your fix commits only, decisions = what you found and fixed).`,
    { label: `review:${c.key}`, phase: 'Review', schema: RESULT, effort: 'high' }),
)
return results
