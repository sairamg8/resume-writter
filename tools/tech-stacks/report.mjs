#!/usr/bin/env node
// Backend-language report for web development, from out/tech-stacks.json (run collect.mjs first).
//   node tools/tech-stacks/report.mjs [--roles backend,fullstack] [--out out]
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
let roles = ['backend', 'fullstack']
let out = join(here, 'out')
const a = process.argv.slice(2)
for (let i = 0; i < a.length; i++) {
  if (a[i] === '--roles') roles = a[++i].split(',')
  else if (a[i] === '--out') out = resolve(a[++i])
  else throw new Error(`Unknown argument: ${a[i]}`)
}

const LANGS = ['Python', 'Java', 'Go', 'Node.js', 'TypeScript', 'JavaScript', 'C#/.NET', 'Ruby', 'PHP', 'Kotlin', 'Scala', 'Rust', 'Elixir', 'C++']
const FRAMEWORKS = ['Spring', 'Django/Flask/FastAPI', 'Rails', 'Node.js', 'Express/NestJS', 'C#/.NET', 'Laravel/Symfony', 'Phoenix', 'GraphQL', 'gRPC']
const MIN_COMPANY_ROLES = 3

const { companies } = JSON.parse(await readFile(join(out, 'tech-stacks.json'), 'utf8'))
const sum = (c) => roles.reduce((n, r) => n + (c.byRole?.[r]?.postings || 0), 0)
const techN = (c, t) => roles.reduce((n, r) => n + (c.byRole?.[r]?.techs?.[t] || 0), 0)

const total = companies.reduce((n, c) => n + sum(c), 0)
const eligible = companies.filter((c) => sum(c) >= MIN_COMPANY_ROLES)

function table(names) {
  const rows = names.map((t) => {
    const n = companies.reduce((x, c) => x + techN(c, t), 0)
    const lean = eligible.filter((c) => techN(c, t) / sum(c) >= 0.2).length
    return { t, n, pct: (100 * n) / total, lean, leanPct: (100 * lean) / eligible.length }
  }).sort((x, y) => y.n - x.n)
  return ['| Technology | Roles mentioning it | Share of roles | Companies where >=20% of roles (of ' + eligible.length + ') |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r.t} | ${r.n} | ${r.pct.toFixed(1)}% | ${r.lean} (${r.leanPct.toFixed(0)}%) |`)].join('\n')
}

const bySector = {}
for (const c of eligible) {
  const s = (bySector[c.sector || 'other'] ??= { roles: 0, t: {} })
  s.roles += sum(c)
  for (const l of LANGS) s.t[l] = (s.t[l] || 0) + techN(c, l)
}
const sectorLines = Object.entries(bySector).filter(([, s]) => s.roles >= 100).sort((x, y) => y[1].roles - x[1].roles).map(([name, s]) => {
  const top = Object.entries(s.t).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([l, n]) => `${l} ${Math.round((100 * n) / s.roles)}%`).join(', ')
  return `| ${name} | ${s.roles} | ${top} |`
})

const md = `# Backend language report (web development)

Roles counted: ${roles.join(' + ')} engineering postings (${total} roles at ${companies.filter((c) => sum(c) > 0).length} companies; ${eligible.length} companies with at least ${MIN_COMPANY_ROLES} such roles).
A role can mention several technologies, so shares do not add to 100%.

## Languages
${table(LANGS)}

## Web frameworks and API styles
${table(FRAMEWORKS)}

## By sector (top 4 languages)
| Sector | Roles | Top languages |
|---|---|---|
${sectorLines.join('\n')}
`
await writeFile(join(out, 'backend-language-report.md'), md)
console.log(md)
