// R4-ED-05: Personal Info → Header Customization → Header Bottom Border → Thickness. The box between
// − and + was a number input controlled by `s.headerBorderWidth || 2` that ignored an empty or
// non-number value, so React put '2' straight back: it could not be emptied, typing 5 after the 2 gave
// 25 (stored as 12, the most), and '0' snapped back. Now it is typed as the other stepper boxes are
// (useTypedNumber, R2-032): the box holds what is typed, and the value is written once, on Enter or on
// leaving the box, clamped to 1–12 pt.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const P = { name: 'Alex Johnson', title: 'Senior Engineer', email: 'alex@example.com', phone: '+1 555 0100' };

/**
 * Header Customization on Classic with the rule on and `width` stored, its Thickness box driven as a
 * browser does. After each event the panel renders again with the settings as stored, as the store
 * does — so a controlled box shows what React puts back, not only what was typed.
 */
async function thickness(width) {
  const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
  const writes = [];
  let s = { showHeaderBorder: true, headerBorderWidth: width };
  const props = () => ({
    s, personal: P, template: 'classic', templateLabel: 'Classic', open: true, onToggle() {},
    set: (k, v) => { if (k === 'headerBorderWidth') writes.push(v); s = { ...s, [k]: v }; },
    clear() {},
  });
  const view = mount(HeaderCustomization, props());
  const box = () => [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Header border thickness (pt)');
  assert.ok(box(), 'the Thickness box is on the panel');
  const fire = (name, extra = {}) => {
    const input = box();
    input.blur = () => reactProps(input).onBlur?.({ target: input, currentTarget: input });
    view.act(() => reactProps(input)[name]?.({ target: input, currentTarget: input, preventDefault() {}, ...extra }));
    view.update(props());
  };
  return {
    writes,
    shown: () => box().value,
    focus: () => fire('onFocus'),
    type: (text) => { box().value = text; fire('onChange'); },
    key: (key) => fire('onKeyDown', { key }),
    leave: () => fire('onBlur'),
    done: () => view.unmount(),
  };
}

describe('Header Bottom Border → Thickness can be typed (R4-ED-05)', () => {
  it('the box can be emptied, and a value typed into it is written once on Enter', async () => {
    const f = await thickness(2);
    try {
      assert.equal(f.shown(), '2');
      f.focus();
      f.type('');
      assert.equal(f.shown(), '', 'an emptied box stays empty while it is being typed in');
      f.type('5');
      assert.equal(f.shown(), '5');
      assert.deepEqual(f.writes, [], 'nothing is written while typing');
      f.key('Enter');
      assert.deepEqual(f.writes, [5]);
      assert.equal(f.shown(), '5');
    } finally { await f.done(); }
  });

  it('typing and leaving writes the value, clamped to 1–12; text that is no number writes nothing', async () => {
    for (const [typed, want] of [['7', [7]], ['0', [1]], ['25', [12]], ['abc', []], ['', []]]) {
      const f = await thickness(2);
      try {
        f.focus();
        f.type(typed);
        assert.deepEqual(f.writes, [], `typed '${typed}': nothing is written until the box is left`);
        f.leave();
        assert.deepEqual(f.writes, want, `typed '${typed}'`);
      } finally { await f.done(); }
    }
  });

  it('clicking in and out, or Escape, writes nothing', async () => {
    for (const how of ['leave', 'Escape']) {
      const f = await thickness(3);
      try {
        f.focus();
        if (how === 'Escape') { f.type('9'); f.key('Escape'); } else f.leave();
        assert.deepEqual(f.writes, [], how);
        assert.equal(f.shown(), '3', how);
      } finally { await f.done(); }
    }
  });
});
