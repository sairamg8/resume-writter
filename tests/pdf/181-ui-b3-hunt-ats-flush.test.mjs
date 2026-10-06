// UI rebuild B3 (hunt H1-2, H1-3): the ATS dock scans the résumé after the preview's own 250 ms pause, and the
// panel's "+" on a missing keyword writes from the résumé it was drawn with. In the old ATS tab a click's write showed
// in the next render; with the pause the chip stayed and a second "+" within 250 ms read the résumé from before the
// first: two Skills sections when there was none, or the first keyword dropped from the group when there was one.
// A press inside the dock (the pointerdown that leads to a click, or a key) now takes the latest résumé first.
// Driven as the browser does: the capture-phase handler of the dock's body, then the chip's click, no pause between.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, until, sleep, attr, text, reactProps, experience } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

// The panel shows the tick on an added keyword for 2 s (a timer of its own that sets state): the page stays mounted until it ran.
const ADDED_TICK_MS = 2000;
const JD = 'Kubernetes Kubernetes Terraform Terraform GraphQL GraphQL';
const box = (t) => t.all().find((el) => el.tagName === 'TEXTAREA' && attr(el, 'placeholder').startsWith('Paste job posting'));
const chips = (t) => t.all().filter((el) => el.tagName === 'BUTTON' && attr(el, 'title') === 'Click to add to Skills');
const chip = (t, keyword) => chips(t).find((el) => text(el) === keyword);
const skillSections = (t) => t.store().activeResume.sections.filter((s) => s.type === 'skills');

/** The ATS dock open on a posting that names `JD`'s keywords, and the first two the scan lists as missing. */
async function scanOpen(options) {
  const t = await openEditor({ path: '?dock=ats', ...options });
  await until(() => box(t), 'the ATS dock shows the posting box');
  t.call(box(t), 'onChange', { target: { value: JD } });
  await until(() => chips(t).length >= 2, 'the scan lists the missing keywords');
  const [first, second] = chips(t).map(text);
  return { t, first, second };
}

/** Closes the page once the panel's own 2 s tick after a "+" has run (a state set after the unmount would reach a window that is gone). */
async function done(t) {
  await sleep(ADDED_TICK_MS + 100);
  await t.close();
}

/** A tap on the chip of `keyword` with nothing between the taps: the pointerdown the dock sees first, then the click. */
function tap(t, keyword) {
  const body = t.byTid('ats-dock-body');
  assert.ok(body && reactProps(body).onPointerDownCapture, 'the dock\'s body takes the press');
  t.call(body, 'onPointerDownCapture');
  t.call(chip(t, keyword), 'onClick');
}

describe('two quick "+" on missing keywords in the ATS dock', () => {
  it('with a skill group: both keywords end up in it, the second does not undo the first', async () => {
    const { t, first, second } = await scanOpen();
    try {
      tap(t, first);
      tap(t, second);
      const sections = skillSections(t);
      assert.equal(sections.length, 1);
      const skills = sections[0].items[0].skills;
      assert.ok(skills.includes(first) && skills.includes(second), `the group reads "${skills}"`);
      assert.ok(skills.startsWith('SQL, Excel, Tableau'), 'the skills that were there stay');
    } finally { await done(t); }
  });

  it('with no Skills section: one section is made, holding both keywords', async () => {
    const jobs = experience([{ company: 'Harbor Mutual', role: 'Senior Analyst', description: '<ul><li>Cut the claims backlog by 40%</li></ul>' }]);
    const { t, first, second } = await scanOpen({ extra: { sections: [jobs] } });
    try {
      assert.equal(skillSections(t).length, 0, 'no Skills section to start with');
      tap(t, first);
      tap(t, second);
      const sections = skillSections(t);
      assert.equal(sections.length, 1, `${sections.length} Skills sections`);
      const all = sections[0].items.map((i) => i.skills).join(', ');
      assert.ok(all.includes(first) && all.includes(second), `the section reads "${all}"`);
    } finally { await done(t); }
  });

  it('the dock still reads the résumé after the pause: a press with nothing changed renders nothing', async () => {
    const { t } = await scanOpen();
    try {
      const w = await t.measure(() => t.call(t.byTid('ats-dock-body'), 'onPointerDownCapture'));
      assert.equal(w.count('atsPanel'), 0, `the panel rendered with no change. ${w.report()}`);
    } finally { await t.close(); }
  });
});
