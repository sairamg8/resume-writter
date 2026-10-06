// Generates demo data for the screenshots: the fixture's fictional résumés as JSON, read through Vite's SSR loader (the '@/' alias).
// usage: node gen-data.mjs <app dir> <out json>
import { createServer } from '/tmp/claude-0/-home-user-resume-writter/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/scratchpad/b1-app/node_modules/vite/dist/node/index.js'
import fs from 'node:fs'
const [root, out] = process.argv.slice(2)
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
const { DEMO_RESUMES } = await server.ssrLoadModule('/tests/fixtures/sampleResumes.js')
const { normalizeResume, DATA_VERSION } = await server.ssrLoadModule('/src/utils/normalizeResume.js')
const resumes = DEMO_RESUMES.map((r) => normalizeResume(r))
fs.writeFileSync(out, JSON.stringify({ resumes, dataVersion: DATA_VERSION, names: resumes.map((r) => r.name) }))
console.log('resumes:', resumes.map((r) => `${r.id}:${r.name}:${r.template}`).join(' | '), 'dataVersion', DATA_VERSION)
await server.close()
