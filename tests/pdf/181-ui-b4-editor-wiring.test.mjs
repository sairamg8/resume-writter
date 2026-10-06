// UI rebuild B4 (lead, after the build workflow): three pieces the clusters could not wire from their own files.
// (1) The Editor gives usePanelResize its dock: with a dock open the panel is drawn no wider than the window less the dock (360) and
//     the stage's floor (320), the remembered width stays; closed, the remembered width is drawn again. (Without the call the
//     clamp the hook has was dead code: a stored 640 px panel left the stage 96 px at 1100 px.)
// (2) The 4 px resize handle is in the cv tokens (hairline, brand on hover, pressed on press), no raw grey and blue.
// (3) A notice is drawn above the phone's Edit | Preview | Design pill: both sat at the window's bottom 16 px, so a notice covered the pill.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, finish, openEditor, findTid, attr } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const source = (file) => fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
const panelPx = (t) => findTid(t.live.tree, 'editor-sidebar').props.style?.width;
const overlaid = (t) => ['absolute', 'z-30', 'shadow-xl'].every((c) => attr(t.byTid('dock-design'), 'class').split(/\s+/).includes(c));
const resizeTo = (t, width) => { window.innerWidth = width; t.act(() => window.dispatchEvent({ type: 'resize' })); };

describe('the editor panel with a dock open (the Editor calls usePanelResize with its dock)', () => {
  it('a stored 640 px panel at 1100 px is drawn at 420 while the dock is open, 640 again when it closes', async () => {
    const t = await openEditor({ path: '?dock=design', panel: 640 });
    try {
      resizeTo(t, 1100);
      assert.equal(panelPx(t), 420, 'window - 360 - 320');
      t.setWidth(1100);
      assert.ok(!overlaid(t), 'the stage keeps its floor beside the dock, so the dock is not laid over it');
      await t.press('design-button'); // the dock closes
      assert.equal(panelPx(t), 640, 'the remembered width is drawn without a dock');
    } finally { await t.close(); }
  });

  it('a wider window gives the width back, and a panel already narrower is left as it is', async () => {
    const t = await openEditor({ path: '?dock=design', panel: 640 });
    try {
      resizeTo(t, 1280);
      assert.equal(panelPx(t), 600);
      resizeTo(t, 1400);
      assert.equal(panelPx(t), 640);
    } finally { await t.close(); }
    const narrow = await openEditor({ path: '?dock=design', panel: 300 });
    try {
      resizeTo(narrow, 1100);
      assert.equal(panelPx(narrow), 300);
    } finally { await narrow.close(); }
  });
});

describe('the resize handle and the phone notices are in the cv look', () => {
  it('the handle carries cv tokens and no raw grey or blue, and keeps its title, its hit area and its separator props', () => {
    const editor = source('pages/Editor.jsx');
    const at = editor.indexOf('{...separatorProps}');
    assert.ok(at > 0, 'the handle takes the separator props');
    const open = editor.slice(editor.lastIndexOf('<div', at), editor.indexOf('/>', at));
    const classes = open.match(/className="([^"]*)"/)[1];
    for (const token of ['bg-cv-hairline', 'hover:bg-cv-brand', 'active:bg-cv-brand-pressed', 'w-1', 'cursor-col-resize', 'touch-none']) assert.ok(classes.split(/\s+/).includes(token), token);
    assert.ok(/before:-right-3/.test(classes), 'the hit area over the preview');
    assert.ok(!/\b(bg-gray-\d+|hover:bg-blue-\d+|active:bg-blue-\d+)\b/.test(classes), `raw palette left: ${classes}`);
    assert.match(open, /title="Drag to resize panel"/);
  });

  it('a rule lifts the notice stack above the pill on a phone, and both elements it names exist', () => {
    const css = source('index.css');
    assert.match(css, /@media \(max-width: 767px\)\s*\{\s*body:has\(\[data-testid="editor-pill"\]\) \[aria-label="Notifications"\]\s*\{\s*bottom: 5rem;/);
    assert.match(source('components/EditorMobilePill.jsx'), /data-testid="editor-pill"/);
    assert.match(source('components/ui/Toast.jsx'), /aria-label="Notifications"/);
    // Outside any @layer, so it outranks the stack's bottom-4 utility.
    const before = css.slice(0, css.indexOf('body:has([data-testid="editor-pill"])'));
    assert.equal((before.match(/\{/g) ?? []).length, (before.match(/\}/g) ?? []).length, 'the rule is at the top level, not inside a layer');
  });
});
