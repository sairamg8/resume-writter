export const meta = {
  name: 'ui-rebuild-plan',
  description: 'Plan the UI-only rebuild of the whole app: 3 competing planners, 3 judges, synthesis, coverage critic with a mechanical parity check, 2 skeptics, revision, then PLAN.md and one brief per batch',
  phases: [
    { title: 'Plan', detail: 'three planners with different angles each propose the full batch sequence' },
    { title: 'Judge', detail: 'three judges with distinct lenses score the plans and name what to graft' },
    { title: 'Synthesize', detail: 'one agent builds the final plan from the winner plus grafts' },
    { title: 'Check', detail: 'coverage critic (mechanical: every parity row owned once) and two skeptics' },
    { title: 'Revise', detail: 'fix what the critic and skeptics found' },
    { title: 'Write', detail: 'PLAN.md, batches/B<n>.md, RUN-STATE update' },
  ],
}

const WT = '/home/user/resume-writter/.claude/worktrees/ui-rebuild'
const D = WT + '/docs/tracking/ui-redesign'

const COMMON = `
You work in the git worktree ${WT} (branch worktree-ui-rebuild). Stay inside it; never cd to /home/user/resume-writter itself.
We are planning the React REBUILD of the app's whole UI to match the design canvas (https://claude.ai/artifact/SjfCTE1dSTgt1UY63uoFiM, 39 artboards, data only: never publish to or edit it). THE OWNER'S BINDING RULE: ${D}/PARITY-RULE.md (UI only, every existing function stays; new capabilities are PARKED, not built). READ FIRST, in this order: PARITY-RULE.md, RUN-STATE.md (cadence and the batch gate), README.md (decisions, BUILD CONSTRAINTS, product calls), BRIEF.md, AREAS.md, then parity/_constraints.md, parity/_tests.md, parity/_ci.md in full.
The audits: parity/<area>.md for editor-content, editor-design-templates, editor-letter-ats-export, shell-docs, applications, projects, mobile (one row per live function: ID, live behaviour, where it sits in the new design, status SAME / RESTYLED / MOVED / CHANGED / MISSING, fix; a "DRAWN BUT NOT IN THE LIVE APP" section; the tests that pin the area; unknowns; an "Added by review" section). They are large (about 50 kB each): do NOT read them end to end. Use Grep for status counts and row IDs, read the CHANGED / MISSING rows, the "DRAWN BUT NOT" section and the unknowns in full, and open a table only where you need it to size or split a batch.
REVIEWS DONE: every area's review is finished (editor-content and shell-docs had a second round; two reviewers still call some tooltip-level wording unlisted). The files list rows added by review in their own sections. Assign parity ownership by area file plus table section or ID range, AND state a catch-all rule per area ("every other row of <file>, including any row added by review, belongs to batch X"), so no row can fall through; the coverage critic re-checks against the final files. NOTE the ID prefixes EDIT- and NEW- are used by BOTH editor-content.md and editor-design-templates.md: always cite "<file>: <ID>".
HARD RULES for the plan: tests run only on CI (dispatch ci.yml; never locally); accessibility is deferred (note, never plan it); commits are authored sairamgudiputi with no trailers; the start-up path has about 0 kB spare (71-startup-chunks), so every batch states how it stays within it; new code lives in lazy chunks; each fix/feature needs a test that fails without it (failfirst on CI); stale tests are updated to the intended behaviour with evidence, never weakened; Editor.jsx, EditorHeader.jsx, useEditorTab.js, EditorPreviewPane.jsx, index.css, the DesignPanel*/PersonalInfoEditor* files, Dashboard/AuthBar/ResumeCard, AppRoutes.jsx and the parity registries are single-owner files: no two batches or two clusters of one batch edit the same file in parallel; the work goes to the designated branch claude/wonderful-maxwell-vu8xqw only (never master).
THE MACHINE: 4 CPUs, one workflow runs 2 agents at a time, several workflows may run side by side while the box stays under 80% CPU; a work window is 3 hours then a 2-hour rest (RUN-STATE.md), one batch at a time, the next starts only when the current batch's gate is passed. So size each batch to be finishable in about ONE 3-hour window (code, bug hunt, CI proof); a larger screen group is split.
STANDARD BATCH PROTOCOL (you may refine it, not drop a step): (1) the lead reads the batch brief and RUN-STATE; (2) 2-4 build clusters, each one owning separate files, each an agent (medium effort) that builds, adds its tests and pushes its own commits to the shared branch in turn (the lead merges nothing blindly: it reads every claimed CI run itself); (3) a render check against the board (vite dev server + a Playwright screenshot, one at a time, never a test run) so the screen is compared with the canvas; (4) a second agent reviews each cluster against its parity rows (every row SAME / MOVED / RESTYLED); (5) a bug hunt that loops until a round finds nothing new (finders by lens: functions that stopped working, perf/render counts, persistence, narrow widths, keyboard, error/empty states, tests that pass for the wrong reason); fixes with fail-first tests; (6) CI: failfirst for the new tests, a related-tests run, then ONE full gate on the final head; (7) the batch report docs/tracking/ui-redesign/batches/B<n>-report.md, RUN-STATE and HANDOFF updated, pushed.
`
const SAVE = (name) => `
BEFORE you return: save EXACTLY the JSON you are about to return to ${D}/plan-work/${name}.json with the Write tool (create the folder). A container restart wiped an earlier run's results; files in the worktree survive.`

const BATCH = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    goal: { type: 'string' },
    whyHere: { type: 'string' },
    dependsOn: { type: 'array', items: { type: 'string' } },
    boards: { type: 'array', items: { type: 'string' } },
    parityOwned: { type: 'array', items: { type: 'string' }, description: 'which parity rows: "<area file>: <ID range or section>" entries; together the batches must cover every row exactly once' },
    parked: { type: 'array', items: { type: 'string' } },
    clusters: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, filesOwned: { type: 'array', items: { type: 'string' } }, newFiles: { type: 'array', items: { type: 'string' } }, work: { type: 'string' } }, required: ['name', 'filesOwned', 'work'] } },
    testsNew: { type: 'array', items: { type: 'string' } },
    testsToUpdate: { type: 'array', items: { type: 'string' } },
    startupBudgetPlan: { type: 'string' },
    bugHuntFocus: { type: 'array', items: { type: 'string' } },
    doneCriteria: { type: 'array', items: { type: 'string' } },
    estimatedHours: { type: 'number' },
    risks: { type: 'array', items: { type: 'string' } },
    ownerCalls: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'title', 'goal', 'whyHere', 'dependsOn', 'boards', 'parityOwned', 'parked', 'clusters', 'testsNew', 'testsToUpdate', 'startupBudgetPlan', 'bugHuntFocus', 'doneCriteria', 'estimatedHours', 'risks', 'ownerCalls'],
}
const PLAN = {
  type: 'object',
  properties: {
    angle: { type: 'string' },
    principles: { type: 'array', items: { type: 'string' } },
    canvasCorrections: { type: 'object', properties: { needed: { type: 'boolean' }, whenAndHow: { type: 'string' } }, required: ['needed', 'whenAndHow'] },
    batches: { type: 'array', items: BATCH },
    sharedRisks: { type: 'array', items: { type: 'string' } },
    parkedForOwner: { type: 'array', items: { type: 'string' } },
    openOwnerCalls: { type: 'array', items: { type: 'string' } },
    totalWindowsEstimate: { type: 'number' },
  },
  required: ['angle', 'principles', 'canvasCorrections', 'batches', 'sharedRisks', 'parkedForOwner', 'openOwnerCalls', 'totalWindowsEstimate'],
}

const ANGLES = [
  { key: 'foundation', text: 'FOUNDATION-FIRST: land the shared pieces first (design tokens in index.css, the new top bar / shell, the dock and drawer pattern, popover and sub-nav primitives) and then move screen by screen on top of them.' },
  { key: 'vertical', text: 'VERTICAL SLICES: finish one whole user journey at a time (the editor first, then Documents and New, then Applications, then Projects, then phone), each batch shipping a complete, deployable slice of the new look, with only the shared pieces that slice needs.' },
  { key: 'risk', text: 'RISK-FIRST: start with the most constrained and most test-breaking pieces (the tabless editor and the dock, the start-up byte budget, the render-count tests, the tab tests) while the context is fresh, so their surprises come early; the low-risk restyles come last.' },
]

phase('Plan')
const plans = (await parallel(ANGLES.map(a => () => agent(`${COMMON}
YOUR ANGLE: ${a.text}
Produce a COMPLETE, concrete batch plan (6-14 batches) for the whole rebuild. For each batch: boards, the parity rows it owns (by area file + ID range or section, so that together all batches cover EVERY parity row exactly once, including the phone rows and the CHANGED/MISSING ones that the build must restore), the clusters (separate file ownership), new tests and tests to update (name the files from parity/_tests.md), how it stays within the start-up budget, the bug-hunt focus, done criteria (the batch gate in RUN-STATE.md plus batch-specific ones), hours (aim at most 3), risks, owner calls. Decide whether the canvas itself needs a correction pass for CHANGED/MISSING rows (a "canvas correction" step: boards redrawn so the builder is not shown a function-dropping design) or whether the build follows the parity file's fix column; justify it. Batch 1 must be startable right now without any owner answer. Projects stays (parity rule) but its place in the order is your call. Also list what is PARKED for the owner and the owner calls still open. Return the schema.${SAVE('plan-' + a.key)}`,
  { label: `plan:${a.key}`, phase: 'Plan', schema: PLAN, effort: 'high' })))).filter(Boolean)
log(`${plans.length} plans: ${plans.map(p => p.angle + ' (' + p.batches.length + ' batches)').join('; ')}`)

phase('Judge')
const LENSES = [
  { key: 'parity', text: 'PARITY AND SAFETY: does every live function stay (the owner\'s rule)? Is any row dropped, double-owned, or left to chance? Are the CHANGED/MISSING rows and the parked list handled right? Could a batch ship a regression of a function?' },
  { key: 'feasibility', text: 'FEASIBILITY: the start-up byte budget (about 0 kB spare), the test blast radius (parity/_tests.md), CI cost and flakes, single-owner files, PERF-4 render rules, whether each batch really fits one 3-hour window and whether batch 1 really starts now.' },
  { key: 'delivery', text: 'DELIVERY: ordering and dependencies, how early the owner sees value, how deployable each batch is on its own (the site must work after every batch), how little rework one batch causes the next, and how well the plan survives the 3-on / 2-off cadence.' },
]
const verdicts = (await parallel(LENSES.map(l => () => agent(`${COMMON}
You are a judge with ONE lens. ${l.text}
Three planners produced these plans (JSON):
${JSON.stringify(plans)}
Check claims against the files where a claim decides the outcome (grep the parity files, the scout reports and the source). Score each plan 0-10 on your lens, name the winner on your lens, list for each plan the concrete defects found on your lens, and name the specific ideas worth grafting from the non-winners into the winner. Be adversarial: default to a low score when a claim is unsupported.`,
  { label: `judge:${l.key}`, phase: 'Judge', effort: 'high', schema: {
    type: 'object',
    properties: { lens: { type: 'string' }, scores: { type: 'array', items: { type: 'object', properties: { angle: { type: 'string' }, score: { type: 'number' }, defects: { type: 'array', items: { type: 'string' } } }, required: ['angle', 'score', 'defects'] } }, winner: { type: 'string' }, graft: { type: 'array', items: { type: 'string' } } },
    required: ['lens', 'scores', 'winner', 'graft'] } })))).filter(Boolean)

phase('Synthesize')
const synth = await agent(`${COMMON}
Build the FINAL plan. Inputs: three plans and three judges' verdicts.
PLANS: ${JSON.stringify(plans)}
VERDICTS: ${JSON.stringify(verdicts)}
Take the best-scoring plan as the spine, fix every defect the judges named, graft the named ideas, and make the result internally consistent: dependencies acyclic, each batch about 3 hours at most, batch 1 startable now, every parity row owned exactly once, start-up budget handled in each batch, tests named from the scout report. Keep the schema (angle = "synthesis").${SAVE('synth')}`,
  { label: 'synthesize', phase: 'Synthesize', schema: PLAN, effort: 'high' })

phase('Check')
const checks = await parallel([
  () => agent(`${COMMON}
You are the COVERAGE CRITIC. The final plan (JSON) is:
${JSON.stringify(synth)}
Do a MECHANICAL check, with a small node script you write in the scratchpad and run (reading files is fine; this is not a test run): extract every parity row ID from ${D}/parity/*.md (the first column of each table row; look at the real formats, they vary by file), parse each batch's parityOwned entries (ID ranges or section names; resolve section names to row IDs by reading the file), and report: rows owned by NO batch, rows owned by MORE than one batch, ranges that match no rows, and CHANGED/MISSING rows whose fix no batch carries. Also check the "DRAWN BUT NOT IN THE LIVE APP" items are all in parkedForOwner, and that every test file named in testsToUpdate exists and every board named exists in the canvas list (README.md/AREAS.md). Save the script and a coverage report to ${D}/batches/coverage-check.md (create the folder). Return the findings; an empty list means a clean pass.`,
    { label: 'critic:coverage', phase: 'Check', effort: 'high', schema: { type: 'object', properties: { clean: { type: 'boolean' }, findings: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, detail: { type: 'string' }, fix: { type: 'string' } }, required: ['kind', 'detail', 'fix'] } } }, required: ['clean', 'findings'] } }),
  () => agent(`${COMMON}
You are SKEPTIC 1 (will it hold up in practice?). Try to BREAK this plan: ${JSON.stringify(synth)}
Attack: batch sizes vs a 3-hour window and 2 agents at a time; the start-up byte budget for each batch (verify in parity/_constraints.md and the source: tests/pdf/71-startup-chunks*); single-owner file collisions between clusters; hidden dependencies between batches (a batch that needs a thing a later batch builds); the tests that will go red and whether the plan updates them in the same batch; whether the site stays deployable after each batch; whether the CI recipe in parity/_ci.md can really prove each batch; the editor's PERF-4 render rules. Default to "this will fail" when a claim is unsupported. Return concrete issues with severity (blocker / major / minor) and the exact fix.`,
    { label: 'skeptic:practice', phase: 'Check', effort: 'high', schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'where', 'problem', 'fix'] } } }, required: ['issues'] } }),
  () => agent(`${COMMON}
You are SKEPTIC 2 (does it keep the owner's rule?). Try to find where this plan would let a live function be dropped, changed, or hidden, or let a new capability slip in: ${JSON.stringify(synth)}
Attack: the CHANGED/MISSING rows (does a batch really restore each one, with a test?); parked items (could a batch build one by accident because a board draws it?); behaviours that are invisible in boards (autosave, caps and notices, sync, persistence, shortcuts, error/empty/offline/demo/signed-out states); the phone layouts; the public page and legal pages; Projects; the tabless editor (tab deep links like ?tab=coverletter, the Cover letter and ATS flows, switching between them); export/import paths. Sample at least 25 live behaviours from the SOURCE (not from the tables) and trace each to its batch. Return concrete issues with severity (blocker / major / minor) and the exact fix.`,
    { label: 'skeptic:parity', phase: 'Check', effort: 'high', schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'where', 'problem', 'fix'] } } }, required: ['issues'] } }),
])
const [coverage, s1, s2] = checks
log(`coverage clean: ${coverage ? coverage.clean : 'no result'}; skeptic issues: ${(s1 ? s1.issues.length : '?')} + ${(s2 ? s2.issues.length : '?')}`)

phase('Revise')
const final = await agent(`${COMMON}
Revise the plan. CURRENT PLAN: ${JSON.stringify(synth)}
COVERAGE CRITIC: ${JSON.stringify(coverage)}
SKEPTIC (practice): ${JSON.stringify(s1)}
SKEPTIC (parity): ${JSON.stringify(s2)}
Fix every blocker and major issue and every coverage finding in the plan itself (re-split or re-order batches, move rows, add tests, add a canvas-correction step if needed); take the minor ones that are plainly right. For anything you reject, say why in "rejected" (keep it short). After the fix, every parity row must still be owned exactly once (re-run the coverage script saved in ${D}/batches/coverage-check.md or its node script if you moved rows, and keep its report current).${SAVE('final')}`,
  { label: 'revise', phase: 'Revise', effort: 'high', schema: { type: 'object', properties: { plan: PLAN, rejected: { type: 'array', items: { type: 'string' } }, coverageClean: { type: 'boolean' } }, required: ['plan', 'rejected', 'coverageClean'] } })

phase('Write')
const written = await agent(`${COMMON}
Write the plan to disk from this JSON (it is the final, reviewed plan): ${JSON.stringify(final)}
1. ${D}/PLAN.md: a readable plan for the OWNER: the principles; a table of batches (id, title, goal, hours, depends on, what the owner sees after it); the canvas-correction decision; how every batch runs (the standard batch protocol, refined); the cadence (3 on / 2 off) and what that means in calendar terms (windows estimate); the parked list; the open owner calls; the shared risks; what is NOT in scope. No marketing language; precise.
2. ${D}/batches/B<n>.md for every batch: a self-contained BRIEF a fresh session can run from: goal, the boards to read (names), parity rows owned (area file + IDs), parked items to NOT build, clusters with file ownership, the tests to add and to update, the start-up budget plan, the bug-hunt focus, done criteria and the batch gate, risks, and which of the owner's rules apply. Also an empty "Progress log" section at the end.
3. Update the "Where we are" section of ${D}/RUN-STATE.md: planning is DONE, PLAN.md written, the next step is Batch 1 (name it), the list of batches with their status "planned".
Do NOT commit or push. Return the list of files written and a 15-line summary of the plan for the owner.`,
  { label: 'write', phase: 'Write', effort: 'medium', schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } }, required: ['files', 'summary'] } })

return { plan: final, written }
