/**
 * Canvas (HTML preview) vs exported PDF (react-pdf) — visual comparison harness.
 *
 * For every template it renders the live editor preview pages and the "Export PDF" output
 * at the SAME scale (A4 → 1588×2246 px), then writes per page:
 *   canvas-pN.png   the on-screen A4 page
 *   pdf-pN.png      the PDF page rasterised with pdftoppm at 192 dpi
 *   cmp-pN.png      [ canvas | pdf | overlay ]   overlay: blue = canvas only, red = PDF only
 * plus summary.json (page counts, per-page diff ratio) and index.html.
 *
 * Usage (dev server must already be running):
 *   node scripts/visual-compare.mjs [--templates classic,modern] [--fixture seed|rich|all]
 *                                   [--out qa-visual-compare] [--base http://127.0.0.1:5173]
 *                                   [--cover]   compare the cover letter instead of the resume
 *                                   [--settings '{"headerAlign":"center"}']  design overrides
 *                                   [--tag suffix]  appended to each output folder name
 *
 * Requires: playwright (devDependency) + its chromium, and `pdftoppm` (poppler-utils).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RICH_EXTRA_SECTIONS, RICH_PERSONAL_OVERRIDES } from './visual-compare-fixture.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
    return acc;
  }, []),
);

const BASE = args.base || process.env.BASE_URL || 'http://127.0.0.1:5173';
const OUT = path.resolve(args.out || 'qa-visual-compare');
const TEMPLATES = (args.templates || 'classic,modern,minimal,sidebar,executive').split(',');
const FIXTURES = args.fixture === 'all' ? ['seed', 'rich'] : [args.fixture || 'seed'];
const WITH_COVER = args.cover === 'true';
const SETTINGS_OVERRIDE = args.settings ? JSON.parse(args.settings) : {};
const TAG_SUFFIX = args.tag ? `-${args.tag}` : '';
const SEED_ID = { classic: 'resume_default', modern: 'resume_modern', minimal: 'resume_minimal', sidebar: 'resume_sidebar', executive: 'resume_executive' };
const PAGE_W = 1588; // 210mm at 96dpi × DPR 2
const PAGE_H = 2246; // 297mm at 96dpi × DPR 2

function buildFixture(seedResume, template, fixture) {
  const r = structuredClone(seedResume);
  r.id = `vc_${template}_${fixture}`;
  r.template = template;
  r.updatedAt = Date.now();
  r.settings = { ...r.settings, ...SETTINGS_OVERRIDE };
  if (fixture === 'rich') {
    r.personal = { ...r.personal, ...RICH_PERSONAL_OVERRIDES };
    const have = new Set(r.sections.map((s) => s.type));
    r.sections = [...r.sections, ...RICH_EXTRA_SECTIONS.filter((s) => !have.has(s.type) || s.type === 'custom')];
  }
  if (WITH_COVER) {
    r.coverLetter = {
      ...r.coverLetter,
      recipientName: 'Sarah Smith', recipientTitle: 'Engineering Manager', company: 'Globex Corp',
      date: '2026-01-15', subject: 'Application for Senior Engineer role',
      body: '<p>Dear Sarah,</p><p>I am excited to apply for the <strong>Senior Engineer</strong> position at <em>Globex Corp</em>. Over seven years I have shipped accessible, fast React applications.</p><ul><li>Cut load time by 40%</li><li>Mentored two engineers</li></ul><p>Best regards,</p>',
      closing: 'Sincerely',
    };
  }
  return r;
}

async function readSeedState(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/`);
  await page.waitForFunction(() => !!localStorage.getItem('cpwtcv_v1'), null, { timeout: 20_000 });
  const state = JSON.parse(await page.evaluate(() => localStorage.getItem('cpwtcv_v1')));
  await ctx.close();
  return state;
}

async function composite(page, canvasPng, pdfPng, outPng) {
  const toUrl = (p) => (p && fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : null);
  const res = await page.evaluate(async ({ a, b, W, H }) => {
    const load = (src) => new Promise((ok) => {
      if (!src) return ok(null);
      const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src;
    });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const pix = (img) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      if (img) x.drawImage(img, 0, 0, W, H);
      return x.getImageData(0, 0, W, H);
    };
    const da = pix(ia), db = pix(ib);
    const out = document.createElement('canvas'); out.width = W * 3 + 40; out.height = H;
    const ctx = out.getContext('2d'); ctx.fillStyle = '#888'; ctx.fillRect(0, 0, out.width, H);
    ctx.putImageData(da, 0, 0); ctx.putImageData(db, W + 20, 0);
    const ov = ctx.createImageData(W, H);
    let diff = 0, inkA = 0, inkB = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const la = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3;
      const lb = (db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3;
      const ka = la < 200, kb = lb < 200;
      if (ka) inkA++; if (kb) inkB++;
      let r = 255, g = 255, bl = 255;
      if (ka && kb) { r = g = bl = 150; }
      else if (ka) { r = 40; g = 90; bl = 255; diff++; }
      else if (kb) { r = 255; g = 40; bl = 40; diff++; }
      ov.data[i] = r; ov.data[i + 1] = g; ov.data[i + 2] = bl; ov.data[i + 3] = 255;
    }
    ctx.putImageData(ov, W * 2 + 40, 0);
    return { png: out.toDataURL('image/png'), diffRatio: diff / Math.max(1, inkA + inkB), inkCanvas: inkA, inkPdf: inkB };
  }, { a: toUrl(canvasPng), b: toUrl(pdfPng), W: PAGE_W, H: PAGE_H });
  fs.writeFileSync(outPng, Buffer.from(res.png.split(',')[1], 'base64'));
  return { diffRatio: +res.diffRatio.toFixed(4), inkCanvas: res.inkCanvas, inkPdf: res.inkPdf };
}

async function exportPdf(page, dir) {
  const dl = page.waitForEvent('download', { timeout: 90_000 });
  await page.locator('button:has-text("Export")').first().click();
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const download = await dl;
  const pdfPath = path.join(dir, 'export.pdf');
  await download.saveAs(pdfPath);
  return pdfPath;
}

function rasterise(pdfPath, dir) {
  for (const f of fs.readdirSync(dir)) if (/^pdfraw-/.test(f)) fs.rmSync(path.join(dir, f));
  execFileSync('pdftoppm', ['-png', '-r', '192', pdfPath, path.join(dir, 'pdfraw')], { stdio: 'pipe' });
  const raws = fs.readdirSync(dir).filter((f) => /^pdfraw-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  return raws.map((f, i) => { const to = path.join(dir, `pdf-p${i + 1}.png`); fs.renameSync(path.join(dir, f), to); return to; });
}

async function runOne(browser, state, template, fixture, cmpPage) {
  const seed = state.resumes.find((r) => r.id === SEED_ID[template]) || state.resumes[0];
  const resume = buildFixture(seed, template, fixture);
  const tag = `${WITH_COVER ? 'cover' : fixture}-${template}${TAG_SUFFIX}`;
  const dir = path.join(OUT, tag);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 2, acceptDownloads: true });
  await ctx.addInitScript(({ s }) => { if (!sessionStorage.getItem('vc_seeded')) { localStorage.setItem('cpwtcv_v1', JSON.stringify(s)); sessionStorage.setItem('vc_seeded', '1'); } },
    { s: { ...state, activeId: resume.id, resumes: [resume] } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));

  await page.goto(`${BASE}/#/resume/${resume.id}${WITH_COVER ? '?tab=coverletter' : ''}`);
  await page.waitForSelector('button:has-text("Export")', { timeout: 20_000 });
  await page.evaluate(async () => { await document.fonts?.ready; });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: 'div.bg-white.shadow-2xl > span.absolute{display:none!important}' });

  const pages = page.locator(WITH_COVER ? '#cover-letter-preview' : 'div.bg-white.shadow-2xl');
  const canvasCount = await pages.count();
  const canvasPngs = [];
  for (let i = 0; i < canvasCount; i++) {
    const p = path.join(dir, `canvas-p${i + 1}.png`);
    if (WITH_COVER) {
      // cover letter preview is one tall element; clip it into A4-high slices
      const box = await pages.nth(i).boundingBox();
      const pageH = box.width * 297 / 210;
      const slices = Math.max(1, Math.round(box.height / pageH));
      for (let k = 0; k < slices; k++) {
        const sp = path.join(dir, `canvas-p${k + 1}.png`);
        await page.screenshot({ path: sp, clip: { x: box.x, y: box.y + k * pageH, width: box.width, height: Math.min(pageH, box.height - k * pageH) }, fullPage: true });
        canvasPngs.push(sp);
      }
      break;
    }
    await pages.nth(i).screenshot({ path: p });
    canvasPngs.push(p);
  }

  const t0 = Date.now();
  const pdfPath = await exportPdf(page, dir);
  const exportMs = Date.now() - t0;
  const pdfPngs = rasterise(pdfPath, dir);

  const pagesOut = [];
  const n = Math.max(canvasPngs.length, pdfPngs.length);
  for (let i = 0; i < n; i++) {
    const stats = await composite(cmpPage, canvasPngs[i], pdfPngs[i], path.join(dir, `cmp-p${i + 1}.png`));
    pagesOut.push({ page: i + 1, ...stats });
  }
  await ctx.close();
  const summary = { tag, template, fixture, settingsOverride: SETTINGS_OVERRIDE, canvasPages: canvasPngs.length, pdfPages: pdfPngs.length, exportMs, pages: pagesOut, consoleErrors: [...new Set(consoleErrors)].slice(0, 20) };
  console.log(`${tag.padEnd(20)} canvas=${canvasPngs.length} pdf=${pdfPngs.length} export=${exportMs}ms diff=[${pagesOut.map((p) => p.diffRatio).join(', ')}]${consoleErrors.length ? ` errors=${consoleErrors.length}` : ''}`);
  return summary;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const state = await readSeedState(browser);
  const cmpCtx = await browser.newContext();
  const cmpPage = await cmpCtx.newPage();
  const results = [];
  for (const fixture of FIXTURES) {
    for (const template of TEMPLATES) {
      try { results.push(await runOne(browser, state, template, fixture, cmpPage)); }
      catch (e) { console.error(`${fixture}-${template} FAILED: ${e.message}`); results.push({ tag: `${fixture}-${template}`, error: e.message }); }
    }
  }
  await browser.close();
  const sumPath = path.join(OUT, 'summary.json');
  const prev = fs.existsSync(sumPath) ? JSON.parse(fs.readFileSync(sumPath, 'utf8')) : [];
  const merged = [...prev.filter((p) => !results.some((r) => r.tag === p.tag)), ...results];
  fs.writeFileSync(sumPath, JSON.stringify(merged, null, 2));
  const rows = merged.map((r) => r.error ? `<h2>${r.tag}</h2><p style="color:red">${r.error}</p>` :
    `<h2>${r.tag} — canvas ${r.canvasPages}p · pdf ${r.pdfPages}p · export ${r.exportMs}ms</h2>` +
    r.pages.map((p) => `<p>page ${p.page} diff ${p.diffRatio}</p><img loading="lazy" src="${r.tag}/cmp-p${p.page}.png" style="width:100%">`).join(''));
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Canvas vs PDF</title><body style="font-family:system-ui;margin:16px">${rows.join('')}</body>`);
  console.log(`\nReport: ${path.join(OUT, 'index.html')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
