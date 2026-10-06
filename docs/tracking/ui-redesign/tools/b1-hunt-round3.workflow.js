export const meta = {
  name: 'b1-hunt-round3',
  description: 'B1 hunt round 3: finders on the four hunt-fix commits (and the B1 lazy code they touch), two skeptics per finding, loop until a round finds nothing new',
  phases: [{ title: 'Find' }, { title: 'Verify' }],
}
const WT = '/home/user/resume-writter/.claude/worktrees/ui-rebuild'
const D = WT + '/docs/tracking/ui-redesign'
const base = '7c02748'
const MAX = 2
const COMMON = `
You work in the git worktree ${WT} (branch worktree-ui-rebuild). Stay inside it. Run git as plain, separate commands. READ-ONLY: do NOT edit, commit, push, run tests, install, build or start servers (CI is the only place tests run). Read ${D}/PARITY-RULE.md and ${D}/batches/B1.md and the fixes to review: git diff ${base}..HEAD -- src (four commits: 190d2ff brand pressed token, 55d3ea9 module-level lazy cache in src/pages/Dashboard.jsx, bfcd7a6 Reload page notice, 538469c stale New Cover fallback). Read src/pages/Dashboard.jsx in full, and the tests tests/pdf/179-ui-b1-*.test.mjs and 178-ui-b1-*.test.mjs. Accessibility is deferred: do NOT report aria/role/contrast/focus findings. Report only REAL defects you can prove by file:line and a concrete input/state that gives a wrong result; no style opinions. Tests are judged too: a test that passes for the wrong reason (cannot fail) is a defect.
Already known and handled (do NOT repeat): after one failed picker import New Cover keeps the letter fallback for that visit; Career History's chunk is requested at first render and is blank until it arrives; a render crash inside a lazy piece shows the connection notice; the 7 findings H1-6, H1-9, H2-12, H2-13, H2-14, H2-15, H2-18 fixed by these very commits.
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
  { key: 'lazy-cache', text: 'The module-level lazy cache and Reload page notice (55d3ea9, bfcd7a6): a rejected import cached forever, retry semantics, remount, StrictMode double mount, two Dashboards at once, tests that share module state between cases, anything that makes Career History or the picker unreachable (a function lost: PARITY-RULE).' },
  { key: 'stale-fallback', text: 'The New Cover flow (538469c and fcba71e): the three cases (zero, one, several résumés), once-per-visit guard, timers and effects cleaned on unmount, abandoned clicks, double clicks, the clock seam in the test, a letter made twice or not at all, drafts lost.' },
  { key: 'tokens-and-tests', text: 'The pressed brand token (190d2ff) and the legacy token re-point (13696fe): any surface whose hover/pressed/focus colour becomes identical or unreadable, kit tokens whose values changed in a way that breaks a pinned class; and the B1 tests that cannot fail (vacuous assertions, selectors that match nothing, polling helpers that pass on timeout).' },
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
