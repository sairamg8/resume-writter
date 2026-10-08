// UI B7 (personal-info): the Personal Info card, its photo section and the Header Customization
// section are drawn with the design tokens. Pins what a person sees (every contact field with its eye,
// the photo controls) and, as the negative twin, that no element still carries an old Tailwind
// grey/blue/red/amber colour class. Rendered with react-dom/server, as 103-r4-dph-29 renders it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};
const OLD_COLOUR = /(?:^|:)(?:text|bg|border|ring|divide|placeholder|from|to|via|outline|fill|stroke)-(?:gray|slate|zinc|neutral|stone|blue|indigo|red|amber|yellow|orange)-\d+(?:\/\d+)?$/;
const oldColourClasses = (html) => [...html.matchAll(/\sclass="([^"]*)"/g)]
  .flatMap(([, cls]) => cls.split(/\s+/))
  .filter((c) => OLD_COLOUR.test(c));

const personal = { name: 'Robin Vale', title: 'Pilot', email: 'robin@example.com', phone: '555 0100', location: 'Harbor City', website: 'robin.dev', linkedin: 'linkedin.com/in/robin', photo: 'data:image/png;base64,AAAA' };
const props = {
  personal, updatePersonal: noop, toggleFieldVisibility: noop, settings: {}, updateSetting: noop, clearSettings: noop, template: 'classic', coverLetter: {},
};

async function renderCard(extra = {}) {
  const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
  return renderToStaticMarkup(createElement(PersonalInfoEditor, { ...props, ...extra }));
}

async function renderOpenPhoto() {
  const { PhotoSection } = await loadModule('/src/components/PersonalInfoEditorPhoto.jsx');
  return renderToStaticMarkup(createElement(PhotoSection, {
    resume: { id: 'r1' }, getResume: undefined, personal, updatePersonal: noop, toggleFieldVisibility: noop,
    hidden: new Set(), s: {}, set: noop, template: 'classic', open: true, onToggle: noop, coverLetter: {},
  }));
}

describe('UI B7: the Personal Info card, with its eyes and photo controls', () => {
  it('shows the name, title and every contact field, each with an eye to show or hide it', async () => {
    const html = await renderCard();
    for (const value of ['Robin Vale', 'Pilot', 'robin@example.com', '555 0100', 'Harbor City', 'robin.dev', 'linkedin.com/in/robin']) {
      assert.ok(html.includes(`value="${value}"`), `the ${value} box is filled in`);
    }
    const eyes = [...html.matchAll(/title="(Hide on resume|Show on resume)"/g)];
    assert.ok(eyes.length >= 6, `an eye on each contact field: ${eyes.length}`);
    assert.match(html, /Hide summary from resume/);
    assert.match(html, /Photo/);
    assert.match(html, /Header Customization/);
  });

  it('an open photo section has the profile photo, Remove, and the Shape, Size and Border choices', async () => {
    const html = await renderOpenPhoto();
    for (const text of ['Profile Photo', 'Remove photo', 'Shape', 'Size', 'Border']) {
      assert.ok(html.includes(text), `${text} is on the photo section`);
    }
    assert.match(html, /title="Hide photo from the résumé and cover letter/);
    assert.match(html, /<input[^>]*type="file"/);
  });
});

describe('UI B7 negative twin: no old grey, blue, red or amber colour class is left', () => {
  it('on the Personal Info card', async () => {
    assert.deepEqual(oldColourClasses(await renderCard()), []);
  });

  it('on the card with a hidden field and a link', async () => {
    const html = await renderCard({ settings: { hiddenFields: ['phone', 'photo', 'summary'] } });
    assert.deepEqual(oldColourClasses(html), []);
  });

  it('on the open photo section', async () => {
    assert.deepEqual(oldColourClasses(await renderOpenPhoto()), []);
  });

  it('the detector does see an old class (so the twin is not vacuous)', () => {
    assert.deepEqual(oldColourClasses('<p class="mb-1 text-gray-500 hover:bg-blue-50 border-cv-hairline">x</p>'), ['text-gray-500', 'hover:bg-blue-50']);
  });
});
