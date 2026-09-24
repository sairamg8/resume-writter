// Unit tests for the Boards v2 model (src/utils/boardModel.js): keys, templates, lookups and
// the local-calendar date maths a recurring issue repeats by — checked in time zones with a DST
// change, where adding 24 hours or reading 'YYYY-MM-DD' as UTC lands on the wrong day.
// Run: yarn test:unit
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, cleanTitle, createBoard, deriveKey, defaultColumnId, findIssueByKey, isIssueDone, isValidKey,
  issueKey, keyError, keyInput, nextDue, parseIssueKey, parseLocalISO, toLocalISO, todayISO,
} from '../../src/utils/boardModel.js';
import { BOARD_TEMPLATES } from '../../src/constants/boards.js';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ; else process.env.TZ = ORIGINAL_TZ;
});

/** Run `fn` in each of these zones: two DST ones (either hemisphere), one where midnight skips, and IST. */
function inZones(fn) {
  for (const tz of ['America/New_York', 'Pacific/Auckland', 'America/Santiago', 'Asia/Kolkata']) {
    process.env.TZ = tz;
    fn(tz);
  }
}

test('dates: a local day reads and writes as itself, invalid days are not days', () => {
  inZones((tz) => {
    assert.equal(toLocalISO(parseLocalISO('2026-03-08')), '2026-03-08', tz);
    assert.equal(toLocalISO(parseLocalISO('2026-09-06')), '2026-09-06', `${tz}: midnight skipped in Santiago`);
    assert.equal(todayISO(new Date(2026, 11, 31, 23, 59).getTime()), '2026-12-31', tz);
  });
  for (const bad of ['2026-02-30', '2026-13-01', '26-01-01', '', null, 20260101]) assert.equal(parseLocalISO(bad), null, String(bad));
});

test('dates: addDays counts calendar days across month ends, leap days and DST changes', () => {
  inZones((tz) => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01', tz);
    assert.equal(addDays('2028-02-28', 1), '2028-02-29', tz);
    assert.equal(addDays('2026-03-07', 1), '2026-03-08', `${tz}: US DST starts 8 Mar`);
    assert.equal(addDays('2026-03-08', 1), '2026-03-09', tz);
    assert.equal(addDays('2026-10-31', 2), '2026-11-02', `${tz}: US DST ends 1 Nov`);
    assert.equal(addDays('2026-04-04', 2), '2026-04-06', `${tz}: NZ DST ends 5 Apr`);
    assert.equal(addDays('2026-09-05', 1), '2026-09-06', `${tz}: Chile DST starts at midnight 6 Sep`);
    assert.equal(addDays('2026-12-31', 1), '2027-01-01', tz);
    assert.equal(addDays('2026-03-01', -1), '2026-02-28', tz);
  });
  assert.equal(addDays('', 1), '');
});

test('nextDue: each rule steps from the old due date, by the calendar, in every zone', () => {
  inZones((tz) => {
    const today = '2026-03-01';
    assert.equal(nextDue('2026-03-07', 'daily', today), '2026-03-08', tz);
    assert.equal(nextDue('2026-03-05', 'weekly', today), '2026-03-12', `${tz}: across US DST`);
    assert.equal(nextDue('2026-10-29', 'weekly', '2026-10-29'), '2026-11-05', `${tz}: across the US DST end`);
    assert.equal(nextDue('2026-03-06', 'weekdays', today), '2026-03-09', `${tz}: Friday → Monday`);
    assert.equal(nextDue('2026-03-07', 'weekdays', today), '2026-03-09', `${tz}: Saturday → Monday`);
    assert.equal(nextDue('2026-03-03', 'weekdays', today), '2026-03-04', tz);
    assert.equal(nextDue('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28', `${tz}: clamped to February's end`);
    assert.equal(nextDue('2028-01-31', 'monthly', '2028-01-31'), '2028-02-29', `${tz}: leap year`);
    assert.equal(nextDue('2026-03-31', 'monthly', '2026-03-31'), '2026-04-30', tz);
    assert.equal(nextDue('2026-12-15', 'monthly', '2026-12-15'), '2027-01-15', `${tz}: across the year end`);
  });
});

test('nextDue: no due date steps from today; a late one lands after today, once; none repeats nothing', () => {
  assert.equal(nextDue('', 'daily', '2026-09-23'), '2026-09-24');
  assert.equal(nextDue('', 'weekly', '2026-09-23'), '2026-09-30');
  assert.equal(nextDue('2026-09-01', 'weekly', '2026-09-23'), '2026-09-29', 'three weeks late: the next one after today, on the same weekday');
  assert.equal(nextDue('2026-09-22', 'daily', '2026-09-23'), '2026-09-24', 'done a day late: tomorrow, not today');
  assert.equal(nextDue('2026-09-25', 'weekly', '2026-09-23'), '2026-10-02', 'done early: the cadence holds');
  assert.equal(nextDue('1900-01-01', 'daily', '2026-09-23'), '2026-09-24', 'a date centuries ago still ends after today');
  assert.equal(nextDue('2026-09-23', 'none', '2026-09-23'), '');
  assert.equal(nextDue('2026-09-23', 'hourly', '2026-09-23'), '');
});

test('keys: the pattern, the typing filter and the reasons a key is refused', () => {
  for (const ok of ['LIFE', 'AB', 'WEB2', 'ABCDEFGHIJ']) assert.equal(isValidKey(ok), true, ok);
  for (const bad of ['A', 'life', '2WEB', 'ABCDEFGHIJK', 'WE-B', '', null]) assert.equal(isValidKey(bad), false, String(bad));
  assert.equal(keyInput('we b-2!'), 'WEB2');
  assert.equal(keyInput('abcdefghijklmn'), 'ABCDEFGHIJ');
  const boards = [{ id: 'a', key: 'LIFE', title: 'Life' }, { id: 'b', key: 'WEB', title: 'Website' }];
  assert.equal(keyError('', boards), 'Enter a key.');
  assert.match(keyError('1AB', boards), /starting with a letter/);
  assert.match(keyError('WEB', boards), /Website/);
  assert.equal(keyError('WEB', boards, 'b'), null, 'a board keeps its own key');
  assert.equal(keyError('HOME', boards), null);
});

test('deriveKey: initials, a short word, and a number when taken — always a valid key', () => {
  assert.equal(deriveKey('Website Relaunch'), 'WR');
  assert.equal(deriveKey('Life'), 'LIFE');
  assert.equal(deriveKey('Groceries'), 'GRO');
  assert.equal(deriveKey('Café été plans'), 'CEP');
  assert.equal(deriveKey('Personal & Projects'), 'PP');
  assert.equal(deriveKey('2026 goals'), 'GOA', 'a leading number is skipped');
  assert.equal(deriveKey('A 2026'), 'A202');
  assert.equal(deriveKey('!!!'), 'PROJ');
  assert.equal(deriveKey(''), 'PROJ');
  assert.equal(deriveKey('Life', ['life']), 'LIFE2', 'taken, case aside');
  assert.equal(deriveKey('Life', ['LIFE', 'LIFE2']), 'LIFE3');
  assert.equal(deriveKey('a b c d e f g h i j', ['ABCDE']), 'ABCDE2');
  for (const t of ['x', 'Ω', '12', 'A', 'The quick brown fox jumps']) assert.equal(isValidKey(deriveKey(t, ['PROJ'])), true, t);
});

test('issue keys: made from the project key, parsed in any case, found across projects', () => {
  const life = { id: 'a', key: 'LIFE', issues: [{ id: 'i1', number: 12 }] };
  const web = { id: 'b', key: 'WEB', issues: [{ id: 'i2', number: 12 }] };
  assert.equal(issueKey(life, life.issues[0]), 'LIFE-12');
  assert.deepEqual(parseIssueKey(' life-12 '), { key: 'LIFE', number: 12 });
  for (const bad of ['LIFE', 'LIFE-', '-12', 'LIFE-1x', 'L-1', null]) assert.equal(parseIssueKey(bad), null, String(bad));
  assert.equal(findIssueByKey([life, web], 'web-12').issue.id, 'i2');
  assert.equal(findIssueByKey([life, web], 'LIFE-12').board, life);
  assert.equal(findIssueByKey([life, web], 'LIFE-13'), null);
  assert.equal(findIssueByKey([life, web], 'HOME-1'), null);
});

test('createBoard: every template gives its columns and labels, a done column, and a free key', () => {
  for (const t of BOARD_TEMPLATES) {
    const b = createBoard({ title: `My ${t.name}`, template: t.id }, { takenKeys: [], now: 1000 });
    assert.deepEqual(b.columns.map((c) => [c.title, c.category]), t.columns, t.id);
    assert.deepEqual(b.labels.map((l) => [l.name, l.color]), t.labels, t.id);
    assert.ok(b.columns.some((c) => c.category === 'done'), t.id);
    assert.equal(b.mode, t.mode);
    assert.deepEqual([b.issues, b.sprints, b.nextNumber, b.createdAt, b.updatedAt, b.dataVersion], [[], [], 1, 1000, 1000, 2]);
    assert.equal(new Set([b.id, ...b.columns.map((c) => c.id), ...b.labels.map((l) => l.id)]).size, 1 + b.columns.length + b.labels.length);
  }
  const scrum = createBoard({ title: 'Website relaunch', template: 'scrum' });
  assert.deepEqual(scrum.columns.map((c) => c.title), ['To Do', 'In Progress', 'In Review', 'Done']);
  assert.equal(createBoard({ title: 'Life', key: 'HOME' }, { takenKeys: ['LIFE'] }).key, 'HOME');
  assert.equal(createBoard({ title: 'Life', key: 'LIFE' }, { takenKeys: ['life'] }).key, 'LIFE2', 'a taken key falls back to a derived one');
  assert.equal(createBoard({ title: '  \n ' }).title, 'Untitled project');
  assert.equal(createBoard({ template: 'nope' }).columns.length, 3, 'an unknown template is Kanban');
});

test('status: the default column is the first to-do one, done is by category', () => {
  const board = {
    columns: [{ id: 'c0', category: 'inprogress' }, { id: 'c1', category: 'todo' }, { id: 'c2', category: 'done' }],
  };
  assert.equal(defaultColumnId(board), 'c1');
  assert.equal(isIssueDone(board, { columnId: 'c2' }), true);
  assert.equal(isIssueDone(board, { columnId: 'c1' }), false);
  assert.equal(isIssueDone(board, { columnId: 'gone' }), false, 'a dangling column reads as the first');
  assert.equal(defaultColumnId({ columns: [] }), null);
});

test('cleanTitle: one line, trimmed, capped', () => {
  assert.equal(cleanTitle('  Call the\nlandlord \t now '), 'Call the landlord now');
  assert.equal(cleanTitle('   '), '');
  assert.equal(cleanTitle(null), '');
  assert.equal(cleanTitle('x'.repeat(300)).length, 255);
});
