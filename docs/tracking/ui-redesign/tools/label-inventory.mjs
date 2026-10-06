// Inventory of the user-visible labels of the src files a change touched: title, aria-label and placeholder attributes
// and the visible text of buttons, listed per file for a base commit and a head commit, so a label sweep can see which
// strings were added, removed or kept (tests and users find controls by these strings).
// Usage (from the worktree root, read-only: it only runs `git diff --name-only` and `git show`):
//   node docs/tracking/ui-redesign/tools/label-inventory.mjs <base> [<head>=HEAD] [--json] [--all]
//   --all: also list the files whose labels did not change (default: only files with an added or removed label).
// Also exports scanLabels(text) for tools/brief.mjs.
// LIMITS (regex-level scan, no JSX parse): finds title= / aria-label= / placeholder= with a string literal ("..", '..',
// {".."}, {'..'}, {`..`} without ${}), the same keys written as object properties (title: '..', 'aria-label': '..'), and
// the plain text between <button ...> and </button> or <Button ...> and </Button> when it holds no nested tag or {expression}
// (a tag whose attributes hold a bare > other than => is cut short; a button whose text comes from a variable, a conditional or a nested <span> is not seen; text split over a nested tag is
// not seen; strings built in a helper or a constant and passed in are not seen; a label inside a comment or a string that
// only looks like a prop is seen as a false positive). Duplicates in one file are counted once. Only .js/.jsx/.ts/.tsx under src/.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ATTR = /(?:^|[\s{,(])(title|aria-label|placeholder|'aria-label'|"aria-label")\s*[=:]\s*(?:\{\s*)?(?:"([^"\n]*)"|'([^'\n]*)'|`([^`\n$]*)`)/g
const BTN = /<(?:button|Button)\b(?:[^<>]|=>)*?>\s*([^<>{}\n][^<>{}]*?)\s*<\/(?:button|Button)>/g

export function scanLabels(text) {
  const out = []
  const seen = new Set()
  const add = (kind, label) => {
    label = (label || '').replace(/\s+/g, ' ').trim()
    if (!label) return
    const k = kind + '\u0000' + label
    if (!seen.has(k)) { seen.add(k); out.push({ kind, label }) }
  }
  for (const m of text.matchAll(ATTR)) add(m[1].replace(/['"]/g, ''), m[2] ?? m[3] ?? m[4])
  for (const m of text.matchAll(BTN)) add('button', m[1])
  return out
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const show = (rev, p) => { try { return git('show', `${rev}:${p}`) } catch { return null } }

function main() {
  const args = process.argv.slice(2)
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const pos = args.filter((a) => !a.startsWith('--'))
  if (!pos[0]) { console.error('usage: label-inventory.mjs <base> [<head>=HEAD] [--json] [--all]'); process.exit(1) }
  const base = pos[0], head = pos[1] || 'HEAD'
  const files = git('diff', '--name-only', `${base}..${head}`, '--', 'src').split('\n').filter((f) => /^src\/.*\.(jsx?|tsx?)$/.test(f))
  const res = []
  for (const f of files) {
    const b = show(base, f), h = show(head, f)
    const bl = b == null ? [] : scanLabels(b), hl = h == null ? [] : scanLabels(h)
    const key = (x) => `${x.kind}: ${x.label}`
    const bs = new Set(bl.map(key)), hs = new Set(hl.map(key))
    const removed = [...bs].filter((k) => !hs.has(k)), added = [...hs].filter((k) => !bs.has(k))
    const kept = [...hs].filter((k) => bs.has(k))
    res.push({ file: f, status: b == null ? 'added' : h == null ? 'deleted' : 'modified', removed, added, kept })
  }
  if (flags.has('--json')) { console.log(JSON.stringify(res, null, 1)); return }
  console.log(`# Label inventory ${base}..${head}: ${files.length} changed src file(s)`)
  let nAdd = 0, nRem = 0
  for (const r of res) {
    nAdd += r.added.length; nRem += r.removed.length
    if (!flags.has('--all') && !r.added.length && !r.removed.length) continue
    console.log(`\n## ${r.file} (${r.status}; ${r.kept.length} kept)`)
    for (const k of r.removed) console.log(`- removed  ${k}`)
    for (const k of r.added) console.log(`+ added    ${k}`)
    if (flags.has('--all')) for (const k of r.kept) console.log(`  kept     ${k}`)
  }
  console.log(`\nTotals: ${nAdd} label(s) added, ${nRem} removed. (Regex-level scan: see the header of ${path.basename(import.meta.url)} for its limits.)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
