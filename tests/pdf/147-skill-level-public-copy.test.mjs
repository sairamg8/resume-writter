// R2-147 — a public link's copy holds the levels of the skills its page draws, and no other. The Skills
// editor keeps a group's `skillLevels` as it is while the skills' text is typed (a skill renamed or
// deleted keeps its level until the résumé is next loaded, when normalizeResume drops it), and
// publicSnapshot copied the object as it was: the published copy, the one document anyone with the link
// can read, named a skill the résumé no longer prints. Now the copy keeps a group's levels only for the
// skills its text lists. Over tests/pdf/fake-firestore.mjs, which applies firestore.rules. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { fakeFirestore } from './fake-firestore.mjs';

let link;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

/** A résumé whose skill group lists Alpha and Bravo, with a level still kept for `Formerskill`, since deleted from the text. */
const edited = () => Object.assign(resume({
  sections: [section('skills', [
    { category: 'Tools', skills: 'Alpha, Bravo', skillLevels: { Alpha: 2, Formerskill: 5, Bravo: 4 } },
    { category: 'Gone', skills: 'Charlie', skillLevels: { Renamedskill: 3 } },
  ], { skillsStyle: 'bars' })],
}), { id: 'resume_levels' });

describe('a public copy keeps only the levels of the skills it prints (R2-147)', () => {
  it('a level of a skill deleted or renamed in the text is not copied; the listed skills keep theirs', () => {
    const copy = link.publicSnapshot(edited());
    const [tools, gone] = copy.sections[0].items;
    assert.deepEqual(tools.skillLevels, { Alpha: 2, Bravo: 4 });
    assert.ok(!('skillLevels' in gone), 'a group none of whose levels is a listed skill\'s has no levels key');
    for (const word of ['Formerskill', 'Renamedskill']) assert.ok(!JSON.stringify(copy).includes(word), `"${word}" is not in the copy`);
  });

  it('the copy published to the cloud names no skill the page does not print, and is current for the résumé as edited', async () => {
    const cloud = fakeFirestore();
    cloud.auth = 'uid_owner';
    const io = link.publicIo(cloud.fs, cloud.db);
    const r = edited();
    const { shareId } = await io.publish('uid_owner', r);
    const stored = JSON.stringify(cloud.doc(`public/${shareId}`));
    assert.ok(!stored.includes('Formerskill') && !stored.includes('Renamedskill'), 'the world-readable document holds neither');
    const back = await io.readShare('uid_owner', r.id);
    assert.ok(link.publishedIsCurrent(back.copy, r), 'the panel does not call the copy out of date over a level nobody sees');
  });
});
