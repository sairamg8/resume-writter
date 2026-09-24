// Two Templates-UI audit leftovers filed together as R2-133. The dashboard card printed the stored
// template id under CSS `capitalize` ("Foo" for an id the app does not offer, which opens and prints
// as Classic) instead of the name the editor shows (templateLabel). And Export Word gave no hint that
// the .docx is the résumé's text — no photo, no banner or coloured column — so a Modern résumé with a
// photo came out plain with no word why.
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

  it('Export Word says what the .docx leaves out', async () => {
    const { ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx');
    const noop = () => {};
    const view = mount(ExportDropdown, { exporting: false, onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onImportJSON: noop });
    try {
      const button = (label) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && text(el) === label);
      view.act(() => reactProps(button('Export')).onClick());
      const word = button('Export Word');
      assert.ok(word, 'the menu is open');
      assert.match(word.getAttribute('title') || '', /photo/i);
      assert.match(word.getAttribute('title') || '', /banner/i);
    } finally {
      await view.unmount();
    }
  });
});
