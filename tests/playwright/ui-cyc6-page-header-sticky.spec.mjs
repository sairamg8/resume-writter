// The workspace page header keeps to the top of the shell's scroll box (<main>) for the whole page, and the Job page's sticky Details
// column stays clear of it. Measured in Chromium on the Job page with a long task list (the page is far taller than the window):
//   - scrolled well past one window's height, the header is still flush with the top of <main> (it used to be carried off with the page
//     root's bottom edge, which is exactly one window high: tests/pdf/278-cyc6-page-header-stays-sticky.test.mjs pins the classes);
//   - the Details column (aside, sticky from lg) starts below the header, not under it.
// Run: playwright: tests/playwright/ui-cyc6-page-header-sticky.spec.mjs
import { test, expect } from '@playwright/test';

const JOB = {
  id: 'job_sticky_0', company: 'Acme Corp', role: 'Senior Frontend Engineer', status: 'applied', url: 'https://example.com/jobs',
  location: 'Remote', salary: '', appliedDate: '2026-09-01', deadline: '', contact: '', notes: '',
  todos: Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, text: `Task number ${i + 1}`, done: false })),
  statusHistory: [{ status: 'applied', changedAt: 1757000000000 }], createdAt: 1757000000000, updatedAt: 1757000000000,
};

test('the Job page header stays flush with the top of the scroll box, and the Details column stays below it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('about:blank');
  await page.addInitScript((job) => {
    localStorage.clear();
    localStorage.setItem('cpwtcv_jobs_v1', JSON.stringify({ jobs: [job], dataVersion: 2 }));
  }, JOB);
  await page.goto(`/#/jobs/${JOB.id}`);
  const aside = page.locator('aside[aria-label="Job details"]');
  await aside.waitFor({ timeout: 20_000 });
  const main = page.locator('main');
  const header = page.locator('main header').first();

  // Far past the window's height (700 - the top bar): the old root ended there, and took the header with it.
  await main.evaluate((el) => { el.scrollTop = 900; });
  await page.waitForTimeout(300);
  const scrolled = await main.evaluate((el) => el.scrollTop);
  expect(scrolled, 'the page is long enough to scroll past one window').toBeGreaterThan(600);

  const box = await main.boundingBox();
  const head = await header.boundingBox();
  const side = await aside.boundingBox();
  expect(Math.abs(head.y - box.y), 'the header is flush with the top of the scroll box').toBeLessThanOrEqual(1);
  expect(side.y, 'the Details column starts below the header').toBeGreaterThanOrEqual(head.y + head.height - 1);
});
