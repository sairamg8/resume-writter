// Screenshots of the built B1 app with demo data. usage: node shoot.mjs
import { chromium } from '/tmp/claude-0/-home-user-resume-writter/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/scratchpad/b1-app/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const S = '/tmp/claude-0/-home-user-resume-writter/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/scratchpad/shots'
const demo = JSON.parse(fs.readFileSync(`${S}/demo.json`, 'utf8'))
const pick = ['demo_classic', 'demo_modern', 'demo_sidebar', 'demo_executive']
const resumes = demo.resumes.filter((r) => pick.includes(r.id))
const store = { resumes, activeId: resumes[0].id, dataVersion: demo.dataVersion, deletedIds: [] }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const BASE = 'http://127.0.0.1:4190'
async function shot(name, { w = 1440, h = 900, hash = '/', after } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
  await p.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v) } catch {} }, ['cpwtcv_v1', JSON.stringify(store)])
  await p.goto(`${BASE}/#${hash}`, { waitUntil: 'load' })
  await p.waitForTimeout(2500)
  if (after) { await after(p); await p.waitForTimeout(1800) }
  await p.screenshot({ path: `${S}/${name}.png` })
  console.log(name, errs.length ? 'errors: ' + JSON.stringify(errs.slice(0, 2)) : 'ok')
  await ctx.close()
}
await shot('app-1-documents')
await shot('app-2-editor', { hash: `/resume/${resumes[0].id}` })
await shot('app-3-design', { hash: `/resume/${resumes[0].id}`, after: async (p) => { await p.getByRole('button', { name: /Design/ }).first().click() } })
await shot('app-4-ats', { hash: `/resume/${resumes[0].id}`, after: async (p) => { await p.getByRole('button', { name: /ATS/ }).first().click() } })
await shot('app-5-jobs', { hash: '/jobs' })
await shot('app-6-phone-documents', { w: 390, h: 844 })
await shot('app-7-phone-editor', { w: 390, h: 844, hash: `/resume/${resumes[0].id}` })
await b.close()
