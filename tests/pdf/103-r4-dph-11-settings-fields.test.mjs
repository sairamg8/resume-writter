// R4-DPH-11 (Project settings): every field of a project's Settings page is 16 px on a touch
// screen. iOS Safari zooms the page into any field it focuses whose text is smaller than 16 px, and
// every input, select and textarea here was 14 px (the "Move its issues to" select 12 px), so each
// tap on one zoomed the page. They now wear the kit's controlClass, which says
// pointer-coarse:text-base, as 81-job-inputs-touch-text.test.mjs asks of the job tracker's fields.
// The real page is mounted (fake DOM, no layout): its class tokens are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { mountSettings } from './103-r4-board-settings-helpers.mjs';

before(setup);
after(teardown);

const TOUCH_16 = /(^|\s)pointer-coarse:text-base(\s|$)/;

it('R4-DPH-11: every input, select and textarea on Project settings is 16 px on a touch screen', async () => {
  const page = await mountSettings();
  try {
    page.openDeleteStrip(); // To Do holds an issue: its strip asks where it goes, with a select
    const fields = page.all(page.cards()).filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && el.getAttribute('type') !== 'checkbox');
    const names = fields.map((el) => el.getAttribute('aria-label'));
    for (const label of ['Project name', 'Project key', 'Project description', 'Project mode', 'Column title', 'Column category', 'WIP limit',
      'Move its issues to', 'New column', 'Label name', 'Label colour', 'New label', 'New label colour', 'Days before done issues are hidden']) {
      assert.ok(names.includes(label), `the "${label}" field is among those checked`);
    }
    assert.equal(fields.length, 22, 'the details (4), three columns (9), the strip (1), New column (1), two labels (4), New label (2), the days (1)');
    for (const el of fields) {
      assert.match(el.getAttribute('class') ?? '', TOUCH_16, `${el.getAttribute('aria-label')}: 16 px on touch (class="${el.getAttribute('class')}")`);
    }
  } finally {
    await page.close();
  }
});
