// R5-HUNT10-REVIEW-HIDDEN-TEXT (review of R5-HUNT10-HIDDEN-FIELDS-NOT-LIST-CRASHES-EDITOR): a native
// .json whose `hiddenFields` is text ("email", or "email, phone"). Before that fix the PDF hid the
// field so named (`'email'.includes('email')`); the fix stored [] for any text, so an imported or
// already-saved résumé printed the very email and role its file said to hide, in the PDF, the
// Markdown and the public link. Now text is read as the keys it names. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, read, allText, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

async function imported(r) {
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  return normalizeResume(r);
}

const file = (template, personalHidden, entryHidden) => resume({
  template,
  personal: { name: 'Ann Vale', email: 'ann@example.com', phone: '555 0100', hiddenFields: personalHidden },
  sections: [experience([{ company: 'Harbor Works', role: 'Pilot', location: 'Dockside', hiddenFields: entryHidden }])],
});

describe('hiddenFields that is text', () => {
  it('names the keys it hides: stored as a list', async () => {
    const one = await imported(file('classic', 'email', 'role'));
    assert.deepEqual(one.personal.hiddenFields, ['email']);
    assert.deepEqual(one.sections[0].items[0].hiddenFields, ['role']);
    const two = await imported(file('classic', ' email, phone ', 'role location'));
    assert.deepEqual(two.personal.hiddenFields, ['email', 'phone']);
    assert.deepEqual(two.sections[0].items[0].hiddenFields, ['role', 'location']);
    const blank = await imported(file('classic', '', ' '));
    assert.deepEqual(blank.personal.hiddenFields, []);
    assert.deepEqual(blank.sections[0].items[0].hiddenFields, []);
  });

  it('what it names stays hidden in the PDF on every template', async () => {
    for (const template of TEMPLATES) {
      const text = allText(await read(await render(await imported(file(template, 'email', 'role')))));
      assert.ok(!text.includes('ann@example.com'), `${template}: the hidden email printed`);
      assert.ok(!/\bPilot\b/.test(text), `${template}: the hidden role printed`);
      assert.ok(text.includes('555 0100') && text.includes('Harbor Works'), `${template}: ${text}`);
    }
  });

  it('and in the Markdown export and the public link', async () => {
    const r = await imported(file('classic', 'email', 'role'));
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const md = generateMarkdownResume(r);
    assert.ok(!md.includes('ann@example.com') && !/\bPilot\b/.test(md), md);
    assert.ok(md.includes('Harbor Works'), md);
    const { publicSnapshot } = await loadModule('/src/utils/publicLink.js');
    const copy = JSON.stringify(publicSnapshot(r));
    assert.ok(!copy.includes('ann@example.com') && !copy.includes('Pilot'), copy);
  });
});
