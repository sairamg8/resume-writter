// A checklist item that is one long word — a pasted URL — in the issue view (B-29). Each item is
// a flex row (tick, text, delete) and a flex item will not shrink below its longest word unless
// told to, so the URL pushed its row, and the issue view with it, past the right edge: the view
// scrolled sideways. The item's text now carries min-w-0 (it may shrink to the row) and
// break-words (the word wraps at the row's edge), done or not, shown or being edited. Mounted with
// react-dom/client over fake-dom (tests/unit/ui-dom-harness.mjs); fake-dom has no layout, so the
// classes that make the browser wrap are what is checked.
// Run: node --test tests/unit/board-checklist-wrap.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kitLoader, patchFakeDom, mount, ev, reactProps, elements } from './ui-dom-harness.mjs';

let kit;
let IssueChecklist;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ IssueChecklist } = await kit.load('/src/components/board/IssueChecklist.jsx'));
});
after(() => kit?.close());

const URL_ITEM = 'https://example.com/a/very/long/path/that/never/breaks/because/it/has/no/spaces/at/all?and=a&query=string&that=goes&on=and&on';

/** The classes of `el`, as a set. */
const classes = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

/** The element of tag `tag` under `root` whose text starts with `text`. */
const withText = (root, tag, text) => [...elements(root)].find((el) => el.tagName === tag && el.textContent.startsWith(text));

describe('IssueChecklist: a long unbroken item', () => {
  for (const done of [false, true]) {
    it(`${done ? 'a done item' : 'an open item'}'s text may shrink to its row and wraps the word there`, async () => {
      const view = mount(IssueChecklist, { items: [{ id: 'chk_1', text: URL_ITEM, done }], onChange: () => {} });
      try {
        const text = withText(view.container, 'BUTTON', URL_ITEM);
        assert.ok(text, 'the item\'s text was not rendered');
        assert.ok(classes(text.parentNode).has('flex'), 'the item is a flex row (why min-w-0 is needed)');
        const got = classes(text);
        assert.ok(got.has('flex-1'), 'the text takes the row\'s free width');
        assert.ok(got.has('min-w-0'), 'without min-w-0 the text is as wide as the URL and the row overflows');
        assert.ok(got.has('break-words'), 'without break-words the URL runs past the row\'s edge');
        assert.equal(got.has('line-through'), done, 'a done item is still struck through');
      } finally { await view.unmount(); }
    });
  }

  it('the field it turns into when clicked wraps the same way', async () => {
    const view = mount(IssueChecklist, { items: [{ id: 'chk_1', text: URL_ITEM, done: false }], onChange: () => {} });
    try {
      view.act(() => reactProps(withText(view.container, 'BUTTON', URL_ITEM)).onClick(ev()));
      const field = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Checklist item');
      assert.ok(field, 'clicking the text did not open its field');
      const got = classes(field);
      assert.ok(got.has('min-w-0') && got.has('flex-1'), 'the field shrinks to the row too');
    } finally { await view.unmount(); }
  });
});
