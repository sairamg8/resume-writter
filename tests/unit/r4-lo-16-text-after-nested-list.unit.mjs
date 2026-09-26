// R4-LO-16: text after a nested list, inside the same outer list item, prints at the outer item's depth
// and continues it — but the ATS bullets glued it onto the nested bullet above it ("Cut costs by 30%
// for 3 regions" instead of "Led migration for 3 regions"). It now continues the item it belongs to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBulletsFromItem } from '../../src/utils/atsChecker.js';

test('text after a nested list continues the outer item', () => {
  const item = { description: '<ul><li>Led migration<ul><li>Cut costs by 30%</li></ul>for 3 regions</li><li>Built CI</li></ul>' };
  assert.deepEqual(extractBulletsFromItem(item), ['Led migration for 3 regions', 'Cut costs by 30%', 'Built CI']);
});

test('a continuation paragraph of a nested item stays with that item', () => {
  const item = { description: '<ul><li>Led migration<ul><li><p>Cut costs</p><p>by 30%</p></li></ul></li></ul>' };
  assert.deepEqual(extractBulletsFromItem(item), ['Led migration', 'Cut costs by 30%']);
});
