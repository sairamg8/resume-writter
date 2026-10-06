export const meta = {
  name: 'b1-hunt-round4',
  description: 'B1 hunt round 4: finders on the round-3 fix commits (intent-based New Cover abandonment in Dashboard.jsx and the strengthened tests), two skeptics per finding, loop until a round finds nothing new',
  phases: [{ title: 'Find' }, { title: 'Verify' }],
}
const WT = '/home/user/resume-writter/.claude/worktrees/ui-rebuild'
const D = WT + '/docs/tracking/ui-redesign'
const base = '0c20d15'
const MAX = 2
const COMMON = `
You work in the git worktree ${WT} (branch worktree-ui-rebuild). Stay inside it. Run git as plain, separate commands. READ-ONLY: do NOT edit, commit, push, run tests, install, build or start servers (CI is the only place tests run). Read ${D}/PARITY-RULE.md and ${D}/batches/B1.md and the fixes to review: git diff ${base}..HEAD -- src tests (src change: dc8856e in src/pages/Dashboard.jsx replaces the 10 s wall-clock guard of the abandoned New Cover request by an interaction listener (document pointerdown/keydown capture, window hashchange/popstate) active while a request is open; the other commits are tests: 0df1499, 4cef788, 736c3b1, f0ac84e, ccf7374; ignore the temporary mutation commit and its revert at the end of the log, they cancel out). Read src/pages/Dashboard.jsx in full and the tests tests/pdf/179-ui-b1-letter-*.test.mjs, 178-ui-b1-*.test.mjs and 96-dashboard.test.mjs. Accessibility is deferred: do NOT report aria/role/contrast/focus findings. Report only REAL defects you can prove by file:line and a concrete input/state that gives a wrong result; no style opinions. A test that passes for the wrong reason (cannot fail, or fails for another reason) is a defect.
Already known and handled (do NOT repeat): after one failed picker import New Cover keeps the letter fallback for that visit; Career History's chunk is requested at first render; a render crash inside a lazy piece shows the connection notice; a late-SUCCESS picker opens uninvited (split verdict); a harmless tap during the wait drops the request with nothing shown (design limit: the next New Cover makes the letter at once); old hard-coded blue (#0c66e4) and track grey (#f1f2f4) in other dialogs and charts (for the restyle batches); Reload page offered while a save fails; unused Cypress reach helpers; the round-3 findings H3-1-1, H3-1-2, H3-1-6, H3-2-8, H3-2-9 are what these commits fix.
`
const FINDINGS = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, title: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
      file: { type: 'string' }, line: { type: 'number' }, what: { type: 'string' }, scenario: { type: 'string' }, fix: { type: 'string' },
    }, required: ['id', 'title', 'severity', 'file', 'what', 'scenario', 'fix'] } },
    covered: { type: 'string' },
  },
  required: ['lens', 'findings', 'covered'],
}
const VERDICT = { type: 'object', properties: { refuted: { type: 'boolean' }, reason: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] } }, required: ['refuted', 'reason', 'severity'] }
const LENSES = [
  { key: 'intent-listener', text: 'The interaction-intent logic in dc8856e: listener registration/cleanup timing in the effect, the starting gesture counted by mistake (pointerdown/keydown/click ordering, Space on keyup, double click, touch, pen), a request that never closes (the fallback never mounts, so moved stays true for the next request?), moved reset, a second New Cover while the first is pending, once-per-visit guard interplay, StrictMode double effects, unmount during a request, zero/one/several résumés cases, and any path where a letter is made twice or a letter request is lost although the person only waited.' },
  { key: 'tests-strength', text: 'The strengthened tests (0df1499, 4cef788, 736c3b1, f0ac84e, ccf7374, 179-ui-b1-letter-intent, 179-ui-b1-letter-stale-fallback): for each, apply in your head the mutation it claims to catch and say whether the test would really go red, and whether it could go red for the wrong reason or fail on correct code (flaky timing, polling that passes on timeout, stubs that leak between tests, restoring globals, bounded waits too short for a slow CI machine).' },
  { key: 'startup-parity', text: 'Regression sweep of src/pages/Dashboard.jsx against its version before B1 (git show 6923727:src/pages/Dashboard.jsx): every function of the Dashboard still works (import, New Resume, New Cover three cases, Career History open and navigate, demo originals, delete/rename flows, notices, Job Tracker / Projects buttons, Terms/Privacy), nothing was lost by the lazy loading, and no start-up weight crept in (imports on the start-up path).' },
]
const seen = []
const confirmed = []
let dry = 0
for (let round = 1; round <= MAX && dry < 1; round++) {
  phase('Find')
  const known = seen.map((f) => `${f.id}: ${f.title} (${f.file})`)
  const found = (await parallel(LENSES.map((l) => () => agent(`${COMMON}
YOUR LENS: ${l.text}
Round ${round}. Already reported this run (do NOT repeat): ${known.length ? known.join(' | ') : 'none yet'}.
Return the schema; "covered" says which files and flows you actually read.`,
    { label: `find:${l.key}:r${round}`, phase: 'Find', schema: FINDINGS, effort: 'high' })))).filter(Boolean)
  const fresh = []
  for (const r of found) for (const f of r.findings) {
    const key = `${f.file}|${f.title}`.toLowerCase()
    if (seen.some((s) => `${s.file}|${s.title}`.toLowerCase() === key)) continue
    f.id = `B1-H3-${round}-${seen.length + fresh.length + 1}`
    fresh.push(f)
  }
  log(`round ${round}: ${fresh.length} new findings`)
  if (!fresh.length) { dry++; continue }
  dry = 0
  fresh.forEach((f) => seen.push(f))
  phase('Verify')
  const judged = await parallel(fresh.map((f) => () => parallel([0, 1].map((i) => () => agent(`${COMMON}
You are skeptic ${i + 1} of 2. Try to REFUTE this finding by reading the code and the tests: ${JSON.stringify(f)}
Default to refuted=true when the scenario cannot happen, is handled elsewhere, is pre-existing and untouched by B1, or is only accessibility. refuted=false only when you traced the failing path yourself.`,
    { label: `verify:${f.id}:${i}`, phase: 'Verify', schema: VERDICT, effort: 'high' }))).then((vs) => ({ f, vs: vs.filter(Boolean) }))))
  for (const j of judged) {
    const alive = j.vs.length > 0 && j.vs.every((v) => !v.refuted)
    if (alive) confirmed.push({ ...j.f, verdicts: j.vs })
  }
  log(`round ${round}: ${confirmed.length} confirmed so far`)
}
return { reported: seen.length, seen, confirmed }
