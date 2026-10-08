// Content hunt (cycle 2): a project with exactly one issue (or a board set to hide done issues after 1 day) read
// "1 issues" in four places: a column's count tooltip ("1 issues, limit 3"), the epic panel ("1 of 1 issues done"),
// the project list's counter ("1 of 1 issues") and the board's note ("resolved more than 1 days ago"). They say it
// with the app's countLabel now ("1 issue", "1 day"), as the cards, the backlog and the job pages already do.
// fake-dom has no layout and these are drawn inside drag-and-drop providers: the source that builds the words is read,
// and countLabel itself is pinned by tests/unit/ui-format.unit.mjs.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

it("a column's count tooltip counts its issues with the singular", () => {
  const s = src('src/components/board/BoardColumn.jsx');
  assert.match(s, /import \{ countLabel \} from '@\/utils\/uiFormat'/);
  assert.match(s, /title=\{list\.limit \? `\$\{countLabel\(list\.cards\.length, 'issue'\)\}, limit \$\{list\.limit\}` : countLabel\(list\.cards\.length, 'issue'\)\}/);
  assert.doesNotMatch(s, /\} issues/, 'no hand-written plural left');
});

it("an epic's progress line and the project list's counter count issues with the singular", () => {
  assert.match(src('src/components/board/BacklogParts.jsx'), /\{p\.done\} of \{countLabel\(p\.total, 'issue'\)\} done/);
  assert.match(src('src/pages/ProjectList.jsx'), /\{rows\.length\} of \{countLabel\(board\.issues\.length, 'issue'\)\}/);
});

it("the board's hidden-done note counts days with the singular", () => {
  assert.match(src('src/pages/Board.jsx'), /resolved more than \{countLabel\(board\.hideDoneAfterDays, 'day'\)\} ago/);
});
