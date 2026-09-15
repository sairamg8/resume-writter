import { useState, useEffect } from 'react';
import { createBlankResume, defaultSettings } from '@/utils/defaultData';
import { createSectionActions } from '@/hooks/useResumeSectionActions';
import { createSyncActions } from '@/hooks/useResumeSyncActions';
import { newId } from '@/utils/ids';
import { templateStyleDefaults } from '@/constants/templates';
import { DATA_VERSION, normalizeResume } from '@/utils/normalizeResume';
import { backupRaw, pendingRecovery, readSavedList, rememberRecovery, setItemWithRoom } from '@/utils/storageBackup';
import { savedDeletions } from '@/utils/localDeletions';
import { isOriginal, withKeep } from '@/utils/demoSeed';

const STORAGE_KEY = 'cpwtcv_v1';

/** First run: no résumés. The dashboard shows its "Create your first resume" state. */
function emptyStore() {
  return { resumes: [], activeId: null, dataVersion: DATA_VERSION, deletedIds: [], deletedInfo: {}, syncedUid: null };
}

const isResume = (r) => Boolean(r && typeof r === 'object' && !Array.isArray(r) && r.id);

/**
 * The saved store, as `{ state, unreadable }` — read only. Whatever cannot be read — the whole
 * value or single résumés — is left out, and `unreadable` is then the raw value, which useAppStore
 * copies to a backup key before its first save replaces it (readSavedList, shared with the job
 * list). A résumé without an id used to be dropped with no copy and no word, and the next save
 * replaced it (R4-6). This is a useState initializer, which React's StrictMode runs twice in
 * development: it used to make the backup and keep the notice itself (VM4-9).
 */
function readStore() {
  const { saved, list, unreadable } = readSavedList(STORAGE_KEY, 'resumes', r => ({ kept: isResume(r) ? r : null }));
  if (!saved) return { state: emptyStore(), unreadable };
  // Any data version is kept: user resumes must survive an app upgrade (or downgrade). Each
  // résumé is migrated from its own dataVersion (normalizeResume), not the store's.
  const resumes = list.map(normalizeResume);
  return {
    state: {
      ...saved,
      resumes,
      activeId: resumes.some(r => r.id === saved.activeId) ? saved.activeId : (resumes[0]?.id ?? null),
      ...savedDeletions(saved), // deletedIds, deletedInfo, syncedUid (a store saved before R8-0 has ids only)
      dataVersion: DATA_VERSION,
    },
    unreadable,
  };
}

export function useAppStore() {
  const [loaded] = useState(readStore);
  const [appState, setAppState] = useState(loaded.state);
  // null when the last write reached localStorage; otherwise the error (usually QuotaExceededError).
  const [persistError, setPersistError] = useState(null);
  // Set when the saved store could not be read in full; the dashboard shows it until dismissed.
  const [recovery, setRecovery] = useState(() => pendingRecovery(STORAGE_KEY));

  function dismissRecovery() {
    rememberRecovery(STORAGE_KEY, null);
    setRecovery(null);
  }

  // Before the save below replaces the stored value, what could not be read is copied, and the
  // notice kept until dismissed: the repaired store is saved over at once, so a reload would lose
  // it. An effect, so a render writes nothing (VM4-9); StrictMode runs this one twice as well,
  // and a second copy of the same value is the first one's key (backupRaw).
  useEffect(() => {
    if (loaded.unreadable === null) return;
    setRecovery(rememberRecovery(STORAGE_KEY, { backupKey: backupRaw(STORAGE_KEY, loaded.unreadable) }));
  }, [loaded]);

  useEffect(() => {
    try {
      // When storage is full, old backups make room before the change is refused (R4-8).
      setItemWithRoom(STORAGE_KEY, JSON.stringify({ ...appState, dataVersion: DATA_VERSION }));
      setPersistError(null);
    } catch (e) {
      setPersistError(e);
    }
  }, [appState]);

  const activeResume = appState.resumes.find(r => r.id === appState.activeId) || appState.resumes[0];

  function setActiveId(id) {
    setAppState(prev => ({ ...prev, activeId: id }));
  }

  function patchActive(updater) {
    setAppState(prev => ({
      ...prev,
      resumes: prev.resumes.map(r =>
        r.id === prev.activeId ? { ...updater(r), updatedAt: Date.now() } : r
      ),
    }));
  }

  // ── Resume management ──────────────────────────────────────────────

  function createResume(name = 'Untitled Resume') {
    const id = newId('resume');
    const newResume = createBlankResume({ id, name });
    setAppState(prev => ({ ...prev, resumes: [...prev.resumes, newResume], activeId: id }));
    return id;
  }

  /**
   * A résumé from a file, as a new one. `keep`: marked as the account's original (useDemoSeed) —
   * never because the file says so. Made current against the file's own `updatedAt` — which build
   * last saved it (normalizeResume) — before it is stamped as new here.
   */
  function importResume(data, { keep = false } = {}) {
    const id = newId('resume');
    const imported = withKeep(normalizeResume({ ...JSON.parse(JSON.stringify(data)), id }), keep, Date.now());
    setAppState(prev => ({ ...prev, resumes: [...prev.resumes, imported], activeId: id }));
    return id;
  }

  function duplicateResume(id) {
    const source = appState.resumes.find(r => r.id === id);
    if (!source) return;
    const copyId = newId('resume');
    // A copy is a new résumé: it does not come back with the originals unless marked itself.
    const copy = withKeep({ ...JSON.parse(JSON.stringify(source)), id: copyId, name: `${source.name} (Copy)` }, false, Date.now());
    setAppState(prev => ({ ...prev, resumes: [...prev.resumes, copy], activeId: copyId }));
    return copyId;
  }

  /** "Keep as my original" (`keep` true) or "Stop keeping": a demo account's originals come back. */
  function keepResume(id, keep) {
    setAppState(prev => ({
      ...prev,
      resumes: prev.resumes.map(r => (r.id === id && isOriginal(r) !== keep ? withKeep(r, keep, Date.now()) : r)),
    }));
  }

  function renameResume(id, name) {
    setAppState(prev => ({
      ...prev,
      resumes: prev.resumes.map(r => r.id === id ? { ...r, name, updatedAt: Date.now() } : r),
    }));
  }

  // ── Personal Info & Settings ───────────────────────────────────────

  function updatePersonal(field, value) {
    patchActive(r => ({ ...r, personal: { ...r.personal, [field]: value } }));
  }

  function toggleFieldVisibility(field) {
    patchActive(r => {
      const hidden = r.personal.hiddenFields || [];
      return { ...r, personal: { ...r.personal, hiddenFields: hidden.includes(field) ? hidden.filter(f => f !== field) : [...hidden, field] } };
    });
  }

  function updateSetting(key, value) {
    patchActive(r => ({ ...r, settings: { ...r.settings, [key]: value } }));
  }

  /** Design → Reset: the ATS-safe defaults with the current template's heading style (M16). */
  function resetSettings() {
    patchActive(r => ({ ...r, settings: defaultSettings(r.template) }));
  }

  function setTemplate(template) {
    patchActive(r => ({ ...r, template, settings: { ...r.settings, ...templateStyleDefaults(template) } }));
  }

  function updateCoverLetter(field, value) {
    patchActive(r => ({ ...r, coverLetter: { ...r.coverLetter, [field]: value } }));
  }

  const sectionActions = createSectionActions(patchActive);
  // Delete, restore, a first sync's result, sent deletions forgotten — the sync tests run these too.
  const syncActions = createSyncActions(setAppState);

  return {
    appState,
    persistError,
    recovery,
    dismissRecovery,
    activeResume,
    setActiveId,
    createResume,
    duplicateResume,
    renameResume,
    keepResume,
    importResume,
    updatePersonal,
    toggleFieldVisibility,
    updateSetting,
    setTemplate,
    updateCoverLetter,
    resetSettings,
    ...syncActions,
    ...sectionActions,
  };
}
