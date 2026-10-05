// Typing-freeze finding 5, the write that races the other tab's save. A tab wrote its whole store without
// looking at what storage held: when the other tab's save had landed but its `storage` event had not
// reached this tab yet — a few milliseconds, with both tabs typing — this tab's write replaced it, and
// the event then made the other tab read this tab's write as the other's save. The edit the other tab
// had just saved was gone from storage and from both tabs. Now a tab reads storage right before it
// writes: a value it has not taken is taken in first (the same merge as the event's), and what is written
// is this tab's changes over it; a value it wrote or took itself is not taken twice.
// The real useAppStore under StrictMode in tabs of one localStorage (tests/pdf/xtab-tabs.mjs), the tabs
// writing before they hear (`race: true`).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { KEY, openTabs, storeOf, savedResume, assertConverged, type } from './xtab-tabs.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

before(setup);
after(teardown);

async function tabs(n, body, state = storeOf([savedResume()])) {
  const t = await openTabs(n, state);
  try { await body(t, ...t.tabs); } finally { await t.close(); }
}

describe('a tab writes before it has heard the other tab\'s save (typing-freeze 5)', () => {
  it('A saves Website, then B — whose event for it is still on its way — saves Full Name: both are in storage and in both tabs', () => tabs(2, async (t, a, b) => {
    await type(a, 'website', 'https://example.com');
    await a.flush();
    assert.equal(b.store().appState.resumes[0].personal.website, '', 'B has not heard');
    await b.edit((s) => s.updatePersonal('name', 'Casey R. Example'), { race: true });
    await b.flush({ race: true });
    assert.equal(t.saved().resumes[0].personal.website, 'https://example.com', 'before: B\'s write replaced A\'s save in storage');
    assert.equal(t.saved().resumes[0].personal.name, 'Casey R. Example');
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.equal(tab.resume().personal.website, 'https://example.com', `tab ${tab.name}`);
      assert.equal(tab.resume().personal.name, 'Casey R. Example', `tab ${tab.name}`);
    }
    assertConverged(assert, t);
  }));

  it('both tabs write at the same moment, each with typing the other has not heard: nothing is lost', () => tabs(2, async (t, a, b) => {
    await type(a, 'website', 'itsairam.netlify.app');
    await type(b, 'jobTitle', 'Staff Engineer');
    await b.edit((s) => s.addItem('sec_exp', { id: 'n_b', company: 'New Co', role: '', location: '', startDate: '', endDate: '', current: false, description: '' }), { race: true });
    await a.flush({ race: true });
    await b.flush({ race: true });
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.equal(tab.resume().personal.website, 'itsairam.netlify.app', `tab ${tab.name}`);
      assert.equal(tab.resume().personal.jobTitle, 'Staff Engineer', `tab ${tab.name}`);
      assert.deepEqual(tab.resume().sections[0].items.map((i) => i.id), ['e_a', 'e_b', 'e_c', 'n_b'], `tab ${tab.name}`);
    }
    assertConverged(assert, t);
  }));

  it('three tabs, each writing before it has heard the others', () => tabs(3, async (t, a, b, c) => {
    await type(a, 'website', 'a.example');
    await type(b, 'jobTitle', 'Staff');
    await type(c, 'phone', '555 0100');
    await a.flush({ race: true });
    await b.flush({ race: true });
    await c.flush({ race: true });
    await t.quiesce();
    for (const tab of [a, b, c]) {
      assert.deepEqual(
        [tab.resume().personal.website, tab.resume().personal.jobTitle, tab.resume().personal.phone],
        ['a.example', 'Staff', '555 0100'],
        `tab ${tab.name}`,
      );
    }
    assertConverged(assert, t);
  }));

  it('a save the tab took already is not taken again, and a tab answers nobody it does not have to: two writes for two tabs\' edits', () => tabs(2, async (t, a, b) => {
    const writes = t.storage.writes;
    await a.edit((s) => s.updatePersonal('website', 'a.example'));
    await b.edit((s) => s.updatePersonal('name', 'Casey R. Example'));
    await a.flush({ race: true });
    await b.flush({ race: true });
    await t.quiesce();
    assert.equal(t.storage.writes, writes + 2, 'A writes, B takes A\'s in and writes both; neither answers again');
    assertConverged(assert, t);
  }));

  it('the sign-out guard holds when the write races it: the account\'s résumés are not put back, what was typed is kept aside for it', async () => {
    const UID = 'uid_casey';
    const resume = savedResume();
    const state = { ...storeOf([resume]), syncedUid: UID, cloudVersions: { [resume.id]: resume.updatedAt } };
    await tabs(2, async (t, a, b) => {
      await type(a, 'name', '!'); // unsaved here: storage has not seen it
      // The other tab signs out (its leave writes the list empty, no owner) before A has heard.
      t.storage.writer = b;
      t.storage.setItem(KEY, JSON.stringify({ resumes: [], activeId: null, dataVersion: DATA_VERSION, deletedIds: [], deletedInfo: {}, syncedUid: null, stashed: {} }));
      t.storage.writer = null;
      await a.flush({ race: true });
      const saved = t.saved();
      assert.deepEqual(saved.resumes, [], 'before: A\'s write put the signed-out account\'s résumé back into the browser');
      assert.equal(saved.syncedUid, null);
      assert.equal(saved.stashed?.[UID]?.resumes?.[0]?.personal?.name, 'Casey Example!', 'what A typed is kept aside for the account');
      await t.quiesce();
      assert.deepEqual(a.store().appState.resumes, []);
      assert.deepEqual(b.store().appState.resumes, []);
    }, state);
  });

  it('a write after a save that was never heard of is still one write: the tab\'s own value is not taken as another tab\'s', () => tabs(2, async (t, a) => {
    await a.edit((s) => s.updatePersonal('website', 'a.example'));
    await a.flush();
    const writes = t.storage.writes;
    await a.edit((s) => s.updatePersonal('website', 'a.example.com'));
    await a.flush();
    assert.equal(t.storage.writes, writes + 1);
    assert.equal(t.saved().resumes[0].personal.website, 'a.example.com');
    await t.quiesce();
  }));
});
