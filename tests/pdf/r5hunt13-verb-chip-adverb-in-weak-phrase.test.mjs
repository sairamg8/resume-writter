// R5-HUNT13-VERB-CHIP-ADVERB-IN-WEAK-PHRASE, in the real modal: "Worked extensively on the checkout page"
// showed no weak phrase and no Auto-Fix button, and a verb chip wrote "Architected Worked extensively on the
// checkout page". Now the banner names "Worked extensively on", Auto-Fix and the chip both replace it, and a
// weak verb with nothing to replace ("Worked as a lead on…") is left as it is with the rewrite tip, never
// given a second verb. The modal is mounted over tests/pdf/fake-dom.mjs. Fictional data only.
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

/** The optimizer open on `initialText`, with what the tests read and click. */
function open(initialText) {
  const view = mount(BulletOptimizerModal, { isOpen: true, onClose() {}, onApply() {}, initialText });
  const all = () => [...elements(view.document.body)];
  const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  return {
    unmount: () => view.unmount(),
    text: () => reactProps(all().find((el) => el.tagName === 'TEXTAREA')).value,
    banner: () => all().find((el) => el.tagName === 'SPAN' && /Detected weak phrase/.test(el.textContent)),
    tip: () => all().find((el) => el.tagName === 'P' && /Rewrite it as something you did/.test(el.textContent)),
    label,
    button: (text) => {
      const found = all().find((el) => el.tagName === 'BUTTON' && label(el) === text);
      assert.ok(found, `a "${text}" button`);
      return found;
    },
    click(text) {
      view.act(() => reactProps(this.button(text)).onClick());
    },
  };
}

describe('an adverb inside a weak phrase (R5-HUNT13-VERB-CHIP-ADVERB-IN-WEAK-PHRASE)', () => {
  const start = 'Worked extensively on the checkout page for a fictional shop';

  it('is named by the banner, and Auto-Fix replaces all of it', async () => {
    const o = open(start);
    try {
      assert.ok(o.banner(), 'the banner shows');
      assert.match(o.label(o.banner()), /“Worked extensively on”/);
      o.click('Auto-Fix');
      assert.equal(o.text(), 'Engineered the checkout page for a fictional shop');
      assert.equal(o.banner(), undefined, 'and the banner goes');
    } finally {
      await o.unmount();
    }
  });

  it('is replaced by a verb chip, not given a second verb', async () => {
    const o = open(start);
    try {
      o.click('Architected');
      assert.equal(o.text(), 'Architected the checkout page for a fictional shop');
      assert.equal(o.tip(), undefined, 'no tip');
    } finally {
      await o.unmount();
    }
  });

  it('before the phrase, stays in front of the chip\'s verb', async () => {
    const o = open('Actively assisted in the checkout redesign');
    try {
      o.click('Architected');
      assert.equal(o.text(), 'Actively architected the checkout redesign');
    } finally {
      await o.unmount();
    }
  });

  it('a weak verb with no phrase to replace is left as it is, with the rewrite tip', async () => {
    const o = open('Worked as a lead on the checkout page');
    try {
      o.click('Architected');
      assert.equal(o.text(), 'Worked as a lead on the checkout page', 'the statement is left as it was');
      assert.ok(o.tip(), 'a tip asks for a rewrite');
      assert.match(o.label(o.tip()), /starts with “Worked as”/);
    } finally {
      await o.unmount();
    }
  });
});
