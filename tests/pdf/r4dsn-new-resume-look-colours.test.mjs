// R4-DSN-03: with no résumé yet, New Resume's looks (/new) and the starters' Template row are drawn in
// the colours the new résumé gets. They were built over no settings, so each picture took the template's
// own default accent (the mock's blue #2563eb, Gridline's navy, Keel's red…) while the résumé a click made
// started on the app's dark grey (#374151): the page did not show what picking it makes (R3-012).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** The markup of the element whose data-testid is `id`, up to its closing button. */
function buttonHtml(html, id) {
  const at = html.indexOf(`data-testid="${id}"`);
  assert.ok(at >= 0, id);
  return html.slice(at, html.indexOf('</button>', at));
}

describe('With no résumé yet, the looks show the colours a click gives (R4-DSN-03)', () => {
  it('every template card on /new and in the Template row is drawn in the accent of the résumé it makes', async () => {
    const { NewResume } = await loadModule('/src/pages/NewResume.jsx');
    const { pickerCards } = await loadModule('/src/utils/templatePicker.js');
    const { cardLook } = await loadModule('/src/components/TemplateThumb.jsx');
    const { createBlankResume } = await loadModule('/src/utils/defaultData.js');
    const { withLook } = await loadModule('/src/utils/templateSwitch.js');
    const store = {
      appState: { resumes: [], deletedIds: [], activeId: null, jobs: [] },
      persistError: null, recovery: null, createResume: () => 'resume_new',
    };
    const html = renderToString(createElement(MemoryRouter, { initialEntries: ['/new'] }, createElement(NewResume, { store })));
    const plain = pickerCards({}).filter((c) => !c.preset);
    assert.ok(plain.length > 5);
    for (const c of plain) {
      const made = withLook(createBlankResume({ id: 'resume_new' }), cardLook(c)).settings.accentColor;
      assert.equal(made, '#374151', c.testid);
      for (const id of [`new-${c.testid}`, `look-${c.testid}`]) {
        const card = buttonHtml(html, id).toLowerCase();
        // Minimal's mock draws grey rules and no accent at all.
        if (c.engine !== 'minimal') assert.match(card, new RegExp(made), `${id}: drawn in ${made}`);
        assert.doesNotMatch(card, /#2563eb/, `${id}: not the template's default blue`);
      }
    }
  });
});
