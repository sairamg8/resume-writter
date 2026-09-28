// R4-DPH-11 (the board's own fields): iOS Safari zooms the page into any field it focuses whose text
// is under 16 px, and these were all 14 px (text-sm) with nothing for a touch screen: the
// "+ Create issue" composer, a checklist's "Add an item" box and an item being renamed, the comment
// box, an issue's start and due dates and its story points, and a sprint's name being renamed in
// the backlog. Each now carries pointer-coarse:text-base, as the kit's controlClass and the job
// tracker's fields do (tests/pdf/81-job-inputs-touch-text.test.mjs, J-38); with a mouse they stay
// 14 px. The two InlineEdit fields get it through inputClassName, so the text they show keeps its
// size. Mounted with react-dom/client over fake-dom (tests/pdf/fake-dom.mjs); fake-dom has no
// layout or media queries, so the fields' class tokens are checked.
// Run: node --test tests/pdf/103-r4-dph-11-board-fields.test.mjs
import { before, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { useBacklogPage, mountBacklog, project, futureSprint, issue, elements, reactProps, ev, tokens } from './103-r4-backlog-page.mjs';

useBacklogPage(); // Vite's loader and the fake DOM's focus, for the components below too

let InlineCreate;
let IssueChecklist;
let IssueActivity;
let DateInput;
let PointsInput;
before(async () => {
  ({ InlineCreate } = await loadModule('/src/components/board/InlineCreate.jsx'));
  ({ IssueChecklist } = await loadModule('/src/components/board/IssueChecklist.jsx'));
  ({ IssueActivity } = await loadModule('/src/components/board/IssueActivity.jsx'));
  ({ DateInput, PointsInput } = await loadModule('/src/components/board/IssueFields.jsx'));
});

/** The text fields under `root`: not ticks, radios, file or hidden inputs (as tests/pdf/81 reads them). */
function textFields(root) {
  // React sets an <input>'s type as a property, not an attribute, and the fake DOM keeps them apart.
  return [...elements(root)].filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
    && !['file', 'hidden', 'checkbox', 'radio'].includes(el.getAttribute('type') ?? el.type));
}

/**
 * The fields among `fields` that would be under 16 px on a phone or a tablet (tests/pdf/81's
 * under16OnTouch): a field passes with `pointer-coarse:text-base`, or an unprefixed `text-base`
 * that no breakpoint shrinks.
 */
function under16OnTouch(fields) {
  assert.ok(fields.length > 0, 'there are fields to check');
  return fields.filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)pointer-coarse:text-base(\s|$)/.test(cls)) return false;
    return !(/(^|\s)text-base(\s|$)/.test(cls) && !/(^|\s)(sm|md|lg|xl|2xl):text-(xs|sm|\[)/.test(cls));
  }).map((el) => el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName);
}

/** `field` is 16 px on a touch screen and still 14 px with a mouse. */
function assertTouchText(field, name) {
  assert.ok(field, `${name} is not on the page`);
  const got = tokens(field);
  assert.ok(got.has('pointer-coarse:text-base'), `${name} is 14 px on a touch screen: iOS zooms the page into it`);
  assert.ok(got.has('text-sm'), `${name} keeps its 14 px with a mouse`);
  assert.equal(got.has('text-base'), false, `${name} is 16 px with a mouse too`);
}

const byLabel = (root, label) => [...elements(root)].find((el) => el.getAttribute('aria-label') === label);
const click = (view, el) => view.act(() => reactProps(el).onClick(ev()));

it('R4-DPH-11: the "+ Create issue" composer\'s field is 16 px on a touch screen', async () => {
  const view = mount(InlineCreate, { onCreate: () => {}, variant: 'row' });
  try {
    click(view, [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Create issue'));
    assertTouchText(byLabel(view.container, 'Summary of the new issue'), 'the composer\'s field');
    assert.deepEqual(under16OnTouch(textFields(view.container)), []);
  } finally {
    await view.unmount();
  }
});

it('R4-DPH-11: a checklist\'s "Add an item" box and an item being renamed are 16 px on a touch screen', async () => {
  const view = mount(IssueChecklist, { items: [{ id: 'chk_1', text: 'Buy screws', done: false }], onChange: () => {} });
  try {
    assertTouchText(byLabel(view.container, 'Add a checklist item'), '"Add an item"');
    // The item's text turns into its field when clicked.
    click(view, [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.startsWith('Buy screws')));
    const field = byLabel(view.container, 'Checklist item');
    assert.equal(field?.tagName, 'INPUT', 'clicking the item did not open its field');
    assertTouchText(field, 'the item being renamed');
    assert.deepEqual(under16OnTouch(textFields(view.container)), []);
  } finally {
    await view.unmount();
  }
});

it('R4-DPH-11: the comment box is 16 px on a touch screen', async () => {
  const view = mount(IssueActivity, {
    issue: { id: 'i1', comments: [], activity: [] }, onAddComment: () => {}, onUpdateComment: () => {}, onDeleteComment: () => {},
  });
  try {
    click(view, [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Add a comment…'));
    const box = byLabel(view.container, 'Comment');
    assert.equal(box?.tagName, 'TEXTAREA', 'the comment box did not open');
    assertTouchText(box, 'the comment box');
    assert.deepEqual(under16OnTouch(textFields(view.container)), []);
  } finally {
    await view.unmount();
  }
});

it('R4-DPH-11: an issue\'s start and due dates and its story points are 16 px on a touch screen', async () => {
  const Fields = () => h('div', null,
    h(DateInput, { label: 'Start date', value: '', onChange: () => {} }),
    h(DateInput, { label: 'Due date', value: '2026-10-01', onChange: () => {} }),
    h(PointsInput, { value: 3, onChange: () => {} }));
  const view = mount(Fields, {});
  try {
    assertTouchText(byLabel(view.container, 'Start date'), 'the start date');
    assertTouchText(byLabel(view.container, 'Due date'), 'the due date');
    assertTouchText(byLabel(view.container, 'Story points'), 'the story points');
    assert.deepEqual(under16OnTouch(textFields(view.container)), []);
  } finally {
    await view.unmount();
  }
});

it('R4-DPH-11: a sprint\'s name being renamed in the backlog is 16 px on a touch screen', async () => {
  const page = mountBacklog([project({ mode: 'scrum', sprints: [futureSprint('s2', 'Sprint 2')], issues: [issue('i1', 1, 'Planned', 'c1', { sprintId: 's2' })] })]);
  try {
    page.click(page.button('Sprint 2, edit Sprint name'));
    const field = page.byLabel('Sprint name', page.section('s2'));
    assert.equal(field?.tagName, 'INPUT', 'clicking the sprint\'s name did not open its field');
    assertTouchText(field, 'the sprint\'s name');
  } finally {
    await page.view.unmount();
  }
});
