// render one artboard of the local rig: node rshot.mjs <File.dc.html> <out.png> <w> <h>
import { chromium } from '/home/user/resume-writter/node_modules/playwright/index.mjs';
const [file, out, w, h] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await p.goto(`http://127.0.0.1:5302/${file}`, { waitUntil: 'load' });
await p.waitForTimeout(2500);
const d = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
await p.screenshot({ path: out });
console.log('scroll size', d.sw + 'x' + d.sh, '(viewport ' + process.argv[4] + 'x' + process.argv[5] + ')');
console.log(file, 'errors:', JSON.stringify(errs.slice(0, 4)));
await b.close();
