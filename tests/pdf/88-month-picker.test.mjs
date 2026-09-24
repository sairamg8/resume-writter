// The month picker's two selects (Section editor → any Start/End Date). Choosing the blank 'Month'
// or 'Year' option did nothing: the picker put the stored half back, so 'Jan 2024' could not become
// the year alone (R2-108).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** What the picker holding `value` stores when its month (0) or year (1) select is set to `choice`. */
async function choose(value, which, choice) {
  const { MonthPicker } = await loadModule('/src/components/SectionEditorShared.jsx');
  const stored = [];
  const view = mount(MonthPicker, { label: 'Start Date', value, onChange: (v) => stored.push(v) });
  try {
    const selects = [...elements(view.container)].filter((el) => el.tagName === 'SELECT');
    view.act(() => reactProps(selects[which]).onChange({ target: { value: choice } }));
  } finally { await view.unmount(); }
  return stored;
}

describe('blanking one half of a date (R2-108)', () => {
  it("'Month' leaves the year alone", async () => {
    assert.deepEqual(await choose('Jan 2024', 0, ''), ['2024']);
  });
  it("'Year' leaves the month alone", async () => {
    assert.deepEqual(await choose('Jan 2024', 1, ''), ['Jan']);
  });
  it('both blank clears the date; a new month or year still replaces its half', async () => {
    assert.deepEqual(await choose('Jan', 0, ''), ['']);
    assert.deepEqual(await choose('Jan 2024', 0, 'Mar'), ['Mar 2024']);
    assert.deepEqual(await choose('Jan 2024', 1, '2020'), ['Jan 2020']);
    assert.deepEqual(await choose('', 1, '2020'), ['2020']);
  });
});
