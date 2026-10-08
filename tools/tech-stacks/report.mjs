#!/usr/bin/env node
// Backend-language and frontend-framework reports for web development, from out/postings.jsonl
// (run collect.mjs first).
//
//   node tools/tech-stacks/report.mjs [--mode all|backend|frontend] [--out out] [--min-roles 3]
//
// Every number is computed over postings whose role is backend/fullstack (backend report) or
// frontend/fullstack (frontend report). Generic "Software Engineer" titles are included when the
// role could be inferred from the stack they ask for (role_source = inferred).
//
// Four views of the same question, from loosest to strictest:
//   any       the technology is mentioned anywhere in the posting
//   required  it is in the title or outside any "nice to have / bonus / preferred" text
//   weighted  each posting is worth 1 point, split evenly between the technologies it requires
//             (a title naming a technology wins over the body), so "Python, Java or Go" gives each 1/3
//   per-co    the weighted share averaged over companies, so large boards do not dominate

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
let mode = 'all'
let out = join(here, 'out')
let minRoles = 3
const a = process.argv.slice(2)
for (let i = 0; i < a.length; i++) {
  if (a[i] === '--mode') mode = a[++i]
  else if (a[i] === '--out') out = resolve(a[++i])
  else if (a[i] === '--min-roles') minRoles = Number(a[++i]) || 3
  else throw new Error(`Unknown argument: ${a[i]}`)
}

const postings = (await readFile(join(out, 'postings.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l))

const BACKEND_BUCKETS = {
  Python: ['Python'],
  Java: ['Java'],
  Go: ['Go', 'Go web frameworks'],
  'Node.js (JS/TS backend)': ['Node.js', 'Express', 'NestJS', 'Fastify/Koa/Hapi'],
  'C#/.NET': ['C#/.NET', 'ASP.NET Core', 'Entity Framework'],
  Ruby: ['Ruby', 'Rails', 'Sinatra'],
  PHP: ['PHP', 'Laravel', 'Symfony'],
  Kotlin: ['Kotlin', 'Ktor'],
  Scala: ['Scala', 'Play Framework', 'Akka', 'ZIO/Cats'],
  Rust: ['Rust', 'Actix/Axum/Tokio'],
  Elixir: ['Elixir', 'Phoenix'],
  'C++': ['C++'],
}

const ECOSYSTEM = {
  Python: ['Django', 'Flask', 'FastAPI', 'SQLAlchemy', 'Celery'],
  Java: ['Spring Boot', 'Spring Framework', 'Quarkus', 'Micronaut', 'Hibernate/JPA', 'Jakarta EE'],
  Scala: ['Play Framework', 'Akka', 'ZIO/Cats', 'Spark'],
  Kotlin: ['Ktor', 'Spring Boot'],
  Go: ['Go web frameworks', 'gRPC'],
  'Node.js (JS/TS backend)': ['Express', 'NestJS', 'Fastify/Koa/Hapi', 'GraphQL'],
  'C#/.NET': ['ASP.NET Core', 'Entity Framework'],
  Ruby: ['Rails', 'Sinatra'],
  PHP: ['Laravel', 'Symfony'],
  Rust: ['Actix/Axum/Tokio'],
  Elixir: ['Phoenix'],
}
// Pseudo-technologies that combine several taxonomy entries.
const COMBINED = {
  'Spring (Boot or Framework)': ['Spring Boot', 'Spring Framework'],
  'Any Python web framework': ['Django', 'Flask', 'FastAPI'],
}

const FRONTEND_BUCKETS = {
  React: ['React', 'Next.js', 'Remix'],
  Angular: ['Angular'],
  Vue: ['Vue', 'Nuxt'],
  Svelte: ['Svelte'],
  Solid: ['Solid'],
  Astro: ['Astro'],
  Ember: ['Ember'],
  jQuery: ['jQuery'],
  'Web Components/Lit': ['Web Components/Lit'],
}
const FRONTEND_OTHER = ['TypeScript', 'JavaScript', 'HTML/CSS', 'Sass/styled-components', 'Tailwind', 'Redux', 'MobX/Zustand/Recoil', 'GraphQL', 'Webpack/Vite', 'Jest/Cypress/Playwright', 'Storybook', 'WebAssembly/WebGL', 'Node.js']

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-')
const has = (techs, list) => list.some((t) => techs.includes(t))

function byCompany(rows) {
  const m = new Map()
  for (const r of rows) (m.get(r.company) ?? m.set(r.company, []).get(r.company)).push(r)
  return m
}

// The buckets a posting is "about": those named in the title, otherwise those in the required text.
function primary(p, buckets) {
  const names = Object.keys(buckets)
  const inTitle = names.filter((b) => has(p.titleTechs, buckets[b]))
  return inTitle.length ? inTitle : names.filter((b) => has(p.reqTechs, buckets[b]))
}

function bucketStats(rows, buckets) {
  const names = Object.keys(buckets)
  const stat = Object.fromEntries(names.map((b) => [b, { any: 0, req: 0, title: 0, weighted: 0 }]))
  const perCo = new Map()
  for (const p of rows) {
    const prim = primary(p, buckets)
    for (const b of names) {
      if (has(p.techs, buckets[b])) stat[b].any++
      if (has(p.reqTechs, buckets[b])) stat[b].req++
      if (has(p.titleTechs, buckets[b])) stat[b].title++
    }
    for (const b of prim) {
      stat[b].weighted += 1 / prim.length
      const c = perCo.get(p.company) ?? perCo.set(p.company, { n: 0, w: {} }).get(p.company)
      c.w[b] = (c.w[b] || 0) + 1 / prim.length
    }
    ;(perCo.get(p.company) ?? perCo.set(p.company, { n: 0, w: {} }).get(p.company)).n++
  }
  const cos = [...perCo.values()].filter((c) => c.n >= minRoles)
  for (const b of names) stat[b].perCo = cos.length ? (100 * cos.reduce((s, c) => s + (c.w[b] || 0) / c.n, 0)) / cos.length : 0
  return { stat, companies: cos.length }
}

function mainTable(rows, buckets, heading) {
  const { stat, companies } = bucketStats(rows, buckets)
  const n = rows.length
  const sorted = Object.keys(buckets).sort((x, y) => stat[y].weighted - stat[x].weighted)
  return `${heading}\n| Technology | Weighted share | Avg per company | Required | In job title | Any mention |\n|---|---|---|---|---|---|\n` +
    sorted.map((b) => `| ${b} | ${pct(stat[b].weighted, n)} | ${stat[b].perCo.toFixed(1)}% | ${pct(stat[b].req, n)} | ${pct(stat[b].title, n)} | ${pct(stat[b].any, n)} |`).join('\n') +
    `\n\n(${n} roles; the per-company average uses the ${companies} companies with at least ${minRoles} roles.)\n`
}

function ecosystemTable(rows) {
  let md = ''
  for (const lang of Object.keys(ECOSYSTEM)) {
    const sub = rows.filter((p) => has(p.reqTechs, BACKEND_BUCKETS[lang]))
    if (sub.length < 10) continue
    const tech = [...ECOSYSTEM[lang]]
    const extra = Object.entries(COMBINED).filter(([, parts]) => parts.every((x) => ECOSYSTEM[lang].includes(x)) || (lang === 'Java' && parts.includes('Spring Boot')) || (lang === 'Python' && parts.includes('Django')))
    const lines = tech.map((t) => [t, sub.filter((p) => p.reqTechs.includes(t)).length])
    for (const [name, parts] of extra) lines.push([name, sub.filter((p) => has(p.reqTechs, parts)).length])
    const anyFw = sub.filter((p) => has(p.reqTechs, ECOSYSTEM[lang])).length
    lines.sort((x, y) => y[1] - x[1])
    md += `\n**${lang}** (${sub.length} roles require it)\n\n| Named alongside it | Roles | Share |\n|---|---|---|\n` +
      lines.filter(([, c]) => c > 0).map(([t, c]) => `| ${t} | ${c} | ${pct(c, sub.length)} |`).join('\n') +
      `\n| *No framework from this list named* | ${sub.length - anyFw} | ${pct(sub.length - anyFw, sub.length)} |\n`
  }
  return md
}

function jsBreakdown(rows) {
  const sub = rows.filter((p) => has(p.reqTechs, ['JavaScript', 'TypeScript']))
  if (!sub.length) return ''
  const fw = Object.keys(FRONTEND_BUCKETS)
  const lines = fw.map((f) => [f, sub.filter((p) => has(p.reqTechs, FRONTEND_BUCKETS[f])).length]).sort((x, y) => y[1] - x[1])
  const none = sub.filter((p) => !fw.some((f) => has(p.reqTechs, FRONTEND_BUCKETS[f]))).length
  const ts = sub.filter((p) => p.reqTechs.includes('TypeScript')).length
  const js = sub.filter((p) => p.reqTechs.includes('JavaScript')).length
  const both = sub.filter((p) => p.reqTechs.includes('TypeScript') && p.reqTechs.includes('JavaScript')).length
  return `\n## When a role says "JavaScript" or "TypeScript", which framework does it name?\n\n${sub.length} roles require JavaScript and/or TypeScript.\n\n| Framework named alongside | Roles | Share of JS/TS roles |\n|---|---|---|\n` +
    lines.filter(([, c]) => c > 0).map(([f, c]) => `| ${f} | ${c} | ${pct(c, sub.length)} |`).join('\n') +
    `\n| *No framework named (plain JS/TS)* | ${none} | ${pct(none, sub.length)} |\n\nLanguage split: TypeScript ${pct(ts, sub.length)}, JavaScript ${pct(js, sub.length)}, both named ${pct(both, sub.length)}.\n`
}

function otherTable(rows, names, heading) {
  const n = rows.length
  return `${heading}\n| Technology | Required | Any mention |\n|---|---|---|\n` +
    names.map((t) => [t, rows.filter((p) => p.reqTechs.includes(t)).length, rows.filter((p) => p.techs.includes(t)).length]).sort((x, y) => y[1] - x[1])
      .map(([t, r, an]) => `| ${t} | ${pct(r, n)} | ${pct(an, n)} |`).join('\n') + '\n'
}

function mixSection(rows, buckets, label) {
  const regions = new Map()
  for (const p of rows) regions.set(p.region, (regions.get(p.region) || 0) + 1)
  const cos = byCompany(rows)
  const sectors = new Map()
  for (const p of rows) sectors.set(p.sector || 'other', (sectors.get(p.sector || 'other') || 0) + 1)
  let md = `\n## Who is in this data (${label} roles)\n\n${rows.length} roles at ${cos.size} companies.\n\n| Region | Roles | Top technologies (weighted) |\n|---|---|---|\n`
  for (const [region, n] of [...regions].sort((x, y) => y[1] - x[1])) {
    const sub = rows.filter((p) => p.region === region)
    const { stat } = bucketStats(sub, buckets)
    const top = Object.keys(buckets).sort((x, y) => stat[y].weighted - stat[x].weighted).slice(0, 3).map((b) => `${b} ${pct(stat[b].weighted, sub.length)}`).join(', ')
    md += `| ${region} | ${n} | ${sub.length >= 15 ? top : '(too few roles)'} |\n`
  }
  md += `\n| Sector | Roles | Top technologies (weighted) |\n|---|---|---|\n`
  for (const [sector, n] of [...sectors].sort((x, y) => y[1] - x[1])) {
    if (n < 25) continue
    const sub = rows.filter((p) => (p.sector || 'other') === sector)
    const { stat } = bucketStats(sub, buckets)
    const top = Object.keys(buckets).sort((x, y) => stat[y].weighted - stat[x].weighted).slice(0, 3).map((b) => `${b} ${pct(stat[b].weighted, sub.length)}`).join(', ')
    md += `| ${sector} | ${n} | ${top} |\n`
  }
  const inferred = rows.filter((p) => p.roleSource === 'inferred').length
  md += `\n${inferred} of these roles (${pct(inferred, rows.length)}) had a generic title such as "Software Engineer"; their role was inferred from the stack they ask for.\n`
  return md
}

async function backend() {
  const rows = postings.filter((p) => p.role === 'backend' || p.role === 'fullstack')
  const md = `# Backend language report (web development)

Roles: backend + fullstack engineering postings, including generic "Software Engineer" titles whose stack points to backend/fullstack.
A role can name several technologies. "Weighted share" gives each role one point split across the technologies it requires, so it adds to about 100%; the other columns do not.
"Required" ignores anything under "nice to have", "bonus" or "preferred".

${mainTable(rows, BACKEND_BUCKETS, '## Languages (frameworks folded into their language)')}
${otherTable(rows, ['TypeScript', 'JavaScript'], '\n## TypeScript and JavaScript across all these roles\n(Not in the table above: in fullstack roles they are usually the frontend language. Backend use shows up as Node.js.)\n')}
## Frameworks and libraries behind each language
Among the roles that require the language, how many also name each framework.
${ecosystemTable(rows)}
${mixSection(rows, BACKEND_BUCKETS, 'backend and fullstack')}`
  await writeFile(join(out, 'backend-language-report.md'), md)
  console.log(md)
}

async function frontend() {
  const rows = postings.filter((p) => p.role === 'frontend' || p.role === 'fullstack')
  const md = `# Frontend framework report (web development)

Roles: frontend + fullstack engineering postings, including generic "Software Engineer" titles whose stack points to frontend/fullstack.
"Weighted share" gives each role one point split across the frameworks it requires. "Required" ignores "nice to have" / "bonus" text.

${mainTable(rows, FRONTEND_BUCKETS, '## Frameworks (meta-frameworks folded in: Next.js and Remix into React, Nuxt into Vue)')}
${jsBreakdown(rows)}
${otherTable(rows, FRONTEND_OTHER, '\n## Languages, styling, state and tooling\n')}
${mixSection(rows, FRONTEND_BUCKETS, 'frontend and fullstack')}`
  await writeFile(join(out, 'frontend-framework-report.md'), md)
  console.log(md)
}

if (mode === 'all' || mode === 'backend') await backend()
if (mode === 'all' || mode === 'frontend') await frontend()
