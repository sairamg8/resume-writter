// UI rebuild B14 to B16: the Projects surface (Backlog, project Settings, the board files) drawn with the
// design tokens keeps the controls the live pages offer. A page still drawn with a grey, blue, red or amber
// Tailwind colour, or with the retired ink-* / line / brand-subtle names, was not moved onto the tokens (the
// negative twin of the restyle).
// Run: node --test tests/pdf/184-ui-b14-boards.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { setup, teardown } from './harness.mjs';
import { useBacklogPage, mountBacklog } from './103-r4-backlog-page.mjs';
import { mountSettings } from './103-r4-board-settings-helpers.mjs';

const OLD_COLOUR = /(^|[\s'"`])(?:[a-z-]+:)*(?:text|bg|border|ring|fill|divide)-(?:gray|blue|red|amber|indigo)-\d/;
const RETIRED = /(^|[\s'"`])(?:[a-z-]+:)*(?:(?:text|bg|border|ring|divide)-(?:ink|ink-subtle|ink-subtlest|line|line-subtle|sunken|hovered|neutral-fill|brand-subtle)|text-brand|bg-white)(?=[\s'"`/]|$)/;
const cls = (el) => el.getAttribute?.('class') ?? '';
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const FILES = ['src/pages/Board.jsx', 'src/pages/Boards.jsx', 'src/pages/Backlog.jsx', 'src/pages/BoardSettings.jsx', 'src/pages/YourWork.jsx',
  ...readdirSync(new URL('../../src/components/board', import.meta.url)).map((f) => `src/components/board/${f}`)];

describe('the Backlog page (B15)', () => {
  useBacklogPage();
  it('still offers its toolbar controls and wears no old colour', async () => {
    const page = mountBacklog();
    try {
      assert.ok(page.button('Epic panel'), 'the Epic panel toggle');
      page.click(page.button('Epic panel'));
      assert.ok(page.byLabel('Epics'), 'the panel opens on demand');
      // The page header and the kit's buttons are restyled with their own batches: read the page's own sections and panel.
      const roots = [...page.all().filter((el) => el.getAttribute('data-section')), page.byLabel('Epics')];
      const own = roots.flatMap((r) => [r, ...page.all(r)]).filter((el) => el.tagName !== 'BUTTON');
      assert.ok(own.length > 3, 'the sections and the panel were found');
      const bad = own.filter((el) => OLD_COLOUR.test(cls(el)) || RETIRED.test(cls(el)));
      assert.deepEqual(bad.map(cls), [], 'no section or panel element carries an old colour class');
    } finally { await page.view.unmount(); }
  });
});

describe('the project Settings page (B16)', () => {
  before(setup);
  after(teardown);
  it('still offers its fields and buttons; the page wears no old colour of its own', async () => {
    const page = await mountSettings();
    try {
      for (const label of ['Project name', 'Project key', 'Project description', 'New column', 'New label']) assert.ok(page.byLabel(label), label);
      for (const text of ['Save key', 'Delete project']) assert.ok(page.button(text), text);
      assert.ok(page.byLabel('Delete column', page.find('data-column', 'c1')), 'a column can be deleted');
      // The kit's own buttons (src/components/ui) are restyled elsewhere: only the page's own sections are read.
      const own = page.all().filter((el) => el.tagName === 'SECTION' || el.tagName === 'P' || el.tagName === 'H2');
      const bad = own.filter((el) => OLD_COLOUR.test(cls(el)) || RETIRED.test(cls(el)));
      assert.deepEqual(bad.map(cls), [], 'no section, line or heading carries an old colour class');
    } finally { await page.close(); }
  });
});

describe('the board, project and Your work sources (B14)', () => {
  it('hard-coded controls are still in the source', () => {
    assert.ok(src('src/pages/Boards.jsx').includes('Create project'), 'Create project');
    assert.ok(src('src/pages/Backlog.jsx').includes('Create sprint'), 'Create sprint');
    assert.ok(src('src/pages/Backlog.jsx').includes('Start sprint'), 'Start sprint');
    assert.ok(src('src/pages/BoardSettings.jsx').includes('Delete project'), 'Delete project');
    assert.ok(src('src/pages/BoardSettings.jsx').includes('Save key'), 'Save key');
  });
  it('negative twin: no source line carries an old colour or a retired token name', () => {
    for (const f of FILES) {
      const offenders = src(f).split('\n').filter((l) => OLD_COLOUR.test(l) || RETIRED.test(l));
      assert.deepEqual(offenders, [], `${f} still carries old colour classes`);
    }
  });
});
