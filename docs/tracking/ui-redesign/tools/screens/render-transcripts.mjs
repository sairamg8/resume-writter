// Renders the workflow agents' raw JSONL transcripts as readable Markdown files (scratchpad, not the repo).
// Re-run any time: node /tmp/claude-0/-home-user-resume-writter/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/scratchpad/render-transcripts.mjs
import fs from 'node:fs'
import path from 'node:path'

const W = '/root/.claude/projects/-home-user-resume-writter--claude-worktrees-ui-rebuild/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/subagents/workflows'
const OUT = '/tmp/claude-0/-home-user-resume-writter/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/scratchpad/transcripts'
fs.mkdirSync(OUT, { recursive: true })

const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + ` ... [+${s.length - n} more characters]` : s }
const blocks = (c) => (typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : [])
const hhmmss = (t) => (t || '').slice(11, 19)

const rows = []
for (const run of fs.readdirSync(W)) {
  const dir = path.join(W, run)
  if (!fs.statSync(dir).isDirectory()) continue
  for (const f of fs.readdirSync(dir).filter((x) => /^agent-.*\.jsonl$/.test(x))) {
    const id = f.replace(/^agent-|\.jsonl$/g, '')
    let meta = {}
    try { meta = JSON.parse(fs.readFileSync(path.join(dir, `agent-${id}.meta.json`), 'utf8')) } catch {}
    const label = meta.description || id
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    let tools = 0, msgs = 0, firstTs = '', lastTs = ''
    const md = []
    const recent = []
    for (const o of lines) {
      const role = o.message?.role || o.type
      const ts = hhmmss(o.timestamp)
      if (ts) { if (!firstTs) firstTs = ts; lastTs = ts }
      for (const b of blocks(o.message?.content)) {
        if (b.type === 'text' && role === 'assistant') { msgs++; md.push(`\n### ${ts} the agent says\n\n${clip(b.text, 6000)}\n`); recent.push(`${ts} says: ${clip(b.text, 160).replace(/\s+/g, ' ')}`) }
        else if (b.type === 'text' && role === 'user') { md.push(`\n### ${ts} the task it was given (clipped)\n\n${clip(b.text, 3500)}\n`) }
        else if (b.type === 'tool_use') { tools++; const line = `${ts} ${b.name} ${clip(JSON.stringify(b.input), 220)}`; md.push(`- **${ts} ${b.name}** \`${clip(JSON.stringify(b.input), 420).replace(/`/g, "'")}\``); recent.push(line) }
        else if (b.type === 'tool_result') { const c = typeof b.content === 'string' ? b.content : JSON.stringify(b.content); md.push(`  - result: ${clip(c, 260).replace(/\s+/g, ' ')}`) }
      }
    }
    const ageSec = Math.round((Date.now() - fs.statSync(path.join(dir, f)).mtimeMs) / 1000)
    const state = ageSec < 150 ? 'RUNNING' : 'finished'
    const file = `${(meta.workflowPhase || 'x').toLowerCase()}-${label.replace(/[^A-Za-z0-9]+/g, '-')}-${id.slice(0, 6)}.md`
    fs.writeFileSync(path.join(OUT, file), `# ${label}  (${meta.workflowPhase || ''}, run ${run})\n\nstate: ${state} | started ${firstTs}Z | last activity ${lastTs}Z | ${msgs} messages, ${tools} tool calls\n\n${md.join('\n')}\n`)
    rows.push({ label, phase: meta.workflowPhase || '', state, firstTs, lastTs, tools, msgs, file, recent: recent.slice(-4) })
  }
}
rows.sort((a, b) => (a.firstTs < b.firstTs ? -1 : 1))
const idx = [`# Workflow agents (rendered ${new Date().toISOString().slice(11, 19)}Z)`, '', '| agent | phase | state | started | last activity | messages | tool calls | transcript |', '|---|---|---|---|---|---|---|---|']
for (const r of rows) idx.push(`| ${r.label} | ${r.phase} | ${r.state} | ${r.firstTs}Z | ${r.lastTs}Z | ${r.msgs} | ${r.tools} | ${r.file} |`)
idx.push('', '## What each RUNNING agent did last', '')
for (const r of rows.filter((x) => x.state === 'RUNNING')) { idx.push(`### ${r.label}`); r.recent.forEach((l) => idx.push(`- ${l}`)); idx.push('') }
fs.writeFileSync(path.join(OUT, 'INDEX.md'), idx.join('\n'))
console.log(rows.map((r) => `${r.state.padEnd(8)} ${r.label.padEnd(24)} ${r.msgs} msgs ${r.tools} tools  ${r.file}`).join('\n'))
