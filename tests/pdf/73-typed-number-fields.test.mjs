// A stepper's typed box — Header spacing (GapStepper) and Design's Size / Spacing rows (SizeRow,
// NumberRow) — rewrote its value when the user only clicked into it and left, and Escape saved what
// had been typed (R2-032). Focus + blur committed the box's rounded text: a template's 13.33 px
// Photo ↔ Text became a stored 13 (the PDF's 10 pt printed 9.75 pt, and the row turned "set" with a
// ↺), Name ↔ Title's 1.33 px became 1, Contact Icons with nothing stored became a stored 11, Line
// Height 1.5 became 1.5000000000000002. Escape set the draft aside and then blurred, and the blur —
// synchronous in a browser, with the typed text still in the box — committed it. Enter committed
// twice. Now a box commits once, on Enter or on leaving it, and only text that differs from what it
// showed; Escape commits nothing.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { PNG_2X2 } from './extractors.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const P = {
  name: 'Alex Johnson', title: 'Senior Engineer', photo: PNG_2X2,
  email: 'alex@example.com', phone: '+1 555 0100', location: 'San Francisco, CA', linkedin: 'linkedin.com/in/alexj',
};

/**
 * Mount `component` and drive its one text box as a browser does: focus selects, typing changes the
 * box's text, and blur() inside a key handler runs the blur handler at once — with the text still in
 * the box and the handlers of the render that was on screen. Returns what onChange received.
 */
function field(component, props) {
  const writes = [];
  const view = mount(component, { ...props, onChange: (v) => writes.push(v) });
  const box = () => [...elements(view.container)].find((el) => el.tagName === 'INPUT');
  const input = box();
  input.select = () => {};
  input.blur = () => reactProps(input).onBlur({ target: input, currentTarget: input });
  const fire = (name, extra = {}) => view.act(() => reactProps(input)[name]({ target: input, currentTarget: input, preventDefault() {}, ...extra }));
  return {
    writes,
    shown: () => input.value,
    focus: () => fire('onFocus'),
    type: (text) => { input.value = text; fire('onChange'); },
    key: (key) => fire('onKeyDown', { key }),
    leave: () => fire('onBlur'),
    done: () => view.unmount(),
  };
}

async function steppers() {
  const { GapStepper } = await loadModule('/src/components/HeaderSpacingControls.jsx');
  const { SizeRow, NumberRow } = await loadModule('/src/components/DesignPanelShared.jsx');
  const { headerGapRows } = await loadModule('/src/utils/headerSpacingRows.js');
  const gap = (row) => [GapStepper, { row, onReset: () => {} }, row.key];
  return [
    // Classic with a photo, a title and contacts: every row, each unset, several of them fractional px.
    ...headerGapRows('classic', {}, P).map(gap),
    ...headerGapRows('modern', {}, P).map(gap),
    [SizeRow, { label: 'Contact Icons', value: 11, min: 6, max: 20 }, 'SizeRow Contact Icons'],
    [SizeRow, { label: 'Full Name', value: 18.5, min: 10, max: 40 }, 'SizeRow Full Name 18.5'],
    [NumberRow, { label: 'Line Height', value: 1.5, min: 1, max: 3, step: 0.1 }, 'NumberRow Line Height'],
    [NumberRow, { label: 'Line Height', value: 1.15, min: 1, max: 3, step: 0.1 }, 'NumberRow Line Height 1.15'],
    [NumberRow, { label: 'Between Sections', value: 16, min: 0, max: 60, step: 1, unit: 'px' }, 'NumberRow Between Sections'],
  ];
}

describe('a stepper box writes only what the user typed (R2-032)', () => {
  it('Classic\'s six Header spacing rows are all offered (with a photo, a title and contacts)', async () => {
    const { headerGapRows } = await loadModule('/src/utils/headerSpacingRows.js');
    assert.deepEqual(headerGapRows('classic', {}, P).map((r) => r.key),
      ['photoTextGap', 'nameTitleGap', 'titleContactsGap', 'iconTextGap', 'contactGapX', 'contactGapY']);
  });

  it('clicking into a box and leaving it writes nothing', async () => {
    const wrote = [];
    for (const [component, props, name] of await steppers()) {
      const f = field(component, props);
      try {
        f.focus();
        f.leave();
        if (f.writes.length) wrote.push(`${name}: ${JSON.stringify(f.writes)}`);
      } finally { await f.done(); }
    }
    assert.deepEqual(wrote, []);
  });

  it('tabbing through (focus, then Tab away) and a second visit write nothing either', async () => {
    const wrote = [];
    for (const [component, props, name] of await steppers()) {
      const f = field(component, props);
      try {
        for (let i = 0; i < 2; i += 1) { f.focus(); f.key('Tab'); f.leave(); }
        if (f.writes.length) wrote.push(`${name}: ${JSON.stringify(f.writes)}`);
      } finally { await f.done(); }
    }
    assert.deepEqual(wrote, []);
  });

  it('Escape drops what was typed and shows the value again', async () => {
    const wrote = [];
    for (const [component, props, name] of await steppers()) {
      const f = field(component, props);
      try {
        const before = f.shown();
        f.focus();
        f.type('3');
        f.key('Escape');
        if (f.writes.length) wrote.push(`${name}: ${JSON.stringify(f.writes)}`);
        assert.equal(f.shown(), before, `${name}: the box shows the value again`);
      } finally { await f.done(); }
    }
    assert.deepEqual(wrote, []);
  });

  it('Enter writes the typed value once; so does typing and leaving', async () => {
    const got = [];
    for (const [component, props, name] of await steppers()) {
      for (const how of ['Enter', 'leave']) {
        const f = field(component, props);
        try {
          f.focus();
          f.type('3');
          if (how === 'Enter') f.key('Enter'); else f.leave();
          got.push(`${name} ${how}: ${f.writes.length}`);
        } finally { await f.done(); }
      }
    }
    assert.deepEqual(got.filter((g) => !g.endsWith(': 1')), [], got.join('\n'));
  });

  it('what is written is the typed value, clamped and rounded as before', async () => {
    const { GapStepper } = await loadModule('/src/components/HeaderSpacingControls.jsx');
    const { NumberRow } = await loadModule('/src/components/DesignPanelShared.jsx');
    const row = { key: 'nameTitleGap', label: 'Name ↔ Title', name: 'Name to title spacing', valuePx: 4 / 3, set: false, min: 0, max: 40 };
    const typed = async (component, props, text, how = 'Enter') => {
      const f = field(component, props);
      try { f.focus(); f.type(text); if (how === 'Enter') f.key('Enter'); else f.leave(); return f.writes; } finally { await f.done(); }
    };
    assert.deepEqual(await typed(GapStepper, { row, onReset() {} }, '30'), [30]);
    assert.deepEqual(await typed(GapStepper, { row, onReset() {} }, '7,6', 'leave'), [8]);
    assert.deepEqual(await typed(GapStepper, { row, onReset() {} }, '999'), [40]);
    assert.deepEqual(await typed(GapStepper, { row, onReset() {} }, 'abc', 'leave'), []);
    assert.deepEqual(await typed(NumberRow, { label: 'Top / Bottom margin', value: 14, min: 5, max: 30, unit: 'mm' }, '20'), [20]);
  });

  it('the arrow keys still step a Header spacing gap by a whole pixel', async () => {
    const { GapStepper } = await loadModule('/src/components/HeaderSpacingControls.jsx');
    const row = { key: 'photoTextGap', label: 'Photo ↔ Text', name: 'Photo to text spacing', valuePx: 40 / 3, set: false, min: 0, max: 60 };
    const f = field(GapStepper, { row, onReset() {} });
    try {
      f.focus();
      f.key('ArrowUp');
      f.key('ArrowDown');
      f.leave();
      assert.deepEqual(f.writes, [14, 13]);
    } finally { await f.done(); }
  });
});
