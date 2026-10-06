// Add the new artboards of the redesign to canvas.json: one block per area (a title1 note, then lines of frames).
//   node layout.mjs <canvas.json in> <plan.json> <canvas.json out>
// plan.json: { "startY": 8000, "firstNumber": 12,
//   "areas": [ { "key": "a1", "title": "Editor: more screens", "boards": [ { "file", "title", "w", "h", "page" } ],
//                "stickies": [ { "text", "fill" } ] } ] }
// Rules (from the Design type): 80 px between frames in a row, a title1 at least 223 px above its row, w and h 40..8000,
// pages get "expand": "fill", existing keys and entries are kept as they are, new files are appended to "order".
import fs from 'node:fs';
const [inFile, planFile, outFile] = process.argv.slice(2);
const canvas = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
let y = plan.startY ?? 8000; let n = plan.firstNumber ?? 12; let titleId = 100; let stickyId = 100;
const GAP = 80; const LINE_GAP = 120; const BLOCK_GAP = 380; const TITLE_ABOVE = 260; const PAGE_W = 1440; const COLS = 2;

for (const area of plan.areas) {
  const pages = area.boards.filter((b) => b.page); const frames = area.boards.filter((b) => !b.page);
  const lines = [];
  for (let i = 0; i < pages.length; i += COLS) lines.push(pages.slice(i, i + COLS));
  const perLine = Math.max(1, Math.floor((COLS * PAGE_W + (COLS - 1) * GAP + GAP) / (Math.max(...frames.map((f) => f.w), 1) + GAP)));
  for (let i = 0; i < frames.length; i += perLine) lines.push(frames.slice(i, i + perLine));
  const rowW = Math.max(...lines.map((l) => l.reduce((s, b) => s + b.w, 0) + GAP * (l.length - 1)), 1440);
  const titleY = y; let lineY = y + TITLE_ABOVE;
  canvas.notes[`t${titleId++}`] = { kind: 'title1', maxW: rowW, text: area.title, w: 240, x: 0, y: titleY };
  const firstLineY = lineY;
  for (const line of lines) {
    let x = 0;
    for (const b of line) {
      const entry = { h: Math.round(b.h), title: `${n++} · ${b.title}`, w: Math.round(b.w), x, y: lineY };
      if (b.page) entry.expand = 'fill';
      canvas.boards[b.file] = entry;
      if (!canvas.order.includes(b.file)) canvas.order.push(b.file);
      x += b.w + GAP;
    }
    lineY += Math.max(...line.map((b) => b.h)) + LINE_GAP;
  }
  (area.stickies || []).forEach((s, i) => {
    canvas.notes[`n${stickyId++}`] = { fill: s.fill || 'blue', size: 24, text: s.text, w: 300, x: rowW + 80, y: firstLineY + i * 460 };
  });
  y = lineY - LINE_GAP + BLOCK_GAP;
}
fs.writeFileSync(outFile, JSON.stringify(canvas, null, 2) + '\n');
console.log(`wrote ${outFile}: ${Object.keys(canvas.boards).length} boards, ${Object.keys(canvas.notes).length} notes, bottom y=${y - BLOCK_GAP}`);
