// R5-JOB-05: an on-hold job's "Close as: Rejected / Withdrawn" row (~261 px on one line) is wider
// than its card on a 320 px phone (~246 px), but it could not wrap: it squeezed instead, so
// "Close as:" broke onto two lines inside itself. It behaves as "Mark as:" does now (R4-DPH-13):
// the row wraps (flex-wrap) and the label and the pills do not break inside (whitespace-nowrap),
// so Withdrawn moves to the next line whole. The fake DOM has no layout, so this reads the classes
// the browser lays the row out by, on the real Pipeline (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

it('R5-JOB-05: the on-hold "Close as:" row wraps between its pills, and neither the label nor a pill breaks inside', async () => {
  const { Pipeline } = await loadModule('/src/components/job/Pipeline.jsx');
  const dom = await import('./fake-dom.mjs');
  const picked = [];
  const view = dom.mount(Pipeline, { status: 'on_hold', onChange: (s) => picked.push(s) });
  try {
    const all = [...dom.elements(view.container)];
    const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const label = all.find((el) => el.tagName === 'SPAN' && el.textContent === 'Close as:');
    assert.ok(label, 'the row is drawn');
    assert.ok(classes(label).includes('whitespace-nowrap'), `"Close as:" stays on one line: ${classes(label).join(' ')}`);

    const row = label.parentNode;
    const r = classes(row);
    assert.ok(r.includes('flex') && r.includes('flex-wrap'), `the row wraps: ${r.join(' ')}`);

    for (const [name, status] of [['Rejected', 'rejected'], ['Withdrawn', 'withdrawn']]) {
      const pill = all.find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === name);
      assert.ok(pill, `${name} is drawn`);
      assert.equal(pill.parentNode, row, `${name} is in the row`);
      assert.ok(classes(pill).includes('whitespace-nowrap'), `${name} stays whole: ${classes(pill).join(' ')}`);
      view.act(() => dom.reactProps(pill).onClick());
      assert.equal(picked.at(-1), status, `${name} still closes the job as ${status}`);
    }
  } finally {
    await view.unmount();
  }
});
