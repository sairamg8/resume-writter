import { chromium } from '/home/user/resume-writter/node_modules/playwright/index.mjs';
import { buildTestState, STORAGE_KEY } from '/home/user/resume-writter/tests/helpers.js';
const BASE = 'https://resume-writter.sairamgudiputi8.workers.dev';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const s0 = buildTestState('classic'); const r = s0.resumes[0]; r.id = 'r_classic'; r.name = 'Senior Engineer résumé'; s0.activeId = 'r_classic';
await page.addInitScript((a) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem(a.key, JSON.stringify(a.state)); sessionStorage.setItem('seeded', '1'); } }, { key: STORAGE_KEY, state: s0 });
const snap = async (n) => { await page.waitForTimeout(900); await page.screenshot({ path: `live/${n}.png` }); console.log('shot', n); };
await page.goto(`${BASE}/#/resume/r_classic`); await page.waitForTimeout(3000);
const btns = await page.$$eval('button, [role=tab], a', els => els.map(e => (e.getAttribute('data-testid') || '') + '|' + (e.textContent || '').trim().slice(0, 30)).filter(x => x.length > 1).slice(0, 60));
console.log(JSON.stringify(btns));
try { await page.getByText('Header Customization', { exact: false }).first().click({ timeout: 6000 }); await snap('37-header-custom'); } catch (e) { console.log('header', String(e).slice(0, 80)); }
try { await page.goto(`${BASE}/#/resume/r_classic?tab=design`); await page.reload(); await page.waitForTimeout(3000); await page.getByTestId('browse-templates').click({ timeout: 8000 }); await snap('36-gallery'); } catch (e) { console.log('gallery', String(e).slice(0, 120)); }
await b.close();
