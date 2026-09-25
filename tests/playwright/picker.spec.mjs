// Design → Template in the real browser (R2-139): pictures a browser paints, and flows that cross tabs and
// pages. A2/A1/F1 the gallery shows each card's real page 1 and letterhead; A3/B3 its chips filter; A4 a
// switch's notice carries Undo; A9 the Sidebar's single column is a card; A12 a collapsed Template stays
// collapsed across tabs; E1 on a phone the gallery fills the screen, two cards to a row, Done in view;
// B4 a design saved on one résumé is picked on another and deleted; C1 the dashboard shows each résumé's
// real page, kept across visits; D1 New Resume picks the look beside the starters.
import { test, expect } from '@playwright/test';
import { buildTestState, STORAGE_KEY } from '../helpers.js';
import { visitEditor, openDesignPanel } from './pw-helpers.js';

const store = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
const active = (s) => s.resumes.find((r) => r.id === s.activeId);

/** Seeds `state` and opens `hash` (the dashboard by default). */
async function visit(page, state, hash = '/') {
  await page.goto('about:blank');
  await page.addInitScript((args) => {
    if (sessionStorage.getItem('seeded')) return; // a reload keeps what the page stored
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem(args.key, JSON.stringify(args.state));
  }, { key: STORAGE_KEY, state });
  await page.goto(`/#${hash}`);
}

test.describe('the template gallery', () => {
  test('paints each card\'s real page, filters by chip, picks with Undo, and closes on Done', async ({ page }) => {
    await visitEditor(page, 'classic');
    await openDesignPanel(page);
    await page.getByTestId('browse-templates').click();
    const gallery = page.getByTestId('template-gallery');
    await expect(gallery).toBeVisible();
    // A1: the real page replaces the drawn one — a JPEG the app's renderer painted.
    const img = page.getByTestId('gallery-template-classic').locator('[data-look-thumb="page"] img[data-page-image]');
    await expect(img).toHaveAttribute('src', /^data:image\/jpeg;base64,/, { timeout: 30_000 });
    expect(await img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(100);
    // A3: Two columns is the Sidebar alone.
    await gallery.getByRole('button', { name: 'Two columns', exact: true }).click();
    await expect(gallery.locator('[data-testid^="gallery-"]').filter({ has: page.locator('[data-look-thumb="page"]') })).toHaveCount(1);
    await gallery.getByRole('button', { name: 'Two columns', exact: true }).click();
    // B3: a category.
    await gallery.getByRole('button', { name: 'Compact', exact: true }).click();
    await expect(page.getByTestId('gallery-preset-inkwell')).toBeVisible();
    await expect(page.getByTestId('gallery-template-classic')).toHaveCount(0);
    await gallery.getByRole('button', { name: 'All', exact: true }).click();
    // A9 + A4: the single column picked, then undone.
    await page.getByTestId('gallery-template-sidebar-single').click();
    await expect.poll(async () => { const r = active(await store(page)); return `${r.template}/${r.settings.sidebarSingleColumn}`; }).toBe('sidebar/true');
    // The notice sits over the gallery: Undo while it is up.
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
    await page.getByTestId('gallery-done').click();
    await expect(gallery).toHaveCount(0);
    await expect.poll(async () => active(await store(page)).template).toBe('classic');
    expect(active(await store(page)).settings.sidebarSingleColumn).toBeFalsy();
  });

  test('on a phone it fills the screen, two cards to a row, with Done in view', async ({ page }) => {
    // Seeded at desktop width, where the preview builds (a phone's Edit tab pauses it), then a phone.
    await visitEditor(page, 'classic');
    await page.setViewportSize({ width: 375, height: 812 });
    await openDesignPanel(page);
    await page.getByTestId('browse-templates').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await dialog.boundingBox())?.width).toBe(375);
    // The sheet slides up (animate-ui-sheet-in): the boxes are read once it has come to rest, in one frame.
    const box = await page.evaluate(async () => {
      await Promise.all(document.getAnimations().map((x) => x.finished.catch(() => {})));
      const of = (id) => { const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect(); return { y: r.y, height: r.height }; };
      return { a: of('gallery-template-executive'), b: of('gallery-template-classic'), c: of('gallery-template-modern'), done: of('gallery-done') };
    });
    const { a, b, c, done } = box;
    expect(Math.abs(a.y - b.y)).toBeLessThan(2); // side by side
    expect(c.y).toBeGreaterThan(a.y + a.height - 1); // the third on the next row
    expect(done.y + done.height).toBeLessThanOrEqual(812);
    expect(done.height).toBeGreaterThanOrEqual(44);
  });
});

test('a collapsed Template stays collapsed across tabs (A12)', async ({ page }) => {
  await visitEditor(page, 'classic');
  await openDesignPanel(page);
  await expect(page.getByTestId('template-classic')).toBeVisible();
  await page.getByRole('button', { name: 'Template', exact: true }).click();
  await expect(page.getByTestId('template-classic')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cover Letter' }).first().click();
  await openDesignPanel(page);
  await expect(page.getByRole('button', { name: 'Template', exact: true })).toBeVisible();
  await expect(page.getByTestId('template-classic')).toHaveCount(0);
});

test('a design saved on one résumé is picked on another and deleted (B4)', async ({ page }) => {
  const state = buildTestState('executive', { accentColor: '#6d28d9', font: 'literata', headingStyle: 'leftbar' });
  const other = { ...buildTestState('minimal').resumes[0], id: 'test_other', name: 'Other' };
  state.resumes.push(other);
  await visit(page, state, `/resume/${state.activeId}`);
  await page.waitForSelector('[data-preview-status="ready"]', { timeout: 30_000 });
  await openDesignPanel(page);
  await page.getByRole('button', { name: 'Save my design' }).click();
  await page.getByLabel('Design name').fill('Violet');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const card = page.locator('[data-testid^="design-design_"]');
  await expect(card).toHaveCount(1);
  await expect(card).toHaveClass(/border-blue-500/);
  const id = (await card.getAttribute('data-testid')).slice('design-'.length);

  await page.goto('/#/resume/test_other');
  await page.waitForSelector('[data-preview-status="ready"]', { timeout: 30_000 });
  await openDesignPanel(page);
  await page.getByTestId(`design-${id}`).click();
  await expect.poll(async () => {
    const r = (await store(page)).resumes.find((x) => x.id === 'test_other');
    return [r.template, r.settings.templatePreset, r.settings.font, r.settings.accentColor].join(' ');
  }).toBe(`executive ${id} literata #6d28d9`);

  await page.getByRole('button', { name: 'Delete design Violet' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId(`design-${id}`)).toHaveCount(0);
  await expect.poll(async () => (await store(page)).resumes.filter((r) => r.settings.myDesigns?.[id]).length).toBe(0);
  const s = await store(page);
  expect(s.resumes.find((x) => x.id === 'test_other').settings.font).toBe('literata');
});

test('the dashboard shows each résumé\'s real page 1, kept across visits (C1)', async ({ page }) => {
  await visit(page, buildTestState('modern'));
  const img = page.locator('img[data-page-image]').first();
  await expect(img).toHaveAttribute('src', /^data:image\/jpeg;base64,/, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cpwtcv_page_images') || '{}')))).toEqual(['test_modern']);
  expect(await page.evaluate((key) => JSON.stringify(JSON.parse(localStorage.getItem(key))).includes('data:image'), STORAGE_KEY)).toBe(false);
  await page.reload();
  // Kept: shown at once, not painted again.
  await expect(page.locator('img[data-page-image]').first()).toBeVisible({ timeout: 3_000 });
});

test('New Resume: a look picked beside the starters makes the résumé on it (D1)', async ({ page }) => {
  await visit(page, buildTestState('classic'));
  await page.getByRole('button', { name: 'New Resume' }).first().click();
  await expect(page.getByText('Template: Modern')).toBeVisible(); // the Product Manager starter names its own
  await page.getByTestId('look-preset-harbor').click();
  await page.getByRole('button', { name: /Product Manager/ }).click();
  await page.waitForURL(/#\/resume\/resume_/);
  await expect.poll(async () => { const r = active(await store(page)); return `${r.template}/${r.settings.templatePreset}/${r.personal.name}`; })
    .toBe('classic/harbor/Sarah Chen');
});
