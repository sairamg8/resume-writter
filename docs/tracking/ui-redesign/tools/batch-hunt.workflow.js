export const meta = {
  name: 'batch-hunt',
  description: 'Bug hunt for one UI batch: lens finders (loop until a round adds nothing new, max rounds from args), adversarial verification of each finding by two skeptics, results saved to plan-work/<batch>-hunt.json. Find and verify only: fixes are a separate step',
  phases: [
    { title: 'Find', detail: 'one finder per lens reads the batch diff and the code around it' },
    { title: 'Verify', detail: 'two skeptics per finding try to refute it; it survives only if both fail' },
  ],
}

// args: { batch: 'B1', base: '<sha before the batch>', head: 'HEAD', lenses: [{key, text}], maxRounds: 2, known: [] }
const WT = '/home/user/resume-writter/.claude/worktrees/ui-rebuild'
const D = WT + '/docs/tracking/ui-redesign'
const batch = args.batch
const base = args.base
const MAX = args.maxRounds || 2

const COMMON = `
You work in the git worktree ${WT} (branch worktree-ui-rebuild). Stay inside it; never cd to /home/user/resume-writter itself. Run git as plain, separate commands. READ-ONLY: do NOT edit, commit, push, run tests, install, build or start servers (CI is the only place tests run). Read ${D}/PARITY-RULE.md, ${D}/batches/${batch}.md (the batch spec) and the diff of the batch: git diff ${base}..HEAD (plain command; read the src files in full, not only hunks, where a change matters). Accessibility is deferred: do NOT report aria/role/contrast/focus findings. Report only REAL defects you can prove by pointing at file:line and a concrete input/state that produces a wrong result; no style opinions, no hypothetical "could be nicer".
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

const seen = []
const confirmed = []
let dry = 0
for (let round = 1; round <= MAX && dry < 1; round++) {
  phase('Find')
  const known = seen.map((f) => `${f.id}: ${f.title} (${f.file})`).concat(args.known || [])
  const found = (await parallel(args.lenses.map((l) => () => agent(`${COMMON}
YOUR LENS: ${l.text}
Round ${round}. Already reported (do NOT repeat these; find NEW ones): ${known.length ? known.join(' | ') : 'none yet'}.
Return the schema. "covered" says which files and flows you actually read.`,
    { label: `find:${l.key}:r${round}`, phase: 'Find', schema: FINDINGS, effort: 'high' })))).filter(Boolean)
  const fresh = []
  for (const r of found) for (const f of r.findings) {
    const key = `${f.file}|${f.title}`.toLowerCase()
    if (seen.some((s) => `${s.file}|${s.title}`.toLowerCase() === key)) continue
    f.id = `${batch}-H${round}-${seen.length + fresh.length + 1}`
    fresh.push(f)
  }
  log(`round ${round}: ${fresh.length} new findings`)
  if (!fresh.length) { dry++; continue }
  dry = 0
  fresh.forEach((f) => seen.push(f))
  phase('Verify')
  const judged = await parallel(fresh.map((f) => () => parallel([0, 1].map((i) => () => agent(`${COMMON}
You are skeptic ${i + 1} of 2. Try to REFUTE this finding by reading the code and the tests it touches: ${JSON.stringify(f)}
Default to refuted=true when the scenario cannot actually happen, is already handled elsewhere, is pre-existing and not touched by this batch, or is only accessibility. refuted=false only when you traced the failing path yourself. Give the severity you believe.`,
    { label: `verify:${f.id}:${i}`, phase: 'Verify', schema: VERDICT, effort: 'high' }))).then((vs) => ({ f, vs: vs.filter(Boolean) }))))
  for (const j of judged) {
    const alive = j.vs.length > 0 && j.vs.every((v) => !v.refuted)
    if (alive) confirmed.push({ ...j.f, verdicts: j.vs })
  }
  log(`round ${round}: ${confirmed.length} confirmed so far`)
}

const out = { batch, base, rounds: MAX, reported: seen.length, confirmed }
return out
