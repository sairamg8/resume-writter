// R5-HUNT6-BLANK-SECTION-HEADING: a section whose entries are all blank — a Skills section just added
// (its first group { category: '', skills: '' }), one whose groups have Category and Skills hidden with
// their eyes, a Custom or Experience section whose one entry is still empty — printed its heading alone
// in the PDF (sectionPrints asked only whether an entry was shown) and in Word (buildSection's `shown`
// counted the blank entry, and the heading kept the section). Markdown and ATS text leave such a
// section out. Now the PDF, in every template, and Word leave it out too (entryPrints), and a section
// with one entry that prints still prints its heading. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderDocx, read, allText, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const BLANK_SKILLS = () => section('skills', [{ category: '', skills: '' }], {}, { title: 'Toolbox' });
const EYES_OFF_SKILLS = () => section('skills', [{ category: 'Hidden', skills: 'Cobol', hiddenFields: ['category', 'skills'] }], {}, { title: 'Toolbox' });
const BLANK_CUSTOM = () => section('custom', [{ title: '', subtitle: '', description: '<p></p>' }], {}, { title: 'Side Quests' });
const BLANK_EXPERIENCE = () => section('experience', [{ company: '', role: '', location: '', startDate: '', endDate: '', description: '' }], {}, { title: 'Earlier Roles' });

const sample = (extra, template = 'classic', settings = {}) => resume({
  template,
  settings,
  personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com' },
  sections: [experience([{ company: 'Fabrikam Studio', role: 'Lead Engineer' }]), ...extra],
});
const HEADINGS = /toolbox|side quests|earlier roles/i;

describe('A section whose entries are all blank prints no heading (R5-HUNT6-BLANK-SECTION-HEADING)', () => {
  const LAYOUTS = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];
  for (const [template, settings] of LAYOUTS) {
    const name = `${template}${settings.sidebarSingleColumn ? ' (Single · ATS-safe)' : ''}`;
    it(`${name}: the PDF prints no lone heading over a blank or eyes-off section`, async () => {
      const text = allText(await read(await render(sample([BLANK_SKILLS(), EYES_OFF_SKILLS(), BLANK_CUSTOM(), BLANK_EXPERIENCE()], template, settings))));
      assert.match(text, /Fabrikam Studio/, 'the filled section prints');
      assert.doesNotMatch(text, HEADINGS, text);
    });
  }

  it('Word prints no lone heading either', async () => {
    const { texts } = await renderDocx(sample([BLANK_SKILLS(), EYES_OFF_SKILLS(), BLANK_CUSTOM(), BLANK_EXPERIENCE()]));
    assert.ok(texts.some((t) => /Fabrikam Studio/.test(t)), texts.join(' | '));
    assert.ok(!texts.some((t) => HEADINGS.test(t)), texts.join(' | '));
  });

  it('Markdown and ATS text agree (they already left it out)', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const r = sample([BLANK_SKILLS(), EYES_OFF_SKILLS(), BLANK_CUSTOM(), BLANK_EXPERIENCE()]);
    assert.doesNotMatch(generateMarkdownResume(r), HEADINGS);
    assert.doesNotMatch(generateAtsPlainText(r), HEADINGS);
  });

  // Guard: one entry that prints keeps the section, heading and all, beside a blank one.
  it('a section with one entry that prints still prints its heading, in the PDF and Word', async () => {
    const r = sample([section('skills', [{ category: '', skills: '' }, { category: 'Languages', skills: 'Rust, Go' }], {}, { title: 'Toolbox' })]);
    const text = allText(await read(await render(r)));
    assert.match(text, /toolbox/i, text);
    assert.match(text, /Rust, Go/, text);
    const { texts } = await renderDocx(r);
    assert.ok(texts.some((t) => /toolbox/i.test(t)), texts.join(' | '));
  });
});
