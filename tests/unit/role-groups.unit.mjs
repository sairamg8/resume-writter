// R2-147 (grouped roles) — src/utils/roleGroups.js, which the PDF's renderers, Word and Markdown group
// Experience's roles by: consecutive entries at one company (trimmed, any case, not empty) form a group;
// a hidden or empty company, or another job between two, groups nothing; off, every entry stands alone.
// A group's first location heads it, and a later role keeps its own only where it differs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { employerOf, groupPlaces, groupsRoles, roleGroups } from '../../src/utils/roleGroups.js';

const job = (company, extra = {}) => ({ company, role: 'R', ...extra });
const shape = (groups) => groups.map((g) => g.length);

test('consecutive roles at one company, trimmed and in any case, form a group, in order', () => {
  const items = [job('Northwind Labs'), job(' northwind LABS '), job('Contoso'), job('Contoso')];
  const groups = roleGroups(items);
  assert.deepEqual(shape(groups), [2, 2]);
  assert.equal(groups[0][1], items[1]);
});

test('a job between two, an empty or hidden company, and off: nothing groups', () => {
  assert.deepEqual(shape(roleGroups([job('A'), job('B'), job('A')])), [1, 1, 1]);
  assert.deepEqual(shape(roleGroups([job(''), job('')])), [1, 1]);
  assert.deepEqual(shape(roleGroups([job('A'), job('A', { hiddenFields: ['company'] })])), [1, 1]);
  assert.deepEqual(shape(roleGroups([job('A'), job('A')], false)), [1, 1]);
  assert.deepEqual(roleGroups(undefined), []);
});

test('the option is on only when stored true', () => {
  assert.equal(groupsRoles({ groupRoles: true }), true);
  for (const s of [{}, { groupRoles: false }, undefined, { groupRoles: 'yes' }]) assert.equal(groupsRoles(s), false);
});

test('employerOf: the company as it prints, trimmed; none when its eye hides it', () => {
  assert.equal(employerOf(job('  Acme  ')), 'Acme');
  assert.equal(employerOf(job('Acme', { hiddenFields: ['company'] })), '');
  assert.equal(employerOf({}), '');
});

test('groupPlaces: the first role\'s location heads the group; a later one prints only where it differs', () => {
  const at = (location) => job('A', { location });
  const place = (item) => item.location;
  assert.deepEqual(groupPlaces([at('Lisbon'), at(' lisbon ')], place), { header: 'Lisbon', roles: ['', ''] });
  assert.deepEqual(groupPlaces([at('Lisbon'), at('Porto')], place), { header: 'Lisbon', roles: ['', 'Porto'] });
  assert.deepEqual(groupPlaces([at(''), at('Porto')], place), { header: '', roles: ['', 'Porto'] });
});
