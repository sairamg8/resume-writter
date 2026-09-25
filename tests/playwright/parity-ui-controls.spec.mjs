// Goal 1 through the real UI: every design control, clicked in the browser, changes the preview. Each
// button, colour input and select of the Design panel (and, on Classic, Personal Info's Header
// Customization and Photo, and a section's Section Options) is used in turn; whenever the use changed the
// saved résumé, the preview must repaint to something else — and after the whole walk the preview still
// equals the downloaded PDF. Big grids of like choices (13 fonts, 8 accents) are sampled: every value's
// effect on every template is the node parity matrix's (tests/pdf/parity), this proves the wiring
// UI → store → preview, click by click.
import { test, expect } from '@playwright/test';
import { TEMPLATE_IDS } from '../../src/constants/templates.js';
import { visitEditor, openDesignPanel } from './pw-helpers.js';
import { ALL_SECTION_TYPES } from '../helpers.js';
import { hookPreviewPdfs, settledPreview, previewPdf, downloadedPdf, drawingDiff, previewPrint } from './parity-helpers.js';

const PNG_2X2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';

/**
 * The résumé the Design panel is walked on: the fixture's, with a photo, and its job's description a
 * paragraph and a bulleted list, as the node matrix's is (tests/pdf/parity/store.mjs). Design → Lists
 * restyles a bulleted list's glyphs (R2-147) and every other text of the fixture is a paragraph: with no
 * list, Bullet, Dash, Circle and None change the résumé and rightly print the same.
 */
const DESIGN_WALK = {
  personal: { photo: PNG_2X2 },
  sections: ALL_SECTION_TYPES.map((s) => (s.type !== 'experience' ? s : {
    ...s,
    items: s.items.map((item, i) => (i ? item : {
      ...item, description: `<p>${item.description}</p><ul><li>Designed the event ledger</li><li>Mentored six engineers</li></ul>`,
    })),
  })),
};

/**
 * What the preview prints from: the open résumé's template, settings, personal info and sections — an
 * unset value and an empty one alike ('' / null / absent: picking the font already in use stores
 * customFont '' where there was none, and prints the same).
 */
const saved = (page) => page.evaluate(() => {
  // The store writes a change that follows another within a moment a short while later; leaving
  // the page writes it at once (R2-077), so this reads what the app holds now.
  window.dispatchEvent(new Event('pagehide'));
  const s = JSON.parse(localStorage.getItem('cpwtcv_v1') || '{}');
  const r = (s.resumes || []).find((x) => x.id === s.activeId) || {};
  return JSON.stringify([r.template, r.settings, r.personal, (r.sections || []).map((x) => [x.id, x.settings, x.visible])],
    (k, v) => (v === '' || v === null ? undefined : v));
});

/** Colours a colour input is set to in turn: never the one it holds, nor one an earlier input set (Name color after Text color). */
const PALETTE = ['#1a7f5a', '#b4235a', '#2b50c8', '#c26a00', '#6b21a8', '#0e7490', '#9f1239', '#4d7c0f', '#7c2d12', '#155e75'];
let nextColour = 0;

/**
 * Tag the usable controls under `root` (a CSS selector) with data-pw-ctl, sampling a parent's run of
 * more than five like buttons to its first two and its last, and with data-pw-group: the buttons of one
 * parent are one control's options (Left / Center, − / +), an input is a control of its own. Returns
 * the range of numbers tagged.
 */
const tag = (page, root, skip) => page.evaluate(({ root, skip }) => {
  const els = [...document.querySelectorAll(`${root} button, ${root} select, ${root} input[type=color]`)]
    .filter((el) => el.offsetParent !== null && !el.disabled && !el.dataset.pwCtl && !el.closest('[data-pw-skip]')
      && !new RegExp(skip, 'i').test(`${el.textContent} ${el.title} ${el.getAttribute('aria-label') || ''}`));
  const kept = els.filter((el) => {
    if (el.tagName !== 'BUTTON') return true;
    const sibs = [...el.parentNode.children].filter((c) => c.tagName === 'BUTTON');
    if (sibs.length <= 5) return true;
    const i = sibs.indexOf(el);
    return i < 2 || i === sibs.length - 1;
  });
  const start = document.querySelectorAll('[data-pw-ctl]').length;
  let group = document.querySelectorAll('[data-pw-group-id]').length;
  kept.forEach((el, i) => {
    el.dataset.pwCtl = String(start + i);
    const owner = el.tagName === 'BUTTON' ? el.parentNode : el;
    if (!owner.dataset.pwGroupId) owner.dataset.pwGroupId = String(group++);
    el.dataset.pwGroup = owner.dataset.pwGroupId;
  });
  return [start, start + kept.length];
}, { root, skip });

/**
 * Use every tagged control in [from, to). A control whose use changes the résumé must repaint the
 * preview with at least one of its options: an option that stores the value already in effect (Left
 * where nothing was stored yet) changes the saved résumé and rightly prints the same, so a control is
 * inert only when none of its options that changed the résumé repainted it.
 */
async function useEach(page, [from, to]) {
  const groups = new Map();
  let used = 0;
  for (let i = from; i < to; i += 1) {
    const el = page.locator(`[data-pw-ctl="${i}"]`);
    if (!(await el.count()) || !(await el.isVisible()) || !(await el.isEnabled())) continue;
    const name = (await el.evaluate((e) => `${e.tagName.toLowerCase()} "${(e.textContent || e.title || e.getAttribute('aria-label') || '').trim().slice(0, 30)}"`));
    const group = await el.getAttribute('data-pw-group');
    const [store, print] = [await saved(page), await previewPrint(page)];
    const tagName = await el.evaluate((e) => e.tagName);
    if (tagName === 'SELECT') {
      const next = await el.evaluate((e) => [...e.options].map((o) => o.value).find((v) => v !== e.value));
      await el.selectOption(next);
    } else if (tagName === 'INPUT') {
      const cur = (await el.inputValue()).toLowerCase();
      let v = PALETTE[nextColour++ % PALETTE.length];
      if (v === cur) v = PALETTE[nextColour++ % PALETTE.length];
      await el.fill(v);
    } else await el.click();
    // A control that opens a dialog is not a design control: say which, rather than time out behind it.
    if (await page.locator('div.fixed.inset-0.z-50').count()) throw new Error(`${name} opened a dialog — leave it out of the walk`);
    await page.waitForTimeout(150);
    if ((await saved(page)) === store) continue; // the value it holds already: nothing to repaint
    used += 1;
    const g = groups.get(group) || { names: [], repainted: false };
    groups.set(group, g);
    g.names.push(name);
    const repainted = await expect.poll(async () => {
      const status = await page.locator('[data-preview-status]').first().getAttribute('data-preview-status');
      return status === 'ready' && (await previewPrint(page)) !== print;
    }, { timeout: 15_000, intervals: [100] }).toBe(true).then(() => true, () => false);
    if (repainted) g.repainted = true;
  }
  const inert = [...groups.values()].filter((g) => !g.repainted).map((g) => g.names.join(' / '));
  return { inert, used };
}

/**
 * The Design panel's sections (DesignSection: a box whose first row's button names it), found from the
 * Template section — so nothing outside the panel (the preview, the header) is ever walked. Each
 * page.evaluate below repeats this lookup: a function cannot be handed to the page, and the app's
 * page may forbid eval.
 */

/** Open every collapsed Design section (its header toggles it; its content follows the header row). */
const openSections = (page) => page.evaluate(() => {
  const title = (box) => box.querySelector(':scope > div > button > span')?.textContent.trim().toLowerCase();
  const template = [...document.querySelectorAll('div.rounded-xl.overflow-hidden')].find((b) => title(b) === 'template');
  const boxes = template ? [...template.parentElement.children].filter((b) => b.matches('div.rounded-xl.overflow-hidden') && title(b)) : [];
  for (const box of boxes) if (box.children.length < 2) box.querySelector(':scope > div > button').click();
  return boxes.length;
});

/**
 * Mark the Design sections named `titles` (all when null) as the walk's roots, and the Template section's
 * Layout choice (the Sidebar's) as a root of its own — not the template picks: each template is its own test.
 */
const markSections = (page, titles) => page.evaluate((titles) => {
  const title = (box) => box.querySelector(':scope > div > button > span')?.textContent.trim().toLowerCase();
  const template = [...document.querySelectorAll('div.rounded-xl.overflow-hidden')].find((b) => title(b) === 'template');
  const boxes = template ? [...template.parentElement.children].filter((b) => b.matches('div.rounded-xl.overflow-hidden') && title(b)) : [];
  for (const box of boxes) {
    // A section's own header row — its open/close toggle and its ↺ — is not a design control: the toggle
    // would fold away the controls after it.
    box.querySelector(':scope > div').dataset.pwSkip = '1';
    if (title(box) === 'template') {
      const layout = [...box.querySelectorAll('p')].find((p) => p.textContent.trim().toLowerCase() === 'layout');
      if (layout) layout.parentElement.dataset.pwRoot = 'layout';
    } else if (!titles || titles.includes(title(box))) box.dataset.pwRoot = 'design';
  }
  return boxes.map(title);
}, titles);

/**
 * Classic walks every Design section; the other templates walk the sections whose effect is their own —
 * Colors (the banner's and the column's colours) and Section Headings — and the Template section's
 * Layout where it has one. The rest print through the same code on every template (the node matrix
 * proves every value there).
 */
const SECTIONS_FOR = (template) => (template === 'classic' ? null : ['colors', 'section headings']);

test.describe('every design control changes the preview, through the UI', () => {
  test.setTimeout(240_000);
  for (const template of TEMPLATE_IDS) {
    test(`${template}: Design panel`, async ({ page }) => {
      await hookPreviewPdfs(page);
      await visitEditor(page, template, DESIGN_WALK);
      await settledPreview(page);
      await openDesignPanel(page);
      await openSections(page);
      await markSections(page, SECTIONS_FOR(template));
      // Not the resets' confirm step, nor Add (a custom font, typed). The Layout choice last: Single ·
      // ATS-safe takes the Sidebar's column colours off the panel.
      const range = await tag(page, '[data-pw-root="design"]', '^(Reset|Yes, Reset|Cancel)$|Reset .* to defaults|Add$');
      const layout = await tag(page, '[data-pw-root="layout"]', '^$');
      const { inert, used } = await useEach(page, [range[0], Math.max(range[1], layout[1])]);
      expect(inert, 'controls that changed the résumé but not the preview').toEqual([]);
      expect(used).toBeGreaterThan(template === 'classic' ? 30 : 8);
      await settledPreview(page);
      expect(await drawingDiff(await previewPdf(page), await downloadedPdf(page)), 'after the walk, preview == download').toEqual([]);
    });
  }

  test('classic: Personal Info (Header Customization, Photo, the eyes) and Section Options', async ({ page }) => {
    await hookPreviewPdfs(page);
    // Two jobs: the first section's Spacing and Grids have a gap between entries to change.
    const sections = ALL_SECTION_TYPES.map((s) => (s.type !== 'experience' ? s : {
      ...s, items: [...s.items, { ...s.items[0], id: 'exp2', company: 'Globex', role: 'Engineer', location: 'Boston', startDate: '03/2019', endDate: '12/2022', current: false }],
    }));
    await visitEditor(page, 'classic', { personal: { photo: PNG_2X2 }, sections });
    await settledPreview(page);
    await page.locator('button:has-text("Header Customization")').click();
    await page.locator('button:has(p:text-is("Photo"))').first().click();
    // The first section's ⋯ menu → Customize layout opens its Section Options.
    await page.locator('button[title="Section options"]').first().click();
    await page.locator('button:has-text("Customize layout")').first().click();
    // The walk's roots: Header Customization's box, the Photo box, each field's eye, and the first
    // section's options — not the rest of Personal Info (the summary's editor opens the STAR optimizer).
    await page.evaluate(() => {
      const byText = (t) => [...document.querySelectorAll('button')].find((x) => [...x.querySelectorAll('p')].some((p) => p.textContent.trim() === t));
      byText('Header Customization').closest('div.rounded-xl').dataset.pwRoot = 'header';
      byText('Photo').closest('div.rounded-xl').dataset.pwRoot = 'photo';
      for (const eye of document.querySelectorAll('button[title="Hide on resume"], button[title="Hide summary from resume"]')) eye.parentElement.dataset.pwRoot = 'eye';
      const so = [...document.querySelectorAll('p')].find((p) => p.textContent.trim() === 'Section Options');
      so.parentNode.dataset.pwRoot = 'section';
    });
    // Uploads, the icon picker, and removing or hiding the photo (the photo's own controls come after):
    // its eye reads "Hide photo from the résumé and cover letter" since R2-092.
    const range = await tag(page, '[data-pw-root]', 'Choose Icon|choose icon|Remove photo|photo from the résumé|photo on the résumé|Clear|^(Header Customization|Photo)');
    const { inert, used } = await useEach(page, range);
    expect(inert, 'controls that changed the résumé but not the preview').toEqual([]);
    expect(used).toBeGreaterThan(15);
    await settledPreview(page);
    expect(await drawingDiff(await previewPdf(page), await downloadedPdf(page)), 'after the walk, preview == download').toEqual([]);
  });
});
