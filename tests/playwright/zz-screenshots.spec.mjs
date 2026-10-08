// Screenshots of the main screens, for looking at the UI (not an assertion suite). Runs only when SHOTS_DIR is
// set (the ui-shots workflow sets it); in every other run the whole file is skipped. Each shot is taken in its
// own try, so one screen that fails to open does not stop the rest; the list of what was taken is printed.
import { test } from '@playwright/test';
import fs from 'node:fs';
import { buildTestState, STORAGE_KEY } from '../helpers.js';
import { visitEditor, openDesignPanel } from './pw-helpers.js';

const DIR = process.env.SHOTS_DIR;
// B17 cross-width sweep: every screen at each width (the width is the last part of the file name).
const VIEWPORTS = [1440, 1280, 1100, 1024, 768, 390].map((w) => [String(w), { width: w, height: w <= 768 ? 844 : 900 }]);
const JOBS = [
  ['Acme Corp', 'Senior Frontend Engineer', 'saved'], ['Globex', 'Full Stack Developer', 'applied'],
  ['Initech', 'React Developer', 'phone_screen'], ['Umbrella', 'Node.js Engineer', 'interview'],
  ['Hooli', 'Staff Engineer', 'offer'], ['Stark Industries', 'UI Engineer', 'rejected'],
].map(([company, role, status], i) => ({
  id: `job_shot_${i}`, company, role, status, url: 'https://example.com/jobs', location: 'Remote', salary: '$150k – $190k',
  appliedDate: '2026-09-0' + (i + 1), deadline: '', contact: '', notes: '<p>Notes for this role</p>', todos: [{ id: `t${i}`, text: 'Send follow-up', done: i % 2 === 0 }],
  statusHistory: [{ status, changedAt: 1757000000000 + i }], createdAt: 1757000000000 + i, updatedAt: 1757000000000 + i,
}));

test.describe.configure({ mode: 'serial' });
test.skip(!DIR, 'SHOTS_DIR is not set: screenshots are taken only by the ui-shots workflow');

const taken = [];
async function shot(page, name, vp) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/${name}-${vp}.png`, fullPage: false });
  taken.push(`${name}-${vp}`);
}
async function attempt(label, fn) {
  try { await fn(); } catch (e) { console.log(`SHOT FAILED ${label}: ${String(e.message).split('\n')[0]}`); }
}
async function seedAndGo(page, hash, { resumes = null, jobs = null } = {}) {
  await page.goto('about:blank');
  await page.addInitScript((a) => {
    localStorage.clear();
    if (a.state) localStorage.setItem(a.key, JSON.stringify(a.state));
    if (a.jobs) localStorage.setItem('cpwtcv_jobs_v1', JSON.stringify({ jobs: a.jobs, dataVersion: 2 }));
  }, { key: STORAGE_KEY, state: resumes, jobs });
  await page.goto(`/#${hash}`);
}

for (const [vp, size] of VIEWPORTS) {
  test(`screens at ${vp}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(size);

    await attempt(`dashboard ${vp}`, async () => {
      const state = buildTestState('classic');
      const base = state.resumes[0];
      state.resumes = ['Software Engineer CV', 'Product Designer CV', 'Data Analyst CV'].map((name, i) => ({ ...JSON.parse(JSON.stringify(base)), id: `r_shot_${i}`, name, updatedAt: Date.now() - i * 3_600_000 }));
      state.activeId = state.resumes[0].id;
      await seedAndGo(page, '/', { resumes: state });
      await page.waitForSelector('[data-testid="resume-card"]', { timeout: 20_000 });
      await shot(page, '01-dashboard', vp);
    });

    await attempt(`editor ${vp}`, async () => {
      await visitEditor(page, 'classic');
      await shot(page, '02-editor-resume', vp);
      for (const h of await page.locator('[data-testid="entry-header"]').all()) await h.click().catch(() => {});
      await shot(page, '03-editor-entries-open', vp);
    });

    await attempt(`section options ${vp}`, async () => {
      await visitEditor(page, 'classic');
      await page.locator('button[title="Section options"]').first().click();
      await page.locator('button:has-text("Customize layout")').first().click();
      await shot(page, '04-section-options-popover', vp);
    });

    await attempt(`design ${vp}`, async () => {
      await visitEditor(page, 'classic');
      await openDesignPanel(page);
      await shot(page, '05-design-drawer', vp);
    });

    await attempt(`ats ${vp}`, async () => {
      await visitEditor(page, 'classic');
      await page.locator('[data-testid="ats-chip"]').click();
      await page.waitForSelector('[data-testid="dock-ats"]', { timeout: 10_000 });
      await shot(page, '06-ats-dock', vp);
    });

    await attempt(`cover letter ${vp}`, async () => {
      await visitEditor(page, 'classic', { tab: 'coverletter' });
      await shot(page, '07-cover-letter', vp);
    });

    await attempt(`new resume ${vp}`, async () => {
      await seedAndGo(page, '/new', { resumes: buildTestState('classic') });
      await page.waitForTimeout(1200);
      await shot(page, '08-new-resume', vp);
    });

    await attempt(`jobs ${vp}`, async () => {
      await seedAndGo(page, '/jobs', { jobs: JOBS });
      await page.waitForSelector('text=Job Tracker', { timeout: 20_000 });
      await shot(page, '09-jobs', vp);
      await seedAndGo(page, '/jobs?view=list', { jobs: JOBS });
      await shot(page, '09b-jobs-list', vp);
      await seedAndGo(page, `/jobs/${JOBS[1].id}`, { jobs: JOBS });
      await shot(page, '10-job-detail', vp);
    });

    await attempt(`boards ${vp}`, async () => {
      await seedAndGo(page, '/boards');
      await shot(page, '11-boards', vp);
      const href = await page.locator('a[href*="#/boards/"]').first().getAttribute('href');
      const id = href.split('#/boards/')[1].split(/[/?]/)[0];
      await page.goto(`/#/boards/${id}`);
      await shot(page, '12-project-board', vp);
      await page.goto(`/#/boards/${id}/list`);
      await shot(page, '13-project-list', vp);
      await page.goto('/#/work');
      await shot(page, '14-your-work', vp);
    });
  });
}

test.afterAll(() => { if (DIR) console.log(`SHOTS TAKEN: ${taken.join(', ')}`); });
