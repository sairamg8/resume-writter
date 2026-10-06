// R4-DPH-29 (Personal Info, the editor header and Header Customization): iOS Safari zooms the page
// into any field it focuses whose text is under 16 px, and the first box a phone user taps in the
// editor did: Full Name, Job Title and the contact fields were 14 px, a link's Display label and Link
// URL 12 px, the résumé-name rename box 12–14 px, and the Header Customization boxes (Thickness, the
// header-spacing steppers) 12 px. Each now says `pointer-coarse:text-base` (16 px on a touch screen,
// as the kit's controlClass does), and the two narrow stepper boxes grow to w-16 there so 16 px
// digits fit. The fake DOM has no layout, so this pins the classes on the real components, rendered
// with react-dom/server (as tests/pdf/31-contact-fields.test.mjs renders Personal Info).
// Section Options' spacing boxes are another group's (SectionEditorCustomizer.jsx).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};
const attr = (attrs, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
const tokens = (attrs) => (attr(attrs, 'class') ?? '').split(/\s+/).filter(Boolean);

/** Every text field in `html` (file, hidden, checkbox and radio inputs left out), as { name, cls }. */
function textFields(html) {
  return [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)]
    .map(([, , attrs]) => attrs)
    .filter((attrs) => !['file', 'hidden', 'checkbox', 'radio'].includes(attr(attrs, 'type')))
    .map((attrs) => ({ name: attr(attrs, 'aria-label') || attr(attrs, 'placeholder') || attr(attrs, 'id'), cls: tokens(attrs) }));
}

/** The fields that would be under 16 px on a touch screen: none says pointer-coarse:text-base. */
const under16OnTouch = (fields) => fields.filter((f) => !f.cls.includes('pointer-coarse:text-base')).map((f) => f.name);

describe('R4-DPH-29: the editor\'s Personal Info boxes are 16 px on a touch screen', () => {
  it('Full Name, Job Title, every contact field and a link\'s Display label and Link URL', async () => {
    const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
    const html = renderToStaticMarkup(createElement(PersonalInfoEditor, {
      personal: { name: 'Robin Vale', linkedin: 'linkedin.com/in/robin' }, updatePersonal: noop,
      toggleFieldVisibility: noop, settings: {}, updateSetting: noop, clearSettings: noop, template: 'classic', coverLetter: {},
    }));
    const fields = textFields(html);
    const names = fields.map((f) => f.name);
    for (const name of ['LinkedIn display label', 'LinkedIn link URL', 'John Doe', 'Software Engineer']) {
      assert.ok(names.includes(name), `the ${name} box is on the panel: ${names.join(' | ')}`);
    }
    assert.ok(fields.length >= 10, `the name, title, six contacts and the link's two boxes: ${names.join(' | ')}`);
    assert.deepEqual(under16OnTouch(fields), []);
  });

  it('the résumé-name rename box in the editor header', async () => {
    const { EditorHeader } = await loadModule('/src/components/EditorHeader.jsx');
    const exportMenu = { exporting: false, importing: false, keeps: false, letterTab: false };
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(EditorHeader, {
      name: 'Harbor Pilot CV',
      rename: { editing: true, draft: 'Harbor Pilot CV', setDraft: noop, commit: noop, cancel: noop, start: noop },
      layoutMode: 'split', setLayoutMode: noop, exportMenu,
      auth: { user: null, authLoading: false, cloudAvailable: false }, sync: {},
    })));
    const fields = textFields(html);
    assert.deepEqual(fields.map((f) => f.name), ['Résumé name'], 'the rename box is the header\'s one text field');
    assert.deepEqual(under16OnTouch(fields), []);
  });

  it('Header Customization: the Thickness box and the header-spacing steppers, wide enough for 16 px digits', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const html = renderToStaticMarkup(createElement(HeaderCustomization, {
      s: { showHeaderBorder: true }, set: noop, clear: noop, template: 'classic', templateLabel: 'Classic', open: true, onToggle: noop,
      personal: { name: 'Robin Vale', title: 'Harbor Pilot', email: 'robin@example.com', phone: '+1 555 0100' },
    }));
    const fields = textFields(html);
    const thickness = fields.find((f) => f.name === 'Header border thickness (pt)');
    assert.ok(thickness, `the Thickness box is on the panel: ${fields.map((f) => f.name).join(' | ')}`);
    const steppers = fields.filter((f) => (f.name ?? '').endsWith(' (px)'));
    assert.ok(steppers.length >= 2, `the header's gaps each have a stepper box: ${fields.map((f) => f.name).join(' | ')}`);
    assert.deepEqual(under16OnTouch(fields), []);
    for (const box of [thickness, ...steppers]) {
      assert.ok(box.cls.includes('pointer-coarse:w-16'), `${box.name}: wider on a touch screen, or 16 px digits do not fit a w-12 / w-14 box`);
    }
  });
});
