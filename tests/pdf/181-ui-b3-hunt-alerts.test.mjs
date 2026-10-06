// UI rebuild B3 (hunt F1): the editor's alerts (a failed export or import, storage that is full) are not part of the
// editor panel. They sat inside the sidebar, which is hidden in the preview-only layout and on the phone's Preview
// tab, and the Export menu is where an export fails: the person pressed Export there and saw nothing. They are a row
// of their own at the root, between the bar and the content row, in every layout.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, loadModule, findTid, find } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

/** The elements from the root of a React tree (as written) down to the first one `hit` accepts, else null. */
function pathTo(node, hit, path = []) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = pathTo(child, hit, path);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object' || !node.props) return null;
  const here = [...path, node];
  if (hit(node)) return here;
  return pathTo(node.props.children, hit, here);
}

const hiddenClass = (el) => /(^|\s)hidden(\s|$)/.test(el.props.className ?? '');

describe('the alerts row of the editor', () => {
  it('is not inside the editor panel, and sits between the bar and the content row', async () => {
    const { EditorAlerts } = await loadModule('/src/components/EditorHeader.jsx');
    const t = await openEditor();
    try {
      const { tree } = t.live;
      const sidebar = findTid(tree, 'editor-sidebar');
      assert.ok(sidebar, 'the editor panel is drawn');
      assert.equal(find(sidebar, EditorAlerts), null, 'no alerts inside the editor panel');
      const row = findTid(tree, 'editor-alerts');
      assert.ok(row, 'the alerts have a row of their own (editor-alerts)');
      assert.ok(find(row, EditorAlerts), 'the alerts are in that row');
      const bar = findTid(tree, 'editor-bar');
      const siblings = pathTo(tree, (el) => el === bar).at(-2).props.children.filter(Boolean);
      const at = (el) => siblings.indexOf(el);
      assert.ok(at(bar) >= 0 && at(row) === at(bar) + 1, 'the row is the bar\'s next sibling');
      assert.equal(findTid(siblings[at(row) + 1], 'editor-sidebar'), sidebar, 'the content row, with the panel, follows it');
    } finally { await t.close(); }
  });

  it('is shown in the preview-only layout, where the panel is hidden and the Export menu is', async () => {
    const { EditorAlerts } = await loadModule('/src/components/EditorHeader.jsx');
    const t = await openEditor();
    try {
      t.act(() => t.header().setLayoutMode('preview'));
      const sidebar = findTid(t.live.tree, 'editor-sidebar');
      assert.ok(hiddenClass(sidebar), 'the panel is hidden in the preview-only layout');
      const path = pathTo(t.live.tree, (el) => el.type === EditorAlerts);
      assert.ok(path, 'the alerts are drawn');
      assert.ok(!path.some((el) => el === sidebar), 'not under the hidden panel');
      assert.ok(!path.some(hiddenClass), `no ancestor hides them: ${path.map((el) => el.props.className ?? '').join(' > ')}`);
    } finally { await t.close(); }
  });
});
