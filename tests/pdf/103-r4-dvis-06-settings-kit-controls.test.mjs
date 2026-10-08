// R4-DVIS-06: a project's Settings page draws its controls with the UI kit, as the rest of the
// workspace does. Its fields, its Save key / Add / Delete column / Cancel buttons and its small
// icon buttons were hand-rolled (8 px corners, a 2 px ring, a second red, pale gray icons) beside
// the kit's own Delete project button, and its captions were not the kit's field labels. Now the
// fields wear controlClass (without its w-full, so a select in a row keeps its own width), the
// buttons are the kit's Button (sm) and IconButton (sm), the captions the kit's label type.
// The real page is mounted (fake DOM, no layout): its class tokens are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { mountSettings, classes } from './103-r4-board-settings-helpers.mjs';

before(setup);
after(teardown);

/** Asserts `el` has every token of `has` and none of `hasNot`. */
function tokens(el, name, { has = [], hasNot = [] }) {
  assert.ok(el, `${name} is shown`);
  const cls = classes(el);
  for (const t of has) assert.ok(cls.includes(t), `${name}: ${t} (class="${el.getAttribute('class')}")`);
  for (const t of hasNot) assert.ok(!cls.includes(t), `${name}: no ${t} (class="${el.getAttribute('class')}")`);
}

/** The element whose own text (not a child's) is `text`. */
const ownText = (page, text) => page.all().find((el) => [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim() === text));

it('R4-DVIS-06: Save key, Add, Delete column and Cancel are the kit\'s small buttons', async () => {
  const page = await mountSettings();
  try {
    const kitPrimary = { has: ['h-7', 'rounded', 'bg-brand', 'font-medium'], hasNot: ['rounded-lg', 'font-semibold'] };
    tokens(page.button('Save key'), 'Save key', kitPrimary);
    tokens(page.button('Add', page.byLabel('New column').parentNode), 'Add (column)', kitPrimary);
    tokens(page.button('Add', page.byLabel('New label').parentNode), 'Add (label)', kitPrimary);

    page.openDeleteStrip();
    const row = page.find('data-column', 'c1');
    tokens(page.button('Delete column', row), 'the strip\'s Delete column', { has: ['h-7', 'rounded', 'bg-cv-bad'], hasNot: ['bg-red-600', 'rounded-lg'] });
    tokens(page.button('Cancel', row), 'Cancel', { has: ['h-7', 'rounded'], hasNot: ['font-semibold'] });
    // The page's own kit button: the strip's red is now the same red.
    tokens(page.button('Delete project'), 'Delete project', { has: ['bg-cv-bad'] });
  } finally {
    await page.close();
  }
});

it('R4-DVIS-06: the move and delete icons are the kit\'s small icon buttons', async () => {
  const page = await mountSettings();
  try {
    const row = page.find('data-column', 'c2');
    for (const label of ['Move column up', 'Move column down', 'Delete column']) {
      tokens(page.byLabel(label, row), label, { has: ['size-7', 'rounded'], hasNot: ['p-1', 'text-gray-300'] });
    }
    tokens(page.byLabel('Delete label', page.find('data-label', 'l1')), 'Delete label', { has: ['size-7', 'rounded', 'hover:text-cv-bad'], hasNot: ['p-1', 'text-gray-300'] });
  } finally {
    await page.close();
  }
});

it('R4-DVIS-06: every field wears the kit\'s control; a select in a row keeps its own width', async () => {
  const page = await mountSettings();
  try {
    page.openDeleteStrip();
    const kitControl = { has: ['rounded', 'border', 'border-cv-field', 'focus:ring-1', 'focus:border-brand'], hasNot: ['rounded-lg', 'border-line', 'focus:ring-2'] };
    for (const label of ['Project name', 'Project key', 'Project description', 'Project mode', 'Column title', 'Column category', 'WIP limit',
      'Move its issues to', 'New column', 'Label name', 'Label colour', 'New label', 'New label colour', 'Days before done issues are hidden']) {
      tokens(page.byLabel(label), label, kitControl);
    }
    // controlClass is w-full; in a row of controls that would give a select the whole row.
    for (const label of ['Column category', 'Label colour', 'New label colour', 'Move its issues to', 'Project key', 'WIP limit']) {
      tokens(page.byLabel(label), label, { hasNot: ['w-full'] });
    }
    tokens(page.byLabel('Project key'), 'Project key', { has: ['w-32'] });
    // A full-width field says so itself.
    for (const label of ['Project name', 'Project description', 'Project mode']) tokens(page.byLabel(label), label, { has: ['w-full'] });
  } finally {
    await page.close();
  }
});

it('R4-DVIS-06: the Details captions are the kit\'s field labels (12 px, semibold)', async () => {
  const page = await mountSettings();
  try {
    for (const caption of ['Name', 'Key', 'Description', 'Colour', 'Way of working']) {
      tokens(ownText(page, caption), `the "${caption}" caption`, { has: ['text-[12px]', 'font-semibold', 'text-cv-muted'], hasNot: ['text-xs'] });
    }
  } finally {
    await page.close();
  }
});
