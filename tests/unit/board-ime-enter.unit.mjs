// Typing Chinese, Japanese or Korean in a board's add fields (B-20): an input method composes a
// word over several keys and Enter picks it, so the Enter that ends a composition belongs to the
// input method. The checklist's "Add an item" and a column's "+ Create issue" composer read that
// Enter as their own and added the half-typed item or issue. A browser flags the keystroke with
// isComposing; Safari fires it after compositionend, with isComposing false, and says so only
// with keyCode 229. InlineEdit already waited; these two now do too. Mounted with
// react-dom/client over fake-dom (tests/unit/ui-dom-harness.mjs).
// Run: node --test tests/unit/board-ime-enter.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, byText } from './ui-dom-harness.mjs';

let kit;
let IssueChecklist;
let InlineCreate;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ IssueChecklist } = await kit.load('/src/components/board/IssueChecklist.jsx'));
  ({ InlineCreate } = await kit.load('/src/components/board/InlineCreate.jsx'));
});
after(() => kit?.close());

/** The keystrokes an input method sends while a word is still being composed. */
const composing = {
  'Enter with isComposing (Chrome, Firefox)': { key: 'Enter', nativeEvent: { isComposing: true } },
  'Enter with keyCode 229 (Safari)': { key: 'Enter', keyCode: 229 },
};

describe('IssueChecklist: Add an item', () => {
  /** The checklist with no items; `changes` records every onChange. */
  function checklist() {
    const changes = [];
    const view = mount(IssueChecklist, { items: [], onChange: (items) => changes.push(items) });
    const field = () => byAttr(view.container, 'aria-label', 'Add a checklist item')[0];
    const type = (value) => view.act(() => reactProps(field()).onChange({ target: { value } }));
    const key = (props) => { const e = ev(props); view.act(() => reactProps(field()).onKeyDown(e)); return e; };
    return { view, field, type, key, changes };
  }

  for (const [name, props] of Object.entries(composing)) {
    it(`${name} picks the word and adds nothing`, async () => {
      const { view, field, type, key, changes } = checklist();
      try {
        type('にほんご');
        key(props);
        assert.deepEqual(changes, [], 'the Enter that ends a composition added the item');
        assert.equal(reactProps(field()).value, 'にほんご', 'the composed text stays in the field');
      } finally { await view.unmount(); }
    });
  }

  it('an Escape while composing cancels the composition, not the typed text', async () => {
    const { view, field, type, key } = checklist();
    try {
      type('日本');
      const esc = key({ key: 'Escape', nativeEvent: { isComposing: true } });
      assert.equal(esc.propagationStopped, false, 'the Escape was taken from the input method');
      assert.equal(reactProps(field()).value, '日本');
    } finally { await view.unmount(); }
  });

  it('the Enter after the composition adds the item, once', async () => {
    const { view, field, type, key, changes } = checklist();
    try {
      type('日本語');
      key(composing['Enter with isComposing (Chrome, Firefox)']);
      const enter = key({ key: 'Enter' });
      assert.ok(enter.defaultPrevented);
      assert.equal(changes.length, 1);
      assert.deepEqual(changes[0].map((c) => [c.text, c.done]), [['日本語', false]]);
      assert.equal(reactProps(field()).value, '', 'the field is cleared for the next item');
    } finally { await view.unmount(); }
  });
});

describe('InlineCreate: + Create issue', () => {
  /** The composer, opened; `created` records every onCreate. */
  function composer() {
    const created = [];
    const view = mount(InlineCreate, { onCreate: (issue) => created.push(issue) });
    view.act(() => reactProps(byText(view.container, 'Create issue')).onClick(ev()));
    const field = () => byAttr(view.container, 'aria-label', 'Summary of the new issue')[0];
    const type = (value) => view.act(() => reactProps(field()).onChange({ target: { value } }));
    const key = (props) => { const e = ev(props); view.act(() => reactProps(field()).onKeyDown(e)); return e; };
    return { view, field, type, key, created };
  }

  for (const [name, props] of Object.entries(composing)) {
    it(`${name} picks the word and creates nothing`, async () => {
      const { view, field, type, key, created } = composer();
      try {
        type('修复登录');
        const e = key(props);
        assert.deepEqual(created, [], 'the Enter that ends a composition created the issue');
        assert.equal(e.defaultPrevented, false, 'the input method keeps its Enter');
        assert.equal(reactProps(field()).value, '修复登录', 'the composed summary stays in the field');
      } finally { await view.unmount(); }
    });
  }

  it('an Escape while composing leaves the composer open with its text', async () => {
    const { view, field, type, key } = composer();
    try {
      type('修复');
      key({ key: 'Escape', nativeEvent: { isComposing: true } });
      assert.ok(field(), 'the composer closed on the input method\'s Escape');
      assert.equal(reactProps(field()).value, '修复');
    } finally { await view.unmount(); }
  });

  it('the Enter after the composition creates the issue, once', async () => {
    const { view, field, type, key, created } = composer();
    try {
      type('修复登录');
      key(composing['Enter with keyCode 229 (Safari)']);
      key({ key: 'Enter' });
      assert.deepEqual(created, [{ title: '修复登录', type: 'task' }]);
      assert.equal(reactProps(field()).value, '', 'the composer stays open, empty, for the next one');
    } finally { await view.unmount(); }
  });
});
