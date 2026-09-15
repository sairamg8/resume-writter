# 05 — State, Auth, and Cloud Sync

## Resume store (`useAppStore`)

**File:** `src/hooks/useResumeStore.js`  
**Section helpers:** `src/hooks/useResumeSectionActions.js`

### Persistence

- Every `appState` change writes full JSON to `localStorage` key `cpwtcv_v1`.
- `DATA_VERSION = 6` — mismatch wipes to seed (no stepwise migration beyond version gate).

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

`deleteResume` appends id to `deletedIds` so sync will not resurrect remote copies.

## Auth (`useAuth`)

**File:** `src/hooks/useAuth.js`

- `onAuthStateChanged` for session
- `signInWithPopup` + `GoogleAuthProvider`
- `signOut`

Requires valid `VITE_FIREBASE_*` env vars; without them Auth will error at runtime (tests ignore HTTPS / may still log Firebase noise).

## Cloud sync (`useCloudSync`)

**File:** `src/hooks/useCloudSync.js`  
**Firebase init:** `src/utils/firebase.js`

### Status values

`idle | syncing | synced | offline | error` — shown in AuthBar cloud icon.

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
- Offline: Firestore persistent cache queues writes (`persistentLocalCache` + multi-tab manager)

## Demo accounts — the owner's ORIGINAL résumés always come back

**Files:** `src/hooks/useDemoSeed.js` (wiring), `src/utils/demoSeed.js` (pure rules, unit-tested),
`src/utils/demoAccounts.js` (`DEMO_ACCOUNTS`), `vite-plugin-owner-resume.js` (the private file on
the dev server), `src/components/ImportMenu.jsx` + `ResumeCard.jsx` (the controls).

The owner's login (`DEMO_ACCOUNTS`, default `sairamgudiputi8@gmail.com`; a build can override it
with `VITE_DEMO_ACCOUNTS`, comma-separated, set-but-empty = nobody) always has its **originals**:
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
| **Samples already in the account** (from before 2026-09-15) | ordinary résumés: kept until the user deletes one, then removed for good. Samples flagged by the old build stay flagged and hidden in Firestore — nothing deletes them by itself (they may hold the owner's edits) |

Marking one (demo accounts only):
- **Card:** "Keep as my original" under the name; a kept one shows an **Original** badge and
  "Stop keeping" (`store.keepResume` — an edit, so it syncs).
- **Dashboard → Import** is a menu there: "Import JSON" or **"Import as my original"**
  (`importResume(data, { keep })`; a file's own `keep` field is ignored). The editor's **Export**
  menu offers the same two (`ExportDropdown` `keeps`, `useEditorExports`); other accounts get
  the plain Import JSON in both places.
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

### What is NOT synced

- Job applications
- UI prefs like panel width
- Auth profile itself (handled by Firebase Auth)

## Job store (`useJobStore`)

**File:** `src/hooks/useJobStore.js`  
Key: `cpwtcv_jobs_v1`, `JOB_VERSION = 2`.

Independent React state; not wired into App-level auth/sync. Each job page instantiates the hook separately — still consistent via localStorage reads on mount (standard multi-hook localStorage pattern; simultaneous multi-tab may race).

## Implications for open-source forks

- App is usable **without** Firebase if users never click Sign In (local mode).
- Document clearly that empty Firebase config breaks only the auth path.
- Consider a “cloud optional” guard that no-ops when env missing (improvement idea).
