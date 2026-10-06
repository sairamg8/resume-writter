// Builds the related-tests list for a batch's targeted CI run (read-only: greps file contents, prints the list).
// usage: node related-tests.mjs <worktree> <regex of touched modules> [extra glob-ish prefixes...]
import fs from 'node:fs'
import path from 'node:path'
const wt = process.argv[2]
const re = new RegExp(process.argv[3])
const extra = process.argv.slice(4)
const out = new Set()
for (const dir of ['tests/pdf', 'tests/unit']) {
  for (const f of fs.readdirSync(path.join(wt, dir))) {
    if (!/\.(test|unit)\.mjs$/.test(f)) continue
    const rel = `${dir}/${f}`
    const src = fs.readFileSync(path.join(wt, rel), 'utf8')
    if (re.test(src) || extra.some((p) => rel.startsWith(p))) out.add(rel)
  }
}
const list = [...out].sort()
console.log(list.join(' '))
console.error(`${list.length} files, ${list.join(' ').length} chars`)
