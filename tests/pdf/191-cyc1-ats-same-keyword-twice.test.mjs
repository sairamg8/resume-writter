// Editor hunt (cycle 1): the ATS dock draws the panel from the résumé after the preview's 250 ms pause, so the "+" chip of a
// missing keyword is still on screen for a moment after it was pressed (the chips stay under the finger on purpose, see
// 181-ui-b3-hunt-ats-latest). A double press on that one chip, as a double click is, wrote the keyword into the Skills group
// twice ("…, Kubernetes, Kubernetes"). A keyword the group already holds is not added again, in the group that was there
// and in the one the first press made.
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
const held = (sections) => sections.flatMap((s) => s.items.map((i) => i.skills)).join(', ').split(/[,;\n•|]+/).map((s) => s.trim());

async function scanOpen(options) {
  const t = await openEditor({ path: '?dock=ats', ...options });
  await until(() => box(t), 'the ATS dock shows the posting box');
  t.call(box(t), 'onChange', { target: { value: JD } });
  await until(() => chips(t).length >= 2, 'the scan lists the missing keywords');
  const drawn = chips(t);
  return { t, chip: drawn[0], keyword: text(drawn[0]) };
}

async function done(t) {
  await sleep(ADDED_TICK_MS + 100);
  await t.close();
}

describe('a double press on one "+" chip of the ATS dock', () => {
  it('with a skill group: the keyword is in it once', async () => {
    const { t, chip, keyword } = await scanOpen();
    try {
      t.call(chip, 'onClick');
      t.call(chip, 'onClick'); // the chip as it was drawn: the scan has not read the new résumé yet
      const words = held(skillSections(t));
      assert.equal(words.filter((w) => w === keyword).length, 1, `"${keyword}" is in the skills ${words.filter((w) => w === keyword).length} times: ${words.join(', ')}`);
      assert.ok(words.includes('SQL') && words.includes('Tableau'), 'the skills that were there stay');
    } finally { await done(t); }
  });

  it('with no Skills section: one section holds the keyword once', async () => {
    const jobs = experience([{ company: 'Harbor Mutual', role: 'Senior Analyst', description: '<ul><li>Cut the claims backlog by 40%</li></ul>' }]);
    const { t, chip, keyword } = await scanOpen({ extra: { sections: [jobs] } });
    try {
      assert.equal(skillSections(t).length, 0, 'no Skills section to start with');
      t.call(chip, 'onClick');
      t.call(chip, 'onClick');
      const sections = skillSections(t);
      assert.equal(sections.length, 1, `${sections.length} Skills sections`);
      const words = held(sections);
      assert.equal(words.filter((w) => w === keyword).length, 1, `"${keyword}" is in the skills ${words.filter((w) => w === keyword).length} times: ${words.join(', ')}`);
    } finally { await done(t); }
  });
});
