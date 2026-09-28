// R4-DPH-42: the STAR / Bullet Optimizer's six power-verb categories (Leadership, Technical,
// Performance, Cost, Innovation, Collaboration — about 420 px) were a sideways strip capped at
// max-w-[280px] beside the heading, in a row that could not wrap. On a phone the strip shrank to about
// 200 px, Performance cut in half and the last three out of sight; on a desktop the cap still hid about
// 130 px of them, and the strip's no-scrollbar is a class no stylesheet defines. The row and the
// categories wrap now: all six beside the heading on a desktop, on their own lines under it on a phone.
// The fake DOM has no layout: the real modal is mounted (103-r4-optimizer-helpers.mjs) and the classes
// the row is laid out by are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { optimizer, classes } from './103-r4-optimizer-helpers.mjs';

before(setup);
after(teardown);

const CATEGORIES = ['Leadership', 'Technical', 'Performance', 'Cost', 'Innovation', 'Collaboration'];

it('R4-DPH-42: the power-verb categories wrap, none hidden in a capped sideways strip', async () => {
  const o = await optimizer('Led the migration of 40 services');
  try {
    const performance = o.find('BUTTON', 'Performance');
    assert.ok(performance, 'the Performance category');
    const strip = performance.parentNode;
    assert.deepEqual(strip.childNodes.map((el) => el.textContent.trim()), CATEGORIES, 'the six categories, together');
    const c = classes(strip);
    assert.ok(c.includes('flex-wrap'), `the categories wrap: ${c.join(' ')}`);
    for (const token of ['overflow-x-auto', 'no-scrollbar', 'max-w-[280px]']) {
      assert.ok(!c.includes(token), `no ${token}: ${c.join(' ')}`);
    }
    const row = strip.parentNode;
    assert.ok(row.textContent.includes('Choose Strong Power Verb'), 'the row with the heading');
    assert.ok(classes(row).includes('flex-wrap'), `and the row wraps, so they can go under the heading: ${classes(row).join(' ')}`);
  } finally {
    await o.unmount();
  }
});
