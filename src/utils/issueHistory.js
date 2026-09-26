// An issue's history entries (boardIssueOps' `activity`) as sentences for the issue view's
// History tab: which field changed, and its values as a person reads them — a priority's name,
// not its id; "None" for a cleared value. Pure (tests/unit/issue-history.unit.mjs).
import { ISSUE_TYPES, PRIORITIES, RECURRENCES } from '../constants/boards.js';

const FIELD_NAMES = {
  status: 'Status', title: 'Summary', description: 'Description', type: 'Issue type', priority: 'Priority',
  labels: 'Labels', due: 'Due date', startDate: 'Start date', estimate: 'Story points', epic: 'Parent epic',
  sprint: 'Sprint', checklist: 'Checklist', recurrence: 'Repeats',
};

const nameIn = (list) => (id) => list.find((x) => x.id === id)?.name ?? id;
const VALUE = { type: nameIn(ISSUE_TYPES), priority: nameIn(PRIORITIES), recurrence: nameIn(RECURRENCES) };

/** A value as the history shows it: its name, or 'None' when there is none. */
function shown(field, value) {
  if (value === null || value === undefined || value === '') return 'None';
  return String((VALUE[field] ?? ((v) => v))(value));
}

/**
 * `entry` (`{ kind, field, from, to, at }`) as `{ text, from, to }` — "created the issue", "added a
 * comment", "changed the Priority" with its old and new values (null for the first two).
 */
export function describeActivity(entry) {
  if (!entry) return null;
  if (entry.kind === 'created') return { text: 'created the issue', from: null, to: null };
  if (entry.kind === 'comment') return { text: 'added a comment', from: null, to: null };
  const name = FIELD_NAMES[entry.field] ?? entry.field ?? 'a field';
  return { text: `changed the ${name}`, from: shown(entry.field, entry.from), to: shown(entry.field, entry.to) };
}
