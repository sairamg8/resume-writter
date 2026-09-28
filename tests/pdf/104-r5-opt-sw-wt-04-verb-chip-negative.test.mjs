// R4-SW-WT-04: a power-verb chip on a statement opening with a helper verb or a negation wrote the verb in
// front of it — "Did not miss a release deadline" became "Spearheaded did not miss a release deadline",
// "Was promoted to lead" "Spearheaded was promoted to lead", "Never missed…" "Spearheaded Never missed…".
// Dropping the words would change what the statement says, so the chip now leaves such a statement as it
// is, and the optimizer shows a tip asking for a rewrite as something the user did. "Did" as a main verb
// ("Did the quarterly audit") is still a weak phrase the chip replaces, and every other opening keeps its
// behaviour ("Spearheaded in 2023, built…", R4-LO-13). The real modal is mounted over tests/pdf/fake-dom.mjs
// and searched from <body> (the kit Dialog's portal). Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

let insertActionVerb;
let BulletOptimizerModal;
before(async () => {
  patchFakeDom();
  await setup();
  ({ insertActionVerb } = await loadModule('/src/utils/bulletOptimizer.js'));
  ({ default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx'));
});
after(teardown);

describe('a power verb never goes before a helper verb or a negation (R4-SW-WT-04)', () => {
  it('leaves such a statement as it is', () => {
    for (const s of [
      'Did not miss a release deadline in 3 years',
      "Didn't miss a release deadline in 3 years",
      'Was promoted to lead within 18 months',
      'Has shipped 40 releases since 2021',
      'Never missed a release deadline',
      '• Were ranked first of 12 teams',
    ]) {
      const out = insertActionVerb(s, 'Spearheaded');
      assert.doesNotMatch(out, /Spearheaded/, `"${s}" became "${out}"`);
      assert.equal(out, s);
    }
  });

  it('every other opening keeps its behaviour', () => {
    assert.equal(insertActionVerb('Did the quarterly audit for 12 teams', 'Spearheaded'), 'Spearheaded the quarterly audit for 12 teams');
    assert.equal(insertActionVerb('In 2023, built a billing API', 'Spearheaded'), 'Spearheaded in 2023, built a billing API');
    assert.equal(insertActionVerb('Built a billing API', 'Spearheaded'), 'Spearheaded a billing API');
    assert.equal(insertActionVerb('Was responsible for the payments team', 'Spearheaded'), 'Spearheaded the payments team');
    assert.equal(insertActionVerb('Docker images for 12 services', 'Built'), 'Built Docker images for 12 services');
  });

  it('the optimizer leaves the statement alone and asks for a rewrite, until it is rewritten', async () => {
    const view = mount(BulletOptimizerModal, { isOpen: true, onClose() {}, onApply() {}, initialText: 'Did not miss a release deadline' });
    try {
      const all = () => [...elements(view.document.body)];
      const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();
      const area = () => all().find((el) => el.tagName === 'TEXTAREA');
      const chip = (verb) => all().find((el) => el.tagName === 'BUTTON' && label(el) === verb);
      const tip = () => all().find((el) => el.tagName === 'P' && /Rewrite it as something you did/.test(el.textContent));
      assert.equal(tip(), undefined, 'no tip before a verb is picked');
      view.act(() => reactProps(chip('Architected')).onClick());
      assert.equal(reactProps(area()).value, 'Did not miss a release deadline', 'the statement is left as it was');
      assert.ok(tip(), 'a tip asks for a rewrite');
      assert.match(label(tip()), /starts with “Did not”/);
      view.act(() => reactProps(area()).onChange({ target: { value: 'Delivered every release on time' } }));
      assert.equal(tip(), undefined, 'rewritten, the tip goes');
      view.act(() => reactProps(chip('Architected')).onClick());
      assert.equal(reactProps(area()).value, 'Architected every release on time', 'and the chip works again');
    } finally {
      await view.unmount();
    }
  });
});
