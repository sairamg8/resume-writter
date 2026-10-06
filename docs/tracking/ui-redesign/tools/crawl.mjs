import { chromium } from '/home/user/resume-writter/node_modules/playwright/index.mjs';
import { buildTestState, STORAGE_KEY } from '/home/user/resume-writter/tests/helpers.js';
const BASE = 'https://resume-writter.sairamgudiputi8.workers.dev';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
// four résumés, different templates
const base = buildTestState('classic');
const mk = (tpl, name, ago) => { const s = buildTestState(tpl); const r = s.resumes[0]; r.id = 'r_' + tpl; r.name = name; r.updatedAt = Date.now() - ago; return r; };
const state = { ...base, activeId: 'r_classic', resumes: [mk('classic', 'Senior Engineer résumé', 7200e3), mk('modern', 'Product Designer', 86400e3), mk('minimal', 'Graduate résumé', 9 * 86400e3), mk('sidebar', 'Consulting CV', 30 * 86400e3)] };
await page.addInitScript((a) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem(a.key, JSON.stringify(a.state)); sessionStorage.setItem('seeded', '1'); } }, { key: STORAGE_KEY, state });
const shot = async (name, hash, after) => {
  await page.goto(`${BASE}/#${hash}`); await page.waitForTimeout(2200);
  if (after) { try { await after(); await page.waitForTimeout(700); } catch (e) { errs.push(name + ': ' + String(e).slice(0, 100)); } }
  await page.screenshot({ path: `live/${name}.png` });
  console.log(name, '->', page.url().replace(BASE, ''));
};
await shot('01-dashboard', '/');
await shot('02-new', '/new');
await shot('03-editor-resume', '/resume/r_classic');
await shot('04-editor-design', '/resume/r_classic?tab=design');
await shot('05-editor-letter', '/resume/r_classic?tab=coverletter');
await shot('06-editor-ats', '/resume/r_classic?tab=ats');
await shot('07-jobs', '/jobs');
await shot('08-jobs-new', '/jobs/new');
await shot('09-boards', '/boards');
await shot('10-work', '/work');
await shot('11-terms', '/terms');
await shot('12-privacy', '/privacy');
console.log('errors', JSON.stringify(errs));
await b.close();
