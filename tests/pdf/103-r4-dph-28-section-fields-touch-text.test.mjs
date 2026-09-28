// R4-DPH-28: every field of a résumé section was 14 px on a touch screen — a section's title, each
// entry's text boxes (InputField), the date pickers' month and year selects, a language's name and level,
// an interest — and iOS Safari zooms the page into any field it focuses whose text is under 16 px, so
// nearly every tap in the section editor zoomed the page. Only the rich-text descriptions were already
// 16 px on touch (RichTextEditor, J-38b). Each is `pointer-coarse:text-base` now; a mouse keeps 14 px.
// Checked on the real components over the fake DOM (tests/pdf/fake-dom.mjs, loaded through Vite), with
// the rule of tests/pdf/81-job-inputs-touch-text.test.mjs.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

const noop = () => {};

/**
 * The text fields and pickers in `root` that would be under 16 px on a phone or a tablet: a field
 * passes with `pointer-coarse:text-base`, or with an unprefixed `text-base` that no breakpoint shrinks.
 */
function under16OnTouch(root) {
  // React sets an <input>'s type as a property, not an attribute, and the fake DOM keeps them apart: read both.
  const fields = [...elements(root)].filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
    && !['file', 'hidden', 'checkbox', 'radio'].includes(el.getAttribute('type') ?? el.type));
  assert.ok(fields.length > 0, 'there are fields to check');
  return fields.filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)pointer-coarse:text-base(\s|$)/.test(cls)) return false;
    return !(/(^|\s)text-base(\s|$)/.test(cls) && !/(^|\s)(sm|md|lg|xl|2xl):text-(xs|sm|\[)/.test(cls));
  }).map((el) => el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName);
}

/** Each kind of entry, open, with a date or two so the pickers show. */
const ENTRIES = [
  ['ExperienceItem', '/src/components/SectionEditorEntryItems.jsx', { id: 'e1', company: 'Acme', role: 'Dev', location: 'Remote', startDate: 'Jan 2020', endDate: 'Mar 2022', current: false, description: '' }],
  ['EducationItem', '/src/components/SectionEditorEntryItems.jsx', { id: 'd1', institution: 'State U', degree: 'BSc', fieldOfStudy: 'CS', location: '', startDate: 'Sep 2014', endDate: 'Jun 2018', gpa: '', description: '' }],
  ['ProjectItem', '/src/components/SectionEditorEntryItems.jsx', { id: 'p1', name: 'Tidewatch', url: 'example.com', technologies: 'React', startDate: 'Jan 2021', endDate: '', description: '' }],
  ['VolunteeringItem', '/src/components/SectionEditorEntryItems.jsx', { id: 'v1', org: 'Harbor Trust', role: 'Guide', location: '', startDate: 'May 2019', endDate: 'Aug 2019', description: '' }],
  ['CustomItem', '/src/components/SectionEditorEntryItems.jsx', { id: 'c1', title: 'Talk', subtitle: 'Conf', date: 'Jan 2020', location: 'Oslo', description: '' }],
  ['CustomItem (a period typed as text)', '/src/components/SectionEditorEntryItems.jsx', { id: 'c2', title: 'Talk', subtitle: '', date: 'Jan 2020 – Mar 2021', location: '', description: '' }],
  ['SkillItem', '/src/components/SectionEditorLeafItems.jsx', { id: 's1', category: 'Tools', skills: 'Figma' }],
  ['CertificationItem', '/src/components/SectionEditorLeafItems.jsx', { id: 'r1', name: 'AWS', issuer: 'Amazon', date: 'Jan 2024', expiry: 'Jan 2027', credentialId: 'X-1', url: 'https://example.com' }],
  ['AwardItem', '/src/components/SectionEditorLeafItems.jsx', { id: 'a1', title: 'Prize', issuer: 'Guild', date: 'Jun 2023', description: '' }],
  ['ReferenceItem', '/src/components/SectionEditorLeafItems.jsx', { id: 'f1', name: 'Ana', jobTitle: 'Lead', company: 'Acme', relationship: 'Manager', email: 'a@x.com', phone: '1' }],
  ['LanguageItem', '/src/components/SectionEditorLeafItems.jsx', { id: 'l1', language: 'English', proficiency: 'Native' }],
  ['InterestItem', '/src/components/SectionEditorLeafItems.jsx', { id: 'i1', interests: 'Sailing' }],
];

for (const [name, path, item] of ENTRIES) {
  it(`R4-DPH-28: every field of an open ${name} is 16 px on a touch screen`, async () => {
    const component = (await loadModule(path))[name.split(' ')[0]];
    assert.equal(typeof component, 'function', `${name} is exported`);
    const view = mount(component, { item, onUpdate: noop, onRemove: noop, onDuplicate: noop, defaultOpen: true });
    try {
      assert.deepEqual(under16OnTouch(view.container), []);
    } finally {
      await view.unmount();
    }
  });
}

it('R4-DPH-28: a section\'s title box is 16 px on a touch screen too', async () => {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const view = mount(SortableSection, {
    section: { id: 'sec_lang', type: 'languages', title: 'Languages', visible: true, settings: {}, items: [{ id: 'l1', language: 'Welsh', proficiency: 'Fluent' }] },
    template: 'classic', settings: {}, updateSection: noop, updateSectionSettings: noop, removeSection: noop,
    addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
  });
  try {
    const title = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Section title');
    assert.ok(title, 'the section has its title box');
    assert.deepEqual(under16OnTouch(view.container), [], 'the title box and the rows under it');
  } finally {
    await view.unmount();
  }
});
