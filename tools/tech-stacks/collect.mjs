#!/usr/bin/env node
// Collects public job postings from Greenhouse and Lever boards and tallies which
// technologies the engineering postings mention, per company.
//
//   node tools/tech-stacks/collect.mjs [--companies companies.json] [--out out]
//        [--all-roles] [--concurrency 4] [--only Stripe,Airbnb] [--max-jobs 2000]
//
// Output (in --out): tech-stacks.json, tech-stacks.csv (long: company,category,tech,postings,share)
// and tech-stacks-wide.csv (one row per company, top tech per category).
// No dependencies. Uses only the public, unauthenticated job board APIs.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TECH, CATEGORIES } from './taxonomy.mjs'

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

const ENGINEERING_TITLE = /engineer|developer|software|sre|devops|platform|architect|data scientist|machine learning|\bml\b|\bai\b|infrastructure|security|full.?stack|front.?end|back.?end|mobile|\bios\b|android|programmer|technical/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url, tries = 3) {
  let lastErr
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'tech-stack-research/1.0' }, signal: AbortSignal.timeout(30000) })
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

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&#x2F;': '/', '&#x27;': "'" }
function htmlToText(s) {
  if (!s) return ''
  const decode = (t) => t.replace(/&(amp|lt|gt|quot|nbsp|#39|#x2F|#x27);/g, (m) => ENTITIES[m])
  // Greenhouse returns HTML that is itself entity-escaped, so decode, strip tags, decode again.
  return decode(decode(s).replace(/<(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ')
}

async function fetchGreenhouse(slug) {
  const r = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`)
  if (r.notFound) return null
  return (r.data.jobs || []).map((j) => ({ title: j.title || '', text: htmlToText(j.content), location: j.location?.name || '' }))
}

async function fetchLever(slug) {
  const r = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`)
  if (r.notFound) return null
  if (!Array.isArray(r.data)) return null
  return r.data.map((j) => ({
    title: j.text || '',
    text: [j.descriptionPlain, ...(j.lists || []).map((l) => `${l.text}\n${htmlToText(l.content)}`), j.additionalPlain].filter(Boolean).join('\n'),
    location: j.categories?.location || '',
  }))
}

const FETCHERS = { greenhouse: fetchGreenhouse, lever: fetchLever }

function analyse(jobs) {
  const counts = new Map()
  for (const job of jobs) {
    const hay = `${job.title}\n${job.text}`
    for (const t of TECH) {
      if (t.re.test(hay)) counts.set(t.name, (counts.get(t.name) || 0) + 1)
    }
  }
  return counts
}

async function processCompany(c, opts) {
  const fetcher = FETCHERS[c.ats]
  if (!fetcher) return { ...c, status: `unsupported ats "${c.ats}"` }
  try {
    const all = await fetcher(c.slug)
    if (all === null) return { ...c, status: 'not found' }
    const jobs = (opts.allRoles ? all : all.filter((j) => ENGINEERING_TITLE.test(j.title))).slice(0, opts.maxJobs)
    const counts = analyse(jobs)
    return { ...c, status: 'ok', totalPostings: all.length, analysedPostings: jobs.length, counts }
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

  const rows = []
  const out = []
  for (const r of ok) {
    const techs = [...r.counts.entries()]
      .map(([tech, postings]) => ({ category: catOf.get(tech), tech, postings, share: r.analysedPostings ? +(postings / r.analysedPostings).toFixed(3) : 0 }))
      .sort((a, b) => b.postings - a.postings)
    for (const t of techs) rows.push([r.name, r.sector || '', r.ats, r.analysedPostings, t.category, t.tech, t.postings, t.share])
    out.push({ company: r.name, sector: r.sector || null, ats: r.ats, slug: r.slug, totalPostings: r.totalPostings, analysedPostings: r.analysedPostings, techs })
  }

  await mkdir(opts.out, { recursive: true })
  const stamp = new Date().toISOString()
  await writeFile(join(opts.out, 'tech-stacks.json'), JSON.stringify({ generatedAt: stamp, engineeringRolesOnly: !opts.allRoles, companies: out, skipped: results.filter((r) => r.status !== 'ok').map((r) => ({ company: r.name, slug: r.slug, ats: r.ats, reason: r.status })) }, null, 2))
  await writeFile(join(opts.out, 'tech-stacks.csv'), ['company,sector,ats,analysed_postings,category,tech,postings,share', ...rows.map((r) => r.map(csv).join(','))].join('\n') + '\n')

  const wideHead = ['company', 'sector', 'analysed_postings', ...CATEGORIES.map((c) => `top_${c}`)]
  const wide = out.map((c) => [
    c.company, c.sector || '', c.analysedPostings,
    ...CATEGORIES.map((cat) => c.techs.filter((t) => t.category === cat).slice(0, 5).map((t) => `${t.tech} (${Math.round(t.share * 100)}%)`).join('; ')),
  ])
  await writeFile(join(opts.out, 'tech-stacks-wide.csv'), [wideHead.join(','), ...wide.map((r) => r.map(csv).join(','))].join('\n') + '\n')

  const skipped = results.length - ok.length
  console.error(`\nDone: ${ok.length} companies analysed, ${skipped} skipped. Files in ${opts.out}`)
  if (!ok.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
