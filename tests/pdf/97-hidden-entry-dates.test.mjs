// R1-LEFT-b: an Education, Project or Volunteering entry whose End Date is hidden (its
// `hiddenFields` holds 'endDate', as a Backup JSON or an older build's data carries it) printed that
// date anyway in the PDF (every template) and in Word — or "Present" for a current one — because
// those sections read the entry's dates straight past the flag (endDateOf). Markdown and ATS text
// already left it out. Now all four agree: a hidden end prints nothing, a hidden start likewise.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, renderDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const hide = (hiddenFields) => ({ hiddenFields });

function entries(template) {
  return resume({ template, sections: [
    section('education', [
      { institution: 'Harbor College', degree: 'BSc', startDate: 'Sep 2019', endDate: 'Jun 2031', ...hide(['endDate']) },
      { institution: 'Cove School', degree: 'Diploma', startDate: 'Sep 2015', endDate: '', current: true, ...hide(['endDate']) },
    ]),
    section('projects', [{ name: 'Tidewatch', startDate: 'Jan 2020', endDate: 'Mar 2032', ...hide(['endDate']) }]),
    section('volunteering', [
      { org: 'Shore Crew', role: 'Warden', startDate: 'Jan 2033', endDate: 'Apr 2034', ...hide(['startDate', 'endDate']) },
    ]),
  ] });
}

function assertHidden(text, label) {
  for (const gone of ['2031', '2032', '2033', '2034', 'Present']) assert.ok(!text.includes(gone), `${label}: prints ${gone}\n${text}`);
  for (const kept of ['2019', '2015', '2020']) assert.ok(text.includes(kept), `${label}: lost the start ${kept}\n${text}`);
}

describe('a hidden date on an Education, Project or Volunteering entry prints nowhere (R1-LEFT-b)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the PDF leaves it out`, async () => {
      assertHidden(allText(await read(await render(entries(template)))), template);
    });
  }

  it('Word, Markdown and ATS text leave it out too', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const r = entries('classic');
    assertHidden((await renderDocx(r)).texts.join('\n'), 'Word');
    assertHidden(generateMarkdownResume(r), 'Markdown');
    assertHidden(generateAtsPlainText(r), 'ATS text');
  });

  it('an entry with nothing hidden still prints both dates', async () => {
    const r = entries('classic');
    for (const s of r.sections) for (const item of s.items) item.hiddenFields = [];
    const text = allText(await read(await render(r)));
    for (const shown of ['2031', '2032', '2033', '2034', 'Present']) assert.ok(text.includes(shown), `PDF ${shown}\n${text}`);
    const word = (await renderDocx(r)).texts.join('\n');
    for (const shown of ['2031', '2032', '2033', '2034', 'Present']) assert.ok(word.includes(shown), `Word ${shown}\n${word}`);
  });
});
