// Typing-freeze finding 5: two tabs of the same résumé typing at once lost edits. Tab A typing Website
// (or Full Name) while tab B edited a DIFFERENT field once, or with four characters: B's edit, or A's
// later characters, vanished in both tabs. The store took another tab's save with keepUnsaved, which
// keeps the WHOLE résumé of a tab that has unsaved changes (the job and board stores' rule, right for a
// job list, wrong for one résumé every field of which a tab may be typing in), then wrote it back.
// Now a résumé changed in both tabs is merged field by field (src/utils/mergeResume.js): what each tab
// changed is kept, in different fields and in different parts of one text, both tabs end on the same
// résumé, and a change both made to the same part goes to the one who edited last.
// The real useAppStore under StrictMode in two tabs of one localStorage (tests/pdf/xtab-tabs.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { openTabs, storeOf, savedResume, assertConverged, type } from './xtab-tabs.mjs';

before(setup);
after(teardown);

/** Two tabs on one résumé; runs `body`, then closes them. */
async function twoTabs(body, resume = savedResume()) {
  const t = await openTabs(2, storeOf([resume]));
  try { await body(t, ...t.tabs); } finally { await t.close(); }
}

describe('two tabs typing in one résumé at once (typing-freeze 5)', () => {
  it('tab A types Website while tab B edits Full Name once: both are kept, in both tabs', () => twoTabs(async (t, a, b) => {
    await type(a, 'website', 'https://exa');
    await b.edit((s) => s.updatePersonal('name', 'Casey R. Example'));
    await b.flush();
    await a.deliver(); // B's save reaches A while A's typing is still unsaved
    await type(a, 'website', 'mple.com');
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.equal(tab.resume().personal.website, 'https://example.com', `tab ${tab.name}: A's typing`);
      assert.equal(tab.resume().personal.name, 'Casey R. Example', `tab ${tab.name}: B's edit — before, it vanished in both tabs`);
    }
    assert.equal(t.saved().resumes[0].personal.name, 'Casey R. Example');
    assertConverged(assert, t);
  }));

  it('tab A types Full Name while tab B types 4 characters in Job title, a key each: every character is kept', () => twoTabs(async (t, a, b) => {
    for (const ch of ['!', '?', '.', ',']) {
      await type(a, 'name', ch);
      await type(b, 'jobTitle', ch === '!' ? 'D' : ch === '?' ? 'e' : ch === '.' ? 'v' : 's');
      if (ch === '?') { await b.flush(); await a.deliver(); }
      if (ch === '.') { await a.flush(); await b.deliver(); }
    }
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.equal(tab.resume().personal.name, 'Casey Example!?.,', `tab ${tab.name}: A's four characters`);
      assert.equal(tab.resume().personal.jobTitle, 'Devs', `tab ${tab.name}: B's four characters`);
    }
    assertConverged(assert, t);
  }));

  it('both tabs type in different parts of ONE text: both insertions are kept, in both tabs', () => twoTabs(async (t, a, b) => {
    await type(a, 'name', 'Dr. ', 0);
    await type(b, 'name', ' Jr.');
    await b.flush();
    await a.deliver();
    await a.flush();
    await t.quiesce();
    for (const tab of [a, b]) assert.equal(tab.resume().personal.name, 'Dr. Casey Example Jr.', `tab ${tab.name}`);
    assertConverged(assert, t);
  }));

  it('both tabs type at the very same place: both texts are kept, in the same order in both tabs', () => twoTabs(async (t, a, b) => {
    const text = a.resume().personal.summary;
    await a.edit((s) => s.updatePersonal('summary', `AAA${text}`));
    await t.tick(5);
    await b.edit((s) => s.updatePersonal('summary', `BBB${text}`)); // the later edit
    await a.flush();
    await b.deliver();
    await b.flush();
    await t.quiesce();
    const summary = a.resume().personal.summary;
    assert.equal(b.resume().personal.summary, summary, 'the two tabs read the same');
    assert.equal(summary, 'AAABBB[A:][B:][C:]', 'the later writer\'s text after the earlier one\'s');
    assertConverged(assert, t);
  }));

  it('both tabs rewrite the same words: the one who edited last wins, in both tabs', async () => {
    for (const order of ['B flushes first', 'A flushes first']) {
      await twoTabs(async (t, a, b) => {
        await b.edit((s) => s.updatePersonal('name', 'Blair Example'));
        await t.tick(5);
        await a.edit((s) => s.updatePersonal('name', 'Alex Example')); // the later edit
        if (order === 'B flushes first') { await b.flush(); await a.deliver(); } else { await a.flush(); await b.deliver(); }
        await t.quiesce();
        for (const tab of [a, b]) assert.equal(tab.resume().personal.name, 'Alex Example', `${order}: tab ${tab.name}`);
        assertConverged(assert, t);
      });
    }
  });

  it('saves only taken are not written back: one write for one edit, however many tabs hear it', () => twoTabs(async (t, a, b) => {
    const writes = t.storage.writes;
    await b.edit((s) => s.updatePersonal('name', 'Casey R. Example'));
    await b.flush();
    await a.deliver();
    await t.quiesce();
    assert.equal(t.storage.writes, writes + 1, 'before the merge it was the same; the merge must not add answers');
  }));

  it('a tab typing alone writes what it typed and the other tab shows it', () => twoTabs(async (t, a, b) => {
    await type(a, 'website', 'itsairam.netlify.app');
    await t.quiesce();
    assert.equal(b.resume().personal.website, 'itsairam.netlify.app');
    assertConverged(assert, t);
  }));
});
