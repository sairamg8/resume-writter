// On a phone (390 x 700) the project pages that scroll in a box of their own (board, backlog, list, timeline, calendar) used to keep
// their header (breadcrumbs, title, actions, tabs) and toolbar pinned outside that box for good, on a root exactly one window high.
// Measured in Chromium on a project with enough issues to be far longer than the screen:
//   - scrolled to the end, <main> has carried the page header off the top: what stays pinned above the content is at most 40% of the
//     window's height (it is 0 now);
//   - the box under the header is not a vertical scroller of its own (its content is as tall as its box), so one scroll moves the page;
//   - from md up (1280) the box is still the page's scroller and the header still lies above it.
// tests/pdf/356-cyc8-phone-project-page-scrolls-whole.test.mjs pins the classes.
// Run: playwright: tests/playwright/ui-cyc8-phone-project-page-scroll.spec.mjs
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
  { name: 'board', path: '' },
  { name: 'backlog', path: '/backlog' },
  { name: 'list', path: '/list' },
  { name: 'timeline', path: '/timeline' },
  { name: 'calendar', path: '/calendar' },
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
}

for (const view of VIEWS) {
  test(`${view.name}: on a phone the header and toolbar scroll away with the page`, async ({ page }) => {
    const height = 700;
    await open(page, { width: 390, height }, view);
    const main = page.locator('main');
    const header = main.locator('header').first();
    await main.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);

    const scrolled = await main.evaluate((el) => ({ top: el.scrollTop, room: el.scrollHeight - el.clientHeight }));
    // The calendar is a month grid: a few screens tall, not 40 rows. Every other view lists the 40 tasks.
    expect(scrolled.room, 'the page is longer than the screen and <main> scrolls it').toBeGreaterThan(view.name === 'calendar' ? 100 : 600);
    expect(scrolled.top, '<main> moved').toBeGreaterThan(100);

    const box = await main.boundingBox();
    const head = await header.boundingBox();
    const pinned = Math.max(0, head.y + head.height - box.y);
    expect(pinned, 'what stays pinned above the content is at most 40% of the window').toBeLessThanOrEqual(height * 0.4);

    const inner = await main.evaluate((el) => {
      const own = el.querySelector('.overflow-auto');
      return own ? { client: own.clientHeight, scroll: own.scrollHeight } : null;
    });
    expect(inner, 'the page has its box under the header').not.toBeNull();
    expect(inner.scroll - inner.client, 'that box is no vertical scroller of its own on a phone').toBeLessThanOrEqual(1);
  });
}

test('board: from md up the header lies above the box, which is still the scroller', async ({ page }) => {
  await open(page, { width: 1280, height: 700 }, VIEWS[0]);
  const main = page.locator('main');
  const room = await main.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(room, '<main> does not scroll: the page is exactly the window').toBeLessThanOrEqual(1);
  const own = await main.evaluate((el) => {
    const box = el.querySelector('.overflow-auto');
    return { client: box.clientHeight, scroll: box.scrollHeight };
  });
  expect(own.scroll, 'the 40 tasks scroll in the box').toBeGreaterThan(own.client + 100);
});
