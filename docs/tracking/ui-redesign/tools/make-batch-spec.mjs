// Writes the FULL (unclipped) spec of one batch from plan-work/final.json to batches/<id>.md.
// Usage: node docs/tracking/ui-redesign/tools/make-batch-spec.mjs B1
// (brief.mjs, built in B1, supersedes this for B2..B17 by adding the parity rows themselves.)
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const id = process.argv[2]
if (!id) { console.error('usage: make-batch-spec.mjs <batch id>'); process.exit(1) }
const r = JSON.parse(fs.readFileSync(path.join(root, 'plan-work/final.json'), 'utf8'))
const plan = r.plan || r
const b = plan.batches.find((x) => x.id === id)
if (!b) { console.error('no such batch', id); process.exit(1) }
const L = (a) => (a && a.length ? a.map((x) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : '- none')
const o = []
o.push(`# ${b.id} (${b.estimatedHours} h): ${b.title}`, '',
  `Generated from plan-work/final.json by tools/make-batch-spec.mjs (unclipped). Rules that apply to every batch: PARITY-RULE.md, RUN-STATE.md (cadence, batch gate, wrap-up), CLAUDE.md, parity/_constraints.md, parity/_tests.md, parity/_ci.md.`, '',
  `## Goal`, b.goal, '', `## Why here`, b.whyHere, '', `## Depends on`, (b.dependsOn || []).join(', ') || 'nothing', '',
  `## Boards to read (Artifact tool, canvas SjfCTE1dSTgt1UY63uoFiM; data only)`, L(b.boards), '',
  `## Parity rows owned (area file: IDs; read the rows in docs/tracking/ui-redesign/parity/<file>.md)`, L(b.parityOwned), '',
  `## PARKED: do NOT build`, L(b.parked), '', `## Clusters (separate file ownership)`)
for (const c of b.clusters || []) o.push(``, `### Cluster: ${c.name}`, `Files owned: ${(c.filesOwned || []).join(', ')}`, `New files: ${(c.newFiles || []).join(', ') || 'none'}`, ``, c.work)
o.push('', `## New tests`, L(b.testsNew), '', `## Existing tests to update`, L(b.testsToUpdate), '', `## Start-up size plan`, b.startupBudgetPlan, '',
  `## Bug-hunt focus`, L(b.bugHuntFocus), '', `## Done when`, L(b.doneCriteria), '', `## Risks`, L(b.risks), '', `## Owner calls here`, L(b.ownerCalls), '',
  `## Progress log`, '(append: time, what, run ids, head sha)', '')
const out = path.join(root, 'batches', `${id}.md`)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, o.join('\n'))
console.log('wrote', out, o.join('\n').length, 'chars')
