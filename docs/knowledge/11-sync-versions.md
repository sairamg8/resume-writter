# 11 — Versions in the jobs' and projects' sync (cyc-D)

The jobs and the projects sync item by item through one engine (`src/utils/collectionSyncEngine.js`,
`src/utils/collectionSyncPlan.js`; 05, "Jobs and boards"). Until now it told "changed on the other
device" from "not changed" by comparing `updatedAt`, a wall-clock time stamped by whichever device made the
edit, and it wrote with no precondition. Four conflicts therefore went unseen. This note names each and
how a per-item version closes it.

## The version

The helpers are in `src/utils/collectionSyncRev.js`; the plan (`src/utils/collectionSyncPlan.js`) and the engine
(`src/utils/collectionSyncEngine.js`) decide by them; the transaction is `commit` in `src/utils/collectionSyncIo.js`.

Every item document the engine writes carries two added fields, and nothing else changes in it:

- `syncRev`: a whole number that goes up by one with every write of the item
  (`max(the cloud's rev it read, the rev this browser last saw) + 1`);
- `syncBy`: the id of the browser (device) that made the write. Each browser makes one id and keeps it in its
  sync record (`cpwtcv_jobs_sync_v1` / `cpwtcv_boards_sync_v1`, field `device`).

This browser's sync record gains one more field, `revs` (`{ id: syncRev }`): the rev of each item's cloud copy as
last seen here, kept next to `versions` (the `updatedAt` it last saw). The two fields are read off a cloud copy
before it reaches the list (the store never holds them), and written back with it.

**The rule:** the cloud's copy of an item *moved* since this browser last saw it when its `syncRev` is above
the recorded one and it was not this browser that wrote it. This browser's copy *changed* when its `updatedAt`
differs from the one recorded (differs, not "is later": a clock behind the other device's stamps an earlier
time). Only one side moved: that side stays, whatever the clocks say. Both: the item and a
"(conflict copy)" are kept, as before, and the existing notice names it. A write is accepted by the cloud only if
the copies it read are still there unchanged (a transaction that checks them), else it reads again.

## The four conflicts

| # | What went unseen | Why | How the version closes it |
|---|------------------|-----|---------------------------|
| a | An item never synced, edited on two devices before either synced it (the demo job has one fixed id on every browser; so has one imported file) | The record had no version for it, and a conflict needed one | A first sync of a list new to the account has the base "rev 0, never seen": the cloud's copy (rev 1 and up, written by another device) moved, this browser's was edited, the content differs: both kept. An untouched demo still never makes one |
| b | A device whose clock is behind (or ahead) | The newer `updatedAt` won, and an edit stamped earlier than the version it was made on looked "not changed" (or lost to a copy it should have replaced) | Whether either side changed no longer reads a clock: the cloud's by `syncRev`, this browser's by `updatedAt` differing from the recorded one. One side only: it wins even with the older stamp. Both: still kept as a copy. Which of the two stays the item still follows `updatedAt` |
| c | Two devices writing the same item at the same moment: same `updatedAt`, a tie, or two writes landing together | A tie went to whichever device read the other; two writes at once had no order at all, the later overwrote the earlier | A tie goes to the greater `syncBy` (the same two copies, the same winner, whoever finds it). Two writes landing together are ordered by the check below |
| d | An edit made while a sync is reading: the cloud copy changes between the sync's read and its write | A read-modify-write with no precondition: the batch overwrote what arrived meanwhile | The write is a Firestore transaction that re-reads each item it replaces or deletes and compares it with the copy the sync decided from (its `syncRev`, `syncBy` and `updatedAt`). A difference writes nothing and the sync decides again from the new copy (up to three times, then it is tried later as any failure) |

## Rolling back to the old site

The previous site (the old UI, `master-backup`) must still read everything written here. So: fields are only added
(the two on an item document, two on the sync record); no storage key, document path, document shape or rule
changes (`firestore.rules` is untouched); a copy with no `syncRev` is rev 0, written by nobody. The old site keeps
unknown fields when it rewrites an item, so a copy it edited has the same `syncRev` and a new `updatedAt`: the
engine reads that as moved too (`updatedAt` differs from the recorded one), as it reads a copy that has no rev. A
record the old site rewrote has no `revs` or `device`: `versions` alone decide then, by equality of `updatedAt`.

This was checked against the code of both previous sites, `master-backup` (00c7283) and d8385e4: `firestore.rules` is
identical in both and in this branch; their `collectionSyncIo` reads a document with `{ ...d.data(), id }` and writes
an item back whole, so the two fields travel with it and are never refused; their `normalizeJob` copies a job with
its unknown fields. Their record read keeps only `uid`, `versions`, `order` and `stashed`, so a record they rewrite
loses `device` and `revs` — harmless: the next sync here makes a new device id (its earlier writes then look like
another device's) and decides by the `updatedAt` fallback above, and a rev bump at the `updatedAt` it saw is no move.

## Tests

`tests/unit/390-cycD-sync-version-stamps.unit.mjs` (the fields, the record, rollback shape),
`391-cycD-sync-slow-clock`, `392-cycD-sync-never-synced-item`, `393-cycD-sync-tie`,
`394-cycD-sync-write-precondition` (one per conflict above), and the review's `395-cycD-sync-undo-stale-copy`,
`396-cycD-sync-apart-stale`, `397-cycD-sync-hung-write`, `398-cycD-sync-redundant-rewrite`, all in `tests/unit/`.

## Not done, on purpose

- Nothing is batched across requests (a 450-item split was reverted: S7). A transaction holds the same at most 500
  writes a batch does; a larger first sync still goes one item at a time, each in a transaction of its own.
- Which side stays the item when both changed still follows `updatedAt`, so a device with a slow clock may find
  its latest edit as the "(conflict copy)". Nothing is lost either way.
- The deletion list and the order are not preconditions (`meta/<name>`): they are merged by the batch itself
  (`arrayUnion`, `arrayRemove`) and a stale order is repaired by the next write.
- A browser whose site data was cleared is a new device: its earlier writes look like another device's.
  Then a list that differs from the account's is kept as a copy rather than guessed at.
- The check covers the copies a write replaces or deletes. A new item under an id nobody else can make needs none (a
  first sync of 1,000 new jobs stays one batch, or one request each past 500, as before); the ids two browsers can both
  make (the demo's) are checked as absent. A batch that writes only the order is not checked.
- Two tabs of one browser share one writer id: the store's own merge of the two tabs (05) is what keeps them apart.
