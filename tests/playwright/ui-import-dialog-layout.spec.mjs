// The dashboard's "Import a file" dialog on a phone, and the rule behind it. The owner's screenshot: the Upload icon
// sat ABOVE "Choose a file", the label hung below its 32 px button, and the two choices were different widths. The
// cause was an icon written as a child of the kit's Button (its label span is inline and preflight makes svg a
// block); the fix puts it in leftIcon. Nothing measured layout, so it was never caught. Measured here in Chromium on
// the production build, in touch mode (hasTouch, isMobile) at 320, 375, 594 and 639 px wide (594 is a wide phone or
// a small tablet, 639 the widest width below the sm breakpoint of 640), and on a laptop at 1280:
//   - in the open dialog and on the dashboard page, every button and link with an icon and a label has the icon on
//     the label's row (tests/playwright/icon-rows.js), and a one-row control holds its label inside its box;
//   - "Choose a file" is 32 px high and, on a phone, as wide as the dialog's content box (on a laptop it keeps its own
//     width, sm:w-auto), inside the content box and the screen, and so is everything else in the body (the long
//     warning, the type chips); the panel fits the screen; neither the page nor the dialog body scrolls sideways;
//     Cancel is on the screen.
// A production build has no demo account, so "Import as my original" (the second choice) is not here: the cypress
// spec cypress/e2e/11-demo-account-import-dialog-layout.cy.js measures both choices side by side on the e2e build.
// Measured after the dialog's 180 ms scale-in has ended (a rect during it is 0.98 of the size).
// To see it fail: put the icon back as a child of the Button in src/components/ImportDialog.jsx and run the spec: the
// dialog tests go red. The "every button and link on the dashboard" tests never open the dialog (it loads when Import
// is pressed), so they stay green either way; they guard the dashboard's own controls, the dialog tests carry the fix.
// Run: playwright: tests/playwright/ui-import-dialog-layout.spec.mjs
import { test, expect } from '@playwright/test';
import { buildTestState, STORAGE_KEY } from '../helpers.js';
import { stackedIcons } from './icon-rows.js';

// [width, height] of the phones.
const PHONES = [[320, 640], [375, 812], [594, 800], [639, 800]];

/** The dashboard on one seeded résumé; waits for its card. */
async function openDashboard(page) {
  await page.goto('about:blank');
  await page.addInitScript((args) => {
    localStorage.clear();
    localStorage.setItem(args.key, JSON.stringify(args.state));
  }, { key: STORAGE_KEY, state: buildTestState('classic') });
  await page.goto('/#/');
  await page.getByTestId('resume-card').first().waitFor({ timeout: 20_000 });
}

/** Presses Import (a tap on a phone) and returns the dialog once its lazy code has loaded and its animation has ended. */
async function openImportDialog(page, touch) {
  const button = page.locator('main').getByRole('button', { name: 'Import', exact: true });
  if (touch) await button.tap(); else await button.click();
  const dialog = page.getByRole('dialog', { name: 'Import a file' });
  await dialog.waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return Boolean(d) && d.getAnimations().every((a) => a.playState !== 'running');
  });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  return dialog;
}

/** Throws unless at least `least` icon-and-label controls under `scope` were checked and each has its icon on its label's row. */
async function expectOneRow(page, scope, least) {
  const { checked, offenders } = await page.locator(scope).first().evaluate(stackedIcons);
  expect(checked, `controls with an icon and a label under ${scope}`).toBeGreaterThanOrEqual(least);
  expect(offenders, offenders.join('\n')).toEqual([]);
}

/** The dialog's boxes in px, measured inside the page (the panel is the [role=dialog] element). */
function measure(panel) {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  const body = panel.querySelector(':scope > .overflow-y-auto');
  if (!body) throw new Error('the dialog body (":scope > .overflow-y-auto" of the panel, src/components/ui/Dialog.jsx) was not found: the markup changed, update this spec');
  const style = getComputedStyle(body);
  const bodyBox = body.getBoundingClientRect();
  const inner = { left: bodyBox.left + parseFloat(style.paddingLeft), right: bodyBox.right - parseFloat(style.paddingRight) };
  const choices = {};
  const buttons = [...panel.querySelectorAll('button')];
  for (const b of buttons) {
    const label = b.textContent.trim();
    if (label === 'Choose a file' || label === 'Import as my original') choices[label] = rect(b);
  }
  const cancel = buttons.find((b) => b.textContent.trim() === 'Cancel');
  const outside = [...body.querySelectorAll('*')].filter((e) => {
    const r = e.getBoundingClientRect();
    return e.getClientRects().length > 0 && (r.right > inner.right + 1 || r.left < inner.left - 1);
  }).map((e) => {
    const r = e.getBoundingClientRect();
    return `${e.tagName.toLowerCase()} "${(e.textContent || '').trim().slice(0, 24)}" ${r.left.toFixed(1)}..${r.right.toFixed(1)}`;
  });
  return {
    screen: { width: innerWidth, height: innerHeight },
    pageScrollWidth: document.documentElement.scrollWidth,
    panel: rect(panel),
    bodyScroll: { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth },
    inner,
    choices,
    cancel: cancel && cancel.getClientRects().length > 0 ? rect(cancel) : null,
    outside,
  };
}

/** Choose a file is one 32 px row (h-8): a label hanging below the button, or a button grown to two lines, is not. */
function expectOneRowHigh(choose) {
  expect(choose, 'the Choose a file button').toBeTruthy();
  expect(choose.height, `Choose a file is ${choose.height.toFixed(1)} px high`).toBeGreaterThanOrEqual(31);
  expect(choose.height, `Choose a file is ${choose.height.toFixed(1)} px high`).toBeLessThanOrEqual(33);
}

for (const [width, height] of PHONES) {
  test.describe(`on a phone ${width} px wide`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test(`${width} px: the Import dialog's choice has its icon and label on one row, inside the dialog, with Cancel on screen`, async ({ page }) => {
      await openDashboard(page);
      const dialog = await openImportDialog(page, true);
      await expectOneRow(page, '[role="dialog"]', 1);

      const m = await dialog.evaluate(measure);
      const choose = m.choices['Choose a file'];
      expectOneRowHigh(choose);
      const where = `Choose a file ${choose.left.toFixed(1)}..${choose.right.toFixed(1)} in the content box ${m.inner.left.toFixed(1)}..${m.inner.right.toFixed(1)}`;
      expect(choose.left, where).toBeGreaterThanOrEqual(m.inner.left - 0.5);
      expect(choose.right, where).toBeLessThanOrEqual(m.inner.right + 0.5);
      expect(Math.abs(choose.width - (m.inner.right - m.inner.left)), `${where}: on a phone it fills the width`).toBeLessThanOrEqual(1);
      expect(m.outside, `elements wider than the dialog's content box (${m.inner.left.toFixed(1)}..${m.inner.right.toFixed(1)})`).toEqual([]);

      const fits = `panel ${m.panel.left.toFixed(1)}..${m.panel.right.toFixed(1)} x ${m.panel.top.toFixed(1)}..${m.panel.bottom.toFixed(1)} on a ${m.screen.width}x${m.screen.height} screen`;
      expect(m.panel.left, fits).toBeGreaterThanOrEqual(0);
      expect(m.panel.right, fits).toBeLessThanOrEqual(m.screen.width);
      expect(m.panel.top, fits).toBeGreaterThanOrEqual(0);
      expect(m.panel.bottom, fits).toBeLessThanOrEqual(m.screen.height);
      expect(m.pageScrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(m.screen.width);
      expect(m.bodyScroll.scrollWidth, 'the dialog body scrolls sideways').toBeLessThanOrEqual(m.bodyScroll.clientWidth);

      expect(m.cancel, 'Cancel is drawn').toBeTruthy();
      const cancelAt = `Cancel ${m.cancel.left.toFixed(1)}..${m.cancel.right.toFixed(1)} x ${m.cancel.top.toFixed(1)}..${m.cancel.bottom.toFixed(1)} on a ${m.screen.width}x${m.screen.height} screen`;
      expect(m.cancel.left, cancelAt).toBeGreaterThanOrEqual(0);
      expect(m.cancel.right, cancelAt).toBeLessThanOrEqual(m.screen.width);
      expect(m.cancel.bottom, cancelAt).toBeLessThanOrEqual(m.screen.height);
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
    });

    test(`${width} px: every button and link on the dashboard has its icon on its label's row`, async ({ page }) => {
      await openDashboard(page);
      await expectOneRow(page, 'body', 2); // Import and New Resume at least
    });
  });
}

test.describe('on a laptop 1280 px wide', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('1280 px: the Import dialog and the dashboard behind it have every icon on its label\'s row', async ({ page }) => {
    await openDashboard(page);
    await expectOneRow(page, 'body', 3);
    const dialog = await openImportDialog(page, false);
    await expectOneRow(page, '[role="dialog"]', 1);
    const m = await dialog.evaluate(measure);
    const choose = m.choices['Choose a file'];
    expectOneRowHigh(choose);
    const content = m.inner.right - m.inner.left;
    expect(choose.width, `on a laptop Choose a file keeps its own width (${choose.width.toFixed(1)} px of a ${content.toFixed(1)} px content box)`).toBeLessThan(content / 2);
    expect(m.outside, 'elements wider than the dialog\'s content box').toEqual([]);
  });
});
