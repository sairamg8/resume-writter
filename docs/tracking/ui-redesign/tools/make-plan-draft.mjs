// Builds docs/tracking/ui-redesign/PLAN-DRAFT.md from plan-work/final.json (deterministic; no agent).
import fs from 'node:fs'
const WT = '/home/user/resume-writter/.claude/worktrees/ui-rebuild/docs/tracking/ui-redesign'
const r = JSON.parse(fs.readFileSync(WT + '/plan-work/final.json', 'utf8'))
const p = r.plan || r
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }
const cell = (s, n) => clip(s, n).replace(/\|/g, '/')
const list = (a, n = 8, w = 260) => (a || []).slice(0, n).map((x) => `  - ${clip(typeof x === 'string' ? x : JSON.stringify(x), w)}`).join('\n') + ((a || []).length > n ? `\n  - … and ${(a || []).length - n} more (see plan-work/final.json)` : '')
const out = []
const hours = p.batches.reduce((s, b) => s + (b.estimatedHours || 0), 0)
out.push('# UI rebuild: the plan (draft for the owner)', '',
  `Source: \`plan-work/final.json\` (three planners, three judges, a synthesis, a coverage critic and two skeptics, then a revision). Rule: PARITY-RULE.md (UI only, every function stays). Cadence: RUN-STATE.md (3 hours on, 2 hours off, one batch at a time).`, '',
  `**${p.batches.length} batches, about ${hours} agent-hours, estimated ${p.totalWindowsEstimate} work windows** (at 5 hours per window cycle that is about ${Math.round(p.totalWindowsEstimate * 5 / 24 * 10) / 10} days of calendar time). Coverage: ${r.coverageClean ? 'CLEAN' : 'NOT clean'}: every audited live function (1,223 rows) is owned by exactly one batch; all 524 CHANGED/MISSING rows have an owner (batches/coverage-findings.md, coverage-check.md).`, '')
out.push('## Principles', '', ...(p.principles || []).map((x) => `- ${clip(x, 700)}`), '')
out.push('## Canvas redraw?', '', `${p.canvasCorrections.needed ? 'YES' : 'NO'}: ${clip(p.canvasCorrections.whenAndHow, 1500)}`, '')
out.push('## The batches at a glance', '', '| id | hours | batch | depends on | clusters | boards |', '|---|---|---|---|---|---|')
for (const b of p.batches) out.push(`| ${b.id} | ${b.estimatedHours} | ${cell(b.title, 110)} | ${(b.dependsOn || []).join(', ') || '-'} | ${(b.clusters || []).length} | ${(b.boards || []).length} |`)
out.push('', '## Each batch', '')
for (const b of p.batches) {
  const rows = (b.parityOwned || []).length
  out.push(`### ${b.id} (${b.estimatedHours} h): ${b.title}`, '',
    `- **Goal:** ${clip(b.goal, 900)}`,
    `- **Why here:** ${clip(b.whyHere, 600)}`,
    `- **Depends on:** ${(b.dependsOn || []).join(', ') || 'nothing'}  |  **Boards:** ${(b.boards || []).join(', ')}`,
    `- **Parity rows owned:** ${rows} range/section entries (full list in plan-work/final.json)`,
    `- **Clusters (separate file ownership):**`)
  for (const c of b.clusters || []) out.push(`  - **${c.name}**: ${clip(c.work, 420)} (files: ${(c.filesOwned || []).slice(0, 5).join(', ')}${(c.filesOwned || []).length > 5 ? ', …' : ''})`)
  out.push(`- **New tests (${(b.testsNew || []).length}):**`, list(b.testsNew, 5, 200),
    `- **Existing tests to update (${(b.testsToUpdate || []).length}):**`, list(b.testsToUpdate, 5, 200),
    `- **Start-up size plan:** ${clip(b.startupBudgetPlan, 600)}`,
    `- **Bug-hunt focus:**`, list(b.bugHuntFocus, 6, 220),
    `- **Done when:**`, list(b.doneCriteria, 8, 240),
    `- **Parked (not built):** ${(b.parked || []).length ? '' : 'none'}`, (b.parked || []).length ? list(b.parked, 6, 200) : '',
    `- **Risks:**`, list(b.risks, 5, 240),
    `- **Owner calls here:** ${(b.ownerCalls || []).length ? '' : 'none'}`, (b.ownerCalls || []).length ? list(b.ownerCalls, 5, 220) : '', '')
}
out.push('## Owner calls (each has a default, so none blocks Batch 1)', '', ...(p.openOwnerCalls || []).map((x) => `- ${clip(x, 500)}`), '')
out.push('## Parked for the owner (drawn on the canvas, not in the live app: NOT built)', '', ...(p.parkedForOwner || []).map((x) => `- ${clip(x, 500)}`), '')
out.push('## Shared risks', '', ...(p.sharedRisks || []).map((x) => `- ${clip(x, 500)}`), '')
out.push('## Skeptic and critic points the revision rejected, and why', '', ...(r.rejected || []).map((x) => `- ${clip(x, 500)}`), '')
fs.writeFileSync(WT + '/PLAN-DRAFT.md', out.join('\n'))
console.log('written', out.join('\n').length, 'chars,', p.batches.length, 'batches')

// the short, owner-facing summary
const s = []
s.push('# UI rebuild: the plan in one read', '',
  `${p.batches.length} batches (about ${hours} agent-hours, ~${p.totalWindowsEstimate} work windows, about ${Math.round(p.totalWindowsEstimate * 5 / 24 * 10) / 10} days at 3 h on / 2 h off). UI only: every live function stays (PARITY-RULE.md). One batch at a time; the next starts only when the current one's gate is passed (code, bug hunt until dry, fail-first tests, full CI gate). Detail per batch: PLAN-DRAFT.md; machine-readable: plan-work/final.json.`, '',
  `Coverage check (mechanical, batches/coverage-findings.md): ${r.coverageClean ? 'CLEAN' : 'NOT clean'}: 1,223 live-function rows, each owned by exactly one batch; the 524 rows the canvas changes or does not draw all have an owner.`, '',
  '## Order of work', '', '| # | hours | batch | what you will see | needs |', '|---|---|---|---|---|')
p.batches.forEach((b, i) => s.push(`| ${b.id} | ${b.estimatedHours} | ${cell(b.title, 80)} | ${cell(b.goal, 230)} | ${(b.dependsOn || []).join(', ') || '-'} |`))
s.push('', '## How each batch runs', '', '1. Brief generated from the batch\'s parity rows. 2. 2-4 build clusters, each owning separate files, each with its own tests. 3. Render check against the canvas board. 4. A second agent reviews each cluster against its rows. 5. Bug hunt, looping until a round finds nothing new. 6. CI: fail-first for the new tests, related tests, then ONE full gate. 7. Report + RUN-STATE + push to claude/wonderful-maxwell-vu8xqw (never master; deploying is your call).', '',
  '## Decisions already taken in the plan', '', ...(p.principles || []).slice(0, 6).map((x) => `- ${clip(x, 360)}`), '',
  '## Your calls (each has a default, so none blocks Batch 1)', '', ...(p.openOwnerCalls || []).map((x) => `- ${clip(x, 330)}`), '',
  '## Drawn on the canvas but not in the live app: NOT built (parked for you)', '', ...(p.parkedForOwner || []).map((x) => `- ${clip(x, 260)}`), '',
  '## Biggest risks', '', ...(p.sharedRisks || []).slice(0, 8).map((x) => `- ${clip(x, 320)}`), '')
fs.writeFileSync(WT + '/PLAN-SUMMARY.md', s.join('\n'))
console.log('summary', s.join('\n').length, 'chars')
