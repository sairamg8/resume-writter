#!/usr/bin/env node
// Collects public job postings from Greenhouse, Lever, Ashby, SmartRecruiters and Recruitee boards
// and records, per posting, the role and the technologies it asks for.
//
//   node tools/tech-stacks/collect.mjs [--companies companies.json] [--out out]
//        [--all-roles] [--concurrency 4] [--only Stripe,Airbnb] [--max-jobs 2000]
//
// Output (in --out):
//   postings.jsonl   one posting per line (title, role, region, techs in the title / required text /
//                    preferred text / anywhere). report.mjs reads this.
//   postings.csv, roles.csv, tech-stacks.json, tech-stacks.csv, tech-stacks-wide.csv
// No dependencies. Uses only public, unauthenticated job board APIs.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TECH, CATEGORIES } from './taxonomy.mjs'
import { classifyRole, ROLES } from './roles.mjs'
import { splitZones, matchTech, inferRole, regionOf } from './analysis.mjs'

const here = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const o = { companies: join(here, 'companies.json'), out: join(here, 'out'), allRoles: false, concurrency: 4, only: null, maxJobs: 5000 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--all-roles') o.allRoles = true
    else if (a === '--companies') o.companies = resolve(argv[++i])
    else if (a === '--out') o.out = resolve(argv[++i])
    else if (a === '--concurrency') o.concurrency = Math.max(1, Number(argv[++i]) || 4)
    else if (a === '--max-jobs') o.maxJobs = Math.max(1, Number(argv[++i]) || 5000)
    else if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim().toLowerCase())
    else throw new Error(`Unknown argument: ${a}`)
  }
  return o
}

const ENGINEERING_TITLE_IN = /engineer|developer|programmer|architect|\bsre\b|devops|software|data scientist|machine learning|full.?stack|front.?end|back.?end|\bsde\b|\bswe\b|\bmts\b|member of technical staff/i
const ENGINEERING_TITLE_OUT = /account executive|sales|recruit|customer success|customer support|solutions? (?:consultant|architect|engineer)|support engineer|field engineer|sales engineer|marketing|legal|counsel|finance|accountant|\bhr\b|people partner|office manager/i
const ENGINEERING_TITLE = { test: (t) => ENGINEERING_TITLE_IN.test(t) && !ENGINEERING_TITLE_OUT.test(t) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url, tries = 3) {
  let lastErr
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'tech-stack-research/1.0' }, signal: AbortSignal.timeout(45000) })
      if (res.status === 404) return { notFound: true }
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return { data: await res.json() }
    } catch (e) {
      lastErr = e
      await sleep(800 * 2 ** t)
    }
  }
  throw lastErr
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&nbsp;': ' ', '&#39;': "'", '&#x2F;': '/', '&#x27;': "'" }
function htmlToText(s) {
  if (!s) return ''
  const decode = (t) => t.replace(/&(amp|lt|gt|quot|nbsp|#39|#x2F|#x27);/g, (m) => ENTITIES[m])
  // Greenhouse returns HTML that is itself entity-escaped, so decode, strip tags, decode again.
  return decode(decode(s).replace(/<\/?(br|p|li|ul|ol|h\d|div|strong|b)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ')
}

async function fetchGreenhouse(slug) {
  const r = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`)
  if (r.notFound) return null
  return (r.data.jobs || []).map((j) => ({ title: j.title || '', text: htmlToText(j.content), location: j.location?.name || '', url: j.absolute_url || '' }))
}

async function fetchLever(slug) {
  const r = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`)
  if (r.notFound || !Array.isArray(r.data)) return null
  return r.data.map((j) => ({
    title: j.text || '',
    text: [j.descriptionPlain, ...(j.lists || []).map((l) => `${htmlToText(l.text)}\n${htmlToText(l.content)}`), j.additionalPlain].filter(Boolean).join('\n'),
    location: j.categories?.location || '',
    url: j.hostedUrl || '',
  }))
}

async function fetchAshby(slug) {
  const r = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`)
  if (r.notFound || !Array.isArray(r.data?.jobs)) return null
  return r.data.jobs.filter((j) => j.isListed !== false).map((j) => ({ title: j.title || '', text: j.descriptionPlain || htmlToText(j.descriptionHtml), location: j.location || '', url: j.jobUrl || '' }))
}

async function fetchRecruitee(slug) {
  const r = await getJson(`https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`)
  if (r.notFound || !Array.isArray(r.data?.offers)) return null
  return r.data.offers.map((j) => ({
    title: j.title || '',
    text: `${htmlToText(j.description)}\nRequirements\n${htmlToText(j.requirements)}`,
    location: [j.city, j.country].filter(Boolean).join(', ') || j.location || '',
    url: j.careers_url || '',
  }))
}

// SmartRecruiters' list endpoint has no descriptions, so list with a title query and fetch the
// detail of each engineering posting (capped).
async function fetchSmartRecruiters(slug, opts) {
  const seen = new Map()
  for (const q of ['engineer', 'developer']) {
    for (let offset = 0; offset < 600; offset += 100) {
      const r = await getJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100&offset=${offset}&q=${q}`)
      if (r.notFound || !r.data) return null
      for (const p of r.data.content || []) seen.set(p.id, p)
      if (offset + 100 >= (r.data.totalFound || 0)) break
      await sleep(150)
    }
  }
  if (!seen.size) return null
  const picked = [...seen.values()].filter((p) => ENGINEERING_TITLE.test(p.name || '')).slice(0, Math.min(opts.maxJobs, 250))
  const jobs = []
  for (const p of picked) {
    try {
      const d = await getJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${p.id}`)
      const s = d.data?.jobAd?.sections || {}
      const text = [s.jobDescription?.text, 'Qualifications', s.qualifications?.text, s.additionalInformation?.text].map((x) => htmlToText(x || '')).join('\n')
      jobs.push({ title: p.name || '', text, location: p.location?.fullLocation || '', url: d.data?.postingUrl || '' })
    } catch {
      // skip a posting whose detail fails
    }
    await sleep(120)
  }
  return jobs
}

const FETCHERS = { greenhouse: fetchGreenhouse, lever: fetchLever, ashby: fetchAshby, recruitee: fetchRecruitee, smartrecruiters: fetchSmartRecruiters }

function analyse(jobs, company) {
  const postings = []
  for (const job of jobs) {
    const { required, preferred } = splitZones(job.text)
    const titleTechs = matchTech(job.title)
    const reqTechs = matchTech(required)
    const prefTechs = matchTech(preferred)
    const anyTechs = [...new Set([...titleTechs, ...reqTechs, ...prefTechs])]
    const titleRole = classifyRole(job.title)
    const { role, source } = inferRole(titleRole, [...new Set([...titleTechs, ...reqTechs])])
    postings.push({
      company: company.name, sector: company.sector || '', ats: company.ats,
      title: job.title, role, roleSource: source, location: job.location, region: regionOf(job.location), url: job.url,
      titleTechs, reqTechs: [...new Set([...titleTechs, ...reqTechs])], prefTechs, techs: anyTechs,
    })
  }
  return postings
}

async function processCompany(c, opts) {
  const fetcher = FETCHERS[c.ats]
  if (!fetcher) return { ...c, status: `unsupported ats "${c.ats}"` }
  try {
    const all = await fetcher(c.slug, opts)
    if (all === null) return { ...c, status: 'not found' }
    const jobs = (opts.allRoles ? all : all.filter((j) => ENGINEERING_TITLE.test(j.title))).slice(0, opts.maxJobs)
    return { ...c, status: 'ok', totalPostings: all.length, analysedPostings: jobs.length, postings: analyse(jobs, c) }
  } catch (e) {
    return { ...c, status: `error: ${e.message}` }
  }
}

async function pool(items, n, fn, onDone) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
      onDone?.(results[i])
      await sleep(250)
    }
  }))
  return results
}

const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const { companies } = JSON.parse(await readFile(opts.companies, 'utf8'))
  const seen = new Set()
  let list = companies.filter((c) => {
    const k = `${c.ats}:${c.slug}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (opts.only) list = list.filter((c) => opts.only.includes(c.name.toLowerCase()))

  console.error(`Fetching ${list.length} companies (concurrency ${opts.concurrency})...`)
  const results = await pool(list, opts.concurrency, (c) => processCompany(c, opts), (r) => {
    console.error(r.status === 'ok' ? `  ok   ${r.name}: ${r.analysedPostings}/${r.totalPostings} postings` : `  skip ${r.name}: ${r.status}`)
  })

  const ok = results.filter((r) => r.status === 'ok')
  const catOf = new Map(TECH.map((t) => [t.name, t.category]))
  const all = ok.flatMap((r) => r.postings)

  await mkdir(opts.out, { recursive: true })
  await writeFile(join(opts.out, 'postings.jsonl'), all.map((p) => JSON.stringify(p)).join('\n') + '\n')
  await writeFile(join(opts.out, 'postings.csv'), ['company,sector,ats,title,role,role_source,region,location,url,required_techs,preferred_techs', ...all.map((p) => [p.company, p.sector, p.ats, p.title, p.role, p.roleSource, p.region, p.location, p.url, p.reqTechs.join('; '), p.prefTechs.join('; ')].map(csv).join(','))].join('\n') + '\n')

  const rows = []
  const out = []
  for (const r of ok) {
    const counts = new Map()
    const byRole = {}
    for (const p of r.postings) {
      const br = (byRole[p.role] ??= { postings: 0, techs: {} })
      br.postings++
      for (const t of p.techs) {
        counts.set(t, (counts.get(t) || 0) + 1)
        br.techs[t] = (br.techs[t] || 0) + 1
      }
    }
    const techs = [...counts.entries()]
      .map(([tech, postings]) => ({ category: catOf.get(tech), tech, postings, share: r.analysedPostings ? +(postings / r.analysedPostings).toFixed(3) : 0 }))
      .sort((a, b) => b.postings - a.postings)
    for (const t of techs) rows.push([r.name, r.sector || '', r.ats, r.analysedPostings, t.category, t.tech, t.postings, t.share])
    out.push({ company: r.name, sector: r.sector || null, ats: r.ats, slug: r.slug, totalPostings: r.totalPostings, analysedPostings: r.analysedPostings, techs, byRole })
  }

  const stamp = new Date().toISOString()
  await writeFile(join(opts.out, 'tech-stacks.json'), JSON.stringify({ generatedAt: stamp, engineeringRolesOnly: !opts.allRoles, companies: out, skipped: results.filter((r) => r.status !== 'ok').map((r) => ({ company: r.name, slug: r.slug, ats: r.ats, reason: r.status })) }, null, 2))
  await writeFile(join(opts.out, 'tech-stacks.csv'), ['company,sector,ats,analysed_postings,category,tech,postings,share', ...rows.map((r) => r.map(csv).join(','))].join('\n') + '\n')
  await writeFile(join(opts.out, 'roles.csv'), ['company,' + ROLES.join(','), ...out.map((c) => [c.company, ...ROLES.map((x) => c.byRole[x]?.postings || 0)].join(','))].join('\n') + '\n')

  const wideHead = ['company', 'sector', 'analysed_postings', ...CATEGORIES.map((c) => `top_${c}`)]
  const wide = out.map((c) => [
    c.company, c.sector || '', c.analysedPostings,
    ...CATEGORIES.map((cat) => c.techs.filter((t) => t.category === cat).slice(0, 5).map((t) => `${t.tech} (${Math.round(t.share * 100)}%)`).join('; ')),
  ])
  await writeFile(join(opts.out, 'tech-stacks-wide.csv'), [wideHead.join(','), ...wide.map((r) => r.map(csv).join(','))].join('\n') + '\n')

  const skipped = results.length - ok.length
  console.error(`\nDone: ${ok.length} companies analysed, ${skipped} skipped, ${all.length} postings. Files in ${opts.out}`)
  if (!ok.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
