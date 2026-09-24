// Unit tests for exporting and importing the boards as a .json file (src/utils/boardTransfer.js):
// B-04 — boards live only in this browser's storage, so the file is the only copy a user can keep
// or carry to another browser. An export imports back exactly (round trip); importing merges by
// id — a project already here takes the newer copy of each issue and loses none it has, so the
// same file twice adds nothing; a key another project holds is re-derived; what is not a boards
// file is refused with a reason; the counts come back for the message. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDS_FILE_FORMAT, boardsFromText, exportBoards, exportFileName, importBoards, importMessage, mergeBoards,
} from '../../src/utils/boardTransfer.js';
import * as ops from '../../src/utils/boardOps.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { makeDemoBoards } from '../../src/utils/boardDemo.js';

const NOW = new Date(2026, 8, 24, 10, 0).getTime();
const ctx = (min = 0) => ({ now: NOW + min * 60 * 1000 });

/** The demo (LIFE) and a scrum project with a sprint, labels, an epic, a checklist and a comment. */
function workspace() {
  let web = createBoard({ title: 'Website relaunch', template: 'scrum' }, { takenKeys: ['LIFE'], now: NOW - 1000 });
  web = { ...web, id: 'board_web' };
  web = ops.addLabel(web, { id: 'lab_ui', name: 'UI', color: '#6366f1' });
  web = ops.addSprint(web, { id: 'spr_1', name: 'Sprint 1' });
  web = ops.addIssue(web, { id: 'iss_epic', title: 'Launch', type: 'epic' }, ctx());
  web = ops.addIssue(web, {
    id: 'iss_hero', title: 'Hero section', type: 'story', labelIds: ['lab_ui'], epicId: 'iss_epic', sprintId: 'spr_1',
    estimate: 3, due: '2026-10-02', checklist: [{ id: 'chk_a', text: 'Copy', done: true }, { id: 'chk_b', text: 'Image' }],
  }, ctx());
  web = ops.addComment(web, 'iss_hero', { id: 'cmt_1', text: 'Use the new photo.' }, ctx(1));
  web = ops.startSprint(web, 'spr_1', {}, ctx(2));
  return [...makeDemoBoards(NOW), web];
}

const ids = (boards) => boards.map((b) => b.id);
const issueTitles = (board) => board.issues.map((i) => i.title);

test('B-04: an export imports back exactly — every project, column, label, sprint, issue, checklist item and comment', () => {
  const boards = workspace();
  const text = exportBoards(boards, NOW);
  const file = JSON.parse(text);
  assert.deepEqual([file.format, file.version, file.dataVersion, file.exportedAt], [BOARDS_FILE_FORMAT, 1, 2, new Date(NOW).toISOString()]);
  const result = importBoards([], text, NOW);
  assert.equal(result.error, undefined);
  assert.deepEqual([result.added, result.updated, result.skipped, result.lossy], [2, 0, 0, false]);
  assert.deepEqual(result.boards, boards, 'nothing lost, nothing changed');
  assert.match(exportFileName(NOW), /^cpwtcv-boards-2026-09-24\.json$/);
});

test('B-04: importing the same file again adds nothing — no duplicate project, issue or label', () => {
  const boards = workspace();
  const text = exportBoards(boards, NOW);
  const again = importBoards(boards, text, NOW);
  assert.deepEqual([again.added, again.updated, again.skipped], [0, 0, 2]);
  assert.equal(again.boards, boards, 'the very same list: nothing to save');
  const twiceInOne = importBoards([], JSON.stringify({ ...JSON.parse(text), boards: [...boards, ...boards] }), NOW);
  assert.deepEqual(ids(twiceInOne.boards), ids(boards), 'a file holding a project twice imports it once');
  assert.deepEqual([twiceInOne.added, twiceInOne.skipped], [2, 2]);
});

test('B-04: a project already here keeps every issue it has and takes the newer copy of each one in the file', () => {
  const [life] = makeDemoBoards(NOW);
  // The file: an older copy with an issue deleted here since, and an issue edited there later.
  let theirs = ops.updateIssue(life, 'demo_issue_2', { title: 'Book the van (edited there)' }, ctx(30));
  theirs = ops.addIssue(theirs, { id: 'iss_there', title: 'Made there' }, ctx(31));
  theirs = { ...theirs, updatedAt: NOW + 31 * 60 * 1000 };
  let mine = ops.updateIssue(life, 'demo_issue_3', { title: 'Tap fixed here' }, ctx(10));
  mine = ops.addIssue(mine, { id: 'iss_here', title: 'Made here' }, ctx(11));
  mine = { ...ops.deleteIssue(mine, 'demo_issue_8'), updatedAt: NOW + 11 * 60 * 1000 };

  const result = mergeBoards([mine], [theirs], NOW + 60 * 60 * 1000);
  assert.deepEqual([result.added, result.updated, result.skipped], [0, 1, 0]);
  assert.deepEqual([result.issues.added, result.issues.updated], [2, 1], 'Made there, and the deleted one back; the van updated');
  const [merged] = result.boards;
  const byId = (id) => merged.issues.find((i) => i.id === id);
  assert.equal(byId('demo_issue_2').title, 'Book the van (edited there)', 'their newer edit');
  assert.equal(byId('demo_issue_3').title, 'Tap fixed here', 'my newer edit');
  assert.ok(byId('iss_here') && byId('iss_there') && byId('demo_issue_8'), 'nothing from either side is lost');
  assert.equal(new Set(merged.issues.map((i) => i.number)).size, merged.issues.length, 'numbers stay unique');
  assert.deepEqual([byId('iss_here').number, byId('iss_there').number], [11, 12], 'LIFE-11 here still opens what it did; theirs is renumbered');
  assert.ok(merged.nextNumber > Math.max(...merged.issues.map((i) => i.number)));
  assert.equal(merged.updatedAt, NOW + 60 * 60 * 1000, 'a merge is a change: stamped');
});

test('B-04: a new project whose key is taken here gets another key, and the result says so', () => {
  const [life] = makeDemoBoards(NOW);
  const other = { ...createBoard({ title: 'Life admin', key: 'LIFE' }, { now: NOW }), id: 'board_other' };
  const result = mergeBoards([life], [other], NOW);
  assert.equal(result.added, 1);
  const imported = result.boards.find((b) => b.id === 'board_other');
  assert.notEqual(imported.key, 'LIFE');
  assert.deepEqual(result.rekeyed, [{ title: 'Life admin', from: 'LIFE', to: imported.key }]);
  assert.equal(result.boards.find((b) => b.id === life.id).key, 'LIFE', 'the project here keeps its key: its links still work');
});

test('B-04: what is not a boards file is refused with a reason, and nothing changes', () => {
  const current = makeDemoBoards(NOW);
  for (const [text, reason] of [
    ['{ not json', /not a JSON file/],
    [JSON.stringify({ resumes: [{ id: 'r' }] }), /No projects/],
    [JSON.stringify({ format: 'cpwtcv-jobs', boards: [] }), /not a boards export/],
    [JSON.stringify({ format: BOARDS_FILE_FORMAT, version: 2, boards: [{ id: 'b', title: 'Future' }] }), /newer version/],
    [JSON.stringify({ format: BOARDS_FILE_FORMAT, version: 1, dataVersion: 3, boards: [{ id: 'b', title: 'Future' }] }), /newer version/],
    [JSON.stringify({ format: BOARDS_FILE_FORMAT, version: 1, dataVersion: 2, boards: [] }), /No projects/],
    ['[1, "x", null]', /No projects/],
  ]) {
    const result = importBoards(current, text, NOW);
    assert.match(result.error ?? '', reason, text);
    assert.equal(result.boards, current, text);
    assert.equal(importMessage(result).kind, 'error');
  }
});

test('B-04: entries that cannot be read are left out and reported; the rest are imported', () => {
  const [life] = makeDemoBoards(NOW);
  const text = JSON.stringify({ format: BOARDS_FILE_FORMAT, version: 1, dataVersion: 2, boards: [
    'junk', { ...life, issues: [...life.issues, 7, { ...life.issues[0], id: 'x', number: 99, priority: 'urgent' }] },
  ] });
  const result = importBoards([], text, NOW);
  assert.deepEqual([result.added, result.lossy], [1, true]);
  assert.equal(result.boards[0].issues.length, life.issues.length + 1);
  assert.equal(result.boards[0].issues.at(-1).priority, 'medium');
  assert.equal(importMessage(result).kind, 'warning');
});

test('B-04: a v1 file (the old boards, lists and cards) is migrated as it is imported; a bare list or one project reads too', () => {
  const v1 = { boards: [{ id: 'b1', title: 'Chores', updatedAt: 5, lists: [
    { id: 'l1', title: 'To do', cards: [{ id: 'c1', title: 'Hoover', labels: [{ name: 'Home', color: '#3b82f6' }], checklist: [{ id: 'k', text: 'Stairs' }] }] },
    { id: 'l2', title: 'Done', cards: [{ id: 'c2', title: 'Dishes' }] },
  ] }], dataVersion: 1 };
  const result = importBoards([], JSON.stringify(v1), NOW);
  assert.equal(result.lossy, false);
  const [chores] = result.boards;
  assert.deepEqual([chores.key, issueTitles(chores), chores.labels.map((l) => l.name)], ['CHO', ['Hoover', 'Dishes'], ['Home']]);
  assert.equal(chores.issues[0].checklist[0].text, 'Stairs');
  const [life] = makeDemoBoards(NOW);
  assert.deepEqual(ids(boardsFromText(JSON.stringify([life])).list), [life.id]);
  assert.deepEqual(ids(boardsFromText(JSON.stringify(life)).list), [life.id]);
});

test('importMessage: what the projects page says after an import', () => {
  assert.deepEqual(importMessage({ added: 2, updated: 0, skipped: 0, issues: { added: 0, updated: 0 } }),
    { kind: 'success', text: 'Imported 2 projects.' });
  assert.deepEqual(importMessage({ added: 1, updated: 1, skipped: 1, issues: { added: 2, updated: 1 } }),
    { kind: 'success', text: 'Imported 1 project, updated 1 (2 issues added, 1 updated), skipped 1 already up to date.' });
  assert.deepEqual(importMessage({ added: 0, updated: 0, skipped: 1 }),
    { kind: 'success', text: 'Nothing new: the project in that file is already here.' });
  assert.deepEqual(importMessage({ added: 0, updated: 0, skipped: 3 }),
    { kind: 'success', text: 'Nothing new: the 3 projects in that file are already here.' });
  assert.deepEqual(importMessage({ added: 1, updated: 0, skipped: 0, rekeyed: [{ title: 'Life admin', from: 'LIFE', to: 'LA' }] }),
    { kind: 'success', text: 'Imported 1 project. LIFE was taken here, so “Life admin” is now LA.' });
  assert.deepEqual(importMessage({ added: 1, updated: 0, skipped: 0, lossy: true }),
    { kind: 'warning', text: 'Imported 1 project; what could not be read in the file was left out.' });
  assert.deepEqual(importMessage({ error: 'No projects found in that file.' }), { kind: 'error', text: 'No projects found in that file.' });
});
