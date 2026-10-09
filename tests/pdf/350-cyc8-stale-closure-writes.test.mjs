// CYC8-U15: two writes made from a render's stale view. (1) Personal Info: Clear (and a pick in the icon
// picker) built the whole customContactIcons map from the settings of the render it was clicked in, so an
// icon changed since (an upload that landed, a change from the other panel) was written over; the upload
// already wrote through a function of the icons as they are (R5-HUNT2). Clear and the picker now do the
// same, by the résumé's id. (2) Design: "Reset" armed a confirm question that outlived a switch to another
// résumé under the mounted panel, so Yes, Reset reset the OTHER résumé; the question is now about the
// résumé it was asked for, and is gone when the panel shows another. The real components over
// tests/pdf/fake-dom.mjs.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const PERSONAL = { name: 'Casey Wren', title: 'Planner', email: 'casey@example.com', phone: '+1 555 0142', location: 'Springfield' };

it('Clear on a contact icon writes through a function of the icons as they are, for its résumé', async () => {
  const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
  const writes = [];
  const held = resume({ settings: { contactStyle: 'icon', customContactIcons: { email: 'icon:mail' } }, personal: PERSONAL });
  const view = mount(PersonalInfoEditor, {
    resume: held, personal: held.personal, settings: held.settings, template: held.template, coverLetter: held.coverLetter,
    updatePersonal: () => {}, toggleFieldVisibility: () => {}, clearSettings: () => {},
    updateSetting: (...args) => writes.push(args),
  });
  try {
    const clear = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Remove custom icon');
    assert.ok(clear, 'the email field shows its Clear button');
    view.act(() => reactProps(clear).onClick());
    assert.equal(writes.length, 1);
    const [key, next, id] = writes[0];
    assert.equal(key, 'customContactIcons');
    assert.equal(typeof next, 'function', 'a function of the icons as they are when it is written, not a map built from this render');
    assert.equal(id, held.id, 'written to this résumé by its id');
    assert.deepEqual(next({ email: 'icon:mail', phone: 'icon:phone' }), { phone: 'icon:phone' }, 'an icon set since is kept');
    assert.deepEqual(next(undefined), {});
  } finally {
    await view.unmount();
  }
});

async function designPanel(first, resetSettings) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const props = (r) => ({ resume: r, updateSetting: () => {}, setTemplate: () => {}, resetSettings });
  const view = mount(DesignPanel, props(first));
  const button = (text) => [...elements(view.container)].find((b) => b.tagName === 'BUTTON' && b.textContent.trim() === text);
  return { view, button, show: (r) => view.update(props(r)), click: (text) => view.act(() => reactProps(button(text)).onClick()) };
}

it('a Reset question asked for one résumé is gone when the panel shows another, so Yes, Reset cannot reset it', async () => {
  const a = { ...resume({ template: 'classic' }), id: 'resume_a' };
  const b = { ...resume({ template: 'classic' }), id: 'resume_b' };
  const resets = [];
  const p = await designPanel(a, () => resets.push('reset'));
  try {
    p.click('Reset');
    assert.ok(p.button('Yes, Reset'), 'the question is up for the first résumé');
    p.show(b);
    assert.equal(p.button('Yes, Reset'), undefined, 'not up for the other one');
    assert.ok(p.button('Reset'), 'Reset is offered again');
    p.show(a);
    assert.equal(p.button('Yes, Reset'), undefined, 'and not found again on coming back');
    assert.deepEqual(resets, []);
  } finally {
    await p.view.unmount();
  }
});

it('with no switch, Yes, Reset resets once and closes the question', async () => {
  const a = { ...resume({ template: 'classic' }), id: 'resume_a' };
  const resets = [];
  const p = await designPanel(a, () => resets.push('reset'));
  try {
    p.click('Reset');
    p.click('Yes, Reset');
    assert.deepEqual(resets, ['reset']);
    assert.equal(p.button('Yes, Reset'), undefined);
  } finally {
    await p.view.unmount();
  }
});
