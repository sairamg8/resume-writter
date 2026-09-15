import { useState, useEffect } from 'react';
import { createBlankResume, defaultSettings } from '@/utils/defaultData';
import { createSectionActions } from '@/hooks/useResumeSectionActions';
import { createSyncActions } from '@/hooks/useResumeSyncActions';
import { newId } from '@/utils/ids';
import { templateStyleDefaults } from '@/constants/templates';
import { DATA_VERSION, normalizeResume } from '@/utils/normalizeResume';
import { loadSavedList, pendingRecovery, rememberRecovery, setItemWithRoom } from '@/utils/storageBackup';
import { savedDeletions } from '@/utils/localDeletions';
import { isOriginal, withKeep } from '@/utils/demoSeed';

const STORAGE_KEY = 'cpwtcv_v1';

/** First run: no résumés. The dashboard shows its "Create your first resume" state. */
function emptyStore() {
  return { resumes: [], activeId: null, dataVersion: DATA_VERSION, deletedIds: [], deletedInfo: {}, syncedUid: null };
}

const isResume = (r) => Boolean(r && typeof r === 'object' && !Array.isArray(r) && r.id);

/**
 * The saved store, as `{ state, recovery }`. Whatever cannot be read — the whole value or single
 * résumés — is left out, after the raw value is copied to a backup key, and `recovery` says so
 * (loadSavedList, shared with the job list). A résumé without an id used to be dropped with no
 * copy and no word, and the next save replaced it (R4-6).
 */
function loadStore() {
  const { saved, list, recovery: found } = loadSavedList(STORAGE_KEY, 'resumes', r => (isResume(r) ? r : null));
  // Kept until dismissed: the repaired store is saved over at once, so a reload would lose it.
  const recovery = found ? rememberRecovery(STORAGE_KEY, found) : null;
  if (!saved) return { state: emptyStore(), recovery };
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
    recovery,
  };
}

export function useAppStore() {
  const [loaded] = useState(loadStore);
  const [appState, setAppState] = useState(loaded.state);
  // null when the last write reached localStorage; otherwise the error (usually QuotaExceededError).
  const [persistError, setPersistError] = useState(null);
  // Set when the saved store could not be read in full; the dashboard shows it until dismissed.
  const [recovery, setRecovery] = useState(() => loaded.recovery || pendingRecovery(STORAGE_KEY));

  function dismissRecovery() {
    rememberRecovery(STORAGE_KEY, null);
    setRecovery(null);
  }

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
