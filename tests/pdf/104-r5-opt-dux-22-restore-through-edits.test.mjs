// R4-DUX-22 (follow-up): in the STAR / Bullet Optimizer, the Undo link a template leaves went away on the
// first edit — typing, Auto-Fix, a verb or a metric chip. Every template is full of placeholders ("[X]%",
// "[feature/system]"), so editing it is always the next step, and that step threw the only copy of the
// user's statement away (Cancel, which drops the whole session, was the only way back). Now the link,
// "Restore my statement", stays through edits to the template and brings back the statement the first
// template replaced, the edits to the template discarded; it goes once used, or once the text is that
// statement again. The real modal is mounted (react-dom/client over tests/pdf/fake-dom.mjs), searched from
// <body> (the kit Dialog's portal). The link is looked up by either label, so this pins the behaviour, not
// the wording. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

let BulletOptimizerModal;
let TEMPLATES;
before(async () => {
  patchFakeDom();
  await setup();
  ({ default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx'));
  ({ GOOGLE_XYZ_TEMPLATES: TEMPLATES } = await loadModule('/src/utils/bulletOptimizer.js'));
});
after(teardown);

const OWN = 'Rebuilt the Quillmark invoicing service for 40 regional shops';

function optimizer(initialText) {
  const view = mount(BulletOptimizerModal, { isOpen: true, onClose() {}, onApply() {}, initialText });
  const all = () => [...elements(view.document.body)];
  const buttons = () => all().filter((el) => el.tagName === 'BUTTON');
  const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const textarea = () => all().find((el) => el.tagName === 'TEXTAREA');
  const click = (el) => view.act(() => reactProps(el).onClick());
  return {
    view,
    text: () => reactProps(textarea()).value,
    restore: () => buttons().find((el) => /^(Undo|Restore my statement)$/.test(label(el))),
    button: (text) => {
      const found = buttons().find((el) => label(el) === text);
      assert.ok(found, `a "${text}" button`);
      return found;
    },
    pickTemplate(t) {
      const card = buttons().find((el) => el.textContent.includes(t.template));
      assert.ok(card, `a card shows "${t.label}"`);
      click(card);
    },
    type(value) {
      view.act(() => reactProps(textarea()).onChange({ target: { value } }));
    },
    click,
  };
}

it('filling a template\'s placeholder keeps the way back, and it brings back the user\'s statement', async () => {
  const o = optimizer(OWN);
  try {
    o.pickTemplate(TEMPLATES[0]);
    const filled = TEMPLATES[0].template.replace('[X]', '30');
    assert.notEqual(filled, TEMPLATES[0].template, 'the template has an [X] to fill');
    o.type(filled);
    assert.ok(o.restore(), 'the way back is still offered after the placeholder is filled');
    o.click(o.restore());
    assert.equal(o.text(), OWN, 'the user\'s own statement is back, the edits to the template discarded');
    assert.equal(o.restore(), undefined, 'used up');
  } finally {
    await o.view.unmount();
  }
});

it('Auto-Fix, a power verb and a metric chip keep it too', async () => {
  const o = optimizer(OWN);
  try {
    o.pickTemplate(TEMPLATES[1]);
    o.type('Handled the Quillmark ledger rollout for 12 shops');
    o.click(o.button('Auto-Fix'));
    assert.equal(o.text(), 'Managed the Quillmark ledger rollout for 12 shops');
    assert.ok(o.restore(), 'kept through Auto-Fix');
    o.click(o.button('Architected'));
    assert.ok(o.text().startsWith('Architected'), o.text());
    assert.ok(o.restore(), 'kept through a power verb');
    o.click(o.button('+ by 35%'));
    assert.ok(o.text().endsWith('by 35%'), o.text());
    assert.ok(o.restore(), 'kept through a metric chip');
    o.click(o.restore());
    assert.equal(o.text(), OWN);
  } finally {
    await o.view.unmount();
  }
});

it('typing the statement back as it was leaves nothing to restore', async () => {
  const o = optimizer(OWN);
  try {
    o.pickTemplate(TEMPLATES[0]);
    o.type('Engineered the Quillmark ledger');
    assert.ok(o.restore());
    o.type(OWN);
    assert.equal(o.restore(), undefined, 'the text is the saved statement again');
  } finally {
    await o.view.unmount();
  }
});

it('the link says what it does, and that the template\'s edits go', async () => {
  const o = optimizer(OWN);
  try {
    o.pickTemplate(TEMPLATES[0]);
    const link = o.restore();
    assert.equal(link.textContent.trim(), 'Restore my statement');
    assert.match(link.getAttribute('title') || '', /discarded/);
  } finally {
    await o.view.unmount();
  }
});
