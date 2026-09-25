# Boards — Trello-style project/task management

A general-purpose task board (boards → lists → cards), Google-synced across devices via the
same Firebase account that syncs résumés. Distinct from the Job Tracker, which is a fixed
job-application pipeline.

## Decisions

- **Sync strategy — a parallel board pipeline, not a refactor of the résumé engine.** The
  résumé engine (`cloudSyncEngine.js`) carries semantics boards don't have (demo "originals",
  `keep` flags, restore) and many incident-tagged behaviors. A dedicated board engine reuses the
  generic parts as-is (`cloudSyncRetry.js` backoff, `cloudSyncBrowser.js` online/hidden wiring,
  the `cloudSyncIo` writeBatch shape, `storageBackup` utils, the `fake-firestore` test harness)
  and stays clear of the most battle-tested code in the app.
- **Merge granularity — per-board last-write-wins by `updatedAt`.** One Firestore doc per board
  at `users/{uid}/boards/{id}`, mirroring `resumes/{id}`. Simple, atomic, offline-friendly.
  Trade-off: two devices editing different cards of the same board while both offline → last sync
  wins the whole board. Acceptable for single-user/multi-device; card-level merge can come later.
- **Doc-size ceiling.** A board doc caps at Firestore's ~1 MiB (hundreds of cards). Phase 3 adds
  a size guard + warning.
- **firestore.rules needs no change** — `users/{uid}/**` already covers `boards`.

## Data model

```
Board { id, title, color, lists: List[], createdAt, updatedAt }
List  { id, title, cards: Card[] }                       // order = array order
Card  { id, title, description, labels: [{color,name?}], due, checklist: [{id,text,done}],
        createdAt, updatedAt }
```

Every board-changing mutation stamps `board.updatedAt` (sync LWW keys on it).

## Phases & files

### Phase 1 — data model + local store  ← DONE (lint clean, normalizer sanity-checked)
- [x] `boards-plan.md` (this file)
- [x] `src/utils/normalizeBoard.js` — `readBoard`/`completeBoard`/`addressableBoards`, migration
- [x] `src/constants/boards.js` — label palette, board colours, starter lists, demo board
- [x] `src/hooks/useBoardStore.js` — `useSyncExternalStore` module store, key `cpwtcv_boards_v1`,
      cross-tab (reuses `keepUnsaved`) + quota-recovery; board/list/card CRUD + `moveCard`/`moveList`
- Verified: `oxlint` clean; Node sanity checks on the normalizer (clean-board identity kept,
  messy input repaired without dropping readable data, demo board loss-free). Formal
  `tests/unit/normalize-board.unit.mjs` lands in Phase 4 alongside the store/sync tests.

### Phase 2 — UI (mobile-first)  ← DONE (lint clean, build green, verified in browser)
- [x] `src/pages/Boards.jsx` (grid, create, delete, empty state), `src/pages/Board.jsx` (DndContext,
      columns, mobile list-tab strip + scroll-snap, `AddListColumn`)
- [x] `src/components/board/{BoardCard,BoardColumn,AddCard,CardDetailSheet,LabelPicker}.jsx`
      (checklist reuses the Job Tracker's `TasksTab` — same `{id,text,done}` shape — so no separate
      Checklist component)
- [x] routes in `src/AppRoutes.jsx` (`/boards`, `/boards/:id`); "Boards" nav button in `src/pages/Dashboard.jsx`
- [x] drag sensors: `MouseSensor` (distance 8, snappy desktop + tap-to-open) + `TouchSensor`
      (delay 200 / tolerance 8, press-and-hold to drag so swipes still scroll)
- Verified in the built-in browser: board renders with labels/due/checklist; cross-list card drag
  works and persists; add-card works and survives navigation (demo board 4→5 cards); the detail
  sheet mounts with all sections; the mobile viewport shows the tab strip + snap columns.
  (Automated pointer can't trigger dnd card taps — same limitation hits the existing Job kanban —
  so the card-tap-to-open sheet was confirmed via a real DOM click; it's the app's proven pattern.)

### Phase 3 — Google sync — ✅ done (R2-140, cloud-sync cluster, e96514b / 8cd4901)
Built as one engine shared with the Job Tracker's sync (R2-145) instead of a board-only copy:
- [x] `src/utils/collectionSyncIo.js` — `users/{uid}/boards` (one document per board), `meta/boards` (deletions, order)
- [x] `src/utils/collectionSyncPlan.js` — per-board last-writer-wins, honours the deletion list
- [x] `src/utils/collectionSyncEngine.js` — first sync + debounced queue + offline/retry + size guard
- [x] `src/hooks/useCollectionSync.js` (`boardSync`), wired into `src/App.jsx`

### Phase 4 — tests — ✅ done
- [x] `tests/unit/board-sync.unit.mjs` (and `job-sync.unit.mjs`) against `fake-firestore.mjs`
- [x] `tests/unit/firestore-rules.unit.mjs`: `users/{uid}/{document=**}` stays owner-only

### Order
1 → 2 (ship-able local app) → 3 (add sync) → 4 (tests with 1 and 3) → polish (sync-status in AuthBar).
