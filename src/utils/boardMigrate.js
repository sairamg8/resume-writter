// A v1 board (Trello-style: lists → cards, key `cpwtcv_boards_v1`) as a v2 board, loss-free.
// The store reads v1 only when nothing is saved under v2, and never writes or removes the v1 key
// — it stays as it was, a copy of everything. migrateV1 only reshapes: what it cannot place
// (a list or card that is not an object, a label with no colour, a checklist that is not a list)
// is passed on as it is, so readBoard — the one place that decides what a board is — leaves it
// out and reports the loss, and the raw value is backed up with a notice, as for any board.
// Pure (tests/unit/board-migrate.unit.mjs).
import { DEFAULT_HIDE_DONE_DAYS } from '../constants/boards.js';
import { deriveKey } from './boardModel.js';
import { isEntry } from './boardReaders.js';

/** The v1 demo board, as the v1 build shipped it; every v1 edit stamped the board's updatedAt. */
const V1_DEMO_ID = 'demo_board_1';
const V1_DEMO_UPDATED_AT = 1749686400000;

/**
 * True for the v1 demo board exactly as shipped (its id and its shipped updatedAt): nobody
 * adopted it, so the v2 demo replaces it. One the user renamed or added a card to is migrated
 * like any board (B-14).
 */
export const isUntouchedV1Demo = (raw) => isEntry(raw) && raw.id === V1_DEMO_ID && raw.updatedAt === V1_DEMO_UPDATED_AT;

/** A list titled like done / complete / finished is a done column; the first list to do; the rest in progress. */
function categoryOf(title, index) {
  if (typeof title === 'string' && /\b(done|complete|completed|finished)\b/i.test(title)) return 'done';
  return index === 0 ? 'todo' : 'inprogress';
}

/** A v1 card label that can become a board label: an object with a colour. */
const isLabel = (l) => isEntry(l) && typeof l.color === 'string';
const labelName = (l) => (typeof l.name === 'string' ? l.name : typeof l.name === 'number' ? String(l.name) : '');

/**
 * `raw` (a v1 board as saved) as a v2 board for readBoard: lists → columns, cards → issues in
 * list order numbered 1…n (tasks, medium priority; a card in a done column resolved when it was
 * last updated), card labels → board labels one per colour and name → labelIds, checklist,
 * description, due and timestamps kept. The key is derived from the title (made unique among
 * the boards by addressableBoards). Anything that is not an object comes back as it is.
 */
export function migrateV1(raw) {
  if (!isEntry(raw)) return raw;
  const lists = Array.isArray(raw.lists) ? raw.lists : [];
  const labels = [];
  const labelFor = new Map();
  const labelId = (l) => {
    const key = `${l.color}\u0000${labelName(l)}`;
    if (!labelFor.has(key)) {
      const id = `${raw.id || 'board'}_label_${labels.length + 1}`;
      labelFor.set(key, id);
      labels.push({ id, name: labelName(l) || l.color, color: l.color });
    }
    return labelFor.get(key);
  };

  const columns = lists.map((l, n) => (isEntry(l) ? { id: l.id, title: l.title, category: categoryOf(l.title, n), wipLimit: null } : l));
  const issues = [];
  let number = 0;
  lists.forEach((list, n) => {
    if (!isEntry(list) || list.cards == null) return; // no cards: an empty column (B-02)
    if (!Array.isArray(list.cards)) {
      issues.push(list.cards); // not a list: readBoard leaves it out and reports it
      return;
    }
    const done = categoryOf(list.title, n) === 'done';
    for (const card of list.cards) {
      if (!isEntry(card)) {
        issues.push(card);
        continue;
      }
      const updatedAt = card.updatedAt ?? card.createdAt;
      number += 1;
      issues.push({
        id: card.id,
        number,
        type: 'task',
        title: card.title,
        description: card.description,
        columnId: list.id,
        priority: 'medium',
        labelIds: Array.isArray(card.labels) ? card.labels.map((l) => (isLabel(l) ? labelId(l) : l)) : card.labels,
        due: card.due,
        checklist: card.checklist,
        recurrence: 'none',
        createdAt: card.createdAt,
        updatedAt,
        resolvedAt: done && typeof updatedAt === 'number' ? updatedAt : null,
      });
    }
  });

  return {
    id: raw.id,
    key: deriveKey(raw.title),
    title: raw.title,
    description: '',
    color: raw.color,
    starred: false,
    mode: 'kanban',
    columns: raw.lists == null || Array.isArray(raw.lists) ? columns : raw.lists,
    labels,
    sprints: [],
    issues,
    nextNumber: number + 1,
    hideDoneAfterDays: DEFAULT_HIDE_DONE_DAYS,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    dataVersion: 2,
  };
}
