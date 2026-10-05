// Typing-freeze finding 7 (the sweep of what an import reaches): a résumé card read its name's copy endings (" (Copy)", " (conflict
// copy)") with /(?: \((?:Copy|conflict copy)\))+$/, which read a name of 60 000 of them and some other text at its end
// again from each ending (five seconds on every render of the card; time squared). A name is an imported file's first
// line, so it can be any text. The endings are taken off its end one at a time now, the same split as before.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const card = async (name) => {
  const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
  const resume = { id: 'resume_x', name, updatedAt: 1, settings: {}, sections: [], personal: { name: 'Wren Calloway' } };
  return mount(ResumeCard, { resume, onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {} });
};
const textOf = (view) => [...elements(view.container)].map((el) => el.textContent).join('|');

it('a card whose name has 60 000 copy endings and other text after them is drawn in linear time', async () => {
  const start = performance.now();
  const view = await card(`${' (Copy)'.repeat(60_000)} x`);
  const ms = performance.now() - start;
  try {
    assert.ok(ms < 1000, `drawing the card took ${ms.toFixed(0)} ms`);
  } finally { await view.unmount(); }
});

it('copy endings still show as one ending with a count after three, and a name that is only endings is left whole', async () => {
  const cases = [['Harbor CV (Copy)', 'Harbor CV', ' (Copy)'], ['Harbor CV (Copy) (Copy) (Copy) (Copy)', 'Harbor CV', ' (Copy ×4)'], ['Harbor CV (conflict copy)', 'Harbor CV', ' (conflict copy)'],
    ['Harbor CV (Copy) (conflict copy)', 'Harbor CV', ' (Copy) (conflict copy)'], ['(Copy)', '(Copy)', '']];
  for (const [name, base, suffix] of cases) {
    const view = await card(name);
    try {
      const text = textOf(view);
      assert.ok(text.includes(base), `${name}: the base ${base}`);
      if (suffix) assert.ok(text.includes(suffix), `${name}: the ending ${suffix} in ${text.slice(0, 200)}`);
    } finally { await view.unmount(); }
  }
});
