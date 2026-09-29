// R5-HUNT6-LINE-HEIGHT-FLOAT, saved data: before the fix, pressing Line Height's − / + stored values
// such as 1.4000000000000001, and a résumé saved then still stores it. Clicking into the Line Height
// box showed "1.4000000000000001" — the bug the user saw — until the next − / + or typed value. The
// focused box now shows 1.4; a template's 1.35 still shows 1.35, and clicking in and out writes nothing.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

async function box(value) {
  const { NumberRow } = await loadModule('/src/components/DesignPanelShared.jsx');
  const writes = [];
  const view = mount(NumberRow, { label: 'Line Height', value, min: 1, max: 3, step: 0.1, onChange: (v) => writes.push(v) });
  const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT');
  input.select = () => {};
  const fire = (name) => view.act(() => reactProps(input)[name]({ target: input, currentTarget: input, preventDefault() {} }));
  return {
    writes,
    focus: () => { fire('onFocus'); return input.value; },
    leave: () => fire('onBlur'),
    done: () => view.unmount(),
  };
}

describe('a Line Height saved with float error shows cleanly in the focused box (R5-HUNT6-LINE-HEIGHT-FLOAT)', () => {
  it('1.4000000000000001, 1.2000000000000002, 2.9000000000000004 show 1.4, 1.2, 2.9 when clicked into', async () => {
    for (const [saved, want] of [[1.4000000000000001, '1.4'], [1.2000000000000002, '1.2'], [2.9000000000000004, '2.9'], [1.3000000000000003, '1.3']]) {
      const b = await box(saved);
      try {
        assert.equal(b.focus(), want, `saved ${saved}`);
        b.leave();
        assert.deepEqual(b.writes, [], `clicking in and out of ${saved} writes nothing`);
      } finally { await b.done(); }
    }
  });

  it('a template\'s 1.35 and 1.15 still show every digit when clicked into', async () => {
    for (const [saved, want] of [[1.35, '1.35'], [1.15, '1.15'], [1.5, '1.5']]) {
      const b = await box(saved);
      try {
        assert.equal(b.focus(), want);
        b.leave();
        assert.deepEqual(b.writes, []);
      } finally { await b.done(); }
    }
  });
});
