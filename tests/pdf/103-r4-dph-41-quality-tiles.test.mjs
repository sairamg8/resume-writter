// R4-DPH-41 (and R4-DPH-43, the same tiles): the STAR / Bullet Optimizer's three quality tiles were a
// grid-cols-3 at every width. On a 375 px phone a third of the body leaves a tile's label about 53 px
// (about 64 px in the full-screen dialog), and "Quantifiable" (of "Quantifiable Metric", shown once the
// statement has a number) is about 70 px and cannot break, so it ran through its tile's right border.
// The tiles stack below sm now (grid-cols-1) and stand three to a row from sm, as before. The fake DOM
// has no layout: the real modal is mounted (103-r4-optimizer-helpers.mjs) and the grid's classes are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { optimizer, classes } from './103-r4-optimizer-helpers.mjs';

before(setup);
after(teardown);

it('R4-DPH-41: the quality tiles stack on a phone and stand three to a row from sm', async () => {
  const o = await optimizer('Cut latency by 45%');
  try {
    const metric = o.find('SPAN', 'Quantifiable Metric');
    assert.ok(metric, 'a statement with a number shows "Quantifiable Metric"');
    const grid = metric.parentNode.parentNode;
    const c = classes(grid);
    assert.ok(c.includes('grid'), `the tiles' grid: ${c.join(' ')}`);
    assert.equal(grid.childNodes.length, 3, 'the three tiles');
    assert.ok(c.includes('grid-cols-1') && c.includes('sm:grid-cols-3'), `one column on a phone, three from sm: ${c.join(' ')}`);
    assert.ok(!c.includes('grid-cols-3'), `no three columns at every width: ${c.join(' ')}`);
  } finally {
    await o.unmount();
  }
});
