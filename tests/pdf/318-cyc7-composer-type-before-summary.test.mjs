// CYC7 project-manager: the "+ Create issue" composer (a board column, a backlog section, the List)
// closed when the issue type was picked before a summary was typed. Opening the type picker moves
// focus into its menu, a portal outside the composer's box, and the box's blur handler read that as
// leaving the composer: with nothing typed it put the composer away, and the picker's menu with it,
// so a type could only be chosen after typing. On a Mac, Safari and Firefox give a pressed button no
// focus at all, so the field blurred with no element to say where focus went and the composer closed
// before the click. Now focus moving into the picker's menu keeps the composer, a press on the picker
// does not move focus off the field; leaving it for the page with nothing typed still closes it.
// The real composer is mounted with react-dom/client over fake-dom (tests/pdf/fake-dom.mjs), as
// tests/pdf/103-r4-dph-10-row-composer-stacks.test.mjs does; fake-dom moves no focus, so the blur
// a browser sends is handed to the box's handler with the element focus went to.
// Run: node --test tests/pdf/318-cyc7-composer-type-before-summary.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let InlineCreate;
before(async () => {
  await setup();
  patchFakeDom(); // the type picker's menu queries the document
  ({ InlineCreate } = await loadModule('/src/components/board/InlineCreate.jsx'));
});
after(teardown);

/** Mounts the composer and opens it from its "+ Create issue" button. */
function openComposer(created) {
  const view = mount(InlineCreate, { onCreate: (fields) => created.push(fields) });
  const all = (root = view.document.body) => [...elements(root)];
  const button = all(view.container).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Create issue');
  assert.ok(button, 'the "+ Create issue" button is shown');
  view.act(() => reactProps(button).onClick(ev()));
  const field = () => all(view.container).find((el) => el.tagName === 'TEXTAREA' && el.getAttribute('aria-label') === 'Summary of the new issue');
  assert.ok(field(), 'the button opened the composer');
  return { view, all, field, box: field().parentNode };
}

/** What the browser sends the box when focus leaves an element inside it for `to`. */
const blurTo = (view, box, to) => view.act(() => reactProps(box).onBlur(ev({ currentTarget: box, relatedTarget: to })));

it('choosing the issue type before typing a summary keeps the composer open, and the type is used', async () => {
  const created = [];
  const { view, all, field, box } = openComposer(created);
  try {
    const picker = all(view.container).find((el) => el.tagName === 'BUTTON' && String(el.getAttribute('aria-label')).startsWith('Issue type'));
    assert.ok(picker, 'the composer has its type picker');
    view.act(() => reactProps(picker).onClick(ev()));
    const menu = all().find((el) => el.getAttribute('role') === 'menu');
    assert.ok(menu, 'the picker opened its menu');

    // The menu takes focus: the picker button loses it to the menu's list.
    blurTo(view, box, menu);
    assert.ok(field(), 'focus going into the type menu left the composer open');
    assert.ok(all().find((el) => el.getAttribute('role') === 'menu'), 'and the menu is still there to choose from');

    const bug = all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === 'Bug');
    assert.ok(bug, 'the menu offers Bug');
    view.act(() => reactProps(bug).onClick(ev()));
    view.act(() => reactProps(field()).onChange(ev({ target: { value: 'Fix the tap' } })));
    const create = all(view.container).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Create');
    view.act(() => reactProps(create).onClick(ev()));
    assert.deepEqual(created, [{ title: 'Fix the tap', type: 'bug' }], 'the issue is made with the type picked first');
  } finally {
    await view.unmount();
  }
});

it('a press on the type picker does not take the focus from the summary field (Safari, Firefox on a Mac)', async () => {
  const { view, all } = openComposer([]);
  try {
    const picker = all(view.container).find((el) => el.tagName === 'BUTTON' && String(el.getAttribute('aria-label')).startsWith('Issue type'));
    const press = ev();
    view.act(() => reactProps(picker.parentNode).onMouseDown(press));
    assert.equal(press.defaultPrevented, true, 'the mouse press is kept from moving focus, so the empty composer is not left before the click');
  } finally {
    await view.unmount();
  }
});

it('leaving the composer for the page with nothing typed still puts it away', async () => {
  const { view, all, field, box } = openComposer([]);
  try {
    const outside = view.document.createElement('button');
    view.document.body.appendChild(outside);
    blurTo(view, box, outside);
    assert.equal(field(), undefined, 'focus left for the page: the empty composer closes');
    assert.ok(all(view.container).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Create issue'), 'and the "+ Create issue" button is back');
  } finally {
    await view.unmount();
  }
});
