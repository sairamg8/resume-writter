// R5-HUNT8-POINTS-INVALID-TEXT-CLEARS: Story points (PointsInput, a type=number field). Text the
// browser cannot read as a number ('2,5' in Firefox or Safari, '1e' or a lone '-' in Chrome) is
// reported as value '' with validity.badInput set, and React sends no further change while it stays
// ''. Leaving the field then took that '' for a clear and erased the issue's points. Unreadable text
// now keeps the saved points; a field really emptied still clears them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let PointsInput;
before(async () => {
  await setup();
  patchFakeDom();
  ({ PointsInput } = await loadModule('/src/components/board/IssueFields.jsx'));
});
after(teardown);

function points(value) {
  const saved = [];
  const view = mount(PointsInput, { value, onChange: (n) => saved.push(n) });
  const input = () => [...elements(view.container)].find((el) => el.tagName === 'INPUT');
  // What the browser hands the handlers: the field's value, and whether its text was unreadable.
  const target = (v, badInput) => ({ value: v, validity: { badInput } });
  const fire = (name, t, extra = {}) => view.act(() => reactProps(input())[name](ev({ target: t, currentTarget: t, ...extra })));
  return {
    saved,
    value: () => reactProps(input()).value,
    type: (v, badInput = false) => fire('onChange', target(v, badInput)),
    blur: (v, badInput = false) => fire('onBlur', target(v, badInput)),
    enter: (v, badInput = false) => fire('onKeyDown', target(v, badInput), { key: 'Enter' }),
    done: () => view.unmount(),
  };
}

describe('Story points keep their value on unreadable text (R5-HUNT8-POINTS-INVALID-TEXT-CLEARS)', () => {
  it('typing 2,5 (reported as "" with badInput) and leaving keeps 3', async () => {
    const p = points(3);
    try {
      p.type('', true);
      p.blur('', true);
      assert.deepEqual(p.saved, [], 'the unreadable entry erased the story points');
      assert.equal(p.value(), 3, 'the field shows the saved points again');
    } finally { await p.done(); }
  });

  it('typing 1e and pressing Enter keeps 3', async () => {
    const p = points(3);
    try {
      p.type('', true);
      p.enter('', true);
      assert.deepEqual(p.saved, [], 'Enter on an unreadable entry erased the story points');
    } finally { await p.done(); }
  });

  it('a field really emptied still clears the points; a valid number still saves', async () => {
    const p = points(3);
    try {
      p.type('', true); // unreadable first, then all of it deleted: still '' but readable now
      p.blur('', false);
      assert.deepEqual(p.saved, [null]);
    } finally { await p.done(); }
    const q = points(3);
    try {
      q.type('2.5');
      q.blur('2.5');
      assert.deepEqual(q.saved, [2.5]);
    } finally { await q.done(); }
  });
});
