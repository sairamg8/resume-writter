# 11 — Versions in the jobs' and projects' sync (cyc-D)

The jobs and the projects sync item by item through one engine (`src/utils/collectionSyncEngine.js`,
`src/utils/collectionSyncPlan.js`; 05, "Jobs and boards"). Until now it told "changed on the other
device" from "not changed" by comparing `updatedAt`, a wall-clock time stamped by whichever device made the
edit, and it wrote with no precondition. Four conflicts therefore went unseen. This note names each and
how a per-item version closes it.

## The version

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

## Not done, on purpose

- Nothing is batched across requests (a 450-item split was reverted: S7). A transaction holds the same at most 500
  writes a batch does; a larger first sync still goes one item at a time, each in a transaction of its own.
- Which side stays the item when both changed still follows `updatedAt`, so a device with a slow clock may find
  its latest edit as the "(conflict copy)". Nothing is lost either way.
- The deletion list and the order are not preconditions (`meta/<name>`): they are merged by the batch itself
  (`arrayUnion`, `arrayRemove`) and a stale order is repaired by the next write.
- A browser whose site data was cleared is a new device: its earlier writes look like another device's.
  Then a list that differs from the account's is kept as a copy rather than guessed at.
