// R4-DUX-26: ticking "Currently working here" (and Education's, Projects' and Volunteering's current
// flag) erased the entry's End Date, so unticking it — a slip, or a role that has since ended —
// left the End Date blank and the date entered was lost. Now the date is kept while the entry is
// current and comes back when it is unticked. Nothing prints the kept date while current: every
// export reads "Present", the JSON Resume file writes no end date and the public link's copy holds
// none. Mounted with react-dom/client over tests/pdf/fake-dom.mjs. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { setup, teardown, loadModule, resume, section, render, read, allText, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const ENTRIES = [
  ['ExperienceItem', 'experience', { company: 'Brindlewood', role: 'Lampwright', startDate: 'Feb 2018', endDate: 'Nov 2021' }],
  ['EducationItem', 'education', { institution: 'Fernhollow Institute', degree: 'BA', startDate: 'Feb 2018', endDate: 'Nov 2021' }],
  ['ProjectItem', 'projects', { name: 'Quietlantern', startDate: 'Feb 2018', endDate: 'Nov 2021' }],
  ['VolunteeringItem', 'volunteering', { org: 'Marsh Wardens', role: 'Guide', startDate: 'Feb 2018', endDate: 'Nov 2021' }],
];

it('ticking the current flag keeps the End Date, and unticking brings it back', async () => {
  const items = await loadModule('/src/components/SectionEditorEntryItems.jsx');
  for (const [name, type, fields] of ENTRIES) {
    const Item = items[name];
    const item = { ...section(type, [fields]).items[0], current: false };
    const updates = [];
    let props = { item, defaultOpen: true, onUpdate: (u) => { updates.push(u); props = { ...props, item: u }; }, onRemove() {} };
    const view = mount(Item, props);
    const box = () => [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'checkbox');
    try {
      assert.ok(box(), `${name}: a current checkbox`);
      view.act(() => reactProps(box()).onChange({ target: { checked: true } }));
      assert.deepEqual([updates.at(-1).current, updates.at(-1).endDate], [true, 'Nov 2021'], `${name}: ticked, the End Date is kept`);
      view.update(props);
      view.act(() => reactProps(box()).onChange({ target: { checked: false } }));
      assert.deepEqual([updates.at(-1).current, updates.at(-1).endDate], [false, 'Nov 2021'], `${name}: unticked, the End Date is back`);
    } finally { await view.unmount(); }
  }
});

it('a current entry keeping its End Date prints Present, never the kept date, in every export', async () => {
  const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
  const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
  const { cpwtResumeToJsonResume } = await loadModule('/src/utils/jsonResumeExport.js');
  const { publicSnapshot } = await loadModule('/src/utils/publicLink.js');
  const r = resume({ sections: ENTRIES.map(([, type, fields]) => section(type, [{ ...fields, current: true }])) });

  const out = {
    pdf: allText(await read(await render(r))),
    word: (await renderDocx(r)).texts.join('\n'),
    markdown: generateMarkdownResume(r),
    ats: generateAtsPlainText(r),
  };
  for (const [k, text] of Object.entries(out)) {
    assert.ok(!text.includes('Nov 2021'), `${k} prints no kept end date: ${text}`);
    assert.equal(text.split('Present').length - 1, 4, `${k} prints Present for each entry: ${text}`);
  }

  const json = JSON.stringify(cpwtResumeToJsonResume(r));
  assert.ok(!json.includes('2021-11'), `the JSON Resume file writes no end date: ${json}`);

  // The public link's copy holds only what prints (publicLink.js): the kept date is not in it.
  const copy = publicSnapshot(r);
  for (const s of copy.sections) {
    assert.deepEqual([s.items[0].current, s.items[0].endDate], [true, ''], `${s.type}: the copy holds no end date`);
  }
  assert.ok(!JSON.stringify(copy).includes('Nov 2021'), 'the public copy holds no kept end date');
});
