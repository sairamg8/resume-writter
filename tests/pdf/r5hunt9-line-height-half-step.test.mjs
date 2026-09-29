// R5-HUNT9-LINE-HEIGHT-STEP-SKIPS: Design → Spacing → Line Height (NumberRow, step 0.1). The app's own
// presets store half steps (Spacious 1.65, 1-Page Fit 1.35 / 1.25), and − / + rounded current ± 0.1 to
// the nearest tenth, so from 1.65 + gave 1.8 and − gave 1.5, from 1.35 + gave 1.5. A typed 1.35 / 1.65
// was stored as 1.4 / 1.6. Now − / + land on the next tenth below / above (as the header-spacing
// stepper does) and a typed value keeps the box's two decimals.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

async function row(value, step = 0.1, min = 1, max = 3) {
  const { NumberRow } = await loadModule('/src/components/DesignPanelShared.jsx');
  const writes = [];
  const view = mount(NumberRow, { label: 'Line Height', value, min, max, step, onChange: (v) => writes.push(v) });
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

describe('Line Height steps one tenth from a half step (R5-HUNT9-LINE-HEIGHT-STEP-SKIPS)', () => {
  it('− / + from 1.65, 1.35 and 1.25 land on the neighbouring tenth', async () => {
    const cases = [[1.65, 'plus', 1.7], [1.65, 'minus', 1.6], [1.35, 'plus', 1.4], [1.35, 'minus', 1.3],
      [1.25, 'plus', 1.3], [1.25, 'minus', 1.2], [1.5, 'plus', 1.6], [1.5, 'minus', 1.4]];
    for (const [start, press, want] of cases) {
      const r = await row(start);
      try {
        r[press]();
        assert.deepEqual(r.writes, [want], `${press} from ${start}`);
      } finally { await r.done(); }
    }
  });

  it('typing 1.35 / 1.65 stores exactly that value', async () => {
    for (const text of ['1.35', '1.65', '1.25', '1.4']) {
      const r = await row(1.5);
      try {
        r.typeEnter(text);
        assert.deepEqual(r.writes, [Number(text)], `typed ${text}`);
      } finally { await r.done(); }
    }
  });

  it('a whole-number row (margins) still steps and stores whole numbers', async () => {
    const r = await row(14, 1, 5, 40);
    try {
      r.plus();
      r.minus();
      assert.deepEqual(r.writes, [15, 13]);
    } finally { await r.done(); }
    const t = await row(14, 1, 5, 40);
    try {
      t.typeEnter('16.4');
      assert.deepEqual(t.writes, [16]);
    } finally { await t.done(); }
  });
});
