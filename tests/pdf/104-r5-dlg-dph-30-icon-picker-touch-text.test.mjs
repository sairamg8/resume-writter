// R4-DPH-30 (the Header Icon picker's part): the picker's search box was text-xs — 12 px on every
// device — and iOS Safari zooms the page into any field under 16 px it focuses, so tapping "Search
// icons…" on an iPhone zoomed the page, which stayed zoomed after the picker closed. It is 16 px on a
// touch screen now (pointer-coarse:text-base, as the optimizer's statement box, 8e97533); a mouse keeps
// 12 px. The rule is under16OnTouch (104-r5-dlg-helpers.mjs), over every text field of the real picker;
// its Upload Image file input is hidden and never typed in.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { openModal, classes, textFields, under16OnTouch } from './104-r5-dlg-helpers.mjs';

before(setup);
after(teardown);

it('R4-DPH-30: the icon picker\'s search box is 16 px on a touch screen, so iOS does not zoom into it', async () => {
  const p = await openModal('/src/components/HeaderIconPickerModal.jsx', {
    fieldKey: 'email', fieldLabel: 'Email', onSelectIcon() {}, onPickIconFile() {}, onClearIcon() {},
  });
  try {
    const fields = textFields(p.all());
    const search = fields.find((el) => (el.getAttribute('placeholder') || '').startsWith('Search icons'));
    assert.ok(search, 'the search box is on the page');
    assert.deepEqual(under16OnTouch(fields), []);
    assert.ok(classes(search).includes('text-xs'), `12 px with a mouse: ${classes(search).join(' ')}`);
  } finally { await p.unmount(); }
});
