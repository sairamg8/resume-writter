// Personal Info → a contact field's Choose Icon → the header icon picker (R2-157). The gate pinned
// only how a picked `icon:<id>` or `pack:<id>` prints (09-contact-icons); the picker itself was
// clicked only by Cypress. So a pick written to another field, one that dropped the other fields'
// icons, a search that looked only at the Recommended tab, or a Close that wrote something passed.
// The real Personal Info editor is mounted over the fake DOM, its updateSetting a small store that
// records each write and re-renders with it; the picker is opened as a person does, from the field.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const PERSONAL = { name: 'Casey Wren', title: 'Planner', email: 'casey@example.com', phone: '+1 555 0142', location: 'Springfield' };
const cv = (customContactIcons = {}) => resume({ settings: { contactStyle: 'icon', customContactIcons }, personal: PERSONAL });

/** The nearest <button> holding `el`. */
const buttonOf = (el) => {
  let n = el;
  while (n && n.tagName !== 'BUTTON') n = n.parentNode;
  return n;
};

/**
 * Personal Info for `r`, as the editor mounts it, over a store that applies each setting write:
 * `writes` (every [key, value] since the last action), `choose(field)` (clicks that field's
 * Choose Icon), `picker()` (the open picker's box, or null), `click(el)`, `type(el, text)`,
 * `inPicker(text, tag)`, `icons()` (the icon cards the picker lists, by label), `settings()`.
 */
async function editor(r) {
  const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
  const { CONTACT_KEYS } = await loadModule('/src/utils/contacts.js');
  const { HEADER_ICONS } = await loadModule('/src/utils/contactIconPaths.js');
  const labels = new Set(Object.values(HEADER_ICONS).map((i) => i.label));
  const writes = [];
  let current = r;
  function Store({ initial }) {
    const [held, setHeld] = useState(initial);
    current = held;
    return createElement(PersonalInfoEditor, {
      resume: held, personal: held.personal, settings: held.settings, template: held.template, coverLetter: held.coverLetter,
      updatePersonal: (key, value) => writes.push(['personal', key, value]),
      toggleFieldVisibility: (key) => writes.push(['hide', key]),
      clearSettings: (keys) => writes.push(['clear', keys]),
      updateSetting: (key, value) => {
        writes.push([key, value]);
        setHeld((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
      },
    });
  }
  const view = mount(Store, { initial: r });
  const all = () => [...elements(view.container)];
  const picker = () => {
    const h3 = all().find((el) => el.tagName === 'H3' && el.textContent.trim() === 'Select Header Icon');
    return h3 ? h3.parentNode.parentNode.parentNode : null;
  };
  const click = (el, event) => {
    writes.length = 0;
    view.act(() => reactProps(el).onClick(event));
    return [...writes];
  };
  const inPicker = (text, tag = 'BUTTON') => {
    const box = picker();
    assert.ok(box, 'the picker is open');
    const el = [...elements(box)].find((e) => e.tagName === tag && e.textContent.trim() === text);
    assert.ok(el, `"${text}" in the picker`);
    return el;
  };
  return {
    writes,
    picker,
    click,
    inPicker,
    choose(field) {
      const buttons = all().filter((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Choose Icon');
      assert.equal(buttons.length, CONTACT_KEYS.length, 'a Choose Icon per contact field');
      click(buttons[CONTACT_KEYS.indexOf(field)]);
      assert.ok(picker(), `${field}: the picker opens`);
    },
    type(el, text) {
      writes.length = 0;
      view.act(() => reactProps(el).onChange({ target: { value: text } }));
    },
    icons: () => [...elements(picker())].filter((el) => el.tagName === 'BUTTON' && labels.has(el.textContent.trim())).map((el) => el.textContent.trim()),
    search: () => [...elements(picker())].find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === 'Search icons (e.g. mail, phone, globe, arrow, star)...'),
    settings: () => current.settings,
    unmount: () => view.unmount(),
  };
}

describe('the header icon picker (R2-157)', () => {
  it('opens for the field it was chosen from, on that field\'s recommended icons', async () => {
    const { getSelectableIcons } = await loadModule('/src/utils/contactIconPaths.js');
    const view = await editor(cv());
    try {
      assert.equal(view.picker(), null, 'closed until asked');
      view.choose('phone');
      assert.ok(view.picker().textContent.includes('Choose a vector icon for Phone'), view.picker().textContent.slice(0, 200));
      const { recommended, all } = getSelectableIcons('phone');
      assert.ok(recommended.length > 0 && recommended.length < all.length, 'the phone icons are a part of the library');
      assert.deepEqual(view.icons(), recommended.map((i) => i.label));
      assert.ok(view.icons().includes('Handset'));
      view.click(view.inPicker(`All Icons (${all.length})`));
      assert.deepEqual(view.icons(), all.map((i) => i.label), 'All Icons lists the library');
      assert.deepEqual(view.writes, [], 'looking writes nothing');
    } finally { await view.unmount(); }
  });

  it('a pick is written to that field only, keeping the other fields\' icons, and the picker closes', async () => {
    const view = await editor(cv({ phone: 'pack:filled', github: 'icon:terminal' }));
    try {
      view.choose('email');
      assert.deepEqual(view.click(view.inPicker('Paper Plane')), [['customContactIcons', { phone: 'pack:filled', github: 'icon:terminal', email: 'icon:send' }]]);
      assert.equal(view.picker(), null, 'closed');
      assert.deepEqual(view.settings().customContactIcons, { phone: 'pack:filled', github: 'icon:terminal', email: 'icon:send' });
      // Opened again, it shows the pick as the current one, and offers to take it off.
      view.choose('email');
      assert.ok(view.inPicker('Paper Plane').className.includes('border-blue-500'), 'Paper Plane marked');
      assert.ok(view.inPicker('Reset to Default'));
    } finally { await view.unmount(); }
  });

  it('Style Packs: a pack is written as pack:<id> for the field', async () => {
    const view = await editor(cv());
    try {
      view.choose('location');
      assert.deepEqual(view.click(view.inPicker('Style Packs (5)')), []);
      assert.deepEqual(view.click(buttonOf(view.inPicker('Solid Filled', 'P'))), [['customContactIcons', { location: 'pack:filled' }]]);
      assert.equal(view.picker(), null);
    } finally { await view.unmount(); }
  });

  it('search looks through the whole library, not the open tab, by name, id or kind', async () => {
    const view = await editor(cv());
    try {
      view.choose('email');
      assert.equal(view.icons().includes('GitHub Octocat'), false, 'not an e-mail icon');
      view.type(view.search(), 'octocat');
      assert.deepEqual(view.icons(), ['GitHub Octocat'], 'by name, outside the field\'s own');
      view.type(view.search(), 'SEND');
      assert.deepEqual(view.icons(), ['Paper Plane'], 'by id, in any case');
      view.type(view.search(), 'zzqx');
      assert.deepEqual(view.icons(), []);
      assert.ok(view.picker().textContent.includes('No icons match "zzqx"'));
      view.click(view.inPicker('Clear search'));
      assert.equal(String(reactProps(view.search()).value), '');
      assert.ok(view.icons().includes('Mail Envelope'), 'back to the e-mail icons');
      assert.deepEqual(view.writes, []);
      assert.deepEqual(view.settings().customContactIcons, {}, 'searching wrote nothing');
    } finally { await view.unmount(); }
  });

  it('Close, the × and a click outside close it and write nothing', async () => {
    const view = await editor(cv({ email: 'icon:mail' }));
    try {
      const ways = {
        Close: () => view.inPicker('Close'),
        '×': () => [...elements(view.picker())].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Close'),
        outside: () => view.picker().parentNode,
      };
      for (const [way, target] of Object.entries(ways)) {
        view.choose('email');
        view.type(view.search(), 'globe');
        assert.deepEqual(view.click(target(), { stopPropagation() {} }), [], way);
        assert.equal(view.picker(), null, `${way}: closed`);
        assert.deepEqual(view.settings().customContactIcons, { email: 'icon:mail' }, `${way}: the icon kept`);
      }
    } finally { await view.unmount(); }
  });

  it('opens fresh each time: no search or tab left over from the last field', async () => {
    // It stayed mounted while closed, so a search for the e-mail icon still filtered the phone's
    // picker, and All Icons stayed picked over the phone's recommended ones.
    const { getSelectableIcons } = await loadModule('/src/utils/contactIconPaths.js');
    const view = await editor(cv());
    try {
      view.choose('email');
      view.type(view.search(), 'octocat');
      view.click(view.inPicker('Close'));
      view.choose('phone');
      assert.equal(String(reactProps(view.search()).value), '', 'the search box is empty');
      assert.deepEqual(view.icons(), getSelectableIcons('phone').recommended.map((i) => i.label), 'the phone\'s recommended icons');
      view.click(view.inPicker(`All Icons (${getSelectableIcons('phone').all.length})`));
      view.click(view.inPicker('Close'));
      view.choose('location');
      assert.deepEqual(view.icons(), getSelectableIcons('location').recommended.map((i) => i.label), 'back on Recommended');
    } finally { await view.unmount(); }
  });

  it('Reset to Default takes the field\'s icon off, and only that one', async () => {
    const view = await editor(cv({ email: 'icon:send', phone: 'pack:bold' }));
    try {
      view.choose('email');
      assert.deepEqual(view.click(view.inPicker('Reset to Default')), [['customContactIcons', { phone: 'pack:bold' }]]);
      assert.equal(view.picker(), null);
      view.choose('email');
      assert.ok(view.picker().textContent.includes('Using default template icon'), 'none left to reset');
    } finally { await view.unmount(); }
  });
});
