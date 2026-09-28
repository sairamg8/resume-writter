// R4-DPH-17: in Project settings, the strip that deletes a column holding issues ("Its N issues move
// to [column]") stays inside its card on a phone. The select was as wide as its longest column
// title (titles run to 255 characters) and its label did not wrap, so at 375 px a long title ran
// the select past the strip and the card. Now the label wraps (flex-wrap) and both it and the
// select may shrink (min-w-0) to the strip's width (max-w-full); the select keeps its own width
// otherwise (no w-full). The real page is mounted (fake DOM, no layout): its class tokens are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { mountSettings, classes } from './103-r4-board-settings-helpers.mjs';

before(setup);
after(teardown);

it('R4-DPH-17: the "move its issues to" select and its label shrink and wrap to the strip', async () => {
  const page = await mountSettings();
  try {
    page.openDeleteStrip();
    const select = page.byLabel('Move its issues to', page.find('data-column', 'c1'));
    assert.ok(select, 'To Do holds an issue: the strip asks where it goes');
    const label = select.parentNode;
    assert.equal(label.tagName, 'LABEL');
    for (const t of ['min-w-0', 'max-w-full']) assert.ok(classes(select).includes(t), `the select: ${t} (class="${select.getAttribute('class')}")`);
    assert.ok(!classes(select).includes('w-full'), 'the select keeps its own width when it fits');
    for (const t of ['flex', 'flex-wrap', 'min-w-0', 'max-w-full']) assert.ok(classes(label).includes(t), `its label: ${t} (class="${label.getAttribute('class')}")`);
  } finally {
    await page.close();
  }
});
