// R4-DPH-13: on a phone, a job's "Mark as: On Hold / Rejected / Withdrawn" group (~354 px on one line)
// is wider than its card (~301 px), but it could not wrap: it squeezed instead, so "Mark as:" and "On
// Hold" each broke onto two lines inside themselves. The group wraps now (flex-wrap), and the label
// and the pills do not break inside (whitespace-nowrap): Withdrawn moves to the next line whole. The
// fake DOM has no layout, so this reads the classes the browser lays the group out by, on the real
// Pipeline (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

it('R4-DPH-13: the "Mark as:" group wraps between its pills, and neither the label nor a pill breaks inside', async () => {
  const { Pipeline } = await loadModule('/src/components/job/Pipeline.jsx');
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(Pipeline, { status: 'applied', onChange: () => {} });
  try {
    const all = [...dom.elements(view.container)];
    const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const label = all.find((el) => el.tagName === 'SPAN' && el.textContent === 'Mark as:');
    assert.ok(label, 'the group is drawn');
    assert.ok(classes(label).includes('whitespace-nowrap'), `"Mark as:" stays on one line: ${classes(label).join(' ')}`);

    const group = label.parentNode;
    const g = classes(group);
    assert.ok(g.includes('flex') && g.includes('flex-wrap'), `the group wraps: ${g.join(' ')}`);
    assert.ok(g.includes('ml-auto'), 'and still sits at the right where it fits beside "Move to"');

    for (const name of ['On Hold', 'Rejected', 'Withdrawn']) {
      const pill = all.find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === name);
      assert.ok(pill, `${name} is drawn`);
      assert.equal(pill.parentNode, group, `${name} is in the group`);
      assert.ok(classes(pill).includes('whitespace-nowrap'), `${name} stays whole: ${classes(pill).join(' ')}`);
    }
  } finally {
    await view.unmount();
  }
});
