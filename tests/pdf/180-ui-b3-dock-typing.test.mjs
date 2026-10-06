// UI rebuild B3 (cluster frame): today Design and ATS Check never mount while the user types in a section (they are
// tabs of the panel the section is in). With a dock open both are on screen at once, so one keystroke in a section
// must not make either panel render in its own commit: the dock reads the résumé through a deferred value (Design)
// and the scan after the preview's own 250 ms pause (ATS), and its panels are memoised. Counted as tests/pdf/165
// and 173 count (renders, never time): the real Editor page with the dock open, a character typed in the summary,
// the commits that follow for longer than the pause. DesignPanel and AtsCheckerPanel render 0 times in the commit
// of the key and at most once after it; the count is live (a setting changed in the dock renders the Design panel,
// and the scan does read the résumé after the pause).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, MARK } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const PAUSE = 700; // past the ATS pause (250 ms) and the store's coalesced write (300 ms)

describe('one keystroke with a dock open', () => {
  it('Design dock: DesignPanel renders 0 times in the key\'s commit and at most once after it', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      const w = await t.measure(() => t.typeInSummary(), PAUSE);
      assert.ok(t.store().activeResume.personal.summary.includes(MARK), 'the character reached the store');
      assert.ok(w.commits.length >= 1 && w.commits[0].size >= 1, `the key rendered its own part, so the count is live. ${w.report()}`);
      assert.equal(w.commits[0].has('designPanel'), false, `the panel rendered in the key's own commit. ${w.report()}`);
      assert.ok(w.count('designPanel') <= 1, `the panel rendered ${w.count('designPanel')} times. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('ATS dock: AtsCheckerPanel renders 0 times in the key\'s commit and once after the pause', async () => {
    const t = await openEditor({ path: '?dock=ats' });
    try {
      const w = await t.measure(() => t.typeInSummary(), PAUSE);
      assert.ok(t.store().activeResume.personal.summary.includes(MARK), 'the character reached the store');
      assert.ok(w.commits.length >= 1 && w.commits[0].size >= 1, `the key rendered its own part. ${w.report()}`);
      assert.equal(w.commits[0].has('atsPanel'), false, `the scan rendered in the key's own commit. ${w.report()}`);
      assert.equal(w.count('atsPanel'), 1, `the scan reads the résumé once, after the pause. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('ATS dock: a burst of keys is one render of the scan, after the pause', async () => {
    const t = await openEditor({ path: '?dock=ats' });
    try {
      const w = await t.measure(() => { t.typeInSummary(); t.typeInSummary(); t.typeInSummary(); }, PAUSE);
      assert.equal(w.count('atsPanel'), 1, `three keys, one scan. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('the count is live: a setting changed with the Design dock open renders the Design panel', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      const w = await t.measure(() => t.act(() => t.store().updateSetting('fontSize', 11)), 100);
      assert.ok(w.count('designPanel') >= 1, `the panel shows the new setting, so it renders. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('with no dock open the key renders neither panel, and no dock', async () => {
    const t = await openEditor();
    try {
      const w = await t.measure(() => t.typeInSummary(), PAUSE);
      for (const label of ['designPanel', 'atsPanel', 'dock']) assert.equal(w.count(label), 0, `${label} rendered. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('the bar\'s leaves are not rendered by the key with a dock open (the chip, the Design button, the switch, the header)', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      const w = await t.measure(() => t.typeInSummary(), PAUSE);
      for (const label of ['header', 'alerts', 'modes', 'switch', 'chip', 'designButton']) assert.equal(w.count(label), 0, `${label} rendered. ${w.report()}`);
    } finally { await t.close(); }
  });
});
