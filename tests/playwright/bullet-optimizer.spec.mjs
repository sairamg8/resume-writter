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

// R4-SW-WT-02: text after a nested list continues its item (the ATS bullet "Led migration for 3
// regions", R4-LO-16). The optimizer opens that whole statement from a caret in either run, and Apply
// writes the result in the first run and deletes the later one, the nested list kept — in a real
// browser's contentEditable, whose delete and insertText the fake DOM only imitates.
test('a list item split by a nested list opens and applies as one statement, its sub-list kept', async ({ page }) => {
  const nested = '<ul><li>Led migration<ul><li>Cut costs by 30%</li></ul> for 3 regions</li><li>Built the ledger service</li></ul>';
  await visitEditor(page, 'classic', { sections: [{ ...SECTIONS[0], items: [{ ...SECTIONS[0].items[0], description: nested }] }] });
  await page.getByText('Staff Engineer', { exact: true }).first().click();
  // Found by the bullet Apply leaves alone: the one it rewrites changes its text.
  const editor = page.locator('[contenteditable="true"]').filter({ hasText: 'Built the ledger service' });
  await expect(editor).toBeVisible();
  // The caret in " for 3 regions", the text after the nested list.
  await editor.evaluate((el) => {
    el.focus();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue.includes('for 3 regions')) node = walker.nextNode();
    document.getSelection().collapse(node, 4);
  });
  await editor.locator('xpath=..').getByTitle('Bullet Optimizer & STAR Formula Helper').click();
  const statement = page.locator('textarea').last();
  await expect(statement).toHaveValue('Led migration for 3 regions');
  await statement.fill('Led the migration of 40 services across 3 regions');
  await page.getByRole('button', { name: 'Apply to Resume' }).click();
  await expect(editor.locator('li')).toHaveText(['Led the migration of 40 services across 3 regionsCut costs by 30%', 'Cut costs by 30%', 'Built the ledger service']);
  await expect.poll(() => savedDescription(page)).toContain('<li>Cut costs by 30%</li>');
  await expect.poll(() => savedDescription(page)).not.toContain('for 3 regions<');
  // Nothing is left where the later run was: no <br> placeholder or empty line after the sub-list,
  // which the PDF printed as a blank line inside the bullet (review of R4-SW-WT-02).
  await expect.poll(() => savedDescription(page)).toBe('<ul><li>Led the migration of 40 services across 3 regions<ul><li>Cut costs by 30%</li></ul></li><li>Built the ledger service</li></ul>');
});

// R4-SW-WT-02: an item whose statement is two paragraphs ('<li><p>A</p><p>B</p></li>') opens as "A B",
// and Apply deletes the second paragraph whole — Chrome's delete over a block, not the fake DOM's —
// leaving one paragraph and no empty line in the item.
test('a list item split in paragraphs opens and applies as one statement, with no empty line left', async ({ page }) => {
  const paragraphs = '<ul><li><p>Owned billing</p><p>for 3 regions</p></li><li>Built the ledger service</li></ul>';
  await visitEditor(page, 'classic', { sections: [{ ...SECTIONS[0], items: [{ ...SECTIONS[0].items[0], description: paragraphs }] }] });
  await page.getByText('Staff Engineer', { exact: true }).first().click();
  const editor = page.locator('[contenteditable="true"]').filter({ hasText: 'Built the ledger service' });
  await expect(editor).toBeVisible();
  // The caret in "for 3 regions", the second paragraph.
  await editor.evaluate((el) => {
    el.focus();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue.includes('for 3 regions')) node = walker.nextNode();
    document.getSelection().collapse(node, 4);
  });
  await editor.locator('xpath=..').getByTitle('Bullet Optimizer & STAR Formula Helper').click();
  const statement = page.locator('textarea').last();
  await expect(statement).toHaveValue('Owned billing for 3 regions');
  await statement.fill('Owned billing for 3 regions, cutting costs 20%');
  await page.getByRole('button', { name: 'Apply to Resume' }).click();
  await expect(editor.locator('li')).toHaveText(['Owned billing for 3 regions, cutting costs 20%', 'Built the ledger service']);
  // Chrome's delete over the second paragraph merges it into the first, and may unwrap it: either is
  // one line. What must not be left is an empty paragraph or a <br>.
  await expect.poll(() => savedDescription(page)).toMatch(/^<ul><li>(?:<p>)?Owned billing for 3 regions, cutting costs 20%(?:<\/p>)?<\/li><li>Built the ledger service<\/li><\/ul>$/);
});
