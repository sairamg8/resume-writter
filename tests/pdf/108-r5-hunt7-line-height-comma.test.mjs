// R5-HUNT7-LINE-HEIGHT-COMMA: Design → Spacing → Line Height (NumberRow, step 0.1). Typing a decimal
// comma ('1,6', as anyone with a comma decimal separator does) and pressing Enter stored 1: parseFloat
// stops at the comma, and the clamp to the minimum kept 1, so the whole résumé was squeezed with no
// message. A decimal comma now reads as a point, as the header-spacing box (GapStepper) already did.
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
  const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT');
  input.select = () => {};
  input.blur = () => reactProps(input).onBlur({ target: input, currentTarget: input });
  const fire = (el, name, extra = {}) => view.act(() => reactProps(el)[name]({ target: el, currentTarget: el, preventDefault() {}, ...extra }));
  return {
    writes,
    typeEnter: (text) => { fire(input, 'onFocus'); input.value = text; fire(input, 'onChange'); fire(input, 'onKeyDown', { key: 'Enter' }); },
    done: () => view.unmount(),
  };
}

describe('Line Height accepts a decimal comma (R5-HUNT7-LINE-HEIGHT-COMMA)', () => {
  it('typing 1,6 / 2,4 and pressing Enter stores 1.6 / 2.4', async () => {
    for (const [text, want] of [['1,6', 1.6], ['2,4', 2.4], ['1.6', 1.6]]) {
      const r = await row(1.5);
      try {
        r.typeEnter(text);
        assert.deepEqual(r.writes, [want], `typed ${text}`);
      } finally { await r.done(); }
    }
  });
});
