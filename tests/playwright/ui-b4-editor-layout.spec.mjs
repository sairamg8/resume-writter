// UI redesign, batch B4: the editor's frame measured in a real browser at six widths (1440, 1280, 1100, 1024, 768, 390).
// The node tests run on a fake DOM with no layout, so this is the only proof that the bar, the editor panel, the
// preview stage and the dock keep out of each other's way, that nothing scrolls the page sideways, that the stage
// never falls under its floor, and that the dock OVERLAYS the preview where it must (below 1100 px, and with the
// panel dragged wide below dockBesideFrom(panelWidth) in src/components/EditorDock.jsx) instead of squeezing it.
//
// What each geometry check reads (boundingBox-style rects from getBoundingClientRect, scrollWidth):
//   bar      [data-testid=editor-bar]        sidebar  [data-testid=editor-sidebar]   (the editor panel)
//   stage    the parent of [data-testid=stage-toolbar]  (the preview column)         dock  [data-testid=dock-design|dock-ats]
//   pill     [data-testid=editor-pill] (phone)         chip  [data-testid=preview-updating]
// A dock "overlays" when its computed position is absolute: it then lies over the stage, which keeps the width it
// had with the dock closed. A dock "beside" the stage is a flex sibling: it stands clear of it.
//
// How the lead proves the spec can fail (mutation pair, on throw-away commits, then reverted; run
// playwright: tests/playwright/ui-b4-editor-layout.spec.mjs on each and record both run ids):
//   M1 (dock a flex sibling below 1100): in src/components/EditorDock.jsx delete the five max-[1099px]:... utilities
//      (absolute inset-y-0 right-0 z-30 shadow-xl) from the dock's className and in src/pages/Editor.jsx pass
//      overlay={false}. At 1024 and 768 the dock is then position: static and the stage is 360 px narrower than with
//      the dock closed: "overlays below 1100" and "the stage keeps the width it had" go RED. The stored-640 tests are
//      not what catches this one (they run from 1100 px). The commit before it is GREEN.
//   M2 (the clamp gone): in src/pages/Editor.jsx call usePanelResize({ dockOpen: false }) (or with no argument). With the
//      stored 640 px panel and a dock open the panel is drawn at 640 at 1100 / 1180 / 1280: the six stored-640 tests go RED on
//      their exact assertion "the panel is drawn at window - 680" (420 / 500 / 600). (The stage-floor and "static" checks stay
//      green there: they are not what guards the clamp; the exact drawn width is.) M1 alone leaves the stored-640 tests green,
//      M2 alone leaves the six-width tests green: each mutation is caught by its own tests.
import { test, expect } from '@playwright/test';
import { buildTestState, STORAGE_KEY } from '../helpers.js';
import { reach } from './pw-helpers.js';

const PANEL_KEY = 'cpwtcv-panel-width';
const WIDTHS = [1440, 1280, 1100, 1024, 768, 390];
const heightOf = (width) => (width < 768 ? 812 : 900);
// The least the preview keeps beside a docked panel (EditorDock.jsx), and the stage's floor in expectFrame.
const DOCK = 360;
const PREVIEW_FLOOR = 288;
const STAGE_FLOOR = 240;
const BESIDE_FROM = 1100; // the dock is a flex sibling of the stage from this width, an overlay below it

/** Opens the seeded editor at `width` (the stored panel width, when given, is written after the clear). */
async function visit(page, width, { panel } = {}) {
  await page.setViewportSize({ width, height: heightOf(width) });
  const state = buildTestState('classic');
  await page.goto('about:blank');
  await page.addInitScript((args) => {
    localStorage.clear();
    localStorage.setItem(args.key, JSON.stringify(args.state));
    if (args.panel) localStorage.setItem(args.panelKey, String(args.panel));
  }, { key: STORAGE_KEY, state, panel: panel ?? null, panelKey: PANEL_KEY });
  await page.goto(`/#/resume/${state.activeId}`);
  await page.getByTestId('editor-bar').waitFor({ timeout: 20_000 });
  // A phone's Edit view keeps the preview paused (R2-016); elsewhere wait for the first build.
  if (width >= 768) await page.waitForSelector('[data-preview-status="ready"]', { timeout: 30_000 });
  else await page.waitForSelector('[data-preview-status]', { state: 'attached', timeout: 30_000 });
}

/** Every box of the frame, in one round trip; a box that is not drawn (display none) is null. */
function measure(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } : null;
    };
    const byId = (id) => document.querySelector(`[data-testid="${id}"]`);
    const stage = byId('stage-toolbar')?.parentElement ?? null;
    const dock = byId('dock-design') ?? byId('dock-ats');
    const box = dock?.querySelector('.overflow-y-auto');
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      pageW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      bar: rect(byId('editor-bar')),
      sidebar: rect(byId('editor-sidebar')),
      stage: rect(stage),
      stageScroll: stage ? { scrollWidth: stage.scrollWidth, clientWidth: stage.clientWidth } : null,
      dock: rect(dock),
      dockPosition: dock ? getComputedStyle(dock).position : null,
      dockBottomRoom: box ? parseFloat(getComputedStyle(box).paddingBottom) : null,
      pill: rect(byId('editor-pill')),
    };
  });
}

/** The measure once two reads, 40 ms apart, agree (a media query or a repaint may still settle after the click). */
async function settled(page) {
  let before = JSON.stringify(await measure(page));
  for (let i = 0; i < 50; i += 1) {
    await page.waitForTimeout(40);
    const now = JSON.stringify(await measure(page));
    if (now === before) return JSON.parse(now);
    before = now;
  }
  throw new Error('the frame never settled');
}

/** True when the two boxes share no area (1 px of tolerance for fractional edges); a box not drawn overlaps nothing. */
const apart = (a, b) => !a || !b || a.r <= b.l + 1 || b.r <= a.l + 1 || a.b <= b.t + 1 || b.b <= a.t + 1;

/** What must hold at any moment, dock open or not. */
function expectFrame(m, what) {
  expect(m.pageW, `${what}: the page does not scroll sideways`).toBeLessThanOrEqual(m.vw);
  expect(m.bar, `${what}: the bar is drawn`).not.toBeNull();
  expect(m.bar.l, `${what}: the bar starts in the window`).toBeGreaterThanOrEqual(-1);
  expect(m.bar.r, `${what}: the bar ends in the window`).toBeLessThanOrEqual(m.vw + 1);
  for (const [name, box] of [['sidebar', m.sidebar], ['stage', m.stage]]) {
    if (!box) continue;
    expect(apart(m.bar, box), `${what}: the bar and the ${name} do not overlap`).toBe(true);
    expect(box.l, `${what}: the ${name} starts in the window`).toBeGreaterThanOrEqual(-1);
    expect(box.r, `${what}: the ${name} ends in the window`).toBeLessThanOrEqual(m.vw + 1);
    expect(box.w, `${what}: the ${name} keeps its ${STAGE_FLOOR} px floor`).toBeGreaterThanOrEqual(STAGE_FLOOR);
  }
  expect(apart(m.sidebar, m.stage), `${what}: the panel and the stage do not overlap`).toBe(true);
  if (m.dock) {
    expect(apart(m.bar, m.dock), `${what}: the bar and the dock do not overlap`).toBe(true);
    expect(m.dock.r, `${what}: the dock ends at the window's right edge`).toBeGreaterThanOrEqual(m.vw - 1);
    expect(m.dock.r, `${what}: the dock ends in the window`).toBeLessThanOrEqual(m.vw + 1);
  }
}

/** With the dock open: it overlays below 1100 px and is a flex sibling of the stage from 1100 px, and never overlaps a neighbour. */
function expectDock(m, closed, what) {
  expect(m.dock, `${what}: the dock is drawn`).not.toBeNull();
  const beside = m.vw >= BESIDE_FROM;
  expect(m.dockPosition, `${what}: ${beside ? 'beside the stage (a flex sibling)' : 'over the stage (overlay)'} at ${m.vw} px`)
    .toBe(beside ? 'static' : 'absolute');
  if (beside) {
    expect(apart(m.dock, m.stage), `${what}: the dock stands clear of the stage`).toBe(true);
    expect(apart(m.dock, m.sidebar), `${what}: the dock stands clear of the panel`).toBe(true);
    expect(m.stage.w, `${what}: the stage keeps its ${PREVIEW_FLOOR} px floor beside the dock`).toBeGreaterThanOrEqual(PREVIEW_FLOOR - 1);
  } else if (m.stage && closed.stage) {
    // The dock lies over the stage: the stage is not narrowed by it.
    expect(Math.abs(m.stage.w - closed.stage.w), `${what}: the stage keeps the width it had with the dock closed`).toBeLessThanOrEqual(1);
  }
}

/** Records every value the preview's data-preview-status takes from now on (a build moves it to 'rendering'). */
function watchBuilds(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-preview-status]');
    window.__builds = [el.dataset.previewStatus];
    new MutationObserver(() => window.__builds.push(el.dataset.previewStatus)).observe(el, { attributes: true, attributeFilter: ['data-preview-status'] });
  });
}
const builds = (page) => page.evaluate(() => window.__builds);

/** Closes the open dock: its X where it shows (an overlay), else the bar's button that opened it. */
async function closeDock(page, kind) {
  const x = page.getByTestId('dock-close');
  if (await x.isVisible()) await x.click();
  else await reach(page, kind);
  await expect(page.getByTestId(`dock-${kind}`)).toHaveCount(0);
}

/** Opens `kind` ('design' | 'ats') and returns the settled frame. */
async function openDock(page, kind) {
  await reach(page, kind);
  await page.getByTestId(`dock-${kind}`).waitFor({ timeout: 10_000 });
  return settled(page);
}

test.describe('the editor frame at six widths', () => {
  for (const width of WIDTHS) {
    test(`${width} px: the bar, panel, stage and dock keep apart, the page does not scroll sideways, and the dock opens and closes without a preview build`, async ({ page }) => {
      await visit(page, width);
      const closed = await settled(page);
      expectFrame(closed, `${width} px, dock closed`);
      expect(closed.dock, 'no dock is open at the start').toBeNull();
      if (width >= 768) expect(closed.stage, 'the preview stage is drawn beside the panel').not.toBeNull();
      if (width >= 768) expect(closed.pill, 'no pill above a phone').toBeNull();
      else expect(closed.pill, 'the Edit | Preview | Design pill is drawn on a phone').not.toBeNull();

      await watchBuilds(page);
      const first = (await builds(page))[0];
      for (const kind of ['design', 'ats']) {
        // On a phone the bar has no ATS chip when the pill carries the views: only what is drawn is opened.
        if (kind === 'ats' && !(await page.getByTestId('ats-chip').isVisible())) continue;
        const open = await openDock(page, kind);
        expectFrame(open, `${width} px, ${kind} dock open`);
        expectDock(open, closed, `${width} px, ${kind} dock`);
        if (width < 1100) expect(open.dockPosition, `${width} px: below 1100 px the dock overlays the preview`).toBe('absolute');
        await closeDock(page, kind);
        const back = await settled(page);
        expectFrame(back, `${width} px, ${kind} dock closed again`);
        if (closed.stage) expect(Math.abs(back.stage.w - closed.stage.w), `${width} px: closing the dock gives the stage its width back`).toBeLessThanOrEqual(1);
      }
      // Opening and closing a dock rebuilds nothing: the preview's status never left what it was.
      expect([...new Set(await builds(page))], `${width} px: the preview status over the open and close`).toEqual([first]);
    });
  }

  test('390 px, Preview view: the stage is on screen at its floor, and nothing in it is wider than it', async ({ page }) => {
    await visit(page, 390);
    await page.getByTestId('pill-preview').click();
    await page.waitForSelector('[data-preview-status="ready"]', { timeout: 30_000 });
    const m = await settled(page);
    expectFrame(m, '390 px, Preview view');
    expect(m.stage, 'the stage is drawn').not.toBeNull();
    expect(m.sidebar, 'the panel is not drawn behind it').toBeNull();
    expect(m.stageScroll.scrollWidth, 'nothing in the stage is wider than it').toBeLessThanOrEqual(m.stageScroll.clientWidth);
  });
});

test.describe('a remembered 640 px panel (localStorage cpwtcv-panel-width) with a dock open', () => {
  // The panel is drawn no wider than the window less the dock (360) and the stage's floor (320): 1100 - 680, 1180 - 680, 1280 - 680.
  const DRAWN = { 1100: 420, 1180: 500, 1280: 600 };
  for (const width of [1100, 1180, 1280]) {
    for (const kind of ['design', 'ats']) {
      test(`${width} px, ${kind} dock: the panel is drawn at ${DRAWN[width]} px, the dock sits beside the stage and the stage keeps its floor`, async ({ page }) => {
        await visit(page, width, { panel: 640 });
        const closed = await settled(page);
        expect(closed.sidebar.w, 'the stored 640 px is drawn with no dock open').toBe(640);
        expectFrame(closed, `${width} px, dock closed`);
        const open = await openDock(page, kind);
        expectFrame(open, `${width} px, ${kind} dock open`);
        expect(open.sidebar.w, `${width} px: the panel is drawn at window - ${DOCK} - 320 with the dock open`).toBe(Math.min(640, width - DOCK - 320));
        expect(open.sidebar.w, `${width} px: ... which is ${DRAWN[width]}`).toBe(DRAWN[width]);
        expect(open.dockPosition, `${width} px: the dock sits beside the stage`).toBe('static');
        expectDock(open, closed, `${width} px, ${kind} dock (stored 640 px)`);
        expect(open.stage.w, `${width} px: the stage floor holds with the dock open`).toBeGreaterThanOrEqual(PREVIEW_FLOOR - 1);
        await closeDock(page, kind);
        const back = await settled(page);
        expectFrame(back, `${width} px, dock closed again`);
        expect(back.sidebar.w, 'the dock closed: the remembered 640 px is drawn again').toBe(640);
        expect(await page.evaluate((key) => localStorage.getItem(key), PANEL_KEY), 'the remembered width stays 640 in storage').toBe('640');
      });
    }
  }
});


test.describe('the Updating chip, the pill and the dock do not collide', () => {
  /** Watches the page for the Updating chip, keeping its box and the dock's and pill's at the moment it is drawn. */
  const watchChip = (page) => page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
    };
    window.__chips = [];
    new MutationObserver(() => {
      const chip = document.querySelector('[data-testid="preview-updating"]');
      if (!chip) return;
      const dock = document.querySelector('[data-testid="dock-design"], [data-testid="dock-ats"]');
      // `covered`: what is on top at the chip's centre is the dock's own content (the chip is behind the dock, so it is not drawn over it).
      const at = rect(chip) && dock ? document.elementFromPoint((rect(chip).l + rect(chip).r) / 2, (rect(chip).t + rect(chip).b) / 2) : null;
      window.__chips.push({ chip: rect(chip), dock: rect(dock), pill: rect(document.querySelector('[data-testid="editor-pill"]')), covered: Boolean(at && dock.contains(at)) });
    }).observe(document.body, { childList: true, subtree: true });
  });
  const chips = (page) => page.evaluate(() => window.__chips);

  // From 1100 px the dock is beside the stage and the chip stands left of it. Below 1100 the dock lies over the stage and the chip,
  // a fixed element with no z-index, is behind it (as on a phone): it is never drawn over the dock, and it is not shifted onto the panel.
  for (const width of [1440, 1100, 1024, 768]) {
    test(`${width} px, dock open: an edit shows the chip ${width >= 1100 ? 'clear of' : 'behind'} the dock`, async ({ page }) => {
      await visit(page, width);
      await openDock(page, 'design');
      await watchChip(page);
      await page.getByTestId('section-title-input').first().fill('Work history, edited');
      await expect.poll(async () => (await chips(page)).length, { timeout: 15_000, message: 'the Updating chip showed while the edit rebuilt' }).toBeGreaterThan(0);
      for (const seen of await chips(page)) {
        expect(seen.dock, 'the dock is open while the chip shows').not.toBeNull();
        if (width >= 1100) expect(apart(seen.chip, seen.dock), `${width} px: the chip (${JSON.stringify(seen.chip)}) is left of the dock (${JSON.stringify(seen.dock)})`).toBe(true);
        else expect(seen.covered, `${width} px: the dock is on top where the chip is (the chip ${JSON.stringify(seen.chip)} is behind the dock ${JSON.stringify(seen.dock)})`).toBe(true);
      }
    });
  }

  test('390 px: the chip rides above the Edit | Preview | Design pill', async ({ page }) => {
    await visit(page, 390);
    // The pages must be on screen once, so a later edit shows the chip over them instead of the placeholder.
    await page.getByTestId('pill-preview').click();
    await page.waitForSelector('[data-preview-status="ready"]', { timeout: 30_000 });
    await page.getByTestId('pill-editor').click();
    await page.getByTestId('section-title-input').first().fill('Work history, edited');
    await watchChip(page);
    await page.getByTestId('pill-preview').click();
    await expect.poll(async () => (await chips(page)).length, { timeout: 15_000, message: 'the Updating chip showed while the edit rebuilt' }).toBeGreaterThan(0);
    for (const seen of await chips(page)) {
      expect(seen.pill, 'the pill is drawn while the chip shows').not.toBeNull();
      expect(apart(seen.chip, seen.pill), `the chip (${JSON.stringify(seen.chip)}) is clear of the pill (${JSON.stringify(seen.pill)})`).toBe(true);
    }
  });

  test('390 px: the dock is the whole screen and leaves room under its content for the pill', async ({ page }) => {
    await visit(page, 390);
    const open = await openDock(page, 'design');
    expect(open.dockPosition).toBe('absolute');
    expect(open.dock.w, 'the dock fills the phone').toBeGreaterThanOrEqual(open.vw - 1);
    expect(open.pill, 'the pill is drawn over the dock').not.toBeNull();
    expect(open.dockBottomRoom, 'the dock\'s scroll box ends above the pill').toBeGreaterThanOrEqual(open.vh - open.pill.t);
  });
});
