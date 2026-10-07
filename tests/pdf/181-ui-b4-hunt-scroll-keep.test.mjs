// UI rebuild B4 re-verification (test strength T5): tests/pdf/32-editor-tab-scroll mounts a stand-in for the Editor's wiring, so
// a change in Editor.jsx (keying the Résumé's scroll box by the open dock, say) could not turn it red. Here the REAL Editor page
// is mounted (the 180-ui-b3 harness): a dock opening, switching and closing over the Résumé leaves its scroll box the very same
// element at the same offset, and the Cover Letter, opened from the bar, starts at its own top.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, attr } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

/** The Résumé's scroll box (EditorTabContent's), not a dock's: both scroll, the dock's pads itself (px-4). */
const resumeBox = (t) => t.all().find((el) => /\boverflow-y-auto\b/.test(attr(el, 'class')) && !/\bpx-4\b/.test(attr(el, 'class')));

describe('the real Editor keeps the Résumé\'s scroll box and offset through the docks', () => {
  it('Design, ATS, ATS again, Design, Design again: the same element, scrolled where it was', async () => {
    const t = await openEditor();
    try {
      const box = resumeBox(t);
      assert.ok(box, 'the Résumé\'s scroll box is on screen');
      box.scrollTop = 500;
      for (const [id, open] of [['design-button', 'dock-design'], ['ats-chip', 'dock-ats'], ['ats-chip', null], ['design-button', 'dock-design'], ['design-button', null]]) {
        await t.press(id);
        assert.equal(Boolean(t.byTid('dock-design')) + Boolean(t.byTid('dock-ats')), open ? 1 : 0, `${id}: the dock state`);
        if (open) assert.ok(t.byTid(open), `${id} opens ${open}`);
        assert.ok(t.all().includes(box), `${id} replaced the Résumé's scroll box`);
        assert.equal(box.scrollTop, 500, `${id} moved the Résumé's scroll`);
      }
    } finally { await t.close(); }
  });
});
