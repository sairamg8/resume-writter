// The Boards vocabulary (v2, the Jira core): issue types, priorities, column categories,
// recurrence rules, the project templates and the palettes. Plain data, no imports, so the pure
// board utilities (boardModel, boardOps, boardQuery, normalizeBoard) and their node tests load it
// as it is. Every list is in display order; `id` is what the data stores.

/** The saved board list's localStorage keys: v2 now; v1 is read once to migrate, and kept. */
export const BOARDS_KEY = 'cpwtcv_boards_v2';
export const BOARDS_V1_KEY = 'cpwtcv_boards_v1';
export const BOARD_DATA_VERSION = 2;

/** Issue types. `color` is the type icon's tint (Jira's: task blue, bug red, story green, epic purple). */
export const ISSUE_TYPES = [
  { id: 'task', name: 'Task', color: '#2563eb' },
  { id: 'bug', name: 'Bug', color: '#dc2626' },
  { id: 'story', name: 'Story', color: '#16a34a' },
  { id: 'epic', name: 'Epic', color: '#7c3aed' },
];

/** Priorities, most urgent first; `rank` sorts (0 highest). */
export const PRIORITIES = [
  { id: 'highest', name: 'Highest', rank: 0, color: '#dc2626' },
  { id: 'high', name: 'High', rank: 1, color: '#ea580c' },
  { id: 'medium', name: 'Medium', rank: 2, color: '#d97706' },
  { id: 'low', name: 'Low', rank: 3, color: '#2563eb' },
  { id: 'lowest', name: 'Lowest', rank: 4, color: '#0284c7' },
];

/** What a column means: an issue in a `done` column is resolved (resolvedAt), the rest are open. */
export const COLUMN_CATEGORIES = [
  { id: 'todo', name: 'To do' },
  { id: 'inprogress', name: 'In progress' },
  { id: 'done', name: 'Done' },
];

/** How a recurring issue repeats once it is done (boardModel.nextDue). */
export const RECURRENCES = [
  { id: 'none', name: 'Does not repeat' },
  { id: 'daily', name: 'Every day' },
  { id: 'weekdays', name: 'Every weekday (Mon–Fri)' },
  { id: 'weekly', name: 'Every week' },
  { id: 'monthly', name: 'Every month' },
];

export const BOARD_MODES = [
  { id: 'kanban', name: 'Kanban', description: 'A continuous flow of work across columns.' },
  { id: 'scrum', name: 'Scrum', description: 'Plan work in time-boxed sprints from a backlog.' },
];

export const SPRINT_STATES = ['future', 'active', 'closed'];

/** Kanban boards hide done issues resolved longer ago than this many days (List view keeps them). */
export const DEFAULT_HIDE_DONE_DAYS = 14;

/** An issue keeps its newest this-many activity entries. */
export const ACTIVITY_CAP = 200;

/** A sprint started without dates runs this many days. */
export const DEFAULT_SPRINT_DAYS = 14;

/** Project keys: 2–10 characters, a letter A–Z first, then A–Z or 0–9 (LIFE, WEB2). */
export const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

/**
 * The label colours a project picks from (and the v1 card's label palette, which the v1 card
 * sheet still imports). `name` is the colour's name, a default for a label made from it.
 */
export const LABEL_COLORS = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Teal', color: '#14b8a6' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Gray', color: '#6b7280' },
];

/** The accent colours a project picks from (its avatar square and sidebar dot). */
export const BOARD_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#64748b'];

/**
 * The templates "Create project" offers. `columns` are [title, category]; `labels` are
 * [name, colour]. Every template has a done column, so resolving an issue always has somewhere to go.
 */
export const BOARD_TEMPLATES = [
  {
    id: 'kanban', name: 'Kanban', mode: 'kanban',
    description: 'Visualise work moving from To Do to Done. Good for a steady stream of tasks.',
    columns: [['To Do', 'todo'], ['In Progress', 'inprogress'], ['Done', 'done']],
    labels: [],
  },
  {
    id: 'scrum', name: 'Scrum', mode: 'scrum',
    description: 'Plan sprints from a backlog, review work, and ship in time-boxed iterations.',
    columns: [['To Do', 'todo'], ['In Progress', 'inprogress'], ['In Review', 'inprogress'], ['Done', 'done']],
    labels: [],
  },
  {
    id: 'personal', name: 'Personal', mode: 'kanban',
    description: 'Day-to-day life: capture in the Inbox, plan the week, focus on today.',
    columns: [['Inbox', 'todo'], ['This week', 'todo'], ['Today', 'inprogress'], ['Done', 'done']],
    labels: [['Home', '#3b82f6'], ['Health', '#22c55e'], ['Finance', '#f59e0b'], ['Errands', '#f97316'], ['Learning', '#a855f7']],
  },
  {
    id: 'blank', name: 'Blank', mode: 'kanban',
    description: 'Just To Do and Done. Add the columns you need.',
    columns: [['To Do', 'todo'], ['Done', 'done']],
    labels: [],
  },
];

export const TYPE_IDS = ISSUE_TYPES.map((t) => t.id);
export const PRIORITY_IDS = PRIORITIES.map((p) => p.id);
export const CATEGORY_IDS = COLUMN_CATEGORIES.map((c) => c.id);
export const RECURRENCE_IDS = RECURRENCES.map((r) => r.id);
export const MODE_IDS = BOARD_MODES.map((m) => m.id);

// ── v1 (removed with the v1 store) ───────────────────────────────────────
/** The lists a brand-new board starts with, so it is usable the moment it is created. */
export const STARTER_LIST_TITLES = ['To do', 'In progress', 'Done'];

/**
 * The board shown before the user has made one. Stable `demo_*` ids so a data-version migration can
 * strip it (useBoardStore.load). Fixed timestamps so it is not "just edited" on every load.
 */
export const DEMO_BOARDS = [
  {
    id: 'demo_board_1',
    title: 'Product launch',
    color: '#6366f1',
    createdAt: 1749500000000,
    updatedAt: 1749686400000,
    lists: [
      {
        id: 'demo_list_todo',
        title: 'To do',
        cards: [
          {
            id: 'demo_card_copy',
            title: 'Draft landing copy',
            description: 'Hook, three benefits, and a CTA above the fold.',
            labels: [{ name: 'Orange', color: '#f97316' }, { name: 'Blue', color: '#3b82f6' }],
            due: '2026-09-24',
            checklist: [
              { id: 'demo_chk_1', text: 'Outline sections', done: true },
              { id: 'demo_chk_2', text: 'Write hero', done: false },
              { id: 'demo_chk_3', text: 'Add CTA', done: false },
            ],
            createdAt: 1749500000000,
            updatedAt: 1749500000000,
          },
          {
            id: 'demo_card_hero',
            title: 'Pick hero image',
            description: '',
            labels: [],
            due: '',
            checklist: [],
            createdAt: 1749500000000,
            updatedAt: 1749500000000,
          },
        ],
      },
      {
        id: 'demo_list_doing',
        title: 'In progress',
        cards: [
          {
            id: 'demo_card_pricing',
            title: 'Build pricing page',
            description: '',
            labels: [{ name: 'Green', color: '#22c55e' }],
            due: '2026-09-22',
            checklist: [],
            createdAt: 1749500000000,
            updatedAt: 1749600000000,
          },
        ],
      },
      { id: 'demo_list_review', title: 'Review', cards: [] },
      {
        id: 'demo_list_done',
        title: 'Done',
        cards: [
          {
            id: 'demo_card_analytics',
            title: 'Set up analytics',
            description: '',
            labels: [],
            due: '',
            checklist: [],
            createdAt: 1749500000000,
            updatedAt: 1749686400000,
          },
        ],
      },
    ],
  },
];
