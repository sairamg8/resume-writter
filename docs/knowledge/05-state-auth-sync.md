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
