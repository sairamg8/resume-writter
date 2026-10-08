#!/usr/bin/env node
// Finds which companies in candidates.txt have a public Greenhouse or Lever board by probing
// likely slugs, then merges the verified ones into companies.json.
//
//   node tools/tech-stacks/discover.mjs [--candidates candidates.txt] [--companies companies.json]
//        [--concurrency 8] [--ats greenhouse,lever,ashby,recruitee,smartrecruiters] [--dry-run]
//
// candidates.txt: "# sector" lines set the sector; each other line is "Company Name" or
// "Company Name = slug1,slug2" (extra slugs to try). Existing entries are kept untouched.

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = { candidates: join(here, 'candidates.txt'), companies: join(here, 'companies.json'), concurrency: 8, dry: false, ats: ['greenhouse', 'lever', 'ashby', 'recruitee', 'smartrecruiters'] }
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--candidates') opt.candidates = resolve(args[++i])
  else if (args[i] === '--companies') opt.companies = resolve(args[++i])
  else if (args[i] === '--concurrency') opt.concurrency = Math.max(1, Number(args[++i]) || 8)
  else if (args[i] === '--ats') opt.ats = args[++i].split(',')
  else if (args[i] === '--dry-run') opt.dry = true
  else throw new Error(`Unknown argument: ${args[i]}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function slugsFor(name, extra) {
  const base = name.toLowerCase().replace(/&/g, 'and').replace(/\.(com|ai|io)$/, '').replace(/[''.]/g, '')
  const words = base.split(/[^a-z0-9]+/).filter(Boolean)
  const joined = words.join('')
  const set = new Set([...extra, joined, words.join('-'), `${joined}hq`, `${joined}inc`, `${joined}labs`, `${joined}careers`, `${joined}io`, `${joined}ai`])
  if (words.length > 1) set.add(words[0])
  const camel = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  if (camel.length > 1) set.add(camel)
  return [...set].filter((s) => s.length > 1)
}

// Returns 'ok' when the board exists, 'none' when it does not, null on a transient failure.
async function probe(url) {
  for (let t = 0; t < 3; t++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'tech-stack-research/1.0' }, signal: AbortSignal.timeout(20000) })
      if (res.status === 404) return 'none'
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) return 'none'
      if (url.includes('lever')) {
        const j = await res.json()
        return Array.isArray(j) && j.length ? 'ok' : 'none' // an empty Lever board is useless
      }
      if (url.includes('smartrecruiters')) return (await res.json()).totalFound > 0 ? 'ok' : 'none' // unknown ids return 200 with nothing
      if (url.includes('ashbyhq')) return (await res.json()).jobs?.length ? 'ok' : 'none'
      return 'ok'
    } catch {
      await sleep(600 * 2 ** t)
    }
  }
  return null
}

const GH = (s) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(s)}/jobs`
const LV = (s) => `https://api.lever.co/v0/postings/${encodeURIComponent(s)}?mode=json&limit=1`

const AB = (s) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(s)}`
const RC = (s) => `https://${encodeURIComponent(s)}.recruitee.com/api/offers/`
const SR = (s) => `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(s)}/postings?limit=1`
const PROBES = { greenhouse: GH, lever: LV, ashby: AB, recruitee: RC, smartrecruiters: SR }

async function findBoard(c) {
  for (const slug of c.slugs) {
    for (const ats of opt.ats) {
      // Recruitee uses a subdomain, so only plain lowercase slugs can work there; SmartRecruiters ids are case-sensitive.
      if (ats === 'recruitee' && /[^a-z0-9-]/.test(slug)) continue
      if ((await probe(PROBES[ats](slug))) === 'ok') return { ats, slug }
    }
    await sleep(100)
  }
  return null
}

function parseCandidates(text) {
  let sector = ''
  const seen = new Set()
  const out = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      const m = line.match(/^#\s*([a-z][a-z ,/&-]*)$/i)
      if (m && !/lines starting|one company/i.test(line)) sector = m[1].trim().toLowerCase()
      continue
    }
    const [namePart, slugPart] = line.split('=').map((s) => s.trim())
    const key = namePart.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name: namePart, sector, slugs: slugsFor(namePart, slugPart ? slugPart.split(',').map((s) => s.trim()) : []) })
  }
  return out
}

async function main() {
  const doc = JSON.parse(await readFile(opt.companies, 'utf8'))
  const have = new Set(doc.companies.map((c) => `${c.ats}:${c.slug}`))
  const haveNames = new Set(doc.companies.map((c) => c.name.toLowerCase()))
  const cands = parseCandidates(await readFile(opt.candidates, 'utf8')).filter((c) => !haveNames.has(c.name.toLowerCase()))
  console.error(`Probing ${cands.length} candidates...`)

  const found = []
  let next = 0
  let done = 0
  await Promise.all(Array.from({ length: opt.concurrency }, async () => {
    while (next < cands.length) {
      const c = cands[next++]
      const hit = await findBoard(c)
      done++
      if (hit && !have.has(`${hit.ats}:${hit.slug}`)) {
        have.add(`${hit.ats}:${hit.slug}`)
        found.push({ name: c.name, ats: hit.ats, slug: hit.slug, sector: c.sector })
        console.error(`  [${done}/${cands.length}] + ${c.name} -> ${hit.ats}:${hit.slug}`)
      } else if (done % 50 === 0) console.error(`  [${done}/${cands.length}] ${found.length} found`)
    }
  }))

  found.sort((a, b) => a.name.localeCompare(b.name))
  console.error(`\nFound ${found.length} new boards; list now ${doc.companies.length + found.length}.`)
  if (opt.dry) return
  doc.companies = [...doc.companies, ...found]
  await writeFile(opt.companies, JSON.stringify(doc, null, 2) + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
