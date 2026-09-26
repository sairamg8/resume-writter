// Education, Volunteering and Projects had no 'Present' option: an ongoing one printed its start
// date alone (R2-150). Each now has Experience's current flag ("Currently studying here", …): the
// End Date is blanked and disabled — its value kept for when it is unticked (R4-DUX-26) — and the
// entry prints '<start> – Present' in the PDF (every template), Word, Markdown and ATS text alike,
// as a current job does (presentLabel).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { setup, teardown, resume, section, render, read, allText, renderDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const count = (text, word) => text.split(word).length - 1;

function ongoing(template, current = true) {
  return resume({ template, sections: [
    section('education', [{ institution: 'Harbor College', degree: 'BSc', startDate: 'Sep 2022', endDate: '', current }]),
    section('projects', [{ name: 'Tidewatch', startDate: 'Jan 2023', endDate: '', current }]),
    section('volunteering', [{ org: 'Shore Crew', role: 'Warden', startDate: 'Mar 2021', endDate: '', current }]),
  ] });
}

describe('a current Education, Project or Volunteering entry prints "Present" (R2-150)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the PDF prints each as <start> – Present`, async () => {
      const text = allText(await read(await render(ongoing(template))));
      assert.equal(count(text, 'Present'), 3, text);
      assert.equal(count(allText(await read(await render(ongoing(template, false)))), 'Present'), 0);
    });
  }

  it('Word, Markdown and ATS text print it too', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const r = ongoing('classic');
    assert.equal(count((await renderDocx(r)).texts.join('\n'), 'Present'), 3, 'Word');
    assert.equal(count(generateMarkdownResume(r), 'Present'), 3, 'Markdown');
    assert.equal(count(generateAtsPlainText(r), 'Present'), 3, 'ATS text');
    assert.match(generateAtsPlainText(r), /Sep 2022 - Present/);
  });

  it('the editor offers the flag; checking it keeps the End Date, unchecking brings it back (R4-DUX-26)', async () => {
    const items = await loadModule('/src/components/SectionEditorEntryItems.jsx');
    const r = ongoing('classic', false);
    for (const [Item, i] of [[items.EducationItem, 0], [items.ProjectItem, 1], [items.VolunteeringItem, 2]]) {
      const item = { ...r.sections[i].items[0], endDate: 'Jun 2024' };
      const updates = [];
      const view = mount(Item, { item, onUpdate: (u) => updates.push(u), onRemove() {} });
      try {
        const all = () => [...elements(view.container)];
        view.act(() => reactProps(all().find((el) => el.tagName === 'DIV' && reactProps(el)?.onClick)).onClick()); // open the card
        const box = all().find((el) => el.tagName === 'INPUT' && el.type === 'checkbox');
        assert.ok(box, `${Item.name}: a current checkbox`);
        view.act(() => reactProps(box).onChange({ target: { checked: true } }));
        // The date entered is kept, not erased: nothing prints it while the entry is current.
        assert.deepEqual([updates[0].current, updates[0].endDate], [true, 'Jun 2024'], Item.name);
        view.update({ item: updates[0], onUpdate: (u) => updates.push(u), onRemove() {} });
        view.act(() => reactProps(all().find((el) => el.tagName === 'INPUT' && el.type === 'checkbox')).onChange({ target: { checked: false } }));
        assert.deepEqual([updates[1].current, updates[1].endDate], [false, 'Jun 2024'], `${Item.name}: unticked, the End Date is back`);
      } finally { await view.unmount(); }
      assert.match(renderToString(createElement(Item, { item: updates[0], onUpdate() {}, onRemove() {} })), /Harbor|Tidewatch|Warden/);
    }
  });
});
