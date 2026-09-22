// The STAR Optimizer (the rich-text editor's toolbar): it opened on the text the editor held at its
// first render — none — so its statement was always empty, and Apply inserted the result at the
// caret as HTML, the bullet it was meant to improve left as it was (bug audit 2026-09-22). It now
// opens on the selection, else the bullet or line the caret is in, and Apply replaces that, as text.
import { test, expect } from '@playwright/test';
import { visitEditor } from './pw-helpers.js';

const BULLETS = '<ul><li>Was responsible for the payments team of 5</li><li>Built the ledger service</li></ul>';
const SECTIONS = [{
  id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: { spacing: 'normal' },
  items: [{ id: 'e1', company: 'Acme', role: 'Staff Engineer', startDate: 'Jan 2020', endDate: 'Dec 2021', description: BULLETS }],
}];

/** The entry's description editor (opened), and its STAR Optimizer button. */
async function description(page) {
  await visitEditor(page, 'classic', { sections: SECTIONS });
  await page.getByText('Staff Engineer', { exact: true }).first().click(); // the entry's card opens
  const editor = page.locator('[contenteditable="true"]').filter({ hasText: 'payments team' });
  await expect(editor).toBeVisible();
  const star = editor.locator('xpath=..').getByTitle('Bullet Optimizer & STAR Formula Helper');
  return { editor, star };
}

/** The saved résumé's first entry's description (localStorage, as the app saved it). */
const savedDescription = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cpwtcv_v1')).resumes[0].sections[0].items[0].description);

test('opens on the bullet the caret is in, and Apply replaces that bullet', async ({ page }) => {
  const { editor, star } = await description(page);
  await editor.locator('li').first().click();
  await star.click();
  const statement = page.locator('textarea').last();
  await expect(statement).toHaveValue('Was responsible for the payments team of 5');
  await page.getByRole('button', { name: 'Auto-Fix' }).click();
  await expect(statement).toHaveValue('Led the payments team of 5');
  await page.getByRole('button', { name: 'Apply to Resume' }).click();
  await expect(editor.locator('li')).toHaveText(['Led the payments team of 5', 'Built the ledger service']);
  await expect.poll(() => savedDescription(page)).toContain('<li>Led the payments team of 5</li>');
});

test('the result goes in as text — "<" and "&" are never markup', async ({ page }) => {
  const { editor, star } = await description(page);
  await editor.locator('li').nth(1).click();
  await star.click();
  const statement = page.locator('textarea').last();
  await expect(statement).toHaveValue('Built the ledger service');
  await statement.fill('Cut p99 <200ms & <b>cost</b> by 5%');
  await page.getByRole('button', { name: 'Apply to Resume' }).click();
  await expect(editor.locator('li')).toHaveText(['Was responsible for the payments team of 5', 'Cut p99 <200ms & <b>cost</b> by 5%']);
  await expect(editor.locator('b, strong')).toHaveCount(0);
});

test('opened with no caret in the field: an empty statement, added as a new bullet', async ({ page }) => {
  const { editor, star } = await description(page);
  await star.click();
  const statement = page.locator('textarea').last();
  await expect(statement).toHaveValue('');
  await statement.fill('Shipped the new checkout, lifting conversion 12%');
  await page.getByRole('button', { name: 'Apply to Resume' }).click();
  await expect(editor.locator('li')).toHaveText(['Was responsible for the payments team of 5', 'Built the ledger service', 'Shipped the new checkout, lifting conversion 12%']);
});
