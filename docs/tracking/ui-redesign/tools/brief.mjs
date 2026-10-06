// The batch brief generator of the UI rebuild (lead tool; reads files only, runs no test, build or server).
// Usage (from the worktree root):
//   node docs/tracking/ui-redesign/tools/brief.mjs <batch id>              write batches/<id>.md (B2, B5a, ...; B1 too, but B1.md is the lead's)
//   node docs/tracking/ui-redesign/tools/brief.mjs --all                   write every batch except B1 (the lead keeps B1.md)
//   node docs/tracking/ui-redesign/tools/brief.mjs --coverage              prove every row of the 7 parity files has exactly one owner
//   node docs/tracking/ui-redesign/tools/brief.mjs --master-sync <commit>  list parity-file and src changes that arrived from origin/master since <commit>
//   a batch run exits 2 (after writing the file) when the 'tests that go red' check found a test the batch does not list, as the plan
//   requires ('the brief fails'); add --lenient to print the FAIL lines in the brief and exit 0.
// A brief = the batch spec of plan-work/final.json (as make-batch-spec.mjs prints it) PLUS: every parity row the batch owns (live
// behaviour, board placement, status, Fix), the rows reached through the file's catch-all rule, DO NOT BUILD AS DRAWN flags, the
// layout-deltas table, and the 'tests that go red' list. Row parsing and ownership follow batches/coverage-check.mjs (same rules).
// Fix cells: one that begins 'Draw' is printed as 'Build from the live behaviour; no board, or the board differs: design from
// tokens' (the audit's own wording after 'Draw' is kept as a hint only); one that is only Same. / Keep. / Draw. is replaced by
// the live-behaviour cell. Limits: a parked-list citation is matched by prefix and number (not by file), so an EDIT-/NEW- number
// cited as parked flags the row of either file when the batch owns both; the red-test grep is textual (a quoted label that is a common
// word can hit a test that only uses the word), it is a worklist for the lead, not a proof.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { scanLabels } from './label-inventory.mjs'

const UI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const ROOT = path.resolve(UI, '../../..')
const FILES = ['applications', 'editor-content', 'editor-design-templates', 'editor-letter-ats-export', 'mobile', 'projects', 'shell-docs']
const rawPlan = JSON.parse(fs.readFileSync(path.join(UI, 'plan-work/final.json'), 'utf8'))
const plan = rawPlan.plan || rawPlan
const BUILD_LIVE = 'Build from the live behaviour; no board, or the board differs: design from tokens'

// ---------- parity rows (the parser of coverage-check.mjs, plus the raw cells) ----------
const splitRow = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.trim())
const idRe = /(?:[A-Z]+-\d+|\bN\d+)\b/g
function readRows() {
  const rows = {}
  const noId = []
  for (const f of FILES) {
    const lines = fs.readFileSync(path.join(UI, 'parity', f + '.md'), 'utf8').split('\n')
    let h2 = '', h3 = '', header = null
    const list = []
    lines.forEach((l, i) => {
      if (/^## /.test(l)) { h2 = l; h3 = ''; header = null; return }
      if (/^### /.test(l)) { h3 = l; header = null; return }
      if (!/^\s*\|/.test(l)) return
      const cells = splitRow(l)
      if (/^[-: ]+$/.test(cells[0])) return
      if (['ID', '#', 'File'].includes(cells[0])) { header = cells; return }
      if (!header || header[0] === 'File') return
      const ids = cells[0].match(idRe)
      if (!ids) { noId.push(`${f}:${i + 1}`); return }
      const sec = h2 + ' ' + h3
      const drawn = /DRAWN BUT NOT/i.test(sec) || /^(What the canvas draws|Drawn control|Canvas draws|Board \+ element)/i.test(header[1] || '')
      const si = header.findIndex((c) => /^Status$/i.test(c))
      const fi = header.findIndex((c) => /^Fix/i.test(c))
      const hi = header.findIndex((c) => /^(Recommended handling|Handling)/i.test(c))
      const revised = /revised/i.test(cells[0])
      for (const id of ids) {
        const m = id.match(/^([A-Z]+)-?(\d+)$/)
        list.push({
          file: f, id, prefix: m[1], num: +m[2], section: sec.replace(/#+ /g, '').trim().slice(0, 120), drawn, revised, header, cells, line: i + 1,
          status: si >= 0 ? (cells[si] || '').trim() : '', fix: fi >= 0 ? cells[fi] || '' : '', handling: hi >= 0 ? cells[hi] || '' : '',
          fn: header[0] === 'ID' && !drawn ? cells[1] || '' : '', live: !drawn && header[2] ? cells[2] || '' : '', board: !drawn && header[3] ? cells[3] || '' : '',
        })
      }
    })
    rows[f] = list
  }
  return { rows, noId }
}

// ---------- ownership (same rules as coverage-check.mjs) ----------
function readOwners(rows) {
  const owners = new Map(), catchAll = {}, bad = [], rangeIssues = []
  const add = (k, b) => { if (!owners.has(k)) owners.set(k, []); if (!owners.get(k).includes(b)) owners.get(k).push(b) }
  for (const b of plan.batches) {
    for (const entry of b.parityOwned || []) {
      const m = entry.match(/^([a-z-]+):\s*(.*)$/s)
      if (!m || !FILES.includes(m[1])) { bad.push(`${b.id}: cannot read file prefix of "${entry.slice(0, 60)}"`); continue }
      const f = m[1]
      let body = m[2]
      if (/CATCH-ALL/.test(body)) {
        const cm = body.match(/belongs to (B\d+[a-z]?)/)
        if (cm) catchAll[f] = cm[1]; else bad.push(`${b.id}: catch-all without batch in ${f}`)
        continue
      }
      body = body.replace(/\([^)]*\)/g, '')
      for (const item of body.split(',').map((s) => s.trim()).filter(Boolean)) {
        const r = item.match(/^([A-Z]+-?)(\d+)(?:\.\.([A-Z]+-?)(\d+))?$/)
        if (!r) { bad.push(`${b.id} ${f}: unreadable item "${item}"`); continue }
        const [, p1, n1, p2, n2] = r
        const pre = p1.replace(/-$/, '')
        if (p2 && p2.replace(/-$/, '') !== pre) { bad.push(`${b.id} ${f}: range "${item}" mixes prefixes`); continue }
        const lo = +n1, hi = n2 ? +n2 : +n1
        const matched = rows[f].filter((x) => x.prefix === pre && x.num >= lo && x.num <= hi)
        const nums = new Set(matched.map((x) => x.num))
        if (!nums.size) rangeIssues.push(`${b.id} ${f}: "${item}" matches NO rows`)
        else {
          const gaps = []
          for (let n = lo; n <= hi; n++) if (!nums.has(n)) gaps.push(n)
          if (gaps.length) rangeIssues.push(`${b.id} ${f}: "${item}" has ${gaps.length} number(s) with no row (${gaps.slice(0, 12).join(',')})`)
        }
        for (const id of new Set(matched.map((x) => x.id))) add(`${f}:${id}`, b.id)
      }
    }
  }
  return { owners, catchAll, bad, rangeIssues }
}

const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true })
const rowKey = (r) => `${r.file}:${r.id}`
const fixKind = (r) => {
  const f = r.fix.trim()
  if (/^(same|keep|draw)\.?$/i.test(f)) return 'live'
  if (/^draw\b/i.test(f)) return 'draw'
  return 'text'
}
function fixCell(r) {
  const f = r.fix.trim()
  const k = fixKind(r)
  if (k === 'live') return r.live || r.fn || '(see the live-behaviour cell)'
  if (k === 'draw') {
    const hint = f.replace(/^draw\b[\s:,-]*/i, '').trim()
    return BUILD_LIVE + '.' + (hint ? ` Audit hint (canvas wording, layout idea only): ${hint}` : '')
  }
  return f && f !== '-' ? f : ''
}
// "A/B/C" and "A..B" citations of one prefix: EDIT-089/090, EDIT-089..094, EDIT-089
function expandCites(s) {
  const set = new Set()
  for (const m of s.matchAll(/\b([A-Z]+)-?(\d+)(?:\.\.(?:[A-Z]+-?)?(\d+)|((?:\/\d+)+))?/g)) {
    const pre = m[1], lo = +m[2]
    if (m[3]) for (let n = lo; n <= +m[3]; n++) set.add(pre + ':' + n)
    else if (m[4]) { set.add(pre + ':' + lo); m[4].split('/').filter(Boolean).forEach((n) => set.add(pre + ':' + +n)) }
    else set.add(pre + ':' + lo)
  }
  return set
}

// ---------- coverage mode ----------
function coverage() {
  const { rows, noId } = readRows()
  const { owners, catchAll, bad, rangeIssues } = readOwners(rows)
  const distinct = {}
  let total = 0, one = 0, none = [], multi = [], viaCatch = 0, listed = 0, changed = 0, missing = 0, chmiOwned = 0
  const L = []
  const P = (s = '') => L.push(s)
  P('Coverage of the 7 parity files by the plan (tools/brief.mjs --coverage; reads plan-work/final.json and the parity files only)')
  P()
  P('| file | distinct row IDs | CHANGED | MISSING | owned exactly once | listed by ID | catch-all only |')
  P('|---|---|---|---|---|---|---|')
  for (const f of FILES) {
    const ids = new Set(rows[f].map((r) => r.id))
    distinct[f] = ids
    let o1 = 0, li = 0, ca = 0, ch = 0, mi = 0
    for (const id of ids) {
      const k = `${f}:${id}`, o = owners.get(k) || []
      const own = o.length ? o : catchAll[f] ? [catchAll[f]] : []
      if (own.length === 1) o1++
      if (!own.length) none.push(k)
      if (own.length > 1) multi.push(`${k} -> ${own.join(' + ')}`)
      if (o.length) li++; else if (own.length) ca++
      const r = rows[f].find((x) => x.id === id && !x.revised && !x.drawn)
      if (r && /^CHANGED/i.test(r.status)) { ch++; if (own.length) chmiOwned++ }
      if (r && /^MISSING/i.test(r.status)) { mi++; if (own.length) chmiOwned++ }
    }
    total += ids.size; one += o1; listed += li; viaCatch += ca; changed += ch; missing += mi
    P(`| ${f} | ${ids.size} | ${ch} | ${mi} | ${o1} | ${li} | ${ca} |`)
  }
  P()
  const fmt = (n) => n.toLocaleString('en-US')
  P(`Totals: ${fmt(total)} distinct row IDs; owned by exactly one batch: ${fmt(one)}; owned by no batch: ${none.length}; owned by more than one batch: ${multi.length}; listed by ID: ${fmt(listed)}; reached only through a catch-all rule: ${viaCatch}.`)
  P(`CHANGED ${changed} + MISSING ${missing} = ${changed + missing} rows; with an owner: ${chmiOwned}.`)
  P(`Catch-all rules: ${FILES.map((f) => `${f} -> ${catchAll[f] || 'NONE'}`).join('; ')}.`)
  P(`Ranges that match no rows or have a numbering gap: ${rangeIssues.length}. Unreadable ownership items: ${bad.length}. Table rows with no recognisable ID: ${noId.length}.`)
  for (const x of [...none, ...multi, ...rangeIssues, ...bad, ...noId]) P('- ' + x)
  const clean = !none.length && !multi.length && !rangeIssues.length && !bad.length && !noId.length && one === total && !viaCatch && chmiOwned === changed + missing
  P(clean ? 'RESULT: clean (every row has exactly one owner and is listed by ID).' : 'RESULT: NOT clean.')
  console.log(L.join('\n'))
  process.exit(clean ? 0 : 1)
}

// ---------- master-sync mode (git log / diff only; modifies nothing; no fetch) ----------
function masterSync(since) {
  if (!since) { console.error('usage: brief.mjs --master-sync <commit>'); process.exit(1) }
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
  const range = `${since}..origin/master`
  console.log(`# Changes that arrived from origin/master since ${since} (as of the last fetch: this tool does not fetch; run git fetch yourself first)\n`)
  const paths = ['docs/tracking/ui-redesign/parity', 'src']
  const log = git('log', '--no-merges', '--format=%h %ad %an: %s', '--date=short', range, '--', ...paths).trim()
  console.log('## Commits touching parity files or src')
  console.log(log || '(none)')
  const names = git('diff', '--name-status', `${since}...origin/master`, '--', ...paths).trim()
  console.log('\n## Files changed (git diff --name-status)')
  console.log(names || '(none)')
  const par = names.split('\n').filter((l) => /docs\/tracking\/ui-redesign\/parity\//.test(l))
  console.log('\n## Parity files changed (re-run --coverage and regenerate the briefs of the batches that own their rows)')
  console.log(par.length ? par.join('\n') : '(none)')
  const src = names.split('\n').filter((l) => /\tsrc\//.test(l)).map((l) => l.split('\t').pop())
  const owned = new Map()
  for (const b of plan.batches) for (const c of b.clusters || []) for (const raw of c.filesOwned || []) for (const p of raw.split(/,\s*(?=[a-z]+\/)/)) {
    const q = p.replace(/\s*\(.*$/, '').trim()
    if (q) { if (!owned.has(q)) owned.set(q, new Set()); owned.get(q).add(b.id) }
  }
  console.log('\n## src files changed on master and the batches that own them')
  console.log(src.length ? src.map((f) => `- ${f}: ${owned.has(f) ? [...owned.get(f)].join(', ') : 'owned by no batch'}`).join('\n') : '(none)')
}

// ---------- tests that go red ----------
const walk = (d, acc = []) => {
  if (!fs.existsSync(d)) return acc
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, acc); else acc.push(p)
  }
  return acc
}
let testCache = null
const testTexts = () => {
  if (testCache) return testCache
  testCache = []
  for (const dir of ['tests', 'cypress']) for (const p of walk(path.join(ROOT, dir))) {
    if (!/\.(mjs|js|jsx|cjs|ts)$/.test(p)) continue
    testCache.push({ rel: path.relative(ROOT, p), text: fs.readFileSync(p, 'utf8') })
  }
  return testCache
}
const listedTokens = (b) => {
  const toks = new Set()
  for (const raw of (b.testsToUpdate || []).join('\n').match(/[\w./*-]+/g) || []) {
    const t = raw.replace(/^[.:]+|[.:*]+$/g, '')
    if (t.length < 2) continue
    toks.add(t)
    const m = t.match(/^(\d{1,3}-[a-z0-9]+-[a-z]+-)(\d+)((?:\/\d+)+)$/) // 103-r4-dvis-29/32
    if (m) for (const n of m[3].split('/').filter(Boolean)) toks.add(m[1] + n)
  }
  return [...toks]
}
const isListed = (rel, toks) => {
  const base = path.basename(rel)
  return toks.some((t) => {
    if (t.includes('/')) return rel === t || rel.startsWith(t.replace(/\.(mjs|js)$/, ''))
    if (/^\d+[a-z]?$/.test(t)) return base.startsWith(t + '-')
    return base === t || (t.length >= 4 && base.startsWith(t))
  })
}
const touchedFiles = (b) => {
  const out = new Set()
  for (const c of b.clusters || []) for (const raw of [...(c.filesOwned || []), ...(c.newFiles || [])]) {
    for (const p of raw.split(/,\s*(?=[a-z]+\/)/)) {
      const q = p.replace(/\s*\(.*$/, '').trim()
      if (/^src\/.*\.(jsx?|css)$/.test(q)) out.add(q)
    }
  }
  return [...out]
}
function testsThatGoRed(b) {
  const files = touchedFiles(b)
  const refs = [] // {term, kind}
  const labels = new Map() // label -> kind
  for (const f of files) {
    let base = path.basename(f).replace(/\.(jsx?|css)$/, '')
    if (f.endsWith('.css')) refs.push({ term: path.basename(f), why: f })
    else if (['index', 'main'].includes(base)) refs.push({ term: f.replace(/^src\//, '').replace(/\.(jsx?)$/, ''), why: f })
    else if (base.length >= 4) refs.push({ term: base, why: f })
    const abs = path.join(ROOT, f)
    if (!fs.existsSync(abs) || f.endsWith('.css')) continue
    for (const { kind, label } of scanLabels(fs.readFileSync(abs, 'utf8'))) {
      if (label.length >= 6 && /[A-Za-z]{3}/.test(label)) labels.set(label, kind)
    }
  }
  const toks = listedTokens(b)
  const hits = []
  for (const t of testTexts()) {
    const why = []
    for (const r of refs) {
      // a path or import reference: the name as the last segment of a quoted path (src/pages/Dashboard, ./Dashboard.jsx)
      const re = new RegExp('[/\'"`]' + r.term.replace(/[.+?^${}()|[\]\\/]/g, '\\$&') + '(?:\\.jsx?)?[\'"`]')
      if (re.test(t.text)) why.push(`imports ${r.why}`)
    }
    const lab = []
    // a label counts when a test quotes it whole ('Save as', "Save as", `Save as`) or writes it as a regex /Save as/
    for (const [label] of labels) for (const q of ["'", '"', '`', '/']) if (t.text.includes(q + label + q)) { lab.push(label); break }
    if (lab.length) why.push(`label${lab.length > 1 ? 's' : ''} ${lab.slice(0, 3).map((x) => JSON.stringify(x)).join(', ')}${lab.length > 3 ? ` (+${lab.length - 3})` : ''}`)
    if (why.length) hits.push({ rel: t.rel, why: why.join('; '), listed: isListed(t.rel, toks) })
  }
  hits.sort((a, c) => natural(a.rel, c.rel))
  return { files, nLabels: labels.size, hits }
}

// ---------- brief ----------
function brief(id, lenient) {
  const b = plan.batches.find((x) => x.id === id)
  if (!b) { console.error('no such batch', id, '(known:', plan.batches.map((x) => x.id).join(' ') + ')'); process.exit(1) }
  const { rows } = readRows()
  const { owners, catchAll } = readOwners(rows)
  const L = (a) => (a && a.length ? a.map((x) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : '- none')
  const o = []
  o.push(`# ${b.id} (${b.estimatedHours} h): ${b.title}`, '',
    'Generated from plan-work/final.json and the 7 parity files by tools/brief.mjs. Rules that apply to every batch: PARITY-RULE.md, RUN-STATE.md (cadence, batch gate, wrap-up), CLAUDE.md, parity/_constraints.md, parity/_tests.md, parity/_ci.md. The parity rows below are the contract: a row is done when it is SAME / MOVED / RESTYLED in the built UI and a test proves it.', '',
    '## Goal', b.goal, '', '## Why here', b.whyHere, '', '## Depends on', (b.dependsOn || []).join(', ') || 'nothing', '',
    '## Boards to read (Artifact tool, canvas SjfCTE1dSTgt1UY63uoFiM; data only)', L(b.boards), '',
    '## Parity rows owned (area file: IDs; the rows themselves are printed below)', L(b.parityOwned), '',
    '## PARKED: do NOT build', L(b.parked), '', '## Clusters (separate file ownership)')
  for (const c of b.clusters || []) o.push('', `### Cluster: ${c.name}`, `Files owned: ${(c.filesOwned || []).join(', ')}`, `New files: ${(c.newFiles || []).join(', ') || 'none'}`, '', c.work)
  o.push('', '## New tests', L(b.testsNew), '', '## Existing tests to update', L(b.testsToUpdate), '', '## Start-up size plan', b.startupBudgetPlan, '',
    '## Bug-hunt focus', L(b.bugHuntFocus), '', '## Done when', L(b.doneCriteria), '', '## Risks', L(b.risks), '', '## Owner calls here', L(b.ownerCalls), '')

  // rows of this batch
  const mine = [] // {f, id, explicit}
  for (const f of FILES) {
    for (const id2 of [...new Set(rows[f].map((r) => r.id))]) {
      const ow = owners.get(`${f}:${id2}`) || []
      if (ow.includes(b.id)) mine.push({ f, id: id2, explicit: true })
      else if (!ow.length && catchAll[f] === b.id) mine.push({ f, id: id2, explicit: false })
    }
  }
  const mineRows = []
  for (const m of mine) for (const r of rows[m.f]) if (r.id === m.id) mineRows.push({ r, explicit: m.explicit })
  mineRows.sort((a, c) => FILES.indexOf(a.r.file) - FILES.indexOf(c.r.file) || a.r.line - c.r.line)
  const parked = expandCites((b.parked || []).join('\n'))
  const flagFor = (r) => {
    const why = []
    if (r.drawn && /\bPARK/i.test(r.handling)) why.push('drawn but not in the live app: handling PARK')
    if (!r.drawn && /^CHANGED/i.test(r.status)) why.push('CHANGED: the drawing alters or loses the live function')
    if (parked.has(r.prefix + ':' + r.num)) why.push("cited in this batch's PARKED list")
    return why
  }
  const real = mineRows.filter(({ r }) => !r.drawn)
  const drawn = mineRows.filter(({ r }) => r.drawn)
  const cnt = (re) => real.filter(({ r }) => !r.revised && re.test(r.status)).length
  o.push('## Parity rows of this batch', '',
    `${new Set(mineRows.map(({ r }) => rowKey(r))).size} row IDs (${real.filter(({ r }) => !r.revised).length} live-function rows: SAME ${cnt(/^SAME/i)}, MOVED ${cnt(/^MOVED/i)}, RESTYLED ${cnt(/^RESTYLED/i)}, CHANGED ${cnt(/^CHANGED/i)}, MISSING ${cnt(/^MISSING/i)}; ${new Set(drawn.map(({ r }) => rowKey(r))).size} drawn-but-not-in-the-live-app items). The live app wins where a board and the app differ.`, '')

  // catch-all
  const ca = mineRows.filter((x) => !x.explicit)
  o.push('### Catch-all rows (no batch lists them by ID; they reach this batch through the file\'s catch-all rule, computed from the final parity files)', '')
  const caFiles = FILES.filter((f) => catchAll[f] === b.id)
  o.push(caFiles.length ? `This batch is the catch-all of: ${caFiles.join(', ')}. Rows reaching it only through the rule: ${new Set(ca.map(({ r }) => rowKey(r))).size}${ca.length ? ' (marked "catch-all" below)' : ' (none today: every row is listed by ID, and any row added by review or later lands here)'}.` : 'none (this batch is not the catch-all of any parity file).', '')

  // flags
  const flagged = mineRows.filter(({ r }) => flagFor(r).length)
  const flagSeen = new Set()
  o.push('### DO NOT BUILD AS DRAWN', '',
    'Rows where the drawing must not be copied: a CHANGED row (the board drops or alters the live function; build the live function), a row cited in the PARKED list above, or a drawn-but-not-live item with handling PARK. Keep every function; build only the layout.', '')
  if (!flagged.length) o.push('- none')
  for (const { r } of flagged) {
    const k = rowKey(r)
    if (flagSeen.has(k)) continue
    flagSeen.add(k)
    const txt = r.drawn ? r.cells.slice(1, 3).join(' / ') : r.fn
    o.push(`- DO NOT BUILD AS DRAWN: ${k}${r.drawn ? ' (drawn item)' : ''} [${flagFor(r).join('; ')}] ${txt.slice(0, 140)}`)
  }
  o.push('')

  // layout deltas
  const ALWAYS = { 'editor-design-templates:EDIT-089': 'live rule kept (opening Design or ATS from the letter switches the stage to the Resume), owner call; negative twin: the Resume switch' }
  const deltas = real.filter(({ r }) => !r.revised && (/^(CHANGED|MISSING)/i.test(r.status) || ALWAYS[rowKey(r)]))
  o.push('### Layout deltas (CHANGED and MISSING rows: how the drawn layout bends to hold the live function)', '',
    'Conservative option when in doubt: the live control stays, one menu or drawer away.', '')
  if (!deltas.length) o.push('- none')
  else {
    o.push('| ID | Status | Drawn layout | Live function that stays | How the layout bends |', '|---|---|---|---|---|')
    for (const { r } of deltas) o.push(`| ${r.id}${r.file === 'editor-content' || r.file === 'editor-design-templates' ? ` (${r.file})` : ''} | ${r.status.split(/[.;(]/)[0].trim() || r.status} | ${r.board || '-'} | ${r.fn} | ${ALWAYS[rowKey(r)] || fixCell(r) || 'Keep the live function; place it in the nearest drawn container (design from tokens).'} |`)
  }
  o.push('')

  // rows by file and section
  o.push('### Rows (ID | live function and behaviour | board placement | status | Fix)', '')
  let lastSec = ''
  let lastFile = ''
  for (const { r, explicit } of real) {
    if (r.file !== lastFile) { o.push('', `#### ${r.file}`); lastFile = r.file; lastSec = '' }
    if (r.section !== lastSec) { o.push('', `**${r.section}**`, '', '| ID | Live function and behaviour | Board placement | Status | Fix |', '|---|---|---|---|---|'); lastSec = r.section }
    const flag = flagFor(r).length ? ' **DO NOT BUILD AS DRAWN**' : ''
    const tags = (r.revised ? ' (revised)' : '') + (explicit ? '' : ' (catch-all)')
    const fx = fixKind(r) === 'live' ? `(live behaviour is the spec) ${fixCell(r)}` : fixCell(r) || '-'
    o.push(`| ${r.id}${tags}${flag} | **${r.fn}**: ${r.live} | ${r.board} | ${r.status} | ${fx} |`)
  }
  o.push('')
  if (drawn.length) {
    o.push('### Drawn but not in the live app (items of the parity files\' "DRAWN BUT NOT" tables owned here)', '')
    for (const { r, explicit } of drawn) {
      const parts = r.cells.slice(1).map((c, i) => `${(r.header[i + 1] || '').replace(/\s*\(.*$/, '')}: ${c}`)
      o.push(`- ${r.id} [${r.file}]${explicit ? '' : ' (catch-all)'}${flagFor(r).length ? ' **DO NOT BUILD AS DRAWN**' : ''}: ${parts.join(' | ')}`)
    }
    o.push('')
  }

  // tests that go red
  const red = testsThatGoRed(b)
  const unlisted = red.hits.filter((h) => !h.listed)
  o.push('## Tests that go red (computed: tests/ and cypress/ grepped for this batch\'s touched src files and for the visible labels found in them)', '',
    `Touched src files (${red.files.length}): ${red.files.join(', ') || 'none'}. Labels scanned: ${red.nLabels} (title, aria-label, placeholder, button text of the files that exist today). Test files hit: ${red.hits.length}; listed in this batch's "Existing tests to update": ${red.hits.length - unlisted.length}; NOT listed: ${unlisted.length}.`, '')
  if (unlisted.length) {
    o.push('FAIL: these hits are not covered by the batch\'s "Existing tests to update" list (add them to the plan or prove the hit harmless, in writing):', '')
    for (const h of unlisted) o.push(`- FAIL ${h.rel}: ${h.why}`)
    o.push('')
  } else o.push('OK: every hit is in the batch\'s update list.', '')
  const listedHits = red.hits.filter((h) => h.listed)
  if (listedHits.length) { o.push('Hits already in the update list:', '', ...listedHits.map((h) => `- ${h.rel}: ${h.why}`), '') }

  o.push('## Progress log', '(append: time, what, run ids, head sha)', '')
  const out = path.join(UI, 'batches', `${id}.md`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, o.join('\n'))
  console.log(`wrote ${path.relative(ROOT, out)}: ${new Set(mineRows.map(({ r }) => rowKey(r))).size} row IDs, ${flagSeen.size} DO NOT BUILD AS DRAWN, ${deltas.length} layout deltas, ${red.hits.length} test hits (${unlisted.length} FAIL: not in the update list)`)
  if (!lenient && unlisted.length) { console.error(`${id}: FAIL, ${unlisted.length} test file(s) hit but not in the update list (see the brief)`); process.exitCode = 2 }
}

const args = process.argv.slice(2)
const pos = args.filter((a) => !a.startsWith('--'))
if (args.includes('--coverage')) coverage()
else if (args.includes('--master-sync')) masterSync(pos[0])
else if (args.includes('--all')) for (const x of plan.batches) { if (x.id !== 'B1') brief(x.id, args.includes('--lenient')) }
else if (pos[0]) brief(pos[0], args.includes('--lenient'))
else { console.error('usage: brief.mjs <batch id> | --all | --coverage | --master-sync <commit>   (see the header comment)'); process.exit(1) }
