// R4-DUX-21: two board forms took bad input without a word. The backlog's Start-sprint dialog sent
// an End date before the Start date (the store then made a 0-day sprint) and a name of only spaces
// (the store kept the old name, the toast read "   started"); the column Rename dialog's Save did
// nothing, silently, for a name of only spaces. Now each says why under its field ('Enter a name',
// 'End date must be on or after the start date'), its Start / Save is disabled and does not act
// until the form is valid, and Start hands on the trimmed name. Mounted with react-dom/client over
// tests/pdf/fake-dom.mjs through Vite's loader (tests/pdf/harness.mjs). Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let dom;
let harness;
let StartSprintDialog;
let ColumnDialog;
before(async () => {
  await setup();
  dom = await import('./fake-dom.mjs');
  harness = await import('../unit/ui-dom-harness.mjs');
  harness.patchFakeDom();
  ({ StartSprintDialog } = await loadModule('/src/components/board/BacklogParts.jsx'));
  ({ ColumnDialog } = await loadModule('/src/components/board/BoardColumn.jsx'));
});
after(teardown);

/** The page's elements (a dialog opens in a portal at the end of <body>) and the few finders the tests need. */
function page(view) {
  const all = () => [...dom.elements(view.document.body)];
  const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);
  return {
    button,
    /** The input its <label> names. */
    field: (label) => {
      const tag = all().find((el) => el.tagName === 'LABEL' && el.textContent.replace('*', '').trim() === label);
      return all().find((el) => el.tagName === 'INPUT' && el.getAttribute('id') === tag?.getAttribute('for'));
    },
    /** The messages shown under the fields. */
    errors: () => all().filter((el) => el.getAttribute('role') === 'alert').map((el) => el.textContent.trim()),
    type: (input, value) => view.act(() => dom.reactProps(input).onChange(harness.ev({ target: { value } }))),
    click: (text) => view.act(() => dom.reactProps(button(text)).onClick(harness.ev())),
    disabled: (text) => !!dom.reactProps(button(text)).disabled,
  };
}

it('Start sprint: a blank name or an end before the start is said, and Start waits for it', async () => {
  const started = [];
  const sprint = { id: 's1', name: 'Garden sprint 3', goal: '', state: 'future', startDate: '2026-10-01', endDate: '2026-10-15' };
  const view = dom.mount(StartSprintDialog, { sprint, onStart: (f) => started.push(f), onClose: () => {} });
  const p = page(view);
  try {
    assert.deepEqual(p.errors(), [], 'a fresh dialog is valid');
    assert.equal(p.disabled('Start'), false);

    p.type(p.field('Sprint name'), '   ');
    assert.deepEqual(p.errors(), ['Enter a name']);
    assert.equal(p.disabled('Start'), true, 'Start waits for a name');
    p.click('Start');
    assert.equal(started.length, 0, 'a name of only spaces does not start the sprint');

    p.type(p.field('Sprint name'), '  Garden sprint 4  ');
    p.type(p.field('End date'), '2026-09-20');
    assert.deepEqual(p.errors(), ['End date must be on or after the start date']);
    assert.equal(p.disabled('Start'), true, 'Start waits for a sensible end');
    p.click('Start');
    assert.equal(started.length, 0, 'an end before the start does not start a 0-day sprint');

    p.type(p.field('End date'), '2026-10-01');
    assert.deepEqual(p.errors(), [], 'an end on the start day is fine');
    assert.equal(p.disabled('Start'), false);
    p.click('Start');
    assert.equal(started.length, 1);
    assert.equal(started[0].name, 'Garden sprint 4', 'the trimmed name is handed on (and toasted)');
    assert.equal(started[0].startDate, '2026-10-01');
    assert.equal(started[0].endDate, '2026-10-01');
  } finally {
    await view.unmount();
  }
});

it('Rename column: a name of only spaces is said, and Save waits for a name', async () => {
  const saved = [];
  const column = { id: 'c1', title: 'To Do', category: 'todo', wipLimit: null };
  const view = dom.mount(ColumnDialog, { column, mode: 'rename', onSave: (patch) => saved.push(patch), onClose: () => {} });
  const p = page(view);
  const submit = () => {
    const form = [...dom.elements(view.document.body)].find((el) => el.tagName === 'FORM');
    view.act(() => dom.reactProps(form).onSubmit(harness.ev()));
  };
  try {
    assert.deepEqual(p.errors(), []);
    p.type(p.field('Column name'), '    ');
    assert.deepEqual(p.errors(), ['Enter a name'], 'Save no longer does nothing without a word');
    assert.equal(p.disabled('Save'), true, 'Save waits for a name');
    submit();
    assert.equal(saved.length, 0);

    p.type(p.field('Column name'), '  Waiting  ');
    assert.deepEqual(p.errors(), []);
    assert.equal(p.disabled('Save'), false);
    submit();
    assert.deepEqual(saved, [{ title: 'Waiting' }]);
  } finally {
    await view.unmount();
  }
});
