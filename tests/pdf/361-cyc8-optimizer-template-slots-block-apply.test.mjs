// The Bullet Optimizer's Google X-Y-Z templates are full of slots ("[X]%", "[feature/system]"), and Apply wrote a template with its slots
// still in it straight into the résumé. Apply is now off, with a one-line note naming the slots, while any slot of a template remains
// in the text; typing over them turns it on. A bracket the user wrote themselves ("[Confidential]") is their text and blocks nothing.
// The real modal over tests/pdf/fake-dom.mjs, as tests/pdf/102-r4-dux-22-template-undo.test.mjs mounts it; fictional text only.
// Run: node --test tests/pdf/361-cyc8-optimizer-template-slots-block-apply.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

let BulletOptimizerModal;
let TEMPLATES;
let FEATURE;
before(async () => {
  patchFakeDom();
  await setup();
  ({ default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx'));
  ({ GOOGLE_XYZ_TEMPLATES: TEMPLATES } = await loadModule('/src/utils/bulletOptimizer.js'));
  FEATURE = TEMPLATES.find((t) => t.label === 'Feature / Performance');
});
after(teardown);

const OWN = 'Rebuilt the Quillmark invoicing service for 40 regional shops';
// "Engineered [feature/system], reducing [latency/downtime] by [X]% and supporting [Y]+ daily active users."

function optimizer(initialText = OWN) {
  const applied = [];
  const view = mount(BulletOptimizerModal, { isOpen: true, onClose() {}, onApply: (text) => applied.push(text), initialText });
  const all = () => [...elements(view.document.body)];
  const buttons = () => all().filter((el) => el.tagName === 'BUTTON');
  const textarea = () => all().find((el) => el.tagName === 'TEXTAREA');
  return {
    view,
    applied,
    apply: () => buttons().find((el) => el.textContent.includes('Apply to Resume')),
    note: () => all().find((el) => el.tagName === 'P' && el.textContent.startsWith('Type over')),
    pickTemplate() {
      const card = buttons().find((el) => el.textContent.includes(FEATURE.template));
      assert.ok(card, 'the Feature / Performance card');
      view.act(() => reactProps(card).onClick());
    },
    type(value) { view.act(() => reactProps(textarea()).onChange({ target: { value } })); },
    clickApply() { view.act(() => reactProps(this.apply()).onClick()); },
  };
}

it('a template picked and not filled in cannot be applied, and says which slots are left', async () => {
  const o = optimizer();
  try {
    assert.ok(!reactProps(o.apply()).disabled, 'the statement as it opened can be applied');
    assert.equal(o.note(), undefined, 'and has no note');
    o.pickTemplate();
    assert.ok(reactProps(o.apply()).disabled === true, 'Apply is off while the slots are in the text');
    assert.ok(o.note(), 'a note names them');
    for (const slot of ['[feature/system]', '[latency/downtime]', '[X]', '[Y]']) assert.ok(o.note().textContent.includes(slot), `${slot} is named`);
    o.clickApply();
    assert.deepEqual(o.applied, [], 'nothing reaches the résumé');
  } finally {
    await o.view.unmount();
  }
});

it('typing over some of the slots keeps Apply off until the last is gone, then it applies the text', async () => {
  const o = optimizer();
  try {
    o.pickTemplate();
    o.type('Engineered the billing service, reducing [latency/downtime] by 40% and supporting [Y]+ daily active users.');
    assert.ok(reactProps(o.apply()).disabled === true);
    assert.ok(o.note().textContent.includes('[latency/downtime]') && o.note().textContent.includes('[Y]'));
    assert.ok(!o.note().textContent.includes('[X]') && !o.note().textContent.includes('[feature/system]'), 'only what is left is named');

    const done = 'Engineered the billing service, reducing downtime by 40% and supporting 12K+ daily active users.';
    o.type(done);
    assert.ok(!reactProps(o.apply()).disabled, 'every slot filled: Apply is on');
    assert.equal(o.note(), undefined, 'the note is gone');
    o.clickApply();
    assert.deepEqual(o.applied, [done]);
  } finally {
    await o.view.unmount();
  }
});

it('a bracket of the user\'s own is not a template slot', async () => {
  const o = optimizer();
  try {
    o.type('Led the [Confidential] migration for 40 regional shops');
    assert.ok(!reactProps(o.apply()).disabled);
    assert.equal(o.note(), undefined);
    o.clickApply();
    assert.equal(o.applied.length, 1);
  } finally {
    await o.view.unmount();
  }
});
