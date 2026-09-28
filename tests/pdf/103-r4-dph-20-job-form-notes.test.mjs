// R4-DPH-20 (the job form's part): the Add / Edit job form's Notes card was padded p-6 on every
// screen, where its sibling cards (Basic Info, Status & Dates, Interview Stage, Contact & Resume) are
// p-4 on a phone and p-6 from sm up — so at 375 px the notes editor sat 16 px narrower than the
// fields above it and its heading 8 px further in. It wears the same padding pair now. The fake DOM
// has no layout: this reads the class tokens of the real JobForm's cards (tests/pdf/fake-dom.mjs,
// loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);

it('R4-DPH-20: the job form\'s Notes card is p-4 on a phone and p-6 from sm up, as every other card of the form', async () => {
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { elements } = await import('./fake-dom.mjs');
  const page = await atRoute('/jobs/new', { '/jobs/new': h(JobForm, { store: { appState: { resumes: [] } } }) }, []);
  try {
    // A card's own heading, however deep its header row puts it (the stage picker's is two divs down).
    const heading = (el) => [...elements(el)].find((n) => n.tagName === 'H2');
    const cards = page.all().filter((el) => el.tagName === 'SECTION' && heading(el));
    const notes = cards.find((el) => heading(el).textContent.trim() === 'Notes');
    assert.ok(notes, 'the Notes card is on the form');
    const c = classes(notes);
    assert.ok(c.includes('p-4') && c.includes('sm:p-6'), `the Notes card is p-4 sm:p-6: ${c.join(' ')}`);
    assert.ok(!c.includes('p-6'), `and no bare p-6 on a phone: ${c.join(' ')}`);

    assert.ok(cards.length >= 5, `the form's cards are found (${cards.map((el) => heading(el).textContent).join(', ')})`);
    for (const card of cards) {
      const k = classes(card);
      assert.ok(k.includes('p-4') && k.includes('sm:p-6') && !k.includes('p-6'), `${heading(card).textContent}: p-4 sm:p-6 (${k.join(' ')})`);
    }
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});
