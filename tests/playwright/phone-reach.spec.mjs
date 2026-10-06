// Phone reachability (UI redesign, batch B1): on a phone there is no hover, so every control of a surface
// must be reachable by a TAP alone. The page runs in touch mode (375x812, hasTouch, isMobile), where
// (hover: none) holds, a `hover:` style never applies and a control drawn only on hover stays invisible.
// A control counts as reachable when, after scrolling it into view, it is rendered (no `display: none`,
// `visibility: hidden` or zero opacity on it or any ancestor, a box inside the screen's width) and a tap on
// it would land on it (Playwright's trial tap checks the hit target without acting). No hover() is ever
// called here: a test that hovered first would pass for a control a phone cannot reach.
//
// Later batches APPEND to SURFACES (a surface's `testids`, or a new surface): when a batch moves a
// control into a menu or a drawer, `open` taps the opener first, so "one drawer or menu away" stays proven.
// Keep this list to data-testids (tests/pdf/ui-selectors.mjs names them for the node tests).
//
// How the lead proves it can fail (the mutation proof, run at the end of B1): on a throw-away commit make
// one listed control hover-only, for instance in src/components/ResumeCard.jsx drop `no-hover:opacity-100`
// from the Rename button's class (it keeps `opacity-0 group-hover/name:opacity-100`), push, and run
//   playwright: tests/playwright/phone-reach.spec.mjs
// the dashboard case must go RED naming resume-card-rename; the commit before it is GREEN. Record both run
// ids. The case 'a control that shows only on hover is not reachable' proves the check itself on a page
// built for the purpose, with no app in it.
import { test, expect } from '@playwright/test';
import { buildTestState, STORAGE_KEY } from '../helpers.js';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

/** Seeds `state` into localStorage and opens `hash`. */
async function visit(page, state, hash) {
  await page.goto('about:blank');
  await page.addInitScript((args) => {
    localStorage.clear();
    localStorage.setItem(args.key, JSON.stringify(args.state));
  }, { key: STORAGE_KEY, state });
  await page.goto(`/#${hash}`);
}

/**
 * Throws unless the first element with data-testid `id` can be tapped on this phone: it is on the page,
 * painted, inside the screen's width, and the tap's hit target is it (a trial tap: nothing is clicked).
 */
async function reachable(page, id) {
  const control = page.getByTestId(id).first();
  await control.waitFor({ state: 'attached', timeout: 15_000 });
  await control.scrollIntoViewIfNeeded();
  const painted = await control.evaluate((el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0 || s.pointerEvents === 'none') return `${n === el ? 'itself' : 'an ancestor'}: display ${s.display}, visibility ${s.visibility}, opacity ${s.opacity}, pointer-events ${s.pointerEvents}`;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= window.innerWidth ? '' : `its box ${Math.round(r.left)}..${Math.round(r.right)} x ${Math.round(r.width)}x${Math.round(r.height)} is off the screen or empty`;
  });
  expect(painted, `${id} is not painted on a phone (${painted})`).toBe('');
  await control.tap({ trial: true, timeout: 5_000 });
}

/** The phone is in touch mode: no hover, a coarse pointer. A pass without this would prove nothing. */
async function assertTouchMode(page) {
  const media = await page.evaluate(() => ({ hover: matchMedia('(hover: none)').matches, coarse: matchMedia('(pointer: coarse)').matches }));
  expect(media, 'the page is in touch mode').toEqual({ hover: true, coarse: true });
}

/** The editor on a seeded résumé, the form tab open; entries and sections are on screen. */
async function openEditor(page) {
  const state = buildTestState('classic');
  await visit(page, state, `/resume/${state.activeId}`);
  await page.getByTestId('section-title-input').first().waitFor({ timeout: 20_000 });
}

/** The dashboard on the same state: one card. */
async function openDashboard(page) {
  await visit(page, buildTestState('classic'), '/');
  await page.getByTestId('resume-card').first().waitFor({ timeout: 20_000 });
}

/**
 * Per surface: how to open it, and the testids that must be reachable by tap there.
 * APPEND here: a later batch lists the testids it adds (or moves behind a menu: `open` taps the opener).
 */
const SURFACES = [
  { name: 'dashboard', open: openDashboard, testids: ['resume-card', 'resume-card-rename', 'bottom-tab-documents', 'bottom-tab-applications', 'bottom-tab-projects'] }, // B2: the nav moves to the phone tab bar (the top bar's nav is hidden below md)
  {
    name: 'editor',
    open: openEditor,
    testids: ['doc-switch-resume', 'doc-switch-letter', 'ats-open', 'design-open', 'section-title-input', 'entry-header'],
  },
];

for (const surface of SURFACES) {
  test.describe(`${surface.name} on a phone`, () => {
    test('is in touch mode', async ({ page }) => {
      await surface.open(page);
      await assertTouchMode(page);
    });
    for (const id of surface.testids) {
      test(`${id} is reachable by tap alone`, async ({ page }) => {
        await surface.open(page);
        await assertTouchMode(page);
        await reachable(page, id);
      });
    }
  });
}

test.describe('the check itself', () => {
  test('a control that shows only on hover is not reachable', async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`<style>.row button { opacity: 0 } .row:hover button { opacity: 1 }</style>
      <div class="row"><button data-testid="hover-only">Rename</button></div>
      <button data-testid="always">Open</button>`);
    await assertTouchMode(page);
    await reachable(page, 'always');
    await expect(reachable(page, 'hover-only')).rejects.toThrow(/not painted/);
  });
});
