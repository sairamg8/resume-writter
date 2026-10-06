// Render one artboard of the local rig, save a PNG, and report what a human would notice.
//   node check.mjs <File.dc.html> <out.png> <w> <h> [--phone]
// Reports: real scroll size vs the declared frame, console/network errors, horizontal overflow, clipped text, text below
// 4.5:1 contrast (3:1 for large text), and (with --phone, or when w <= 430) controls smaller than 44 px.
// Needs the rig server (serve.mjs) on port 5302 and node_modules (Playwright) of the repo.
import { chromium } from '/home/user/resume-writter/node_modules/playwright/index.mjs';
const [file, out, w, h, flag] = process.argv.slice(2);
const phone = flag === '--phone' || Number(w) <= 430;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 160)));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
p.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 100)}`); });
await p.goto(`http://127.0.0.1:5302/${file}`, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(2200);

const res = await p.evaluate(({ phone, W, H }) => {
  const lum = (c) => { const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { // composite the ancestors' backgrounds over white
    const stack = []; for (let e = el; e; e = e.parentElement) stack.push(e);
    let base = [255, 255, 255];
    for (const e of stack.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) base = base.map((v, i) => Math.round(c.c[i] * c.a + v * (1 - c.a))); }
    return base;
  };
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const out = { overflowX: [], clipped: [], contrast: [], small: [], hidden: 0 };
  const doc = document.documentElement;
  out.scroll = [doc.scrollWidth, doc.scrollHeight];
  const seen = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (r.right > W + 1 && r.width > 0 && !el.closest('[style*="overflow"]')) out.overflowX.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)} "${own.slice(0, 30)}"`);
    if (own) {
      if (!/[A-Za-z0-9]/.test(own)) continue; // separators such as a middle dot
      // clipped text: a box that hides overflow and whose content is wider/taller than it, without an ellipsis on purpose
      if ((el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis') || (el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden' && cs.display !== 'inline' && cs.webkitLineClamp === 'none' && el.clientHeight > 0)) out.clipped.push(`${el.tagName.toLowerCase()} "${own.slice(0, 40)}" ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
      const fg = parse(cs.color); if (!fg) continue;
      const bgc = bgOf(el); const f = fg.c.map((v, i) => Math.round(v * fg.a + bgc[i] * (1 - fg.a)));
      const [l1, l2] = [lum(f), lum(bgc)].sort((a, b) => b - a); const ratio = (l1 + 0.05) / (l2 + 0.05);
      const px = parseFloat(cs.fontSize); const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
      const key = `${hex(f)}|${hex(bgc)}|${own.slice(0, 20)}`;
      if (ratio < (large ? 3 : 4.5) && !seen.has(key) && r.width > 0 && r.bottom > 0) { seen.add(key); out.contrast.push(`${ratio.toFixed(2)} ${hex(f)} on ${hex(bgc)} "${own.slice(0, 36)}" ${px}px`); }
    }
    if (phone && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && r.width > 0 && (r.height < 44 || r.width < 44) && !(el.tagName === 'A' && r.height < 44 && el.closest('nav') === null && cs.display === 'inline')) out.small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`);
  }
  return out;
}, { phone, W: Number(w), H: Number(h) });

await p.screenshot({ path: out });
const [sw, sh] = res.scroll;
const verdict = [];
if (sw > Number(w) + 1) verdict.push(`WIDTH ${sw} > frame ${w}`);
if (sh > Number(h) + 1) verdict.push(`HEIGHT ${sh} > frame ${h} (frame is clipped: raise the root height and $preview)`);
else if (!phone && sh < Number(h) - 1) verdict.push(`note: content is ${sh} tall, frame ${h}`);
console.log(`${file}: scroll ${sw}x${sh}, frame ${w}x${h}${verdict.length ? '  <-- ' + verdict.join('; ') : '  ok'}`);
if (errs.length) console.log('  errors: ' + JSON.stringify([...new Set(errs)].slice(0, 6)));
const show = (name, a, n = 8) => { if (a.length) console.log(`  ${name} (${a.length}):\n    ` + a.slice(0, n).join('\n    ')); };
show('overflow right of the frame', res.overflowX); show('clipped text', res.clipped); show('low contrast', res.contrast, 10); if (phone) show('controls under 44px', res.small, 10);
await b.close();
