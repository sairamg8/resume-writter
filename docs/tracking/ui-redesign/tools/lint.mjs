// Static check of .dc.html artboards against the format rules that fail silently.
//   node lint.mjs <rigDir> <File.dc.html> [more files]      (exit 1 when any file has an ERROR)
// rigDir is the folder that holds the artboards (and support.js); links are checked against it and the planned names.
import fs from 'node:fs';
import path from 'node:path';

const PLANNED = ['Main', 'New', 'Editor', 'EditorSection', 'EditorLetter', 'EditorAts', 'Jobs', 'MobileHome', 'MobileEdit', 'MobilePreview',
  'MobileDesign', 'Paper', 'Letter', 'Projects', 'ProjectBoard', 'ProjectList', 'ProjectCalendar', 'ProjectTimeline', 'ProjectSummary',
  'ProjectBacklog', 'ProjectIssue', 'ProjectSettings', 'MobileProject', 'JobsList', 'JobAdd', 'JobsInsights', 'MobileJobs', 'EditorPersonal',
  'EditorDownload', 'EditorShare', 'EditorTemplates', 'EditorImprove', 'EditorDraft', 'ShellMenus', 'Empty', 'ImportModal', 'Public', 'Legal', 'States'];
const VOID = new Set(['meta', 'link', 'input', 'br', 'hr', 'img', 'source', 'col', 'wbr']);
const [rigDir, ...files] = process.argv.slice(2);
if (!rigDir || !files.length) { console.error('usage: node lint.mjs <rigDir> <File.dc.html> ...'); process.exit(2); }

let anyError = false;
for (const file of files) {
  const errs = []; const warns = [];
  const full = path.isAbsolute(file) ? file : path.join(rigDir, file);
  if (!fs.existsSync(full)) { console.log(`${file}: ERROR file not found`); anyError = true; continue; }
  const src = fs.readFileSync(full, 'utf8');
  const err = (m) => errs.push(m); const warn = (m) => warns.push(m);

  if (!src.includes('<script src="./support.js"></script>')) err('head must contain <script src="./support.js"></script> exactly');
  if (!/<title>[^<]{2,60}<\/title>/.test(src)) err('missing or odd <title> (a few words)');
  if (!/<html lang="en">/.test(src)) warn('no <html lang="en">');
  if (!/<script type="text\/x-dc" data-dc-script/.test(src) || !/class Component extends DCLogic/.test(src)) err('missing the data-dc-script block with class Component extends DCLogic');
  if (!/<x-dc>[\s\S]*<\/x-dc>/.test(src)) err('missing <x-dc> ... </x-dc>');
  const pv = src.match(/"\$preview":\{"width":(\d+),"height":(\d+)\}/);
  if (!pv) err('data-props has no $preview width/height'); else console.log(`${file}: $preview ${pv[1]}x${pv[2]}`);

  // holes: dotted lookups only
  for (const m of src.matchAll(/\{\{([^}]*)\}\}/g)) {
    const t = m[1].trim();
    if (!/^(\$?[A-Za-z_][\w$]*(\.\$?[A-Za-z_][\w$]*|\.\d+)*|true|false|-?\d+(\.\d+)?)$/.test(t)) err(`hole is not a dotted lookup: {{${t.slice(0, 40)}}}`);
  }
  for (const m of src.matchAll(/<sc-for\b([^>]*)>/g)) if (!/hint-placeholder-count=/.test(m[1])) err('<sc-for> without hint-placeholder-count');
  for (const m of src.matchAll(/<sc-if\b([^>]*)>/g)) if (!/hint-placeholder-val=/.test(m[1])) err('<sc-if> without hint-placeholder-val');
  if (/<(sc-for|sc-if|dc-import)\b[^>]*\/>/.test(src)) err('custom tag is self-closed');
  if (/<(Paper|Letter)\b/.test(src)) err('capitalised custom tag (use <dc-import name="Paper">)');

  // forbidden things
  if (/<(iframe|object|embed)\b/i.test(src)) err('iframe/object/embed is not allowed');
  if (/<img\b/i.test(src)) err('<img> is not allowed (no external images; draw with divs)');
  if (/\p{Extended_Pictographic}/u.test(src.replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, ''))) err('emoji in the artboard');
  if (/<script\b(?![^>]*(support\.js|data-dc-script))/i.test(src)) err('extra <script>');
  if (/\bon(click|keydown|keyup|input)=/i.test(src) && !/Click="\{\{/.test(src)) warn('raw DOM event attribute');
  if (/role="(button|tab|link)"/.test(src)) warn('role= on non-native element: use real <button>/<a>');
  for (const m of src.matchAll(/<link\b[^>]*>/g)) if (!/fonts\.(googleapis|gstatic)\.com/.test(m[0])) err(`<link> that is not the Google font link: ${m[0].slice(0, 70)}`);
  if (/var\(--/.test(src)) warn('CSS variable used (brief: literal hex, inline styles)');
  const svgBlocks = [...src.matchAll(/<svg\b([^>]*)>/g)].filter((m) => { const w = m[1].match(/width="(\d+)"/); return w && Number(w[1]) > 40; });
  if (svgBlocks.length) err(`${svgBlocks.length} <svg> wider than 40px (charts and diagrams are drawn with divs)`);
  const bg = src.match(/background(?:-image)?:\s*[^;"]*gradient/g);
  if (bg && !/conic-gradient/.test(src)) warn('gradient background (only conic-gradient for a donut is expected)');

  // tag balance and nested interactive elements
  const body = src.replace(/<script[\s\S]*?<\/script>/g, '<script></script>').replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let m; let line = 1; let last = 0;
  const interactive = new Set(['a', 'button']);
  while ((m = re.exec(body))) {
    const [all, close, nameRaw, attrs] = m; const name = nameRaw.toLowerCase();
    line += (body.slice(last, m.index).match(/\n/g) || []).length; last = m.index;
    if (!close && /\/\s*$/.test(attrs)) continue; // self-closed svg children
    if (VOID.has(name)) continue;
    if (!close) {
      if (interactive.has(name) && stack.some((s) => interactive.has(s.name))) err(`line ${line}: <${name}> inside <${stack.find((s) => interactive.has(s.name)).name}> (nested interactive)`);
      if (name === 'input' || name === 'img') continue;
      stack.push({ name, line, attrs });
    } else {
      const top = stack.pop();
      if (!top) { err(`line ${line}: stray </${name}>`); continue; }
      if (top.name !== name) { err(`line ${line}: </${name}> closes <${top.name}> opened on line ${top.line}`); stack.length = 0; break; }
    }
  }
  for (const s of stack) err(`line ${s.line}: <${s.name}> never closed`);

  // accessibility as drawn
  for (const mm of body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const text = mm[2].replace(/<[^>]*>/g, '').replace(/\{\{[^}]*\}\}/g, 'x').trim();
    if (!text && !/aria-label=/.test(mm[1])) err('icon-only <button> without aria-label');
  }
  for (const mm of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const text = mm[2].replace(/<[^>]*>/g, '').replace(/\{\{[^}]*\}\}/g, 'x').trim();
    if (!text && !/aria-label=/.test(mm[1])) err('icon-only <a> without aria-label');
  }
  for (const mm of body.matchAll(/<input\b([^>]*)>/g)) {
    if (/type="(checkbox|radio)"/.test(mm[1]) || !/aria-label=/.test(mm[1])) {
      // allowed when wrapped in a <label>: check the nearest preceding open tag crudely
      const before = body.slice(0, mm.index); const lo = before.lastIndexOf('<label'); const lc = before.lastIndexOf('</label>');
      if (!(lo > lc) && !/aria-label=/.test(mm[1]) && !/aria-labelledby=/.test(mm[1])) err('<input> without a label or aria-label');
    }
  }

  // links to other artboards
  for (const mm of body.matchAll(/href="([^"#]*\.dc\.html)"/g)) {
    const name = mm[1].replace(/\.dc\.html$/, '');
    if (!PLANNED.includes(name) && !fs.existsSync(path.join(rigDir, mm[1]))) err(`link to unknown artboard ${mm[1]}`);
  }

  // colours: literal hex only for text; lightest allowed text colour is #6B7385
  const lightText = [...body.matchAll(/(?<![-\w])color:\s*(#[0-9a-fA-F]{6})/g)].map((x) => x[1].toUpperCase())
    .filter((h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); const L = 0.2126 * r + 0.7152 * g + 0.0722 * b; return (1.05 / (L + 0.05) < 4.5) && L < 0.85; });
  if (lightText.length) warn(`text colours that fail 4.5:1 on white: ${[...new Set(lightText)].join(' ')} (ok only on a dark fill)`);
  if (!/font-family:\s*'Instrument Sans'/.test(src)) warn("no font-family: 'Instrument Sans' on the root");

  console.log(`${file}: ${errs.length} error(s), ${warns.length} warning(s)`);
  for (const e of [...new Set(errs)]) console.log('  ERROR ' + e);
  for (const w of [...new Set(warns)]) console.log('  warn  ' + w);
  if (errs.length) anyError = true;
}
process.exit(anyError ? 1 : 0);
