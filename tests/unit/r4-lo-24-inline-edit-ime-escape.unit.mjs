// R4-LO-24: the kit's InlineEdit (a project's name, a page title, a board's fields) waited for an input
// method's Enter (B-20) but acted on its Escape: the Escape that drops the word being composed in
// Chinese, Japanese or Korean reverted the whole edit and closed the field, losing what was typed —
// the bug B-20c fixed in the kit's Dialog and Popover. Pinned: an Escape flagged as composing
// (isComposing, or Safari's keyCode 229) leaves the field open with its text, and is not taken from
// the input method; a plain Escape still reverts. Mounted with react-dom/client over fake-dom.
// Run: node --test tests/unit/r4-lo-24-inline-edit-ime-escape.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr } from './ui-dom-harness.mjs';

let kit;
let InlineEdit;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ InlineEdit } = await kit.load('/src/components/ui/InlineEdit.jsx'));
});
after(() => kit?.close());

/** InlineEdit on 'Life admin', being edited; `commits` records every onCommit. */
function editing(props = {}) {
  const commits = [];
  const view = mount(InlineEdit, { value: 'Life admin', label: 'Project name', onCommit: (v) => commits.push(v), ...props });
  const button = [...byAttr(view.container, 'type', 'button')][0];
  view.act(() => reactProps(button).onClick());
  const field = () => byAttr(view.container, 'aria-label', 'Project name').find((el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  assert.ok(field(), 'the field is open');
  const type = (value) => view.act(() => reactProps(field()).onChange({ target: { value } }));
  const key = (p) => { const e = ev(p); view.act(() => reactProps(field()).onKeyDown(e)); return e; };
  return { view, field, type, key, commits };
}

const composingEscape = {
  'Escape with isComposing (Chrome, Firefox)': { key: 'Escape', nativeEvent: { isComposing: true } },
  'Escape with keyCode 229 (Safari)': { key: 'Escape', keyCode: 229 },
};

describe('InlineEdit leaves an input method\'s Escape to it (R4-LO-24)', () => {
  for (const multiline of [false, true]) {
    for (const [name, props] of Object.entries(composingEscape)) {
      it(`${multiline ? 'multiline: ' : ''}${name} keeps the field open with its text`, async () => {
        const { view, field, type, key, commits } = editing({ multiline });
        try {
          type('生活');
          const esc = key(props);
          assert.ok(field(), 'the field is still open');
          assert.equal(reactProps(field()).value, '生活', 'what was typed is kept');
          assert.equal(esc.defaultPrevented, false, 'the Escape was left to the input method');
          assert.equal(esc.propagationStopped, false);
          assert.deepEqual(commits, []);
          key({ key: 'Enter' });
          assert.deepEqual(commits, ['生活'], 'the Enter after it saves the typed text');
        } finally { await view.unmount(); }
      });
    }
  }

  it('a plain Escape still reverts the edit', async () => {
    const { view, field, type, key, commits } = editing();
    try {
      type('Something else');
      const esc = key({ key: 'Escape' });
      assert.ok(esc.defaultPrevented);
      assert.equal(field(), undefined, 'the field is closed');
      assert.deepEqual(commits, [], 'nothing saved');
    } finally { await view.unmount(); }
  });
});
