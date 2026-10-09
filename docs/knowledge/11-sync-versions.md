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
  The one exception is deletions: more than 400 at once ("Clear all jobs" on a long list) are sent first, 400 to a request,
  each request recorded as deleted as it lands, so an Undo after part of them went is still a copy changed since; left in
  one request they were refused for good and so was every sync after, with the next job added blamed as too large (H1).
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

## The final hunt (H1): what changed after the review

Each fix has its own test, `tests/unit/4*-h1-sync-*` (400 to 429); `410-h1-sync-three-devices-fuzz` runs seeded random scripts of
three devices on two accounts (edits, additions, imports, deletions with Undo, moves, offline spells, sign-outs, account
switches, reloads, a browser's data cleared, failing reads and writes, slow and fast clocks, slow server calls that let the
syncs of different devices overlap) and checks that they converge and that nothing typed is lost or leaks to the other
account; a failing script is cut down to the steps that matter and printed with every device's list and record after each.

- More than 400 deletions at once ("Clear all jobs" on a long list) are sent first, 400 to a request, each recorded as it lands:
  in one request they were refused for good and so was every sync after, the next job added blamed as too large (400).
- A flush belongs to the line it began in (`gen`): after a start (refresh, going online, an account change) it stops, so the
  copy it was queued with is never written, on a retry, over the newer edit the restart's first sync sent (401).
- A flush or a first sync that takes the cloud's copy of an item edited here meanwhile does not record that copy as seen (the
  record keeps the copy the edit was made on; for an item never seen here, the copy the edit was made on is the base): the
  edit's own write then finds the cloud's copy moved and keeps the older side as a conflict copy (402, 414). An untouched demo
  in the account is no copy, and never replaces an edit (417).
- A job deleted here and unsent at sign-out keeps its version in what is kept aside, like an item changed here: the next sign-in
  keeps an edit another device made meanwhile (403). An item kept aside and one the signed-out list has under the same id (a file
  imported again) are both kept, the earlier as a copy (412).
- A transaction out of tries (`failed-precondition` from the SDK) is a copy that kept changing (`STALE`), not a refusal that holds
  the item (404).
- A flush of up to 100 items also checks that the copies it read as absent still are: an imported file's jobs have the same ids
  on every browser that imports it (405). A first sync's few new items are checked too, so a first sync a start replaced cannot
  land late with its older copy over a newer edit (413). Larger writes are not (each check is a read in a transaction of 500).
- A flush sends the list's order only when it changes it (a move, a deletion, an item the account lacks, a copy), not with every
  edit, which put another device's move back (406).
- After a merge the sync queues the list the store holds, not the one it handed over: a project given a key of its own on taking
  the list is sent with it (407).
- The id of a conflict copy carries a mark of the id when the id had characters replaced (408), and another content with the same
  id and time takes the next free id: the second copy was taken for the first and never made (409).
- A job deleted here, sent, edited on another device (the edit won over the deletion), then put back here with Undo and edited,
  keeps both edits, the older as a copy (411).
- A write that landed after a start replaced the sync that sent it is recorded (for what the list holds), or its items are ones
  "never seen here" at the next sync and the older of two edits is dropped (415); a conflict copy it wrote is not recorded, or it
  is taken for an item deleted here (416).
- A first sync reads the deleted list again when an item it read is on it: a write between the two reads (an edit that brings a
  deleted item back) made it look deleted for good, and the edit was deleted from the account (418).

- (After the review of the fixes above; tests 419 to 429.) A deletion request that landed after a start replaced the sync
  that sent it is recorded as deleted all the same, so an Undo made then keeps the jobs (419); a write that landed so is
  recorded for an item deleted here meanwhile too, or it came back as a job never seen here (420).
- A flush reads the ids of its conflict copies as well: another device holding one, or writing it between the read and the
  write, was overwritten with the copy. Another content takes the next free id, a copy the account holds already is not made
  again, and the rest are expected absent when the write lands (421). The check of absent copies covers a write of up to 400
  items (a transaction holds 500 writes and the lists take three), not 100 (423).
- A stale error keeps the SDK's own code (`failed-precondition`, `already-exists`) as its `cause`, in its message and in the
  line logged when the sync gives up for the moment (422).
- A deletion this browser sent stays in its record (as version `DELETED`) at the next first sync too, while the account lists the id
  as deleted, up to 2,000 of them: an Undo made after a restart was a job "typed before signing in" whose id the account
  deleted, and was dropped (424). One kept aside at a sign-out is not (a deletion already sent is not kept aside, as before).
- A job deleted while the first sync's batch is on its way keeps the copy it was deleted from as its base in the record, like an
  edit typed then: claimed as the account's newer copy, the deletion the sync queued deleted another device's edit the user
  had never seen (425).
- A first sync waits (a few seconds at most, `cloudTimeout`) for what an older line left on its way, so its read of the cloud
  comes after the request has landed: read before, a deletion landing after an Undo left the record claiming jobs the cloud no
  longer had, and the next sync dropped them (426).
- A flush judges the copies it read by the record as it was before the read: two tabs share the record, and the other tab's
  flush landing during the read left the record ahead of the copy, which counted as a move and replaced the newer edit (427).
- An untouched demo put back by Undo yields to the account's edit of it, as one never synced here does (428).

The three-device script (`410`) now also checks that a job deleted in the script, not put back by Undo and not touched on
another device, is gone from every device and the account; that the conflict copies are no more than the edits made and no two
jobs hold one content; and that every device shows the jobs in the account's order. It covers "Clear all" of 405 jobs (with the
second request failing), `failed-precondition` from the SDK, and a second tab of one browser. Its knobs are `H1_FUZZ_SEEDS`,
`H1_FUZZ_STEPS` and `H1_FUZZ_ONLY` (seeds to run alone); the CI `tests` input passes them as
`--import=data:text/javascript,process.env.H1_FUZZ_SEEDS=3000 tests/unit/410-h1-sync-three-devices-fuzz.unit.mjs`.

Left as they were, and why:

- The whole list is read at every first sync (each time a tab is shown after ten seconds, going online), and the transaction
  reads again the copies it replaces: cost, not loss.
- An item over the size limit by less than the two version fields is held by the server's refusal, not by the size check.
- An item typed before the first sign-in, or imported, whose id the account deleted, is dropped by the first sync: it cannot be
  told from a stale copy of a deleted item.
- Two devices that each import the same file and edit the same job before either has synced it: the item is unknown to both, so
  the clocks settle it and the older edit is dropped with no copy. The same for an edit made at the very millisecond of the
  version the record holds (the record cannot tell it changed): both need a base the record does not keep.
- The first account to sync a list nobody owned (typed signed out) takes it; a sync a start replaced may already have sent it to
  the account just left. Nothing of that account's own data goes to the other.
- A project's key given on taking a list (two projects that met with one key) is a write like an edit's: sent after another device
  deleted the project, it brings it back. The store makes the key, not the user; the sync cannot tell the two.
- A conflict copy a user deleted may be made again by a device that settles the same conflict later (its id follows the
  conflict).
- Stage names: a stage removed on one device and added again on another before either sees the other is settled by which
  request reaches the cloud last; a tombstone list over 100 names is replaced whole by the device that removes the 101st.
