# 05 — State, Auth, and Cloud Sync

## Resume store (`useAppStore`)

**File:** `src/hooks/useResumeStore.js`  
**Section helpers:** `src/hooks/useResumeSectionActions.js`

### Persistence

- Every `appState` change writes full JSON to `localStorage` key `cpwtcv_v1`: at once after a quiet
  spell, then the keystrokes that follow together (`coalescedWriter`, `src/utils/coalescedWrite.js`).
- `DATA_VERSION = 13` (`src/utils/dataVersion.js`) — each résumé records its own `dataVersion`, and
  `normalizeResume()` runs the one-time migrations it has not had yet, so none runs twice (not after a
  sync, an import, or a stale tab of an older build). A store of any version loads: nothing is wiped
  to a seed. A version above this build's is stamped down to it and the claim kept in
  `dataVersionAhead` (AUD-26). `tests/unit/knowledge-docs.unit.mjs` fails when this number drifts.

### Two tabs of one résumé (typing-freeze 5)

Every tab keeps its own state and shares only `localStorage` (`cpwtcv_v1`); it hears another tab's save
through the `storage` event, and also looks at storage right before each of its own writes, because that
event is still on its way when both tabs type (the write used to overwrite the other tab's save, and the
event then read this tab's own write back). A tab remembers the raw value it last wrote or took: a value
that differs is another tab's save, taken in first (`takeSave`, `withOtherTabsSave`); one that equals it is
not heard twice.

- **Résumés** are taken by id (`keepUnsaved` in `src/utils/unsavedJobs.js`): a résumé this tab did not change
  is the other tab's; one added here stays; one deleted here stays deleted; the résumé open here stays open.
- **A résumé changed in both tabs is merged field by field** (`mergeResume`, `src/utils/mergeResume.js`), a
  three-way merge of `base` (the copy this tab last read from or wrote to storage), `mine` and `theirs`:
  objects per key; lists of entries (sections, entries) by `id`, where an entry added in either tab stays, one
  deleted in either stays deleted whatever the other tab did to it, and the order is the one the tab that
  moved entries gave (the later writer's if both did); lists of words (hidden fields) as sets; a text both
  tabs changed keeps both changes when they touch different parts of it (compared as the common prefix and
  suffix of each change against `base`), two insertions at one point in the order of their writers; a leaf
  both tabs changed to different values, or changes of one text that overlap, go to the later writer (the
  résumé's `updatedAt`, then its JSON as the tie-break), so that both tabs weigh the same two copies the same
  way and end on the same résumé. A merge that is neither copy is stamped one past the later `updatedAt`
  (cloud sync versions a résumé by it). A part nobody changed here keeps its object, so no preview is rebuilt.
  A copy stamped more than 10 s before the one this tab last read is an old one (a tab that never heard of
  what was saved since): it is not merged, this tab's résumé stands (read against `base` it would look like an
  edit that undid what this tab typed after it).
- **A whole résumé deleted in one tab while the other holds it** follows the cloud sync's rule (an edit made
  after a deletion wins, R2-029). A copy the other tab only *held* is not an edit: the deletion stands in
  both tabs and in storage (the résumé is not written back, whether the other tab writes before it has
  heard the deletion or after), and the id stays in `deletedIds` for the account. A copy it *typed* in
  since it last read storage is an edit, and the save written second decides: when the editing tab saves
  after the deleting tab, it takes the deletion in, keeps its résumé, and the résumé is back in both tabs
  with the typing (and off `deletedIds`); when the deleting tab saves after the editing tab, it keeps the
  deletion it made and the résumé is gone in both. Either way both tabs end on the same list. This differs
  from an *entry* (above), which stays deleted whatever the other tab did to it: an entry is a part of a
  résumé both tabs keep merging, and a deleted one has nowhere to put the edit, while a whole résumé the
  other tab typed in is one a person was looking at. Signing out follows the same rule for what is kept
  aside for the account (`stashedFor`): the other tab's deleted résumé is dropped from the stash if this
  tab only held it, and kept, typing and all, if this tab typed in it. A `deletedInfo` entry of a résumé
  that came back is left in place; nothing reads it without the id in `deletedIds`.
- **Why this shape (the decision, typing-freeze 5):** the loss came from two things — a whole-résumé merge that
  keeps one tab's copy entire, and a write that never looked at storage. A résumé is a tree of small fields
  that tabs type into one at a time, so a field-level three-way merge keeps what each did without a server or
  a shared history (a CRDT or operation log would add a dependency and bytes to the start-up path, which has a
  1,100 kB cap); text is merged by the span each tab changed because a keystroke stream is one such span per
  save. Where two changes cannot both stand (one text overlapped, one leaf set two ways) one must give way, so
  both tabs apply the same rule, by the résumé's own `updatedAt`, and end on the same résumé. The jobs, boards
  and custom-stage stores have neither the save window nor the whole-item merge (they write every change at
  once, and `keepUnsaved` without a merge only holds what storage refused), but they had the same write that
  never looked: each now reads storage first and takes in a save whose event has not arrived (`setJobs`,
  `setBoards`, `addCustomStage` / `removeCustomStage`).
- **The account changing hands** (sign-out, or another account's sign-in) is decided by which tab did it: a tab
  remembers the account storage held when it last wrote or took it. When this tab's account differs from that
  and the other tab's save still carries it, the change is this tab's — the other tab's save is edits on the old
  account's list, so this tab keeps its own `syncedUid`, `cloudVersions` and list, and keeps the other tab's
  changes aside for the account it left (the same `stash` as its own unsent work; a résumé both tabs changed is
  merged with `mergeResume`, one the other tab deleted is not kept unless this tab typed in it, see above) — whether the save is taken at this tab's
  write or by its storage event. When the other tab changed the account, this tab follows it as before (its
  unsent work is kept aside, merged with what the other tab's leave already kept for the same résumé).
- **A write that takes in the other tab's save and fails** (storage full): the merged state is still this
  tab's to write. It is marked as taken, so the save effect writes nothing for it, only after the write
  reached storage; after a failure the effect schedules the write again, and the tab's edits stay unsaved
  against what storage holds, so a later event of the other tab merges with them instead of replacing them.
- No write ping-pong: a save only taken is not written back, and a tab with nothing unsaved takes the other's
  copy as it is.
- Known limit: a read-then-write of `localStorage` is not atomic across tabs (no lock), so two writes inside
  the same few microseconds can still overwrite each other; the window is the gap between a tab's read and its
  write, not the save interval.

### Core API (conceptual)

| Method | Role |
|--------|------|
| `createResume` / `importResume` / `duplicateResume` / `deleteResume` / `renameResume` | CRUD (`importResume(data, { keep })`) |
| `keepResume(id, keep)` | "Keep as my original" / "Stop keeping" (demo accounts) |
| `setActiveId` / `loadResumes` | selection & bulk replace (cloud merge) |
| `restoreResumes` | put résumés back by id and drop them from `deletedIds` (a demo account's originals) |
| `updatePersonal` / `toggleFieldVisibility` | personal block |
| `updateSetting` / `resetSettings` / `setTemplate` | design |
| `updateCoverLetter` | cover letter fields |
| section actions | add/remove/reorder sections & items |

`deleteResume` appends id to `deletedIds` so sync will not resurrect remote copies. `deletedInfo`
records each deletion's version, time and account (`src/utils/localDeletions.js`): another
account's sync leaves it for that account, and on a shared browser an id keeps one deletion per
account — one account's deletion of it never replaces, nor forgets, another's (V2VF1S-1).

## Auth (`useAuth`)

**File:** `src/hooks/useAuth.js`

- `onAuthStateChanged` for session
- `signInWithPopup` + `GoogleAuthProvider`
- `signOut`

Firebase is optional: without the `VITE_FIREBASE_*` values `src/utils/firebase.js` exports `auth` and
`db` as null (`firebaseEnabled`), and the app runs on localStorage alone. A build then shows no Sign In
at all (`useAuth().cloudAvailable` false, so AuthBar renders nothing); on the dev server Sign In signs
in a local stand-in user instead (`SITE_OWNER.devUser` from `src/utils/siteOwner.js`: `VITE_DEV_USER_*`,
made-up `dev@example.com` by default).

## Cloud sync (`useCloudSync`)

**File:** `src/hooks/useCloudSync.js` (React state) over `src/utils/cloudSyncBrowser.js` (the page: its online flag, whether the tab is hidden, the online/offline/visibilitychange listeners) and `src/utils/cloudSyncEngine.js`  
**Firebase init:** `src/utils/firebase.js`

### Status values

`idle | syncing | synced | offline | error | stopped | off` — shown in AuthBar's cloud icon (its tip
on hover); what a failure means: `src/utils/cloudSyncRetry.js`.

| Status | Tip | Means |
|--------|-----|-------|
| `error` | Sync error — will retry | a temporary failure: the first sync is tried again after 30 s, 1 min … up to 10 min, not while the tab is hidden |
| `stopped` | “My CV” not synced (a large photo?) — saved in this browser | the cloud will not take that résumé — over Firestore's 1 MiB document limit (counted before sending) or refused for good. It alone is held back until it changes or goes — or the store makes its photo smaller (`src/utils/smallerPhotos.js`, ONB-10), when it is sent in the same visit; every other résumé keeps syncing (`src/utils/cloudSyncHeld.js`, V2VF1S-0). With no résumé named: a refused batch none could be held for; the next change is tried |
| `off` | Sync is off — changes are saved in this browser | permission-denied or no `(default)` database, or a build with no cloud: nothing is retried until a sign-out or a reload (V2VF1S-2) |

### Initial sync (on sign-in)

1. Fetch all `users/{uid}/resumes`
2. Fetch `users/{uid}/meta/deletions`
3. Merge with local using `updatedAt` and deleted ID sets
4. Batch write merged set back to Firestore
5. `store.loadResumes(merged)`

### Ongoing writes

- Diff previous vs current resumes by id / `updatedAt`
- Queue writes and deletes
- Debounce ~1.5s then flush
- Each flush first reads the server's copies of the résumés it sends — the deletion list only when a
  copy the cloud had is gone, and nothing is written from what it read (R8-4, R2-029). The store is
  asked again once the cloud has answered: a résumé deleted in this browser meanwhile (another tab's
  Delete reaches this one through the storage event) is not written, and not taken off the deletion
  list as an edit; its queued deletion goes next, and a newer copy another device made meanwhile
  comes back with it, as a deletion from an older copy always did. One put back meanwhile (Undo) is
  still written (SL-SYNC-FLUSH-WRITES-DELETED, `tests/pdf/18-cloud-sync-deleted-meanwhile.test.mjs`)
- Offline, or a flush that failed: the résumé store keeps the edits and deletions, and the next first
  sync sends them. Firestore's cache is in memory only (`memoryLocalCache`, R2-005): nothing reads it
  (every read asks the server), and a persistent one kept every account's résumés on disk after sign-out

### Another device's edit (R2-004)

`src/utils/cloudSyncLineage.js`, `src/utils/cloudSyncQueue.js`. Each page remembers which copies of each
résumé it has seen (read from or sent to the cloud, or held in its store) — by `updatedAt`, compared for
equality only, never by clock. The store keeps the cloud's versions it last knew (`cloudVersions`).

| When | What happens |
|------|--------------|
| A flush finds a copy in the cloud this page never saw (another device edited it since) | both kept: this page's copy under its id, the other one as a new résumé **"<name> (conflict copy)"** — on every device; its id comes from the résumé and the other device's version, so two tabs that find the same conflict write one copy (R5-HUNT6) |
| A deletion made from a copy older than the cloud's | not sent: the newer copy comes back (as R8-0 at a first sync) |
| First sync: the copy here is one the cloud had, the cloud's is newer | the cloud's loads, whatever the clocks say |
| First sync: changed on both sides (an offline edit, even across a reload) | both kept, as above |
| The tab is shown again ≥ 10 s after the account was read | the account is read again, so the next edit starts from the other device's copy |
| Deleted on another device, edited here where the deletion was never seen (a page left open, or offline; R2-029) — not one this browser already holds as deleted (another tab's Delete, while a flush reads) | the edit wins: written under its id, taken off the deletion list, back on every device. A copy the cloud had, written again (a demo restore racing a deletion for good), is no edit: it stays listed (V2OWNER-DATA-0); one held back (too large) stays listed until it goes |
| First sync: a listed id the cloud holds again (an older build wrote it back after the deletion) | loaded and taken off the list; a demo account's original there (a restore's copy) is removed from the cloud instead |
| First sync: a listed id, the copy here unchanged since the cloud had it, or of no known version | left out, deleted, as before |

### Signing out on a shared browser (R2-005)

`src/utils/cloudSyncLeave.js`. The list belongs to the account it was last synced with (`syncedUid`).
When that account signs out — or another signs in while the list is still the last one's — the list
leaves the browser: what the account's cloud holds goes (its next sign-in brings it back); a change
that cloud lacks (typed within the pause, offline, or held back as too large) is kept aside for it
(`stashed[uid]`), off the dashboard and out of every other account's sync, and sent at its next
first sync. Its waiting deletions stay (they are its own). A list no account synced (made signed
out) still joins whoever signs in; a build with no cloud keeps its list (its only copy).

## Demo accounts — the owner's ORIGINAL résumés always come back

**Files:** `src/hooks/useDemoSeed.js` (wiring), `src/utils/demoSeed.js` (pure rules, unit-tested),
`src/utils/demoAccounts.js` (`DEMO_ACCOUNTS`), `vite-plugin-owner-resume.js` (the private file on
the dev server), `src/components/ImportDialog.jsx` + `ResumeCard.jsx` (the controls).

The owner's login (`DEMO_ACCOUNTS`: the build's `VITE_DEMO_ACCOUNTS`, comma-separated, read by
`src/utils/siteOwner.js`; unset or empty = nobody, so a fork has no demo account — the e2e build's
is the made-up one in `.env.e2e`) always has its **originals**:
the résumés marked **"Keep as my original"** (`keep: true` on the résumé). Everyone else, and every
signed-out visitor, deletes like anywhere and keeps the blank first run.

> **Changed 2026-09-15.** Until then what came back was five fictional samples ("Jordan Rivera",
> ids `demo_classic` … `demo_executive`). The user: *"i want to see my original resume data
> instead of sample one"*. The samples are gone from the app (they live on as test data in
> `tests/fixtures/sampleResumes.js`); no account gets them any more.

| When | What happens |
|------|--------------|
| Signed in, account list known, **no original in it** (every résumé deleted, or only samples / others left) | every original comes back (`restoreResumes`), each as its **latest edited copy** |
| Some originals deleted, another left | the deleted ones stay deleted (until the last one goes: "Stop keeping" on it) |
| Delete on the list's **last** original | disabled, with a note on its card — it would come straight back (V2OWNER-DATA-4) |
| The account has no original at all | nothing comes back — an empty dashboard stays empty |
| An original edited | saved and synced like any résumé |
| "Stop keeping", then Delete | deleted for good, like any résumé |
| A copy of an original ("Copy") | a new résumé, not an original |
| **Samples already in the account** (from before 2026-09-15) | ordinary résumés: kept until the user deletes one, then removed for good |
| **Samples the old build flagged** (deleted before 2026-09-15, hidden in Firestore since) | the account's first sync settles each (`oldSamples.js`, V2OWNER-DATA-8): **untouched** — its content is one an old build stored for the sample (a fingerprint baked into the app: 13 copies, re-derived from those builds' own code), or a flag with nothing under it — removed and listed, for good; **edited** (anything else) — back in the list as an ordinary résumé (flag dropped, written back normalised), to keep or delete |

Marking one (demo accounts only):
- **Card:** "Keep as my original" under the name; a kept one shows an **Original** badge and
  "Stop keeping" (`store.keepResume` — an edit, so it syncs).
- **Dashboard → Import** is a menu there: "Import JSON" or **"Import as my original"**
  (`importResume(data, { keep })`; a file's own `keep` field is ignored). The editor's **Export**
  menu offers the same two (`ExportDropdown` `keeps`, `useEditorExports`); other accounts get
  the plain import in both places (the editor's is labelled "Import as a new résumé").
- **Delete** on an original says it comes back, and to "Stop keeping" first to delete it for good.
  On the list's last original it is disabled instead (`demoSeed.comesStraightBack`: the list left
  would need the restore, which puts that very copy back), and the card says so: "Your last
  original always comes back. To delete it, choose "Stop keeping" first."
- **Dev server only — the owner's real résumé, automatically.** `private/sairam-resume.json`
  (git-ignored) is served by `vite-plugin-owner-resume.js` as `virtual:owner-resume` to the dev
  server, and as `null` to every build (production, e2e) without being read. On the dev server,
  once the owner's account is known and it has **no original yet** (local or cloud, deleted ones
  included), `useDemoSeed` adds the file as its original (`privateOriginal`: fixed id
  `original_private`, `keep: true`) — only into the account whose e-mail the file carries, never
  twice, never over a résumé with that id, never after it was deleted for good (the cloud's
  deletion list or this browser's `deletedIds`). The sync then takes it to `users/{uid}` in
  Firestore (owner-only by `firestore.rules`), and the public site loads it from there on every
  device. So: run `yarn dev` once, sign in as the owner — done. Without the dev server: Import →
  "Import as my original". `tests/pdf/24-private-data.test.mjs` builds production and e2e and
  checks none of the file's text is in them.

- **"Account list known"** = `useCloudSync` returned `account` for this uid: the first sync
  finished, or there is no cloud (no Firebase / rules error). Never earlier — restoring before
  the sync could stamp stale copies with a new `updatedAt` and overwrite newer cloud ones.
- **Latest copy:** `useDemoSeed` keeps a per-uid map of the newest copy of every résumé seen
  (`rememberCopies`), fed by the local list on every change, by the cloud's originals from the
  first sync (`account.cloudOriginals`, deleted ones included) and by the cloud's answer at
  restore time (`readCloudCopies`, R4-4). A newer copy that is not kept wins over an older kept
  one, so "Stop keeping" sticks. A restored copy keeps its own `updatedAt`; with no answer from the
  cloud the restore stays local until a first sync gets through (VM4-6).
- Local-only (no cloud, e.g. the e2e fake sign-in): an original deleted before a reload is only
  known again from the cloud, so without one it comes back only within the same visit.

### How the cloud stores a deleted original

A regular résumé is deleted from `users/{uid}/resumes` and its id is added to
`meta/deletions`. **An original is flagged instead** (demo accounts only): the flush writes
`{ deleted: true, keep: true }` with `merge: true`, so the doc keeps its last content — marked an
original even when it was marked here and deleted before a flush sent the mark. Whether a deleted
résumé was an original is decided by the copy deleted: the write queue tracks it (`queueChanges`
→ `kept`), and so does the store's deletion record (`deletedInfo[id].keep`) for the first sync; an
older build's entry falls back to the cloud copy's mark. The first sync treats flagged ids like
deletion-list ids (excluded from the merge, local copies too, unless edited since) and hands the
flagged originals, flag stripped, to the restore. A restore rewrites the whole doc, which drops
the flag; a restored original that is on the deletion list (removed outright by an older build)
comes off it in the same batch. Outside a demo account a flagged doc is removed at the first sync
(R4-11).

The debounced watcher also drops an id from the pending deletes when the same id is written
again before the flush — otherwise one batch would set and then delete (or flag) the restored
doc.

### Jobs and boards (R2-145, R2-140)

The Job Tracker's jobs and the boards sync with the signed-in account too, through one shared
engine for plain lists (`src/utils/collectionSyncEngine.js`, wired per list in
`src/hooks/useCollectionSync.js`, mounted twice in `App.jsx`). Each job or board is one document,
`users/{uid}/jobs/{id}` / `users/{uid}/boards/{id}`; `users/{uid}/meta/jobs` and `meta/boards` hold
the ids deleted for good (`deleted`) and the list's order (`order`). The existing
`users/{uid}/{document=**}` rule covers them (no rules change). The first sync merges item by item
(`collectionSyncPlan.planFirstSync`: newer `updatedAt` wins, nothing typed is lost, a deleted id
stays deleted unless edited where the deletion was never seen); then changes are sent in one batch
after a 1.5 s pause. Failures, retries and 'off' reuse `cloudSyncRetry.js`; an item over Firestore's
1 MiB is held back on its own and named on the page (`SyncHeldNotice`); a batch of several refused
for good (an imported id the cloud cannot name, a list inside a list) goes to a first sync, which
takes it apart and holds only the item refused on its own (`commitApart`, R5-HUNT7). Deleting such a held item (or clearing the list with it) sends no deletion for an id the cloud cannot name (`cloudCanName`: it was never there), so the other deletions go and the sync ends synced (R5-HUNT8). An item whose id the cloud cannot name is held before it is sent, as one too large is: with two "/" ("greenhouse/acme/12345") the SDK took it as a document nested under the list, never read back, and the next first sync dropped the job here; a version an older build recorded for such an id is ignored (R5-HUNT8 review). What each list's sync is
doing goes to `collectionSyncStatus` (`collectionSyncMeta.js`) and shows in the workspace's top bar (the AppBar's right slot)
as the résumés' cloud icon, with its words (`shell/CollectionSyncDot.jsx`, R2-140-c): the jobs and
the projects on the Job Tracker's pages, the projects elsewhere, the worst status winning
(`worstSyncStatus`: error, stopped, off, offline, syncing, synced); none while signed out. It reads
the browser's online flag as the résumés' icon does, so 'offline' with the browser online (a server
the sync cannot reach) says "Cannot reach your account", and "Offline" only when the browser is (R4-LO-23). This browser's record of a
list — the account it last synced with, the versions and the order its cloud holds, what was kept
aside — is `cpwtcv_jobs_sync_v1` / `cpwtcv_boards_sync_v1` (`collectionSyncMeta.js`; a record saved
before the order was kept reads with none). The order merges on that base: a move made before a
first sync (offline, signed out, a failed sync) leads when the cloud's order is still the base's,
and the cloud's order leads otherwise (R2-140). The first sync takes the record's versions (and the
order it last saw) before it reads the cloud, as the résumés' takes `known` (R5-HUNT6): every tab shares the record, and
another tab's flush landing during the read no longer has a job or project that tab just added
dropped (and then deleted from the account), or one it just deleted brought back
(R5-HUNT11-SYNC-COLLECTION-FIRST-SYNC-READS-RECORD-AFTER-CLOUD), or a move it just sent undone by the
cloud's old order (R5-HUNT11-SYNC-REVIEW-FIRST-SYNC-ORDER-READ-AFTER-CLOUD). So does what was kept aside at the
last sign-out: two tabs signing in at once, the other tab's first sync taking it out of the record during
this one's read no longer brings back a job or project deleted just before that sign-out
(R5-HUNT12-SYNC-FIRST-SYNC-STASH-READ-AFTER-CLOUD). A first sync that finds the record naming its account
after the read, when it did not before (the other tab's first sync took the kept-aside list meanwhile), reads
again, once, as a steady-state sync: the cloud copy, the kept-aside list and the list were no longer one view,
and a job that tab restored from it and then deleted was added here again and sent back to the account
(SL-SYNC-FIRST-SYNC-STASH-CONSUMED, `tests/unit/sync-first-sync-stash-consumed.unit.mjs`). A first sync applies its merge to the list as it is once its batch is acknowledged,
and tells what was changed meanwhile by content, not by object (as the queue's `changed()` does): another tab's save
re-reads the whole list, and every item, a job the phone had deleted among them, then counted as edited here, was added
back and sent, taking the phone's deletion off the account's list (SL-SYNC-FIRST-SYNC-SAVED-MEANWHILE,
`tests/unit/sync-first-sync-saved-meanwhile.unit.mjs`); an item whose content was edited here meanwhile still stays.
A flush asks the list again once the cloud has
answered its read: a job or project deleted in another tab meanwhile (it reaches this one through the storage event) is
not written back — the write would also take its id off the account's deletion list, undoing that tab's
deletion on every device — and its queued deletion goes next; one put back meanwhile (Undo) is still written
(SL-SYNC-FLUSH-WRITES-DELETED-ITEM, `tests/unit/sync-flush-deleted-meanwhile.unit.mjs`). Signing out (or another account signing in) takes
the list off the browser as the résumés' is (`leaveList`: unsent changes, a move among them, kept
aside for that account's next sign-in); signed out, nothing runs and the list is this browser's, as
before. Storage too full to take the record with what was kept aside: the list goes first to make
room, and when the record is still refused the list stays, still that account's, and another
account's first sync waits (retried) rather than taking it in (R5-HUNT7). A first sync whose record (naming the account the list now belongs to) storage refuses is not done
either: the list is left as it was and the sync says it will try again, instead of showing "synced"
while no change was sent and the account's list stayed behind at sign-out (R5-HUNT9). The record makes room as the list does (`setItemWithRoom`: the page
pictures' cache goes first, then the backups), so a storage filled only by that cache no longer keeps
the first sync waiting for good (R5-HUNT9 review). Two guards against losing the account's items: a first visit's demo
job or project, untouched (`isUntouchedDemoJob` / `isUntouchedDemoBoard`, the store's `seed`),
never wins over the account's copy of it, though dated newer, and never joins an account that
already has items or deletions of its own; and the demo deleted on a browser before its first
sign-in (`seedIds`, the demo's fixed id, absent here, from the account and from this browser's
record) is listed as deleted at that first sync, so it stays deleted even in an account with no
other item, while a demo filled in on another browser before its first sign-in still wins over that
deletion (R5-HUNT4); and a saved list the store could not
read in full makes the record forget the versions (`forgetSynced`), so the items left out are
merged back from the cloud instead of being deleted from it; and the record claims no version
for an item shown here that storage refused to hold (the store's `saved()`, `claimed` in the
engine) — storage full, a list save refused while the few bytes of the record fitted made the record
name items never stored, and the next reload's first sync took them for deleted here and deleted
them from the account; now they come back from the cloud (R5-HUNT10). An item deleted here (gone from
the list and from storage) keeps its version until its deletion is sent, so a reload or a failed
flush before then still deletes it from the account rather than bringing it back.

### Public links (R2-148)

Export → **Share a public link** (only for a signed-in account on a site with Firebase configured;
hidden otherwise) publishes a read-only copy of one résumé (`src/utils/publicLink.js`,
`src/components/ShareLinkModal.jsx`). The copy is `publicSnapshot(resume)`: template, design, and
what the PDF prints — hidden fields' values blanked (a hidden contact's Display label and Link URL
with it), only the `personal` keys the PDF reads, a section's dates with Show dates off and its
locations with Show location off blanked, hidden sections and entries, entries that print nothing
(blank, or every field hidden: the panel neither counts one nor calls adding one a change,
R5-HUNT12) and sections with no entry that prints dropped, the design's saved designs, last-applied look name and hidden contacts' icons left
out, no cover letter, no dashboard name, no id. It is written to `public/{shareId}` (`{ owner, resume,
publishedAt }`, `shareId` a random uuid) together with `users/{uid}/shares/{resumeId}` (`{ shareId,
publishedAt }`) in one transaction; Publish first reads that record and reuses the link it names, so two tabs
or devices never make two copies — two Publishes at the same moment included: the second's write is
refused as the record changed since its read, and it runs again on the first one's link (R4-LO-22) — and Unpublish deletes the copy the panel shows and the one the record
names (each only if it is still there) and the record, in one transaction too, so a Publish elsewhere between its read and
its write never leaves a copy no record names (R4-LO-22), and so does deleting the résumé from the Dashboard while signed
in (`unpublishResume`), which would otherwise leave a copy with no panel left to take it down. A
résumé deleted on another device, offline, signed out or on an older build loses its copy at the next
first sync of any device: the engine (`publicLinks`, wired in `useCloudSync`) passes the account's
deletion list, the ids its batch removed or flagged and the cloud's flagged originals — none the
merged list holds — to `unpublishDeleted`, which reads
`users/{uid}/shares` and the index below once and takes down each listed résumé's copy, each in a
transaction that checks the résumé is still gone (one written back since keeps its copy) — not waited for, a failure only
logged (`tests/pdf/18-cloud-sync-public-links.test.mjs`). Every copy is also listed in the account's
index `users/{uid}/meta/publicCopies` (`{ copies: { [shareId]: resumeId } }`, R2-148), written in the same
transaction as the copy and taken out with it (the document goes when it lists none): the rules forbid
listing `public/`, so a copy no record names — the record lost, or a second copy a race left — was
public for good. Now the panel's `readShare` falls back to the index when the record is gone, Publish
reuses the indexed copy (and takes down any other one the index lists for the résumé), and Unpublish,
Dashboard Delete and `unpublishDeleted` take down every copy the index names
(`tests/pdf/148-r2-148-public-copies-index.test.mjs`). It lives under the account's own rule, so
`firestore.rules` needed no change, and no sync reads it (03-data-model.md, Firestore layout). A copy
holds a skill group's levels only for the skills its text lists, none for a group whose skills are
hidden (R2-147, `tests/pdf/147-skill-level-public-copy.test.mjs`). `firestore.rules` lets **anyone get** a `public/{shareId}` document
(never list the collection) and only the account named its `owner` create, update or delete it, a
write carrying only `{ owner, resume, publishedAt }` with the copy's template, settings, personal,
sections and data version, each of its type (`isPublishedCopy`, R2-148-d) —
the only world-readable documents. The copy is not live: the panel says when the résumé changed since
(its data version aside) and offers "Update the public copy". The link `#/r/<shareId>` is served by this same app
(`src/pages/PublicResume.jsx`): the editor's PDF preview of the copy and a Download PDF button; a
missing copy says it is not published. The page stays mounted when the tab moves to another link
(only the hash changes): it says it is loading until the new link's copy is read, and a download or
its error shows only on the link it was for (R5-HUNT7). Tests: `tests/pdf/99-public-link.test.mjs` (over
`tests/pdf/fake-firestore.mjs`, which applies the same rule), `tests/unit/firestore-rules.unit.mjs`.

### What is NOT synced

- UI prefs like panel width
- Auth profile itself (handled by Firebase Auth)

## Job store (`useJobStore`)

**File:** `src/hooks/useJobStore.js`  
Key: `cpwtcv_jobs_v1`, `JOB_VERSION = 2`.

A module store shared by every job page (`useSyncExternalStore`), read from localStorage when the first job page
opens; another tab's save arrives through the `storage` event, and what storage refused here is kept and written
again (`src/utils/unsavedJobs.js`). While no job page is open (no `storage` listener), `snapshot()` first takes
what storage holds if it changed (`catchUp`, pure: it runs in render), so an Undo toast or a reopened job form
never writes this tab's old list over another tab's; a value it could not read in full is backed up before the
next write (`backupRaw`); a change made while a page listens also takes in a save whose `storage` event has not
arrived yet (typing-freeze 5). Signed in, it syncs with the account through `useCollectionSync` (above);
`jobsNow` / `replaceJobs` are what the sync reads and replaces.

## Implications for open-source forks

- App is usable **without** Firebase: a clone with no `VITE_FIREBASE_*` values runs local-only
  (`firebaseEnabled` false; no Sign In in a build).
