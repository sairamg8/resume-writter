// The issue dialog's Sprint field offered "Backlog" for a DONE issue that sits in a sprint, and choosing it made the issue vanish from the
// Backlog page (it lists open issues only) while it stayed on the List and Board. Round 3 refused the drag and the row's Move to menu for a
// done row; this is the same refusal in the dialog: SprintPicker takes allowBacklog, and the issue view turns it off for a done issue that
// is in a sprint. Mounted over tests/pdf/fake-dom.mjs, through Vite's loader, as tests/pdf/280 mounts a Menu.
// Run: node --test tests/pdf/390-cyc9-sprint-picker-no-backlog-for-done.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';

let dom;
let harness;
let SprintPicker;
before(async () => {
  await setup();
  dom = await import('./fake-dom.mjs');
  harness = await import('../unit/ui-dom-harness.mjs');
  harness.patchFakeDom();
  ({ SprintPicker } = await loadModule('/src/components/board/IssueFields.jsx'));
});
after(teardown);

const board = { sprints: [{ id: 's1', name: 'Sprint 1', state: 'active' }, { id: 's2', name: 'Sprint 2', state: 'future' }] };

/** The labels of the radio items of the picker's menu once it is opened. */
async function opened(props) {
  const view = dom.mount(() => h(SprintPicker, { board, value: 's1', onChange() {}, ...props }), {});
  try {
    const trigger = [...dom.elements(view.container)].find((el) => el.tagName === 'BUTTON');
    assert.ok(trigger, 'the picker button');
    view.act(() => dom.reactProps(trigger).onClick(harness.ev()));
    return [...dom.elements(view.document.body)].filter((el) => el.getAttribute('role') === 'menuitemradio').map((el) => el.textContent.trim());
  } finally {
    await view.unmount();
  }
}

it('the picker offers Backlog by default, as before', async () => {
  assert.deepEqual(await opened({}), ['Backlog', 'Sprint 1 (active)', 'Sprint 2']);
});

it('with allowBacklog off it offers the sprints only', async () => {
  assert.deepEqual(await opened({ allowBacklog: false }), ['Sprint 1 (active)', 'Sprint 2']);
});

it('the issue view turns Backlog off for a done issue in a sprint, and keeps it for an issue in no sprint', () => {
  const view = fs.readFileSync(new URL('../../src/components/board/IssueDetails.jsx', import.meta.url), 'utf8');
  // `.*` and not `[^>]*`: the onChange arrow on the same line holds a ">".
  assert.match(view, /<SprintPicker .*allowBacklog=\{!issue\.sprintId \|\| !isIssueDone\(board, issue\)\}/);
});
