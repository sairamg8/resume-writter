export const meta = {
  name: 'r2-cluster',
  description: 'Round 2 cluster: one worker per row (fail-first tests on CI), an independent reviewer, then the cluster report',
  phases: [{ title: 'Rows' }, { title: 'Review' }, { title: 'Finish' }],
}

const A = args
const WT = A.worktree
const BR = `claude/wf-${A.cluster}`
const TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01KDXZzZfUEUyKqzYyULQbRi'

const GLOBAL_NOTE = `Clusters running in parallel right now, each on its own branch (the coordinator merges them all later — keep your hunks local, never reformat shared files):
- design-page (R2-136 page size control, R2-149 1-Page Fit that checks the page count, R2-157 Design tests): DesignPanel.jsx spacing/page area and page-fit code.
- header-type (R2-137 six header-spacing rows, R2-146 typography): headerSpacingRows.js, header/letterhead PDF code, DesignPanelTypography.jsx, pdfFontLoader.js, Word header.
- templates (R2-139 picker a11y/badges/atsRating, R2-138 presets): DesignPanel.jsx Template section, constants/templates.js, EditorHeader.jsx, ResumeCard.jsx, DesignPanelShared.jsx, the ATS checker's template rating.
- section-style (R2-147 bullet marker, skills pipe separator, page-number footer): richText.js, PdfRichText, SectionEditorCustomizer.jsx, PdfSectionsOne/PdfSidebarSkills, Word lists/footer.
- cloud-sync (R2-159 NotesTab test, R2-145 jobs sync + Privacy page, R2-140 boards sync): cloudSync*, useJobStore, useBoardStore, App.jsx, PrivacyPage.jsx, firestore.rules.
- structure-tests (R2-158, R2-167, R2-171): tests only.
- perf (R2-142 preview max-wait + deferred save): PdfPreview.jsx, useResumeStore.js save path.
- ats-view (R2-141): atsChecker.js, AtsCheckerPanel.jsx.
- letters-import (R2-135 cover letters, R2-148 import from PDF/DOCX/text): Dashboard.jsx, the store's letter creation, ImportMenu.jsx, a new importer.
- release (R2-169, R2-143, R2-154, R2-168): README, docs/knowledge, demoAccounts.js, useAuth.js, package.json, graphify-out, ci.yml.`

const RULES = `PROJECT: CPWT-CV, a free open-source résumé builder (repo sairamg8/resume-writter; React 19 + Vite; résumés print through react-pdf and the preview IS that PDF drawn by pdf.js; Word via docx; Markdown, JSON Resume and ATS plain-text exporters; a Job Tracker and Boards; Firebase sync for résumés).

WHERE: work ONLY in the git worktree ${WT} (branch ${BR}, tracking origin). The Bash cwd resets between calls, so use \`cd ${WT} && …\` or \`git -C ${WT} …\` every time. node_modules there is a symlink to a shared install: never run yarn install in it. If your row really adds or removes a dependency, first \`rm ${WT}/node_modules\` (the symlink only) and run \`cd ${WT} && corepack enable && yarn install\` to get a private node_modules, then \`yarn add\`/\`yarn remove\` — yarn.lock changes only through yarn.

READ FIRST: docs/tracking/CLUSTER-PROTOCOL.md (the rules — you follow "For each row" and "Rules"; the review and the report file are done after you by the workflow), your row in docs/tracking/bug-status-r2/03-features-and-test-gaps.md (grep its ID, read it whole), docs/knowledge/09-file-map.md plus the knowledge doc of your area, CONTRIBUTING.md. Look at \`git log --oneline -15\` for the commit style.

RULES (from the owner — non-negotiable):
- Tests run ONLY on the GitHub Actions CI pipeline. Never run node --test, playwright, cypress, vite build, vite preview or the dev server on this machine. Allowed locally: git, grep/sed/reading, and \`./node_modules/.bin/oxlint <changed files>\` (fix what it reports in your changes).
- Every fix commit gets a test that fails without it, proven on CI with the \`failfirst\` input. Test-only work (verification gaps): fail-first cannot apply (CI rejects a commit with no src/ change) — make each test assert the concrete behaviour so that breaking the code turns it red, and say in your summary which regression each test catches. If a test exposes a real bug, fix that bug in its own fix commit with fail-first.
- Fix the root cause minimally, in the surrounding code's style (naming, idiom; comments say why, in plain words). What prints must agree across the preview (= the PDF), PDF, Word, Markdown and the ATS text: check every exporter your change touches. Keep behaviour for everything the row doesn't cover; older stored data must still load and print the same.
- A new Design / Section / Personal-info control must be registered in the parity registry (tests/pdf/parity/registry*.mjs) with a measure — tests/pdf/parity/00-registry fails for a control that has none. With the new setting unset, every template must print exactly as today.
- Fixtures are fictional people. No private data.
- Never edit anything under docs/tracking/. Don't open a pull request. Push only to ${BR} (\`git -C ${WT} push -u origin ${BR}\` after every commit). Never force-push, never push another branch or any tag, never delete a branch, never rewrite pushed history.
- Commit messages follow the repo style, e.g. \`fix(pdf): <what now happens, in plain words> (R2-0xx)\`, \`feat(design): … (R2-0xx)\`, \`test(sections): … (R2-0xx)\`. One commit per row, or per root cause. End every message with a blank line and then exactly these two lines:
${TRAILER}
- New tests: tests/unit/<name>.unit.mjs for modules node imports directly; tests/pdf/${A.prefix}-<name>.test.mjs (${A.prefix} is this cluster's prefix) when you need the PDF harness, Vite's SSR loader (JSX, @/ imports) or the fake DOM. Reuse tests/pdf/harness.mjs, extractors.mjs, fake-dom.mjs, fake-firestore.mjs, preview-stub.mjs, tests/unit/ui-dom-harness.mjs and the tests/pdf/parity helpers. Open each test file with a short comment naming the row and the behaviour it pins, like the neighbouring tests.

CI (GitHub MCP tools — load them first: ToolSearch query "select:mcp__github__actions_run_trigger,mcp__github__actions_list,mcp__github__get_job_logs,mcp__github__actions_get"):
- Push, then dispatch: actions_run_trigger {method:"run_workflow", owner:"sairamg8", repo:"resume-writter", workflow_id:"ci.yml", ref:"${BR}", inputs:{tests:"<space-separated test files>", failfirst:"<sha>:<test1>,<test2> <sha2>:<test3>", playwright:"none" | "<specs>", cypress:"none" | "<specs>"}}. Shas must be pushed (7+ chars). \`tests\` = your new/changed tests + the existing test files that exercise the code you changed (grep -rl the module/component names in tests/). If you changed UI that a Cypress or Playwright spec touches (grep cypress/e2e and tests/playwright for its selectors/text), name those specs; else "none". Always pass all four inputs (use "" for tests/failfirst you don't need).
- Find your run: actions_list {method:"list_workflow_runs", owner:"sairamg8", repo:"resume-writter", resource_id:"ci.yml", workflow_runs_filter:{branch:"${BR}", event:"workflow_dispatch"}, perPage:5} → the newest. Wait with Bash \`sleep 90\` between polls (a run takes ~5–20 min; queued is normal — ten clusters share the runners). Then actions_list {method:"list_workflow_jobs", resource_id:"<run id>"} and get_job_logs {job_id, return_content:true, tail_lines:200} (or {run_id, failed_only:true, return_content:true, tail_lines:200}). The failfirst job prints "ok <sha> — … fail without the fix" and "ok <sha> — … pass with it" per pair; the lint job runs oxlint on src tests cypress.
- Iterate until everything you touched passes. A failure that isn't yours: dispatch the same tests on ref claude/confident-goldberg-2uig8b (the base) to prove it is a baseline failure, and record it. Batch what you need into as few dispatches as you can.

${GLOBAL_NOTE}`

const ROW_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    outcome: { type: 'string', enum: ['fixed', 'partial', 'already-fixed', 'duplicate', 'not-a-bug', 'known-limit', 'not-fixed'] },
    commits: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    remaining: { type: 'string' },
    ciRuns: { type: 'array', items: { type: 'string' } },
    baselineFailures: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['id', 'outcome', 'commits', 'tests', 'summary', 'remaining', 'ciRuns', 'notes'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'string' } },
    fixedByReviewer: { type: 'array', items: { type: 'string' } },
    commits: { type: 'array', items: { type: 'string' } },
    outcomeChanges: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, outcome: { type: 'string' }, summary: { type: 'string' }, remaining: { type: 'string' },
      addCommits: { type: 'array', items: { type: 'string' } }, addTests: { type: 'array', items: { type: 'string' } },
    }, required: ['id'] } },
    finalHead: { type: 'string' },
    finalCi: { type: 'string' },
    allGreen: { type: 'boolean' },
    baselineFailures: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['issues', 'fixedByReviewer', 'commits', 'outcomeChanges', 'finalHead', 'finalCi', 'allGreen', 'notes'],
}

const done = []
phase('Rows')
for (const row of A.rows) {
  const prior = done.length ? JSON.stringify(done, null, 1) : 'none yet — you are the first on this branch'
  const task = row.task ? `${row.id} (${row.task})` : row.id
  const r = await agent(`${RULES}

YOUR TASK: tracker row ${task} in cluster "${A.cluster}". You own this one task only; the others in the cluster are done one at a time by other workers.
BRIEF AND PRE-MADE DECISIONS from the Round 2 lead (follow them; where the code proves one wrong, do the right thing and say why in notes):
${row.brief}

Tasks in this cluster, in order: ${A.rows.map((x) => x.task ? `${x.id} (${x.task})` : x.id).join(' → ')}.
Reports of the tasks already done on this branch: ${prior}

STEPS
1. \`git -C ${WT} status\`, \`git -C ${WT} log --oneline -5\`. Read the row, the brief and the code; confirm what still reproduces at HEAD (by reading the code or by a test on CI). Rows were filed 2026-09-23; Round 1 may already have fixed parts (git log -- <file>, and the ✅/⏸ rows in the same tracker files).
2. If it no longer reproduces, is a duplicate, not a bug, or a known limit: no code change — give concrete proof (the commit that fixed it, the row it duplicates, the reason).
3. Otherwise: a failing test first → the fix → oxlint → commit → push. For a feature-sized task, ship the brief's core completely and well, and list the rest as remaining.
4. CI: dispatch, wait, read the logs, fix, until green; each fix commit's failfirst pair must report both "fail without the fix" and "pass with it".
5. Leave ${WT} clean with everything pushed (git status clean, HEAD == origin/${BR}).

RETURN (structured): id "${row.id}"; outcome; commits (short shas, in order); tests (test files added or changed); summary (1–3 plain sentences in the tracker's **Now:** voice: what now happens for the user, or the proof for a closed row); remaining (what is left, for partial/not-fixed; "" otherwise); ciRuns (each run id + a one-line result, e.g. "36012345678: tests 14/14 pass, failfirst 2/2 ok, lint ok"); baselineFailures; notes (new bugs found, risky spots, files other clusters may conflict on).`, { label: `${A.cluster}:${task}`, phase: 'Rows', schema: ROW_SCHEMA })
  const rep = r || { id: row.id, outcome: 'not-fixed', commits: [], tests: [], summary: 'The worker returned nothing.', remaining: row.brief, ciRuns: [], notes: 'worker died' }
  rep.id = row.id
  if (row.task) rep.task = row.task
  done.push(rep)
  log(`${A.cluster} ${task}: ${rep.outcome} ${rep.commits.join(',')}`)
}

phase('Review')
const review = await agent(`${RULES}

YOU ARE THE INDEPENDENT REVIEWER for Round 2 cluster "${A.cluster}": worktree ${WT}, branch ${BR}, base ${A.base}. You did not write this code.
The workers' per-task reports: ${JSON.stringify(done, null, 1)}
The briefs they were given: ${JSON.stringify(A.rows, null, 1)}

Brief (CLUSTER-PROTOCOL.md): Adversarially review this branch; assume each claim is wrong until you see it hold. For each row: read the row (grep its ID in docs/tracking/bug-status-r2/) and the diff (\`git -C ${WT} log -p ${A.base}..HEAD\`). Does the change fix the defect at the root for every case the Repro names, without breaking other templates, other exporters (PDF, preview, Word, Markdown, ATS text, JSON Resume must agree), other callers of a changed function, or older stored data? Did the worker deliver the brief's core, and is every "remaining" honest? Fail-first, on CI only (the failfirst input): each fix commit's tests must fail without its src/ changes; strengthen any test that passes without its fix or that would stay green if the code did nothing. Run every added or changed test file plus the existing tests of the changed modules on CI (the tests input) — never locally — and the browser specs the UI changes touch. Check each closed row's proof is true. Check new controls are in the parity registry and defaults print unchanged. Run oxlint on the changed files. Fix every real problem you find (commits in the same style and trailers, pushed), and report the issues and any row whose outcome should change.

Your LAST CI dispatch must be on the final head of ${BR} (after your last push) and cover: every added/changed test file and the existing tests of the changed modules (tests), every fix commit on the branch including yours (failfirst), and the affected Cypress/Playwright specs. It must be green apart from proven baseline failures. Leave ${WT} clean and pushed.

RETURN: issues (each real problem found, one line), fixedByReviewer (what you fixed, with short sha), commits (your commits), outcomeChanges (rows whose outcome/summary/remaining/commits/tests should change — include addCommits/addTests for your commits that belong to a row), finalHead (short sha), finalCi (run id + one-line result), allGreen, baselineFailures, notes.`, { label: `${A.cluster}:review`, phase: 'Review', schema: REVIEW_SCHEMA })

// Merge sub-task reports into one entry per row, then apply the reviewer's changes.
const byId = new Map()
for (const d of done) {
  const cur = byId.get(d.id)
  if (!cur) { byId.set(d.id, { id: d.id, outcome: d.outcome, commits: [...d.commits], tests: [...d.tests], summary: d.summary, remaining: d.remaining || '', ci: [...(d.ciRuns || [])], notes: d.notes || '' }); continue }
  const order = ['fixed', 'already-fixed', 'duplicate', 'not-a-bug', 'known-limit', 'partial', 'not-fixed']
  const worst = order.indexOf(d.outcome) > order.indexOf(cur.outcome) ? d.outcome : cur.outcome
  cur.outcome = (worst === 'not-fixed' && (cur.commits.length || d.commits.length)) ? 'partial' : worst
  cur.commits.push(...d.commits)
  for (const t of d.tests) if (!cur.tests.includes(t)) cur.tests.push(t)
  cur.summary = `${cur.summary} ${d.summary}`.trim()
  cur.remaining = [cur.remaining, d.remaining].filter(Boolean).join(' ')
  cur.ci.push(...(d.ciRuns || []))
  cur.notes = [cur.notes, d.notes].filter(Boolean).join(' | ')
}
for (const ch of (review && review.outcomeChanges) || []) {
  const cur = byId.get(ch.id)
  if (!cur) continue
  if (ch.outcome) cur.outcome = ch.outcome
  if (ch.summary) cur.summary = ch.summary
  if (ch.remaining !== undefined && ch.remaining !== null) cur.remaining = ch.remaining
  for (const c of ch.addCommits || []) if (!cur.commits.includes(c)) cur.commits.push(c)
  for (const t of ch.addTests || []) if (!cur.tests.includes(t)) cur.tests.push(t)
}
const baseline = [...new Set([...done.flatMap((d) => d.baselineFailures || []), ...((review && review.baselineFailures) || [])])]
const report = {
  cluster: A.cluster,
  branch: BR,
  base: A.base,
  rows: [...byId.values()].map((r) => ({ id: r.id, outcome: r.outcome, commits: r.commits, tests: r.tests, summary: r.summary, remaining: r.remaining })),
  review: { issues: (review && review.issues) || ['the reviewer returned nothing'], fixedByReviewer: (review && review.fixedByReviewer) || [] },
  baselineFailures: baseline,
  notes: [
    `CI: ${[...byId.values()].map((r) => `${r.id}: ${r.ci.join('; ')}`).join(' || ')}`,
    review ? `Review final CI on ${review.finalHead}: ${review.finalCi} (allGreen=${review.allGreen}). ${review.notes}` : 'no review result',
    ...[...byId.values()].map((r) => r.notes ? `${r.id}: ${r.notes}` : '').filter(Boolean),
  ].join('\n'),
}

phase('Finish')
const fin = await agent(`You finish Round 2 cluster "${A.cluster}" in worktree ${WT} (branch ${BR}). Bash cwd resets: use \`cd ${WT} && …\`.
1. Check \`git -C ${WT} status\` is clean and \`git -C ${WT} fetch origin ${BR}\` then HEAD == origin/${BR}. If there are uncommitted changes, stop and return what they are (do not commit them).
2. Check every short sha named in the report below exists on the branch (\`git -C ${WT} cat-file -e <sha>\` and \`git -C ${WT} merge-base --is-ancestor <sha> HEAD\`); fix a wrong sha in the JSON only if you can identify the right commit unambiguously from git log.
3. Write ${WT}/wf-reports/${A.cluster}.json containing this JSON (pretty-printed, 2-space indent, trailing newline):
${JSON.stringify(report, null, 2)}
4. Commit only that file with the message \`chore(wf): ${A.cluster} cluster report\` followed by a blank line and exactly:
${TRAILER}
5. \`git -C ${WT} push -u origin ${BR}\` and confirm HEAD == origin/${BR}. Never force-push.
Return JSON {"reportCommit": "<short sha>", "head": "<short sha>", "problems": "<anything wrong, or empty>"}.`, { label: `${A.cluster}:finish`, phase: 'Finish', schema: { type: 'object', properties: { reportCommit: { type: 'string' }, head: { type: 'string' }, problems: { type: 'string' } }, required: ['reportCommit', 'head', 'problems'] } })

return { cluster: A.cluster, branch: BR, report, review, finish: fin }
