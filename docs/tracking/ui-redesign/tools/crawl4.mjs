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
try { await page.getByText('STAR Optimizer').first().click({ timeout: 6000 }); await snap('39-star-optimizer'); await page.keyboard.press('Escape'); } catch (e) { console.log('star', String(e).slice(0, 100)); }
try { await page.getByRole('button', { name: /Cover Letter/ }).first().click({ timeout: 6000 }); await page.waitForTimeout(1500); await snap('43-letter-tab');
  const names = await page.$$eval('button', els => els.map(e => (e.textContent || '').trim().slice(0, 40)).filter(Boolean));
  console.log(JSON.stringify(names.slice(0, 40)));
  const g = page.getByRole('button', { name: /(Generate|Draft|Write|AI)/i }).first(); await g.click({ timeout: 4000 }); await snap('44-letter-generator'); } catch (e) { console.log('letter', String(e).slice(0, 100)); }
await b.close();
