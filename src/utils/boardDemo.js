// The demo project shown before anything is saved: "Personal & Projects" (LIFE), made by the
// Personal template's columns and labels, with a few issues that show each type and priority,
// labels, an epic with children, a recurring chore, a checklist and comments. Its due dates are
// days from today, computed when it is first shown — a fixed calendar date meant every new
// user's first board was already overdue (B-23). Stable `demo_*` ids so a link to one of its
// issues keeps working once it is saved. Pure (tests/unit/board-store.unit.mjs).
import { BOARD_DATA_VERSION, DEFAULT_HIDE_DONE_DAYS } from '../constants/boards.js';
import { addDays, todayISO } from './boardModel.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const COLUMNS = [
  { id: 'demo_col_inbox', title: 'Inbox', category: 'todo', wipLimit: null },
  { id: 'demo_col_week', title: 'This week', category: 'todo', wipLimit: null },
  { id: 'demo_col_today', title: 'Today', category: 'inprogress', wipLimit: 3 },
  { id: 'demo_col_done', title: 'Done', category: 'done', wipLimit: null },
];

const LABELS = [
  { id: 'demo_label_home', name: 'Home', color: '#3b82f6' },
  { id: 'demo_label_health', name: 'Health', color: '#22c55e' },
  { id: 'demo_label_finance', name: 'Finance', color: '#f59e0b' },
  { id: 'demo_label_errands', name: 'Errands', color: '#f97316' },
  { id: 'demo_label_learning', name: 'Learning', color: '#a855f7' },
];

/**
 * The issues, in rank order: [type, title, column, priority, labels, due (days from today, or
 * null), extra fields]. `ageDays` is how long ago each was made; done ones were resolved `doneDays` ago.
 */
const ISSUES = [
  ['epic', 'Move to the new flat', 'inbox', 'high', ['home'], 21, {
    description: '<p>Everything for moving day. Its child issues track the van and the new home office.</p>', ageDays: 9,
  }],
  ['task', 'Book the moving van', 'week', 'high', ['errands'], 3, {
    epic: 1, estimate: 2, ageDays: 8,
    checklist: [['Get three quotes', true], ['Compare prices and insurance', false], ['Pay the deposit', false]],
  }],
  ['bug', 'Fix the dripping kitchen tap', 'today', 'highest', ['home'], 1, {
    description: '<p>Drips about once a second. Probably the washer: turn the water off under the sink first.</p>', ageDays: 4,
    comments: [['The washer is 1/2 inch. Buy two, in case.', 2]],
  }],
  ['task', 'Take out the recycling', 'today', 'low', ['home'], 0, { recurrence: 'weekly', ageDays: 6 }],
  ['task', 'Renew the car insurance', 'week', 'high', ['finance'], 5, {
    ageDays: 5, comments: [['The current policy ends this month. Compare two quotes before renewing.', 1]],
  }],
  ['story', 'Set up the home office', 'inbox', 'medium', ['home'], null, {
    epic: 1, estimate: 3, ageDays: 7, description: '<p>Desk by the window, a proper chair, cable tray.</p>',
  }],
  ['story', 'Finish the TypeScript course', 'inbox', 'low', ['learning'], null, { estimate: 5, ageDays: 12 }],
  ['task', 'Sort the old photos', 'inbox', 'lowest', [], null, { ageDays: 20 }],
  ['task', 'Book a dentist check-up', 'done', 'medium', ['health'], null, { ageDays: 10, doneDays: 2 }],
  ['task', 'Pay the electricity bill', 'done', 'medium', ['finance'], null, { ageDays: 6, doneDays: 1 }],
];

/**
 * The demo project as of `now` (ms): due dates from today (none overdue), timestamps a few days
 * back so "Recently updated" and "Created" read naturally.
 */
export function makeDemoBoards(now = Date.now()) {
  const today = todayISO(now);
  const issues = ISSUES.map(([type, title, column, priority, labels, dueIn, extra], n) => {
    const number = n + 1;
    const id = `demo_issue_${number}`;
    const createdAt = now - (extra.ageDays ?? 1) * DAY;
    const resolvedAt = extra.doneDays !== undefined ? now - extra.doneDays * DAY : null;
    const activity = [{ id: `demo_act_${number}_1`, at: createdAt, kind: 'created', field: null, from: null, to: null }];
    if (resolvedAt) activity.push({ id: `demo_act_${number}_2`, at: resolvedAt, kind: 'field', field: 'status', from: 'Today', to: 'Done' });
    const comments = (extra.comments || []).map(([text, hoursAgo], c) => ({
      id: `demo_cmt_${number}_${c + 1}`, text, createdAt: now - hoursAgo * HOUR, editedAt: null,
    }));
    for (const c of comments) activity.push({ id: `demo_act_${c.id}`, at: c.createdAt, kind: 'comment', field: null, from: null, to: c.id });
    const updatedAt = Math.max(resolvedAt ?? now - ((number % 4) + 1) * HOUR, ...comments.map((c) => c.createdAt));
    return {
      id,
      number,
      type,
      title,
      description: extra.description ?? '',
      columnId: `demo_col_${column}`,
      priority,
      labelIds: labels.map((l) => `demo_label_${l}`),
      due: dueIn === null ? '' : addDays(today, dueIn),
      startDate: '',
      estimate: extra.estimate ?? null,
      epicId: extra.epic ? `demo_issue_${extra.epic}` : null,
      sprintId: null,
      checklist: (extra.checklist || []).map(([text, done], c) => ({ id: `demo_chk_${number}_${c + 1}`, text, done })),
      comments,
      activity: activity.sort((a, b) => a.at - b.at),
      recurrence: extra.recurrence ?? 'none',
      recurrenceNextId: null,
      createdAt,
      updatedAt,
      resolvedAt,
    };
  });
  return [{
    id: 'demo_board_life',
    key: 'LIFE',
    title: 'Personal & Projects',
    description: 'Day-to-day life and side projects: capture in the Inbox, plan the week, focus on today.',
    color: '#6366f1',
    starred: true,
    mode: 'kanban',
    columns: COLUMNS.map((c) => ({ ...c })),
    labels: LABELS.map((l) => ({ ...l })),
    sprints: [],
    issues,
    nextNumber: issues.length + 1,
    hideDoneAfterDays: DEFAULT_HIDE_DONE_DAYS,
    createdAt: now - 21 * DAY,
    updatedAt: now - HOUR,
    dataVersion: BOARD_DATA_VERSION,
  }];
}

/**
 * Whether `board` is the demo project as makeDemoBoards made it, never edited: every action that
 * changes a board stamps its updatedAt with the time of the change (boardActions.js), always later
 * than the demo's own, which sits a fixed time after its createdAt. The cloud sync lets the
 * account's copy of the demo win over such a board (collectionSyncPlan.planFirstSync): dated from
 * the day it was shown, it looked newer than the demo project the user adopted and filled in.
 */
export function isUntouchedDemoBoard(board) {
  return board?.id === 'demo_board_life' && board.updatedAt === board.createdAt + 21 * DAY - HOUR;
}
