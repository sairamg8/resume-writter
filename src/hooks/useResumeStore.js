import { useState, useEffect, useRef } from 'react';
import { createBlankResume, settingsAfterReset, styleOnSwitch } from '@/utils/defaultData';
import { buildResumeFromStarter } from '@/utils/starterTemplates';
import { createSectionActions } from '@/hooks/useResumeSectionActions';
import { createSyncActions } from '@/hooks/useResumeSyncActions';
import { newId } from '@/utils/ids';
import { HEADER_READS, headerColorsOnSwitch, withHeaderColorsBack } from '@/templates/pdf/shared/headerColors';
import { DATA_VERSION, normalizeResume } from '@/utils/normalizeResume';
import { backupRaw, notSavedReason, pendingRecovery, readSavedList, rememberRecovery, setItemWithRoom } from '@/utils/storageBackup';
import { savedDeletions } from '@/utils/localDeletions';
import { isOriginal, withKeep } from '@/utils/demoSeed';
import { useSmallerPhotos } from '@/hooks/useSmallerPhotos';
import { keepUnsaved } from '@/utils/unsavedJobs';

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

/**
 * This tab's state once another tab has saved `incoming` (readStore of the value it wrote): its
 * résumés, but for what this tab changed that storage has not seen (keepUnsaved against `stored`,
 * the list this tab last knew storage to hold — as the job and board stores do); its deletions, and
 * any made here that it does not list yet; the résumé open here stays open here. Each tab saved its
 * whole list on every change and never read the other's: a résumé created in one tab was erased by
 * the next edit in the other, and an edit made there undone (bug audit 2026-09-22). Pure: React may
 * run it twice. The same arrays as `incoming` where nothing of this tab's is kept.
 */
function withOtherTabsSave(prev, incoming, stored) {
  const resumes = keepUnsaved(incoming.resumes, prev.resumes, stored);
  const ids = new Set(resumes.map((r) => r.id));
  const mine = (prev.deletedIds || []).filter((id) => !incoming.deletedIds.includes(id));
  const listed = mine.length ? [...incoming.deletedIds, ...mine] : incoming.deletedIds;
  const deletedIds = listed.some((id) => ids.has(id)) ? listed.filter((id) => !ids.has(id)) : listed;
  const deletedInfo = mine.length
    ? { ...incoming.deletedInfo, ...Object.fromEntries(mine.filter((id) => prev.deletedInfo?.[id]).map((id) => [id, prev.deletedInfo[id]])) }
    : incoming.deletedInfo;
  const activeId = ids.has(prev.activeId) ? prev.activeId : (ids.has(incoming.activeId) ? incoming.activeId : resumes[0]?.id ?? null);
  return { ...incoming, resumes, deletedIds, deletedInfo, activeId };
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

  // The résumés this tab last knew storage to hold (loaded, saved, or taken from another tab), and
  // another tab's save just taken — storage holds it already.
  const stored = useRef(loaded.state.resumes);
  const taken = useRef(null);

  useEffect(() => {
    const other = taken.current;
    taken.current = null;
    // Only another tab's save was taken: not written back, or two tabs would answer each other's
    // saves for ever (each keeps its own open résumé, so their stores never read the same).
    if (other && appState.resumes === other.resumes && appState.deletedIds === other.deletedIds) {
      stored.current = appState.resumes;
      return;
    }
    try {
      // When storage is full, old backups make room before the change is refused (R4-8).
      setItemWithRoom(STORAGE_KEY, JSON.stringify({ ...appState, dataVersion: DATA_VERSION }));
      stored.current = appState.resumes;
      setPersistError(null);
    } catch (e) {
      setPersistError(e);
    }
  }, [appState]);

  // Another tab saved the store: take its save (withOtherTabsSave). A value that cannot be read in
  // full is not taken over this tab's — its own load backs such a value up (readStore).
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      const { state: incoming, unreadable } = readStore();
      if (unreadable !== null) return;
      taken.current = incoming;
      setAppState((prev) => withOtherTabsSave(prev, incoming, stored.current));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // A photo an older build stored at camera size is made what an upload of it is now, once (ONB-10).
  useSmallerPhotos(appState.resumes, setAppState);

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

  function createResume(name = 'Untitled Resume', starterId = null) {
    const id = newId('resume');
    const newResume = starterId
      ? buildResumeFromStarter(starterId, id)
      : createBlankResume({ id, name });
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

  /**
   * One Design setting. Layout → "Single · ATS-safe" is the one key that moves the ground the header
   * prints on — the Sidebar's dark column becomes Classic's white page — so it re-checks the picked
   * Name and Job title colours exactly as a template switch does (TUI-1). Without it a white name
   * picked for the column printed white on the white page, at 1.0:1.
   */
  function updateSetting(key, value) {
    patchActive(r => {
      const settings = { ...r.settings, [key]: value };
      return {
        ...r,
        settings: key === 'sidebarSingleColumn'
          ? withHeaderColorsBack(settings, r.template, { below: HEADER_READS })
          : settings,
      };
    });
  }

  /**
   * Remove settings keys, so each prints as its template decides again (Personal Info → Header
   * spacing's resets). Deleted, never set to undefined: Firestore refuses an undefined field.
   */
  function clearSettings(keys) {
    patchActive(r => {
      const settings = { ...r.settings };
      for (const k of keys) delete settings[k];
      return { ...r, settings };
    });
  }

  /** Design → Reset: the ATS-safe defaults with the current template's heading style (M16); uploaded icons stay (R5-6). */
  function resetSettings() {
    patchActive(r => ({ ...r, settings: settingsAfterReset(r) }));
  }

  /**
   * Design → a template: the style it brings (styleOnSwitch: its heading style and title case, and
   * Academic's type and spacing — which leave with it where the user kept them), and a Name or Job
   * title colour picked for the old header that does not read on the new one back to its own (NB-1).
   */
  function setTemplate(template) {
    patchActive(r => ({
      ...r,
      template,
      settings: headerColorsOnSwitch(styleOnSwitch(r.settings, r.template, template), r.template, template),
    }));
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
    persistReason: notSavedReason(persistError),
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
    clearSettings,
    setTemplate,
    updateCoverLetter,
    resetSettings,
    ...syncActions,
    ...sectionActions,
  };
}
