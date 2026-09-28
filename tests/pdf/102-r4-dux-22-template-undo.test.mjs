// R4-DUX-22: in the STAR / Bullet Optimizer, clicking a "Google X-Y-Z Proven Templates" card replaced
// the user's statement with the template, and the modal had no way back. Now an Undo link shows under
// the statement after a template replaces it and restores the text as it was before the first template
// picked (a second template keeps that text). Since R4-DUX-22's follow-up (104-r5-opt-dux-22-*) the link
// reads "Restore my statement" and stays through edits to the template: every template is full of
// placeholders ("[X]%", "[feature/system]"), so the text is always edited next, and the old rule — Undo
// gone on the first keystroke — left Cancel, which drops the whole session, as the only way back.
// The real modal is mounted (react-dom/client over tests/pdf/fake-dom.mjs). Fictional data only. It is
// the kit's Dialog (R4-DVIS-07), in a portal at the end of <body>: the page is searched from there, and
// patchFakeDom gives its focus trap the querySelector it needs.
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
  const textarea = () => all().find((el) => el.tagName === 'TEXTAREA');
  return {
    view,
    text: () => reactProps(textarea()).value,
    undo: () => buttons().find((el) => el.textContent.trim() === 'Restore my statement'),
    pickTemplate(t) {
      const card = buttons().find((el) => el.textContent.includes(t.template));
      assert.ok(card, `a card shows "${t.label}"`);
      view.act(() => reactProps(card).onClick());
    },
    type(value) {
      view.act(() => reactProps(textarea()).onChange({ target: { value } }));
    },
    click(el) {
      view.act(() => reactProps(el).onClick());
    },
  };
}

it('Undo after a template brings back the statement it replaced', async () => {
  const o = optimizer(OWN);
  try {
    assert.equal(o.undo(), undefined, 'nothing to undo yet');
    o.pickTemplate(TEMPLATES[0]);
    assert.equal(o.text(), TEMPLATES[0].template);
    assert.ok(o.undo(), 'an Undo link shows after the template replaced the text');
    o.click(o.undo());
    assert.equal(o.text(), OWN, 'the user\'s own statement is back');
    assert.equal(o.undo(), undefined, 'Undo is used up');
  } finally {
    await o.view.unmount();
  }
});

it('after two templates, Undo goes back to the user\'s own text', async () => {
  const o = optimizer(OWN);
  try {
    o.pickTemplate(TEMPLATES[0]);
    o.pickTemplate(TEMPLATES[1]);
    assert.equal(o.text(), TEMPLATES[1].template);
    o.click(o.undo());
    assert.equal(o.text(), OWN);
  } finally {
    await o.view.unmount();
  }
});

// Was "editing the text after a template drops Undo": stale since the follow-up — filling a template's
// placeholders is the edit every template needs, and it must not throw the user's statement away.
it('editing the text after a template keeps the way back to the user\'s statement', async () => {
  const o = optimizer(OWN);
  try {
    o.pickTemplate(TEMPLATES[0]);
    o.type('Engineered the Quillmark ledger, cutting close time by 30%');
    assert.ok(o.undo(), 'Restore my statement is still offered');
    o.click(o.undo());
    assert.equal(o.text(), OWN, 'the user\'s own statement is back');
  } finally {
    await o.view.unmount();
  }
});
