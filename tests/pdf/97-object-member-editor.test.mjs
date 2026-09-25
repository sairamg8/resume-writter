// R1-LEFT-c in the editor: a stored section typed like an Object member ('constructor', 'toString',
// 'valueOf', …) — a Backup JSON or an older build's data — is edited as the custom section it prints
// as. Its "Add" button looked the type up on Object: the label rendered a function (nothing), and a
// click called that member as the new entry's factory — Object() made an entry with no id,
// toString() a string, valueOf() and hasOwnProperty() threw. Section options → Reset style did the
// same with the section's defaults.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const TYPES = ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__'];
const odd = (type) => ({ id: `odd_${type}`, type, title: `Odd ${type}`, visible: true, settings: {}, items: [] });

const buttons = (view) => [...elements(view.container)].filter((el) => el.tagName?.toLowerCase() === 'button');
const buttonWith = (view, text) => buttons(view).find((b) => b.textContent.includes(text));

describe('a section typed like an Object member is edited as a custom one (R1-LEFT-c)', () => {
  for (const type of TYPES) {
    it(`${type}: "Add Entry" adds a custom entry, and Reset style gives a custom section's settings`, async () => {
      const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
      const r = resume({ sections: [odd(type)] });
      const added = [];
      const updates = [];
      const noop = () => {};
      const view = mount(SortableSection, {
        section: r.sections[0], template: r.template, settings: r.settings, updateSectionSettings: noop,
        updateSection: (id, fn) => updates.push(fn), removeSection: noop,
        addItem: (id, item) => added.push(item), updateItem: noop, removeItem: noop, reorderItems: noop,
      });
      try {
        const add = buttonWith(view, 'Add Entry');
        assert.ok(add, `the add button reads "Add Entry": ${buttons(view).map((b) => JSON.stringify(b.textContent)).join(', ')}`);
        view.act(() => reactProps(add).onClick());
        assert.equal(added.length, 1);
        assert.equal(typeof added[0], 'object', `the new entry is ${typeof added[0]}`);
        assert.match(String(added[0].id), /^cust/, 'a custom entry, with its id');

        view.act(() => reactProps(buttons(view).find((b) => b.getAttribute('title') === 'Section options')).onClick());
        const reset = buttonWith(view, 'Reset style');
        assert.ok(reset, 'the options menu is open');
        view.act(() => reactProps(reset).onClick());
        assert.equal(updates.length, 1);
        const { SECTION_TYPE_DEFAULTS } = await loadModule('/src/utils/defaultData.js');
        const { newSectionGrid } = await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js');
        const { templateId } = await loadModule('/src/constants/templates.js');
        const custom = newSectionGrid(SECTION_TYPE_DEFAULTS.custom(r.sections[0].id), templateId(r.template)).settings;
        assert.deepEqual(updates[0](r.sections[0]).settings, custom, 'a custom section\'s settings');
      } finally { await view.unmount(); }
    });
  }
});
