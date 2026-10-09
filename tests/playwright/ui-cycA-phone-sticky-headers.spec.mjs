// On a phone the five project pages scroll as one page in <main> (tests/playwright/ui-cyc8-phone-project-page-scroll.spec.mjs), and the
// sticky headers inside their box (the List's table header, the Timeline's day header, the swimlane header of the Board grouped) stuck to
// that box, which is content-high and never moves down, so they scrolled away with the page. They now hold their place under the top of
// <main> (src/hooks/usePhoneStickyTop.js sets --stuck on the box; each header's top reads it below md). Measured in Chromium at 390 x 700
// on a project with 40 more tasks, with the page scrolled (the state AFTER a scroll, not only at the top):
//   - at the top of the page the header lies where it always did, below the page header and toolbar;
//   - scrolled well past it, the header is flush with the top of <main>, and stays inside its table or lane at the very end;
//   - the box under the page header is still no vertical scroller of its own (the shifted header adds no scrollable height);
//   - scrolled back to the top, the header is back in its place; from md up (1280) the box scrolls itself and the header sticks to the box.
// tests/unit/391-cycA-phone-sticky-top.unit.mjs pins the offset maths and the wiring.
// Run: playwright: tests/playwright/ui-cycA-phone-sticky-headers.spec.mjs
import { test, expect } from '@playwright/test';
import { BOARDS_KEY } from '../../src/constants/boards.js';
import { DEMO_BOARD_ID, makeDemoBoards } from '../../src/utils/boardDemo.js';

/** The demo project with 40 more tasks in its Inbox, so every view is far taller than a phone. */
function longBoards() {
  const boards = makeDemoBoards(Date.now());
  const board = boards[0];
  const proto = board.issues.find((i) => i.type === 'task' && i.columnId === 'demo_col_inbox') ?? board.issues.find((i) => i.type === 'task');
  for (let n = 0; n < 40; n += 1) {
    const number = board.nextNumber + n;
    board.issues.push({ ...proto, id: `long_issue_${number}`, number, title: `Extra task ${number}`, columnId: 'demo_col_inbox', epicId: null, checklist: [], comments: [], activity: [], recurrence: 'none', due: '' });
  }
  board.nextNumber += 40;
  return boards;
}

const VIEWS = [
  { name: 'list', path: '/list', header: 'main .overflow-auto thead' },
  { name: 'timeline', path: '/timeline', header: 'main .overflow-auto .sticky.top-0.z-20' },
  // The swimlane header exists once the board is grouped (see `group`).
  { name: 'board grouped by priority', path: '', header: 'main .overflow-auto .sticky.top-0.z-10', group: 'Priority' },
];

async function open(page, size, view) {
  await page.setViewportSize(size);
  await page.goto('about:blank');
  await page.addInitScript((args) => {
    localStorage.clear();
    localStorage.setItem(args.key, JSON.stringify({ boards: args.boards, dataVersion: 2 }));
  }, { key: BOARDS_KEY, boards: longBoards() });
  await page.goto(`/#/boards/${DEMO_BOARD_ID}${view.path}`);
  await page.locator('main header h1').waitFor({ timeout: 20_000 });
  if (view.group) {
    // Below md the filters, and Group by with them, wait behind the Filters button.
    const filters = page.getByRole('button', { name: /^Filters/ });
    if (await filters.isVisible()) await filters.click();
    await page.getByRole('button', { name: /^Group by:/ }).click();
    await page.getByRole('menuitemradio', { name: view.group }).click();
  }
  await page.locator(view.header).first().waitFor({ timeout: 20_000 });
}

/** Where the header is, measured against the top of <main>. */
async function place(page, view) {
  return page.evaluate((sel) => {
    const main = document.querySelector('main');
    const head = document.querySelector(sel);
    const box = main.querySelector('.overflow-auto');
    const parent = head.parentElement.closest('table, .w-max') ?? head.parentElement;
    const m = main.getBoundingClientRect();
    const h = head.getBoundingClientRect();
    const p = parent.getBoundingClientRect();
    return {
      fromTop: h.top - m.top,
      inside: h.bottom <= p.bottom + 1,
      scrolled: main.scrollTop,
      room: main.scrollHeight - main.clientHeight,
      boxOverflow: box.scrollHeight - box.clientHeight,
    };
  }, view.header);
}

for (const view of VIEWS) {
  test(`${view.name}: on a phone the header holds under the top of the page while it scrolls`, async ({ page }) => {
    await open(page, { width: 390, height: 700 }, view);
    const main = page.locator('main');

    const atTop = await place(page, view);
    expect(atTop.fromTop, 'at the top of the page the header lies below the page header and toolbar').toBeGreaterThan(100);

    await main.evaluate((el) => { el.scrollTop = 600; });
    await page.waitForTimeout(300);
    const middle = await place(page, view);
    expect(middle.room, 'the page is longer than the screen').toBeGreaterThan(600);
    expect(middle.scrolled, '<main> moved').toBeGreaterThan(400);
    expect(Math.abs(middle.fromTop), 'scrolled past it, the header is flush with the top of <main>').toBeLessThanOrEqual(2);
    expect(middle.boxOverflow, 'the box under the page header is still no vertical scroller of its own').toBeLessThanOrEqual(1);

    await main.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);
    const end = await place(page, view);
    expect(end.scrolled, '<main> reached its end').toBeGreaterThan(middle.scrolled);
    expect(end.fromTop, 'at the end the header has not left the top of <main>').toBeLessThanOrEqual(2);
    expect(end.fromTop, 'nor risen above it').toBeGreaterThanOrEqual(-2);
    expect(end.inside, 'it stays inside its table or lane').toBe(true);
    expect(end.boxOverflow, 'and adds no scrollable height to the box').toBeLessThanOrEqual(1);

    await main.evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(300);
    const back = await place(page, view);
    expect(Math.abs(back.fromTop - atTop.fromTop), 'scrolled back to the top, the header is back in its place').toBeLessThanOrEqual(2);
  });
}

test('list: from md up the header sticks to the top of the box, which is the scroller', async ({ page }) => {
  await open(page, { width: 1280, height: 700 }, VIEWS[0]);
  const state = await page.evaluate(() => {
    const box = document.querySelector('main .overflow-auto');
    box.scrollTop = 500;
    return { moved: box.scrollTop };
  });
  expect(state.moved, 'the box scrolled').toBeGreaterThan(300);
  await page.waitForTimeout(300);
  const gap = await page.evaluate(() => {
    const box = document.querySelector('main .overflow-auto').getBoundingClientRect();
    const head = document.querySelector('main .overflow-auto thead').getBoundingClientRect();
    return head.top - box.top;
  });
  expect(Math.abs(gap), 'the header is flush with the top of the box').toBeLessThanOrEqual(2);
});
