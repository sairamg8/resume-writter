// UI rebuild B3 (hunt H2-11, H2-12): the dock is a 360 px sibling after the preview from 1100 px up. The editor panel can
// be dragged to 640 px, and then the preview was left 96 px at 1100 px and about 276 px at 1280 px, below the floor the
// page is drawn at. The dock now overlays the preview (the same classes as below 1100 px, with the close X) wherever the
// preview would keep less than its floor beside the panel, its handle and the dock, and sits beside it above that width.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, loadModule, attr } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const tokens = (el) => attr(el, 'class').split(/\s+/).filter(Boolean);
const overlaid = (t) => ['absolute', 'z-30', 'shadow-pop'].every((c) => tokens(t.byTid('dock-design')).includes(c));
const closeShown = (t) => !tokens(t.byTid('dock-close')).includes('min-[1100px]:hidden');

describe('the width from which the dock sits beside the preview', () => {
  it('is 1100 px for a panel up to 448 px, and grows with a wider one so the preview keeps its floor', async () => {
    const { dockBesideFrom } = await loadModule('/src/components/EditorDock.jsx');
    for (const width of [0, 240, 360, 448]) assert.equal(dockBesideFrom(width), 1100, `panel ${width}`);
    assert.equal(dockBesideFrom(640), 640 + 4 + 360 + 288);
    assert.ok(dockBesideFrom(500) > 1100 && dockBesideFrom(640) > dockBesideFrom(500));
  });
});

describe('the dock with the editor panel dragged wide', () => {
  it('a 640 px panel at 1200 px: the dock overlays the preview, with its close X', async () => {
    const t = await openEditor({ path: '?dock=design', panel: 640 });
    try {
      t.setWidth(1200);
      assert.ok(overlaid(t), `dock classes: ${attr(t.byTid('dock-design'), 'class')}`);
      assert.ok(closeShown(t), 'the close X shows on an overlay');
    } finally { await t.close(); }
  });

  it('the same panel beside the preview from 1292 px, and one px under it still overlays', async () => {
    const t = await openEditor({ path: '?dock=design', panel: 640 });
    try {
      t.setWidth(1291);
      assert.ok(overlaid(t), '1291 px overlays');
      t.setWidth(1292);
      assert.ok(!overlaid(t), `1292 px: beside. ${attr(t.byTid('dock-design'), 'class')}`);
      assert.ok(!closeShown(t), 'no close X beside the preview (the Design button toggles it)');
      t.setWidth(1920);
      assert.ok(!overlaid(t));
    } finally { await t.close(); }
  });

  it('the default panel (360 px) is unchanged: beside the preview at 1100 px and up', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      t.setWidth(1100);
      assert.ok(!overlaid(t) && !closeShown(t));
    } finally { await t.close(); }
  });
});
