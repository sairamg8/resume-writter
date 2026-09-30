// R5-HUNT10-HIDDEN-FIELDS-NOT-LIST-CRASHES-EDITOR: a native .json whose personal (or an entry's)
// `hiddenFields` is not a list. Dashboard → Import takes any file with `personal` and a list of
// `sections`, and store.importResume only runs normalizeResume on it, which never made hiddenFields a
// list. Personal Info (open by default) did `new Set({})` and threw ("object is not iterable"), so the
// editor showed "Something went wrong" on every open and every synced device; an entry's editor did the
// same, and the PDF (`hidden.includes`) never built. Now normalizeResume stores a list of keys: an
// object, a number or `true` hides nothing ([]), and a list keeps its text members (text names the keys
// it hides: r5hunt10-review-hidden-text.test.mjs). Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setup, teardown, loadModule, resume, experience, render, read, allText, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};

/** The file as Dashboard → Import reads it, through the store's import (normalizeResume). */
async function imported(r) {
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  return normalizeResume(r);
}

async function personalPanel(r) {
  const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
  return renderToStaticMarkup(createElement(PersonalInfoEditor, {
    resume: r, personal: r.personal, updatePersonal: noop, toggleFieldVisibility: noop, settings: r.settings,
    updateSetting: noop, clearSettings: noop, template: r.template, coverLetter: r.coverLetter,
  }));
}

async function entryPanel(item) {
  const { ExperienceItem } = await loadModule('/src/components/SectionEditorEntryItems.jsx');
  const { SkillItem } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
  const props = { item, onUpdate: noop, onRemove: noop, onDuplicate: noop, defaultOpen: true };
  return renderToStaticMarkup(createElement(ExperienceItem, props)) + renderToStaticMarkup(createElement(SkillItem, props));
}

describe('hiddenFields that is not a list', () => {
  // Text is not here: it names the keys it hides (r5hunt10-review-hidden-text.test.mjs).
  for (const bad of [{}, 1, true]) {
    it(`personal and an entry holding ${JSON.stringify(bad)}: a list, and the editor and the PDF render`, async () => {
      const r = await imported(resume({
        personal: { name: 'Ann Vale', email: 'ann@example.com', hiddenFields: bad },
        sections: [experience([{ company: 'Harbor Works', role: 'Pilot', hiddenFields: bad }])],
      }));
      assert.deepEqual(r.personal.hiddenFields, [], `before: ${JSON.stringify(bad)} stayed`);
      assert.deepEqual(r.sections[0].items[0].hiddenFields, []);
      assert.ok((await personalPanel(r)).includes('Ann Vale'), 'Personal Info renders');
      assert.ok((await entryPanel(r.sections[0].items[0])).includes('Harbor Works'), 'the entry renders');
      const text = allText(await read(await render(r)));
      assert.ok(text.includes('ann@example.com') && text.includes('Harbor Works'), text);
    });
  }

  it('a list keeps its text members, and what it hides stays hidden on every template', async () => {
    for (const template of TEMPLATES) {
      const r = await imported(resume({
        template,
        personal: { name: 'Ann Vale', email: 'ann@example.com', phone: '555 0100', hiddenFields: ['email', 3, null] },
        sections: [experience([{ company: 'Harbor Works', role: 'Pilot', hiddenFields: ['role', {}] }])],
      }));
      assert.deepEqual(r.personal.hiddenFields, ['email']);
      assert.deepEqual(r.sections[0].items[0].hiddenFields, ['role']);
      const text = allText(await read(await render(r)));
      assert.ok(!text.includes('ann@example.com'), `${template}: the hidden email stays hidden`);
      assert.ok(text.includes('555 0100') && text.includes('Harbor Works'), `${template}: ${text}`);
      assert.ok(!/\bPilot\b/.test(text), `${template}: the hidden role stays hidden`);
    }
  });

  it('a list of text or none is left as it is (the same object)', async () => {
    const r = await imported(resume({ personal: { hiddenFields: ['phone'] }, sections: [experience([{ hiddenFields: ['location'] }, {}])] }));
    const again = await imported(r);
    assert.equal(again, r);
    assert.equal(r.sections[0].items[1].hiddenFields ?? null, null);
  });
});
