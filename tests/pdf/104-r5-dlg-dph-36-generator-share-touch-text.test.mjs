// R4-DPH-36 (the Smart Cover Letter Generator's and the Share dialog's part): the generator's Target
// Company, Target Role and Recipient Name were text-xs — 12 px on every device — and iOS Safari zooms
// the page into any field under 16 px it focuses, so tapping one zoomed the page. Share a public link's
// read-only Public link box took the body's text-xs and is focused on a tap (it selects its text). Each
// is 16 px on a touch screen now (pointer-coarse:text-base); a mouse keeps 12 px. The rule is
// under16OnTouch (104-r5-dlg-helpers.mjs), over every text field of the real dialogs.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { openModal, classes, textFields, under16OnTouch, until } from './104-r5-dlg-helpers.mjs';

before(setup);
after(teardown);

it('R4-DPH-36: the generator\'s three fields are 16 px on a touch screen, 12 px with a mouse', async () => {
  const r = resume({ personal: { name: 'Robin Vale', title: 'Planner' } });
  const g = await openModal('/src/components/CoverLetterGeneratorModal.jsx', { resume: r, coverLetter: r.coverLetter, onApply() {} });
  try {
    const fields = textFields(g.all());
    assert.equal(fields.length, 3, 'Target Company, Target Role and Recipient Name');
    assert.deepEqual(under16OnTouch(fields), []);
    for (const el of fields) assert.ok(classes(el).includes('text-xs'), `12 px with a mouse: ${classes(el).join(' ')}`);
  } finally { await g.unmount(); }
});

it('R4-DPH-36: Share a public link\'s Public link box is 16 px on a touch screen, 12 px with a mouse', async () => {
  const { publicSnapshot } = await loadModule('/src/utils/publicLink.js');
  const r = resume({ personal: { name: 'Jordan Ellery' } });
  // A fake io: the résumé is already published, as it is now.
  const shared = { shareId: 'share_t1', publishedAt: Date.now(), copy: publicSnapshot(r) };
  const s = await openModal('/src/components/ShareLinkModal.jsx', { resume: r, uid: 'uid_owner', io: { readShare: async () => shared } });
  try {
    await until(s.view, () => textFields(s.all()).length > 0);
    const fields = textFields(s.all());
    const link = fields.find((el) => el.getAttribute('aria-label') === 'Public link');
    assert.ok(link, 'the published link is shown');
    assert.deepEqual(under16OnTouch(fields), []);
    assert.ok(classes(link).includes('text-xs'), `12 px with a mouse: ${classes(link).join(' ')}`);
  } finally { await s.unmount(); }
});
