// Renders canvas boards from the local rig. usage: node canvas-shoot.mjs   (rig served on 5302)
import { chromium } from '/tmp/claude-0/-home-user-resume-writter/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/scratchpad/b1-app/node_modules/playwright/index.mjs'
const S = '/tmp/claude-0/-home-user-resume-writter/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/scratchpad/shots'
const boards = [
  ['canvas-1-documents', 'Main.dc.html', 1440, 900],
  ['canvas-2-editor-design', 'Editor.dc.html', 1440, 900],
  ['canvas-3-editor-ats', 'EditorAts.dc.html', 1440, 900],
  ['canvas-4-applications', 'Jobs.dc.html', 1440, 900],
  ['canvas-5-phone-documents', 'MobileHome.dc.html', 390, 844],
]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const [name, file, w, h] of boards) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
  await p.goto(`http://127.0.0.1:5302/${file}`, { waitUntil: 'load' })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${S}/${name}.png` })
  console.log(name, errs.length ? JSON.stringify(errs.slice(0, 2)) : 'ok')
  await p.close()
}
await b.close()
