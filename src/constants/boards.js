// Boards feature constants: the label palette a card picks from, the accent colours a board picks
// from, and the demo board shown on first run (like DEMO_JOBS in useJobStore) — stripped on a
// data-version bump, kept only until the user has boards of their own.

/** The label colours a card can carry. `name` is a default the user may rename per board later. */
export const LABEL_COLORS = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Gray', color: '#6b7280' },
];

/** The accent colours a new board picks from (the dot beside its title). */
export const BOARD_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];

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
