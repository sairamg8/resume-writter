// Typing-freeze finding 5, the rest of the outcome: what two (and three) tabs of one résumé change at
// once is all kept — entries added, deleted and moved merge by their id, a deletion in one tab is not
// undone by the copy another tab still holds, a setting one tab cleared stays cleared, two tabs hiding
// different contact fields hide both — and every tab ends on the same résumé storage holds.
// The real useAppStore under StrictMode in tabs of one localStorage (tests/pdf/xtab-tabs.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { openTabs, storeOf, savedResume, assertConverged, type } from './xtab-tabs.mjs';

before(setup);
after(teardown);

const EXP = 'sec_exp';
const ids = (tab, section = EXP) => tab.resume().sections.find((s) => s.id === section).items.map((i) => i.id);
const role = (tab, id) => tab.resume().sections.find((s) => s.id === EXP).items.find((i) => i.id === id)?.role;
const entry = (id, company) => ({ id, company, role: '', location: '', startDate: '', endDate: '', current: false, description: '' });

async function tabs(n, body) {
  const t = await openTabs(n, storeOf([savedResume()]));
  try { await body(t, ...t.tabs); } finally { await t.close(); }
}

describe('entries, deletions and settings across tabs (typing-freeze 5)', () => {
  it('one tab adds an entry and edits another while the other deletes one and edits a third: all of it stays', () => tabs(2, async (t, a, b) => {
    await a.edit((s) => { s.addItem(EXP, entry('n1', 'New Co')); s.updateItem(EXP, 'e_a', (i) => ({ ...i, role: 'Lead' })); });
    await b.edit((s) => { s.removeItem(EXP, 'e_b'); s.updateItem(EXP, 'e_c', (i) => ({ ...i, role: 'QA' })); });
    await b.flush();
    await a.deliver();
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.deepEqual(ids(tab), ['e_a', 'e_c', 'n1'], `tab ${tab.name}`);
      assert.equal(role(tab, 'e_a'), 'Lead');
      assert.equal(role(tab, 'e_c'), 'QA');
    }
    assertConverged(assert, t);
  }));

  it('an entry one tab deleted and the other edited is deleted in both, whichever saved first', async () => {
    for (const first of ['the deleting tab', 'the editing tab']) {
      await tabs(2, async (t, a, b) => {
        await a.edit((s) => s.removeItem(EXP, 'e_b'));
        await b.edit((s) => s.updateItem(EXP, 'e_b', (i) => ({ ...i, role: 'Edited meanwhile' })));
        if (first === 'the deleting tab') { await a.flush(); await b.deliver(); } else { await b.flush(); await a.deliver(); }
        await t.quiesce();
        for (const tab of [a, b]) assert.deepEqual(ids(tab), ['e_a', 'e_c'], `${first}: tab ${tab.name}`);
        assertConverged(assert, t);
      });
    }
  });

  it('a deletion in one tab is not undone by the copy the other tab still holds while it types', () => tabs(2, async (t, a, b) => {
    await type(a, 'website', 'https://exa');
    await b.edit((s) => s.removeItem(EXP, 'e_a'));
    await b.edit((s) => s.removeItem('sec_edu', 'o_a'));
    await b.flush();
    await a.deliver(); // A still holds both entries, and has unsaved typing
    await type(a, 'website', 'mple.com');
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.deepEqual(ids(tab), ['e_b', 'e_c'], `tab ${tab.name}: before, A's copy put e_a back`);
      assert.deepEqual(ids(tab, 'sec_edu'), [], `tab ${tab.name}`);
      assert.equal(tab.resume().personal.website, 'https://example.com');
    }
    assert.deepEqual(t.saved().resumes[0].sections[0].items.map((i) => i.id), ['e_b', 'e_c'], 'storage too');
    assertConverged(assert, t);
  }));

  it('a setting one tab cleared stays cleared while the other types', () => tabs(2, async (t, a, b) => {
    await type(a, 'website', 'itsairam');
    await b.edit((s) => s.clearSettings(['tfProbe']));
    await b.flush();
    await a.deliver();
    await type(a, 'website', '.netlify.app');
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.equal('tfProbe' in tab.resume().settings, false, `tab ${tab.name}: the key is back`);
      assert.ok('accentColor' in tab.resume().settings, `tab ${tab.name}: the other settings stay`);
      assert.equal(tab.resume().personal.website, 'itsairam.netlify.app');
    }
    assertConverged(assert, t);
  }));

  it('entries one tab moved and the other added or edited: the moved order and both changes', () => tabs(2, async (t, a, b) => {
    await b.edit((s) => s.reorderItems(EXP, 2, 0)); // e_c to the front
    await a.edit((s) => { s.addItem(EXP, entry('n1', 'New Co')); s.updateItem(EXP, 'e_a', (i) => ({ ...i, role: 'Lead' })); });
    await b.flush();
    await a.deliver();
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.deepEqual(ids(tab), ['e_c', 'e_a', 'e_b', 'n1'], `tab ${tab.name}`);
      assert.equal(role(tab, 'e_a'), 'Lead');
    }
    assertConverged(assert, t);
  }));

  it('two tabs adding an entry each, and a section each: all four stay, in the same order in both', () => tabs(2, async (t, a, b) => {
    await a.edit((s) => { s.addItem(EXP, entry('n_a', 'From A')); s.addSection('skills'); });
    await b.edit((s) => { s.addItem(EXP, entry('n_b', 'From B')); s.addSection('awards'); });
    await a.flush();
    await b.deliver();
    await t.quiesce();
    assert.deepEqual(ids(a).sort(), ['e_a', 'e_b', 'e_c', 'n_a', 'n_b']);
    assert.deepEqual(ids(a), ids(b), 'the same order in both tabs');
    assert.deepEqual(a.resume().sections.map((s) => s.type).sort(), ['awards', 'experience', 'experience', 'skills']);
    assert.deepEqual(a.resume().sections.map((s) => s.id), b.resume().sections.map((s) => s.id));
    assertConverged(assert, t);
  }));

  it('two tabs hiding different contact fields: both stay hidden', () => tabs(2, async (t, a, b) => {
    await a.edit((s) => s.toggleFieldVisibility('email'));
    await b.edit((s) => s.toggleFieldVisibility('phone'));
    await b.flush();
    await a.deliver();
    await t.quiesce();
    for (const tab of [a, b]) assert.deepEqual([...tab.resume().personal.hiddenFields].sort(), ['email', 'phone'], `tab ${tab.name}`);
    assert.deepEqual(a.resume().personal.hiddenFields, b.resume().personal.hiddenFields);
    assertConverged(assert, t);
  }));

  it('three tabs typing in three fields, one adding an entry and one deleting one: everything is kept', () => tabs(3, async (t, a, b, c) => {
    await type(a, 'website', 'https://exa');
    await type(b, 'jobTitle', 'Staff');
    await c.edit((s) => { s.addItem(EXP, entry('n_c', 'From C')); });
    await type(c, 'phone', '555 01');
    await b.edit((s) => s.removeItem(EXP, 'e_b'));
    await b.flush();
    await a.deliver();
    await type(a, 'website', 'mple.com');
    await c.deliver(1);
    await c.flush();
    await a.flush();
    await type(b, 'jobTitle', ' Engineer');
    await c.deliver();
    await type(c, 'phone', '99');
    await t.quiesce();
    for (const tab of [a, b, c]) {
      assert.equal(tab.resume().personal.website, 'https://example.com', `tab ${tab.name}`);
      assert.equal(tab.resume().personal.jobTitle, 'Staff Engineer', `tab ${tab.name}`);
      assert.equal(tab.resume().personal.phone, '555 0199', `tab ${tab.name}`);
      assert.deepEqual(ids(tab).sort(), ['e_a', 'e_c', 'n_c'], `tab ${tab.name}`);
    }
    assertConverged(assert, t);
  }));

  it('older saved data — a store with no deletedInfo or owner, a résumé at an older data version — loads in both tabs and merges the same', async () => {
    const old = { resumes: [{ ...savedResume(), dataVersion: 11 }], activeId: 'resume_x', dataVersion: 11 };
    const t = await openTabs(2, old);
    try {
      const [a, b] = t.tabs;
      await type(a, 'website', 'itsairam.netlify.app');
      await b.edit((s) => { s.updatePersonal('name', 'Casey R. Example'); s.removeItem(EXP, 'e_c'); });
      await b.flush();
      await a.deliver();
      await t.quiesce();
      for (const tab of [a, b]) {
        assert.equal(tab.resume().personal.website, 'itsairam.netlify.app', `tab ${tab.name}`);
        assert.equal(tab.resume().personal.name, 'Casey R. Example', `tab ${tab.name}`);
        assert.deepEqual(ids(tab), ['e_a', 'e_b'], `tab ${tab.name}`);
      }
      assertConverged(assert, t);
    } finally { await t.close(); }
  });

  it('after everything is said the tabs stay quiet: nothing is written again', () => tabs(3, async (t, a, b, c) => {
    await type(a, 'website', 'itsairam');
    await type(b, 'jobTitle', 'Staff');
    await type(c, 'phone', '555');
    await t.quiesce();
    const writes = t.storage.writes;
    await t.quiesce();
    for (const tab of [a, b, c]) { await tab.deliver(); await tab.flush(); }
    assert.equal(t.storage.writes, writes);
    assertConverged(assert, t);
  }));
});
