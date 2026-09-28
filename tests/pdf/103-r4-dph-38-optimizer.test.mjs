// R4-DPH-38 (the Bullet / STAR Optimizer's part): its footer was one row that could not wrap — Copy on
// the left, Cancel and Apply in a group on the right — and at 375 px the three were wider than the row
// (by about 40 px after "Copy failed"), so the buttons shrank and "Apply to Resume" broke onto two
// lines. The actions are the kit Dialog's footer now: one row that wraps, of kit buttons that never
// shrink or break their label, Copy held at the row's start. The fake DOM has no layout: the real
// modal is mounted (103-r4-optimizer-helpers.mjs) and the classes the row is laid out by are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { optimizer, classes } from './103-r4-optimizer-helpers.mjs';

before(setup);
after(teardown);

it('R4-DPH-38: the optimizer\'s actions wrap as one row, and no button shrinks or breaks its label', async () => {
  const o = await optimizer('Led the migration of 40 services');
  try {
    const copy = o.find('BUTTON', 'Copy');
    const cancel = o.find('BUTTON', 'Cancel');
    const apply = o.find('BUTTON', 'Apply to Resume');
    assert.ok(copy && cancel && apply, 'Copy, Cancel and Apply to Resume');

    const row = cancel.parentNode;
    assert.ok(copy.parentNode === row && apply.parentNode === row, 'the three are in one row, with no group inside it that cannot wrap');
    assert.ok(classes(row).includes('flex-wrap'), `the row wraps: ${classes(row).join(' ')}`);
    for (const [name, el] of [['Copy', copy], ['Cancel', cancel], ['Apply to Resume', apply]]) {
      for (const token of ['whitespace-nowrap', 'shrink-0']) {
        assert.ok(classes(el).includes(token), `${name} has ${token}: ${classes(el).join(' ')}`);
      }
    }
    assert.ok(classes(copy).includes('mr-auto'), `Copy stays at the row's start: ${classes(copy).join(' ')}`);
  } finally {
    await o.unmount();
  }
});
