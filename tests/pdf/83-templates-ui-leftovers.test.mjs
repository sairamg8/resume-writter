// Two Templates-UI audit leftovers filed together as R2-133. The dashboard card printed the stored
// template id under CSS `capitalize` ("Foo" for an id the app does not offer, which opens and prints
// as Classic) instead of the name the editor shows (templateLabel). And Export Word gave no hint of
// what the .docx leaves out. It now prints the photo (R2-126) and Modern's and the Sidebar's header on
// their band (R2-137): the hint names what is left — Banner's and Banded's headers and the Sidebar's
// side column print on the white page. The letter's .docx prints its photo too (R4-DOUT-06), so its
// hint no longer says it is left out.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('Templates UI leftovers (R2-133)', () => {
  it('the dashboard card names the template as the editor does', async () => {
    const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
    const card = (template) => renderToString(createElement(ResumeCard, {
      resume: { id: 'r1', name: 'Mine', template, updatedAt: Date.now(), settings: {} },
      onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {},
    }));
    assert.match(card('banner'), />Banner<!-- --> · /);
    // An id the app does not offer opens as Classic, and the card says so.
    const unknown = card('fancy');
    assert.match(unknown, />Classic<!-- --> · /, unknown);
    assert.ok(!/fancy/i.test(unknown), unknown);
  });

  it('Export Word says what the .docx leaves out — and no longer that the résumé loses its photo or every band', async () => {
    const { ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx');
    const noop = () => {};
    const hint = async (letter, label) => {
      const view = mount(ExportDropdown, { exporting: false, letter, onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onImportJSON: noop });
      try {
        const button = (name) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && text(el) === name);
        view.act(() => reactProps(button('Export')).onClick());
        const word = button(label);
        assert.ok(word, 'the menu is open');
        return word.getAttribute('title') || '';
      } finally {
        await view.unmount();
      }
    };
    const resumeHint = await hint(false, 'Export Word');
    assert.match(resumeHint, /Banner's and Banded's headers/);
    assert.match(resumeHint, /designed layouts' rules and bars are left out/);
    assert.match(resumeHint, /Sidebar's side column/);
    assert.doesNotMatch(resumeHint, /photo|coloured column|without its banner/i);
    const letterHint = await hint(true, 'Export Cover Letter Word');
    assert.match(letterHint, /An editable document/);
    assert.doesNotMatch(letterHint, /without its photo/, 'the letter\'s .docx prints its photo (R4-DOUT-06)');
  });
});
