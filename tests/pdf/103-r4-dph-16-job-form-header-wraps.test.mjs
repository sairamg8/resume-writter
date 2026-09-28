// R4-DPH-16: on a phone (375 px) the job form's sticky header put the back arrow, the title and
// Cancel + Save Changes in one row that could not wrap — "max-w-3xl mx-auto px-6 py-4 flex
// items-center gap-3", a title with no min-w-0, buttons that wrapped their labels — so the row
// squeezed everything to its min-content: "Edit Job / Application" on two lines and "Save /
// Changes" broken inside its button, the header 8 px further in than the cards (px-6 against px-4).
// The header is the shell's PageHeader now: its row wraps, the title block can shrink (min-w-0) and
// the title truncates to one line, the actions go under it with one-line kit buttons, at the body's
// px-4. The fake DOM has no layout: this reads the real JobForm's structure and class tokens
// (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);

/** `el` and its ancestors up to (not past) `top`, nearest first. */
function upTo(el, top) {
  const chain = [];
  for (let n = el; n && n !== top.parentNode; n = n.parentNode) chain.push(n);
  return chain;
}

it('R4-DPH-16: the job form\'s header row wraps on a phone — a one-line title that can shrink, the actions under it on one line each', async () => {
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { elements } = await import('./fake-dom.mjs');
  const form = h(JobForm, { store: { appState: { resumes: [] } } });
  const page = await atRoute('/jobs/a/edit', { '/jobs/:id/edit': form, '/jobs/:id': h('p', null, 'DETAIL') }, [acme]);
  try {
    const h1 = page.all().find((el) => el.tagName === 'H1');
    assert.ok(h1, 'the page has its title');
    const top = upTo(h1, page.view.container).find((el) => el.tagName === 'HEADER' || classes(el).includes('sticky'));
    assert.ok(top, 'the title is in the sticky header');
    const inHeader = [...elements(top)];
    const save = inHeader.find((el) => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit');
    const cancel = inHeader.find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Cancel');
    assert.equal(save?.textContent.trim(), 'Save Changes');
    assert.ok(cancel, 'the header has its Cancel');

    // One line for the title: it truncates, and it or a block around it can shrink below its text.
    const chain = upTo(h1, top);
    assert.ok(classes(h1).includes('truncate'), `the title truncates (class="${h1.getAttribute('class')}")`);
    assert.ok(chain.some((el) => classes(el).includes('min-w-0')), 'the title can shrink in its row (min-w-0)');

    // The row holding the title and the buttons wraps, so on a phone the buttons go under the title.
    const row = chain.find((el) => classes(el).includes('flex') && classes(el).includes('flex-wrap') && el.contains(save));
    assert.ok(row, `the title's row wraps and holds the actions (${chain.map((el) => el.getAttribute('class')).join(' | ')})`);
    assert.ok(row.contains(cancel));

    // Each button keeps its label on one line.
    for (const b of [cancel, save]) assert.ok(classes(b).includes('whitespace-nowrap'), `${b.textContent.trim()}: whitespace-nowrap`);

    // The header's side padding is the body's on a phone: px-4, not px-6.
    for (const el of inHeader) {
      const c = classes(el);
      assert.ok(!(c.includes('px-6') && !c.includes('px-4')), `no px-6 gutter in the header (class="${el.getAttribute('class')}")`);
    }
    assert.ok(inHeader.some((el) => classes(el).includes('px-4')), 'the header is padded px-4 on a phone, as the cards');
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});
