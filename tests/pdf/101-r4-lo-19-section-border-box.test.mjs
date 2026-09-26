// R4-LO-19: Design → Section Headings → Border thickness. The box between − and + was a number input
// controlled by the stored thickness that ignored an empty value, so React put the number straight
// back: it could not be emptied, and typing 5 after the 2 gave 25, stored as the most (8; 10 pt under
// Left bar). The R4-ED-05 bug, in the Design panel. Now it is typed as the other stepper boxes are
// (useTypedNumber, R2-032): the box holds what is typed, and the value is written once, on Enter or on
// leaving the box, clamped to the style's range.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/**
 * Section Headings on Classic in `headingStyle` with `width` stored, its thickness box driven as a
 * browser does. After each event the panel renders again with the settings as stored, as the store
 * does — so a controlled box shows what React puts back, not only what was typed.
 */
async function thickness(width, headingStyle = 'ruled') {
  const { HeadingControls } = await loadModule('/src/components/DesignPanelHeadings.jsx');
  const writes = [];
  let settings = { headingStyle, sectionBorderWidth: width };
  const props = () => ({
    settings, template: 'classic',
    updateSetting: (k, v) => { if (k === 'sectionBorderWidth') writes.push(v); settings = { ...settings, [k]: v }; },
  });
  const view = mount(HeadingControls, props());
  const box = () => [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Section border thickness (pt)');
  assert.ok(box(), 'the thickness box is on the panel');
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

describe('Section Headings → Border thickness can be typed (R4-LO-19)', () => {
  it('the box can be emptied, and 5 typed after the 2 is written once, on Enter, as 5', async () => {
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

  it('typing and leaving writes the value, clamped to 1–8 pt; text that is no number writes nothing', async () => {
    for (const [typed, want] of [['7', [7]], ['0', [1]], ['25', [8]], ['abc', []], ['', []]]) {
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

  it('under Left bar the box is in the pt the bar prints: 6 typed stores 4, within 3–10 pt', async () => {
    for (const [typed, want] of [['6', [4]], ['2', [1]], ['12', [8]]]) {
      const f = await thickness(2, 'leftbar');
      try {
        assert.equal(f.shown(), '4', 'a stored 2 prints a 4 pt bar');
        f.focus();
        f.type('');
        assert.equal(f.shown(), '');
        f.type(typed);
        f.key('Enter');
        assert.deepEqual(f.writes, want, `typed '${typed}'`);
      } finally { await f.done(); }
    }
  });

  it('clicking in and out, or Escape, writes nothing', async () => {
    for (const how of ['leave', 'Escape']) {
      const f = await thickness(3);
      try {
        f.focus();
        if (how === 'Escape') { f.type('6'); f.key('Escape'); } else f.leave();
        assert.deepEqual(f.writes, [], how);
        assert.equal(f.shown(), '3', how);
      } finally { await f.done(); }
    }
  });
});
