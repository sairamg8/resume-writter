// Content hunt (cycle 2): a title (an issue's summary, a project, label, sprint or column name) is cut to 255
// characters. cleanTitle cut at UTF-16 unit 255, so a pasted paragraph with an emoji at the cut kept half of it:
// a lone surrogate that shows as a box in the card and the list, and that the account's sync can refuse. It
// cuts at 255 whole characters now. The same cut was made on the first 140 characters of a description that the issue's
// history shows (excerpt). Pure: the model is loaded as the app loads it.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let cleanTitle;
let model;
let ops;
before(async () => {
  await setup();
  model = await loadModule('/src/utils/boardModel.js');
  ({ cleanTitle } = model);
  ops = await loadModule('/src/utils/boardIssueOps.js');
});
after(teardown);

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

it('a title with an emoji at the 255-character cut keeps the whole emoji, not half of it', () => {
  const pasted = `${'a'.repeat(254)}🙂 and the rest of a long pasted paragraph`;
  const title = cleanTitle(pasted);
  assert.doesNotMatch(title, LONE_SURROGATE);
  assert.equal(title, `${'a'.repeat(254)}🙂`);
  assert.equal([...title].length, 255);
});

it('a plain long title is still cut to 255 characters, a short one is untouched', () => {
  assert.equal(cleanTitle('x'.repeat(300)).length, 255);
  assert.equal(cleanTitle('  Call the\nlandlord  '), 'Call the landlord');
  assert.equal(cleanTitle('🙂'.repeat(300)).length, 510, 'an all-emoji title: 255 emoji, two units each');
});

it("an issue's history shows the first 140 characters of a description by whole characters", () => {
  let board = model.createBoard({ title: 'Garden', template: 'kanban' }, { now: 1 });
  board = ops.addIssue(board, { title: 'Dig the bed' }, { now: 1 });
  const id = board.issues[0].id;
  board = ops.updateIssue(board, id, { description: `<p>${'a'.repeat(139)}🙂 and the rest of the notes</p>` }, { now: 10 });
  const entry = board.issues[0].activity.at(-1);
  assert.equal(entry.field, 'description');
  assert.doesNotMatch(entry.to, LONE_SURROGATE, 'no half emoji at the cut');
  assert.equal(entry.to, `${'a'.repeat(139)}🙂`);
});
