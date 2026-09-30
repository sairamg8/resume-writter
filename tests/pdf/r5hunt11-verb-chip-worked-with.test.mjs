// R5-HUNT11-VERB-CHIP-ON-WORKED-WITH, in the real modal: the Spearheaded chip on "Worked with product
// managers to define the roadmap" wrote "Spearheaded product managers…". Now the statement is left as it
// is and a tip names the verbs that take "with"; the Partnered chip then writes "Partnered with product
// managers…" and the tip goes. The modal is mounted over tests/pdf/fake-dom.mjs. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

let BulletOptimizerModal;
before(async () => {
  patchFakeDom();
  await setup();
  ({ default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx'));
});
after(teardown);

describe('a power verb on "Worked with…" (R5-HUNT11-VERB-CHIP-ON-WORKED-WITH)', () => {
  it('keeps the people as the people worked with', async () => {
    const start = 'Worked with product managers to define the roadmap';
    const view = mount(BulletOptimizerModal, { isOpen: true, onClose() {}, onApply() {}, initialText: start });
    try {
      const all = () => [...elements(view.document.body)];
      const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();
      const area = () => all().find((el) => el.tagName === 'TEXTAREA');
      const button = (text) => all().find((el) => el.tagName === 'BUTTON' && label(el) === text);
      const tip = () => all().find((el) => el.tagName === 'P' && /Rewrite it as something you did/.test(el.textContent));
      view.act(() => reactProps(button('Spearheaded')).onClick());
      assert.equal(reactProps(area()).value, start, 'the statement is left as it was');
      assert.ok(tip(), 'a tip asks for a rewrite');
      assert.match(label(tip()), /takes “with”/);
      view.act(() => reactProps(button('Collaboration')).onClick());
      view.act(() => reactProps(button('Partnered')).onClick());
      assert.equal(reactProps(area()).value, 'Partnered with product managers to define the roadmap');
      assert.equal(tip(), undefined, 'the tip goes');
    } finally {
      await view.unmount();
    }
  });
});
