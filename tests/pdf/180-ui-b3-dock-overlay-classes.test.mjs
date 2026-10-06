// UI rebuild B3 (cluster frame): the dock's geometry, as a node mirror of the rule the real browser proves later
// (B4): above 1100 px the dock is a 360 px sibling that does not shrink, after the preview; from 1100 px down it
// overlays the preview, by CSS alone (no JS width), with a close X; on a phone it is the whole width; its width is
// never animated (the preview repaints at every frame of a resize); and no fixed inset-0 z-50 layer on a desktop
// (tests/playwright/parity-ui-controls throws on one). Each Tailwind variant of the dock's class list is
// evaluated at a window width, so a class moved to the wrong breakpoint fails here.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (file) => fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
const dock = source('components/EditorDock.jsx');
const editor = source('pages/Editor.jsx');

/** The class string of the first element whose opening tag carries `marker`. */
function classesOf(marker) {
  const from = dock.indexOf(marker);
  assert.ok(from >= 0, `${marker} is in EditorDock.jsx`);
  const open = dock.slice(dock.lastIndexOf('<', from), dock.indexOf('>', from));
  return open.match(/className="([^"]*)"/)[1];
}

/** The utilities of `classes` in force at window width `width`: unprefixed ones, and the max-md / max-[Npx] / min-[Npx] variants that hold. */
function activeAt(classes, width) {
  const out = new Set();
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    const m = token.match(/^(max-md|max-\[(\d+)px\]|min-\[(\d+)px\]):(.+)$/);
    if (!m) { out.add(token); continue; }
    const holds = m[1] === 'max-md' ? width < 768 : m[2] ? width <= Number(m[2]) : width >= Number(m[3]);
    if (holds) out.add(m[4]);
  }
  return out;
}

const asideClasses = classesOf('data-testid={`dock-${dock}`}');
const closeClasses = classesOf('data-testid="dock-close"');

describe('the dock\'s classes at each window width', () => {
  it('from 1100 px up it is a 360 px sibling that does not shrink, in the flow, with no close X', () => {
    for (const width of [1100, 1280, 1920]) {
      const on = activeAt(asideClasses, width);
      assert.ok(on.has('shrink-0') && on.has('w-[360px]'), `${width}: 360 px and shrink-0`);
      for (const token of ['absolute', 'fixed', 'inset-y-0', 'right-0', 'z-30', 'shadow-xl']) assert.ok(!on.has(token), `${width}: ${token} is for the overlay`);
      assert.ok(activeAt(closeClasses, width).has('hidden'), `${width}: the close X is hidden (the Design button toggles it)`);
    }
  });

  it('from 1099 px down it overlays the preview: absolute on the right, full height, above it, with the close X shown', () => {
    for (const width of [1099, 900, 768]) {
      const on = activeAt(asideClasses, width);
      for (const token of ['absolute', 'inset-y-0', 'right-0', 'z-30']) assert.ok(on.has(token), `${width}: ${token}`);
      assert.ok(!on.has('fixed'), `${width}: absolute inside the editor, not fixed`);
      assert.ok(!activeAt(closeClasses, width).has('hidden'), `${width}: the close X shows`);
    }
  });

  it('on a phone it takes the whole width', () => {
    assert.ok(activeAt(asideClasses, 390).has('w-full'));
    assert.ok(!activeAt(asideClasses, 768).has('w-full'), 'a tablet keeps the 360 px sheet');
  });

  it('its width is never animated, and no fixed inset-0 z-50 layer is used on a desktop', () => {
    assert.ok(!/\b(transition|animate|duration|ease)[-\w\[\]]*/.test(asideClasses), `no transition or animation on the dock: ${asideClasses}`);
    assert.ok(!/\bfixed\b/.test(dock), 'no fixed layer in the dock');
    assert.ok(!/\binset-0\b/.test(dock) && !/\bz-50\b/.test(dock), 'no inset-0 or z-50');
    assert.ok(!/ResizeObserver|style=\{\{[^}]*width/.test(dock), 'no JS width');
  });
});

describe('where the dock sits in the Editor', () => {
  it('it is a sibling after the preview pane, not inside the editor panel, and mounted only while a dock is open', () => {
    const preview = editor.indexOf('<EditorPreviewPane');
    const mounted = editor.indexOf('<EditorDock');
    assert.ok(preview >= 0 && mounted > preview, 'EditorDock comes after EditorPreviewPane');
    assert.match(editor, /\{dock && <EditorDock\b/, 'mounted only while open');
    const sidebarEnd = editor.indexOf('</EditorTabContent>');
    assert.ok(mounted > sidebarEnd, 'not inside the editor panel');
    assert.equal(editor.match(/<EditorDock\b/g).length, 1, 'ONE dock element');
  });

  it('the dock joins the flex row under the bar, which is the positioned box its overlay is placed in', () => {
    assert.match(editor, /className="fixed inset-0 z-20 flex flex-col overflow-hidden/, 'the root stacks the bar over the row');
    const row = editor.match(/<div className="(relative flex-1 min-h-0 flex overflow-hidden)">/);
    assert.ok(row, 'the row of the editor panel, the preview and the dock is a relative flex row');
    assert.ok(editor.indexOf(row[0]) < editor.indexOf('<EditorDock') && editor.indexOf('<EditorDock') < editor.indexOf('{canShare && <ShareLinkModal'), 'the dock is inside that row');
  });
});
