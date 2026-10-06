// UI rebuild B3 (hunt H1-2, H1-3; round 3 H1-1, H1-3): the ATS dock draws the panel from the résumé after the preview's
// own 250 ms pause, and the panel's "+" on a missing keyword wrote from the résumé it was DRAWN with. In the old ATS tab a
// click's write showed in the next render; with the pause the chip stayed and a second "+" within 250 ms read the résumé
// from before the first: two Skills sections when there was none, or the first keyword dropped from the group when there
// was one. The buttons now act on the LATEST résumé (the dock's `getLatest`), and nothing is drawn again by a press: the
// first attempt re-drew the panel on pointerdown, which moved the chips under the pointer between a press and its release
// (the browser then clicks their common ancestor, so the second "+" was dropped). The chips are resolved BEFORE the
// first tap and each is tapped as it was drawn, as a finger does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, until, sleep, attr, text, experience } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

// The panel shows the tick on an added keyword for 2 s (a timer of its own that sets state): the page stays mounted until it ran.
const ADDED_TICK_MS = 2000;
const JD = 'Kubernetes Kubernetes Terraform Terraform GraphQL GraphQL';
const box = (t) => t.all().find((el) => el.tagName === 'TEXTAREA' && attr(el, 'placeholder').startsWith('Paste job posting'));
const chips = (t) => t.all().filter((el) => el.tagName === 'BUTTON' && attr(el, 'title') === 'Click to add to Skills');
const skillSections = (t) => t.store().activeResume.sections.filter((s) => s.type === 'skills');

/** The ATS dock open on a posting that names `JD`'s keywords, and the chips the scan lists as missing, as they are drawn. */
async function scanOpen(options) {
  const t = await openEditor({ path: '?dock=ats', ...options });
  await until(() => box(t), 'the ATS dock shows the posting box');
  t.call(box(t), 'onChange', { target: { value: JD } });
  await until(() => chips(t).length >= 2, 'the scan lists the missing keywords');
  const drawn = chips(t);
  return { t, drawn, first: text(drawn[0]), second: text(drawn[1]) };
}

/** Closes the page once the panel's own 2 s tick after a "+" has run (a state set after the unmount would reach a window that is gone). */
async function done(t) {
  await sleep(ADDED_TICK_MS + 100);
  await t.close();
}

describe('two quick "+" on missing keywords in the ATS dock', () => {
  it('with a skill group: both keywords end up in it, the second does not undo the first', async () => {
    const { t, drawn, first, second } = await scanOpen();
    try {
      t.call(drawn[0], 'onClick');
      t.call(drawn[1], 'onClick'); // the chip as it was drawn: the first tap re-drew nothing under it
      const sections = skillSections(t);
      assert.equal(sections.length, 1);
      const skills = sections[0].items[0].skills;
      assert.ok(skills.includes(first) && skills.includes(second), `the group reads "${skills}"`);
      assert.ok(skills.startsWith('SQL, Excel, Tableau'), 'the skills that were there stay');
    } finally { await done(t); }
  });

  it('with no Skills section: one section is made, holding both keywords', async () => {
    const jobs = experience([{ company: 'Harbor Mutual', role: 'Senior Analyst', description: '<ul><li>Cut the claims backlog by 40%</li></ul>' }]);
    const { t, drawn, first, second } = await scanOpen({ extra: { sections: [jobs] } });
    try {
      assert.equal(skillSections(t).length, 0, 'no Skills section to start with');
      t.call(drawn[0], 'onClick');
      t.call(drawn[1], 'onClick');
      const sections = skillSections(t);
      assert.equal(sections.length, 1, `${sections.length} Skills sections`);
      const all = sections[0].items.map((i) => i.skills).join(', ');
      assert.ok(all.includes(first) && all.includes(second), `the section reads "${all}"`);
    } finally { await done(t); }
  });

  it('a tap does not re-draw the list under the finger: the chips stay as they were until the pause', async () => {
    const { t, drawn, first } = await scanOpen();
    try {
      const before = chips(t).map(text);
      t.call(drawn[0], 'onClick');
      assert.ok(t.store().activeResume.sections.some((s) => s.type === 'skills' && s.items.some((i) => i.skills.includes(first))), 'the keyword was written');
      assert.deepEqual(chips(t).map(text), before, 'no chip left or moved under the finger (the scan reads the new résumé after the pause)');
    } finally { await done(t); }
  });
});
