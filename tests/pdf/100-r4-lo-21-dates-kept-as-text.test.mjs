// R4-LO-21: R4-ED-03 made a Custom entry's Date / Period a text box when it holds text the month picker
// cannot read, but every other date — Experience, Education, Project and Volunteering Start/End, a
// certificate's Issue and Expiry, an award's Date — was still the picker: an imported 'Summer 2019' or
// '2019 – 2021' (which the PDF prints as stored) showed as blanks or its first year, and any pick wrote
// a month and year over all of it. Now each of them is a text box for such a date, showing what prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** [component's module, component, its section type, the date's key, its label]: every date an entry card edits. */
const ENTRY = '/src/components/SectionEditorEntryItems.jsx';
const LEAF = '/src/components/SectionEditorLeafItems.jsx';
const DATES = [
  [ENTRY, 'ExperienceItem', 'experience', 'startDate', 'Start Date'],
  [ENTRY, 'ExperienceItem', 'experience', 'endDate', 'End Date'],
  [ENTRY, 'EducationItem', 'education', 'startDate', 'Start Date'],
  [ENTRY, 'EducationItem', 'education', 'endDate', 'End Date'],
  [ENTRY, 'ProjectItem', 'projects', 'startDate', 'Start Date'],
  [ENTRY, 'VolunteeringItem', 'volunteering', 'endDate', 'End Date'],
  [LEAF, 'CertificationItem', 'certifications', 'date', 'Issue Date'],
  [LEAF, 'CertificationItem', 'certifications', 'expiry', 'Expiry Date'],
  [LEAF, 'AwardItem', 'awards', 'date', 'Date'],
];

/** The card of `Name` holding a new `type` entry with `fields`, open; re-rendered with each update, as the section does. */
async function card(path, Name, type, fields, label) {
  const Item = (await loadModule(path))[Name];
  const { NEW_ITEM } = await loadModule(LEAF);
  let item = { ...NEW_ITEM[type](), ...fields };
  const writes = [];
  const props = () => ({ item, defaultOpen: true, onRemove() {}, onUpdate: (u) => { writes.push(u); item = u; } });
  const view = mount(Item, props());
  const all = () => [...elements(view.container)];
  const textBox = () => all().find((el) => el.tagName === 'INPUT' && el.getAttribute('id')
    && all().some((l) => l.tagName === 'LABEL' && l.getAttribute('for') === el.getAttribute('id') && l.textContent === label));
  const yearSelect = () => all().find((el) => el.tagName === 'SELECT' && el.getAttribute('aria-label') === `${label} year`);
  const act = (el, event) => { view.act(() => reactProps(el).onChange(event)); view.update(props()); };
  return { view, writes, textBox, yearSelect, act };
}

describe('every entry date shows and keeps text the month picker cannot hold (R4-LO-21)', () => {
  for (const [path, Name, type, key, label] of DATES) {
    for (const stored of ['Summer 2019', '2019 – 2021']) {
      it(`${Name} ${label}: '${stored}' is a text box showing it whole, and an edit keeps the rest`, async () => {
        const { view, writes, textBox, yearSelect, act } = await card(path, Name, type, { [key]: stored }, label);
        try {
          assert.equal(yearSelect(), undefined, 'no month picker, which cannot hold it');
          const box = textBox();
          assert.ok(box, `a ${label} text box`);
          assert.equal(box.value, stored);
          act(box, { target: { value: `${stored} (part-time)` } });
          assert.deepEqual(writes.map((w) => w[key]), [`${stored} (part-time)`]);
          act(textBox(), { target: { value: '2019' } }); // retyping passes through a year the picker reads
          assert.equal(yearSelect(), undefined, 'still a text box');
          assert.equal(textBox().value, '2019');
        } finally { await view.unmount(); }
      });
    }

    it(`${Name} ${label}: a month and year, a year or nothing keeps the picker`, async () => {
      for (const stored of ['Apr 2019', '2019', '']) {
        const { view, textBox, yearSelect } = await card(path, Name, type, { [key]: stored }, label);
        try {
          assert.ok(yearSelect(), `'${stored}': the month picker`);
          assert.equal(textBox(), undefined, `'${stored}': no text box`);
        } finally { await view.unmount(); }
      }
    });
  }

  it('an End Date while the entry is current is the disabled picker, whatever it held', async () => {
    const { view, textBox, yearSelect } = await card(ENTRY, 'ExperienceItem', 'experience', { endDate: 'Summer 2019', current: true }, 'End Date');
    try {
      assert.ok(yearSelect(), 'the picker, greyed out');
      assert.equal(textBox(), undefined);
    } finally { await view.unmount(); }
  });
});
