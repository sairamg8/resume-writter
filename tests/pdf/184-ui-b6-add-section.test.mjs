// UI rebuild B6: the Résumé tab's own controls on the design tokens — Collapse All / Expand All above the cards,
// the Personal Info card, and the Add Section row with its picker: every type the app can add is offered, in
// its Core / More group, and a pick adds that type and closes the picker. A section type stored in an older
// résumé that the picker does not know still draws (as a Custom section).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const press = { preventDefault() {}, stopPropagation() {}, detail: 1, nativeEvent: {} };
const OLD_COLOUR = /(^|\s)(?:[a-z-]+:)*(?:text|bg|border|ring)-(?:gray|blue|red|amber)-\d/;

// Every type and label the picker offers today, written out: a type dropped from the picker fails here.
const OFFERED = [
  ['Core', 'Work Experience'], ['Core', 'Education'], ['Core', 'Skills'], ['Core', 'Projects'],
  ['More', 'Languages'], ['More', 'Certifications'], ['More', 'Awards & Honors'], ['More', 'Volunteering'],
  ['More', 'References'], ['More', 'Interests'], ['More', 'Custom Section'],
];

async function tab({ sections, addSectionOpen = true, toggle = () => {} } = {}) {
  const { EditorResumeTab } = await loadModule('/src/components/EditorResumeTab.jsx');
  const r = resume({ sections: sections ?? [section('experience', [{ role: 'Quillwright' }])] });
  const added = [];
  // The tab takes its actions from the store (useStableActions reads the store's own function keys), so a
  // plain object holding every action the tab hands on; addSection records the type.
  const noop = () => {};
  const store = {
    addSection: (type) => { added.push(type); return `new_${type}`; },
    updateSections: noop, updateSection: noop, updateSectionSettings: noop, removeSection: noop, addItem: noop,
    updateItem: noop, removeItem: noop, reorderItems: noop, toggleSectionVisibility: noop, duplicateSection: noop,
    duplicateItem: noop, updatePersonal: noop, toggleFieldVisibility: noop, updateSetting: noop, clearSettings: noop,
  };
  const props = {
    resume: r, store, personalOpen: false, setPersonalOpen() {}, allExpanded: true, forceOpenKey: 0,
    toggleAllSections: toggle, addSectionOpen, setAddSectionOpen() {},
  };
  const view = mount(EditorResumeTab, props);
  return { view, added, all: () => [...elements(view.container)] };
}

describe('the Résumé tab keeps its own controls (B6)', () => {
  it('the Add Section picker offers every type, in its group, and a pick adds that type', async () => {
    const t = await tab();
    try {
      const body = text(t.view.container);
      for (const [group, label] of OFFERED) {
        assert.ok(body.includes(label), `${label} is offered`);
        assert.ok(body.includes(group), `the ${group} group is named`);
      }
      const offered = t.all().filter((el) => el.tagName === 'BUTTON' && OFFERED.some(([, label]) => text(el) === label));
      assert.equal(offered.length, OFFERED.length, 'one button for each of the 11 types');
      const pick = offered.find((el) => text(el) === 'Awards & Honors');
      t.view.act(() => reactProps(pick).onClick(press));
      assert.deepEqual(t.added, ['awards']);
    } finally { await t.view.unmount(); }
  });

  it('Collapse All / Expand All is above the first card and calls the tab\'s toggle', async () => {
    let toggled = 0;
    const t = await tab({ addSectionOpen: false, toggle: () => { toggled += 1; } });
    try {
      const btn = t.all().find((el) => el.tagName === 'BUTTON' && /^(Collapse|Expand) All$/.test(text(el)));
      assert.ok(btn, 'the button');
      assert.equal(text(btn), 'Collapse All', 'every section is open, so it offers Collapse');
      t.view.act(() => reactProps(btn).onClick(press));
      assert.equal(toggled, 1);
      const order = t.all().filter((el) => el.tagName === 'BUTTON');
      assert.ok(order.indexOf(btn) < order.findIndex((el) => /Personal Info/.test(text(el))), 'above Personal Info and the cards');
    } finally { await t.view.unmount(); }
  });

  it('a stored section of an unknown type still draws, as a Custom section would', async () => {
    const odd = section('custom', [{ title: 'Odd entry' }]);
    odd.type = 'valueOf';
    const t = await tab({ sections: [odd], addSectionOpen: false });
    try {
      assert.ok(t.all().some((el) => (el.getAttribute('data-testid') ?? '').startsWith('section-card-')), 'its card is drawn');
    } finally { await t.view.unmount(); }
  });

  it('negative twin: the tab\'s own controls use the design tokens, not grey or blue Tailwind colours', async () => {
    const t = await tab();
    try {
      const old = t.all().filter((el) => OLD_COLOUR.test(el.getAttribute('class') ?? ''));
      assert.deepEqual(old.map((el) => `${el.tagName} ${el.getAttribute('class')}`), []);
    } finally { await t.view.unmount(); }
  });
});
