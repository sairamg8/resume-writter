// The Cover Letter panel mounts the Smart Cover Letter Generator whether or not it is open, and the
// generator ran on every render of the tab. A skill group whose skills were not text threw
// "….split is not a function": a list, a number or an object, from an imported file or a résumé
// saved that way. The app has no error boundary, so the editor went blank as soon as the Cover
// Letter tab opened, before the generator was ever clicked. The generator now reads every résumé
// value as text (src/utils/storedText.js), and it runs only while the modal is open. The résumés
// here are passed as stored, not loaded: the generator must not rely on normalizeResume() having
// made them text first (16-saved-data-text-fields).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, experience, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const SHAPES = {
  list: ['React', 'SQL'],
  number: 12345,
  object: { a: 1 },
  true: true,
  'object with its own toString': JSON.parse('{"toString":"x"}'),
};

/** A résumé as stored, whose one skill group's skills are `skills`. */
const stored = (skills) => resume({
  personal: { name: 'Ada Lovelace', title: 'Engineer' },
  sections: [experience([{ role: 'Lead', company: 'Acme' }]), section('skills', [{ category: 'Tools', skills }])],
});

const panel = (r, CoverLetterPanel) => createElement(CoverLetterPanel, {
  resume: r, coverLetter: r.coverLetter, personal: r.personal, settings: r.settings, template: r.template, updateCoverLetter: () => {},
});

/** The open generator's live preview, as text. */
async function preview(r) {
  const { default: Modal } = await loadModule('/src/components/CoverLetterGeneratorModal.jsx');
  const html = renderToString(createElement(Modal, { isOpen: true, onClose: () => {}, onApply: () => {}, resume: r }));
  const inner = /class="prose[^"]*"[^>]*>(.*?)<\/div>/s.exec(html)?.[1] ?? '';
  return inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

describe('the cover letter generator reads a résumé whose skills are not text', () => {
  it('the Cover Letter tab renders, whatever the skills, with the generator closed', async () => {
    const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
    for (const [shape, skills] of Object.entries(SHAPES)) {
      assert.doesNotThrow(() => renderToString(panel(stored(skills), CoverLetterPanel)), shape);
    }
  });

  it('opened, it previews a letter of text: a list\'s skills, a number\'s digits, and nothing from an object', async () => {
    const want = { list: 'React, SQL', number: '12345' };
    for (const [shape, skills] of Object.entries(SHAPES)) {
      const text = await preview(stored(skills));
      assert.ok(text.length > 200, `${shape}: the preview holds the letter`);
      assert.ok(!/\[object Object\]|\btrue\b/.test(text), `${shape}: ${text}`);
      assert.ok(text.includes(`utilizing ${want[shape] ?? 'modern best practices'}.`), `${shape}: ${text}`);
    }
  });

  it('closed, the generator does not run: nothing of the résumé is read', async () => {
    const { default: Modal } = await loadModule('/src/components/CoverLetterGeneratorModal.jsx');
    const reads = [];
    const watched = (r) => new Proxy(r, { get(target, key) { reads.push(key); return target[key]; } });
    renderToString(createElement(Modal, { isOpen: false, onClose: () => {}, onApply: () => {}, resume: watched(stored('SQL')) }));
    assert.deepEqual(reads, []);
    // …which the open generator does: the check above can fail.
    renderToString(createElement(Modal, { isOpen: true, onClose: () => {}, onApply: () => {}, resume: watched(stored('SQL')) }));
    assert.ok(reads.includes('sections'), reads.join(', '));
  });
});
