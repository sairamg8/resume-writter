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
| `createResume` / `importResume` / `duplicateResume` / `deleteResume` / `renameResume` | CRUD |
| `setActiveId` / `loadResumes` | selection & bulk replace (cloud merge) |
| `restoreResumes` | put résumés back by id and drop them from `deletedIds` (demo samples) |
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

## Demo accounts — sample résumés that always come back

**Files:** `src/hooks/useDemoSeed.js` (wiring), `src/utils/demoSeed.js` (pure rules, unit-tested),
`src/utils/demoResumes.js` (the samples + `DEMO_ACCOUNTS`).

The owner's login (`DEMO_ACCOUNTS`, default `sairamgudiputi8@gmail.com`; a build can override it
with `VITE_DEMO_ACCOUNTS`, comma-separated, set-but-empty = nobody) always has five sample
résumés — one per template, a fictional "Jordan Rivera", ids `demo_classic` … `demo_executive`.
Everyone else, and every signed-out visitor, keeps the blank first run.

| When | What happens |
|------|--------------|
| Signed in, account list known, **no sample in it** | the whole sample set is put back (`restoreResumes`) |
| First sign-in on an empty account | the set appears (same rule) |
| The owner has only their own résumés | the set is added next to them (same rule) |
| Some samples deleted, others left | the deleted ones stay deleted |
| A sample edited | saved and synced like any résumé |
| A restore | each sample comes back as its **latest edited copy**, else the built-in one |

- **"Account list known"** = `useCloudSync` returned `account` for this uid: the first sync
  finished, or there is no cloud (no Firebase / rules error). Never earlier — restoring before
  the sync could stamp stale copies with a new `updatedAt` and overwrite newer cloud ones.
- **Latest copy:** `useDemoSeed` keeps a per-uid map of the newest copy of each sample seen,
  fed by the local list on every change and by the cloud's sample docs from the first sync —
  deleted ones included.
- **Fixed ids** mean two devices restoring at once merge into one set instead of duplicating.

### How the cloud stores a deleted sample

A regular résumé is deleted from `users/{uid}/resumes` and its id is added to
`meta/deletions`. **A sample is flagged instead:** the flush writes `{ deleted: true }` with
`merge: true`, so the doc keeps its last content. The first sync treats flagged ids like
deletion-list ids (excluded from the merge, local copies too) and hands the flagged docs,
flag stripped, to the demo seed. A restore rewrites the whole doc, which drops the flag. No
read of `meta/deletions` is needed on that path, so a delete-then-restore within one session
cannot race. A sample that an older build deleted outright (hard delete + deletion list) is
taken off the list when it is written again (`nextTombstones`).

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
