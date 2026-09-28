// R4-DPH-20: a job's Notes tab was the one card on the job page drawn apart from the rest — rounded-2xl,
// a border-gray-100 edge, p-6, and a text-gray-400 label — where the Overview and Tasks tabs' cards are
// rounded-md, border-line, p-5, with text-ink-subtlest labels. It showed on switching tabs, and the
// p-6 cost a phone's editor width. The Notes card is drawn as theirs now. The fake DOM has no layout,
// so this reads the classes the card is drawn by, on the real NotesTab (tests/pdf/fake-dom.mjs, loaded
// through Vite; patchFakeDom for the rich-text editor inside it).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

it('R4-DPH-20: the Notes card has the job page\'s card radius, edge, padding and label colour', async () => {
  const { NotesTab } = await loadModule('/src/components/job/NotesTab.jsx');
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const view = dom.mount(NotesTab, { job: { id: 'a', company: 'Acme', notes: '' }, set: () => {} });
  try {
    const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const card = view.container.childNodes.find((el) => el.tagName === 'DIV');
    assert.ok(card, 'the Notes card is drawn');
    const c = classes(card);
    for (const token of ['bg-white', 'rounded-md', 'border', 'border-line', 'p-5', 'shadow-sm']) {
      assert.ok(c.includes(token), `the card has ${token}, as the Overview and Tasks cards: ${c.join(' ')}`);
    }
    for (const token of ['rounded-2xl', 'border-gray-100', 'p-6']) {
      assert.ok(!c.includes(token), `and not ${token}: ${c.join(' ')}`);
    }

    const label = card.childNodes[0];
    assert.equal(label.tagName, 'P');
    assert.equal(label.textContent, 'Notes');
    assert.ok(classes(label).includes('text-ink-subtlest') && !classes(label).includes('text-gray-400'), `the label in the page's label colour: ${classes(label).join(' ')}`);
    assert.ok([...dom.elements(card)].some((el) => el.getAttribute('role') === 'textbox'), 'and the notes editor is in the card');
  } finally {
    await view.unmount();
  }
});
