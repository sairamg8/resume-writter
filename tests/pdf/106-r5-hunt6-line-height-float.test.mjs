// R5-HUNT6-LINE-HEIGHT-FLOAT: Design → Spacing → Line Height (NumberRow, step 0.1) stored float
// error. Pressing − from 1.5 stored 1.4000000000000001 (Math.round(14) * 0.1), clicking into the box
// showed that long number, and typing 1.4 + Enter stored it again, so a clean 1.4 could not be saved.
// Now − / + and a typed value store the value rounded to the step's decimals: 1.4, 1.2, 2.9.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

async function row(value) {
  const { NumberRow } = await loadModule('/src/components/DesignPanelShared.jsx');
  const writes = [];
  const view = mount(NumberRow, { label: 'Line Height', value, min: 1, max: 3, step: 0.1, onChange: (v) => writes.push(v) });
  const all = [...elements(view.container)];
  const input = all.find((el) => el.tagName === 'INPUT');
  const buttons = all.filter((el) => el.tagName === 'BUTTON');
  const minus = buttons.find((b) => b.textContent === '−');
  const plus = buttons.find((b) => b.textContent === '+');
  input.select = () => {};
  input.blur = () => reactProps(input).onBlur({ target: input, currentTarget: input });
  const fire = (el, name, extra = {}) => view.act(() => reactProps(el)[name]({ target: el, currentTarget: el, preventDefault() {}, ...extra }));
  return {
    writes,
    minus: () => fire(minus, 'onClick'),
    plus: () => fire(plus, 'onClick'),
    typeEnter: (text) => { fire(input, 'onFocus'); input.value = text; fire(input, 'onChange'); fire(input, 'onKeyDown', { key: 'Enter' }); },
    done: () => view.unmount(),
  };
}

describe('Line Height stores clean one-decimal values (R5-HUNT6-LINE-HEIGHT-FLOAT)', () => {
  it('− from 1.5 stores 1.4, + from 1.8 stores 1.9, + from 2.8 stores 2.9', async () => {
    for (const [start, press, want] of [[1.5, 'minus', 1.4], [1.1, 'plus', 1.2], [1.8, 'plus', 1.9], [2.8, 'plus', 2.9], [2.4, 'minus', 2.3]]) {
      const r = await row(start);
      try {
        r[press]();
        assert.deepEqual(r.writes, [want], `${press} from ${start}`);
      } finally { await r.done(); }
    }
  });

  it('typing 1.4, 1.7, 2.4 and pressing Enter stores exactly that number', async () => {
    for (const text of ['1.4', '1.7', '2.4', '2.8', '1.2']) {
      const r = await row(1.5);
      try {
        r.typeEnter(text);
        assert.deepEqual(r.writes, [Number(text)], `typed ${text}`);
        assert.equal(String(r.writes[0]), text);
      } finally { await r.done(); }
    }
  });
});
