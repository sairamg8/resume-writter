import { useState, useEffect, useRef } from 'react';
import { createBlankResume, settingsAfterReset } from '@/utils/defaultData';
import { buildResumeFromStarter } from '@/utils/starterTemplates';
import { createSectionActions } from '@/hooks/useResumeSectionActions';
import { createSyncActions } from '@/hooks/useResumeSyncActions';
import { createDesignActions } from '@/hooks/useResumeDesignActions';
import { keepPageImagesOf } from '@/utils/pageImageStore';
import { newId } from '@/utils/ids';
import { HEADER_READS, withHeaderColorsBack } from '@/templates/pdf/shared/headerColors';
import { withLook, withTemplate } from '@/utils/templateSwitch';
import { DATA_VERSION, normalizeResume } from '@/utils/normalizeResume';
import { backupRaw, notSavedReason, pendingRecovery, readSavedList, rememberRecovery, setItemWithRoom } from '@/utils/storageBackup';
import { savedDeletions } from '@/utils/localDeletions';
import { isOriginal, withKeep } from '@/utils/demoSeed';
import { isLetter, letterFrom, LETTER_KIND, LETTER_NAME } from '@/utils/letters';
import { resumeFrom } from '@/utils/newResume';
import { useSmallerPhotos } from '@/hooks/useSmallerPhotos';
import { keepUnsaved } from '@/utils/unsavedJobs';
import { coalescedWriter } from '@/utils/coalescedWrite';

const STORAGE_KEY = 'cpwtcv_v1';
// A save is the whole store — every résumé, photos as base64 — stringified and written on the main
// thread. A change after a quiet spell is written at once; the keystrokes that follow are written
// together, this long after the last (and at least every SAVE_MAX_WAIT_MS while typing goes on).
const SAVE_WAIT_MS = 300;
const SAVE_MAX_WAIT_MS = 2000;

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

/**
 * `incoming` (another tab's save, read from its JSON) with each résumé that reads the same as the
 * one storage last held here (`known`) replaced by that very object (R2-142): every résumé came back
 * a new copy, so the one open here — unchanged there — was built into a new preview, and the
 * dashboard's thumbnails redrawn, at every save of the other tab. `known` is what this tab's
 * unchanged résumés are (keepUnsaved), so they stay as they are; a changed one reads differently.
 */
function sameAsKnown(incoming, known) {
  const byId = new Map(known.map((r) => [r.id, r]));
  return incoming.map((r) => {
    const k = byId.get(r.id);
    return k && k.updatedAt === r.updatedAt && JSON.stringify(k) === JSON.stringify(r) ? k : r;
  });
}

export function useAppStore() {
  const [loaded] = useState(readStore);
  const [appState, setAppState] = useState(loaded.state);
  // null when the last write reached localStorage; otherwise the error (usually QuotaExceededError).
  const [persistError, setPersistError] = useState(null);
  // What the editor's save status reads: a change held until its coalesced write (`saving`), and
  // when the last write reached storage (`savedAt`) — not when the résumé last changed.
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
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
  // The account the list belongs to (syncedUid) as this tab last saved or took it.
  const owner = useRef(loaded.state.syncedUid);

  // Saves are coalesced (R2-077): every keystroke used to stringify and write the whole store.
  // Until a held save is written, storage has not seen its changes, so another tab's save keeps
  // them (stored stays the list last written).
  const [saver] = useState(() => coalescedWriter((state) => {
    try {
      // When storage is full, old backups make room before the change is refused (R4-8).
      setItemWithRoom(STORAGE_KEY, JSON.stringify({ ...state, dataVersion: DATA_VERSION }));
      stored.current = state.resumes;
      // The dashboard's page pictures of résumés this browser no longer holds go with them (C1).
      keepPageImagesOf(state.resumes);
      setPersistError(null);
      setSavedAt(Date.now());
    } catch (e) {
      setPersistError(e);
    }
    setSaving(false);
  }, { wait: SAVE_WAIT_MS, maxWait: SAVE_MAX_WAIT_MS }));

  useEffect(() => {
    const other = taken.current;
    taken.current = null;
    // The list changing hands — above all its account signing out, which takes it off this browser
    // (R2-005) — is written at once, not held with the typing just before it: until then storage
    // still held that account's résumés, for a browser closed with no pagehide (killed, crashed) to
    // show whoever opened it next (R2-142).
    const handedOver = appState.syncedUid !== owner.current;
    owner.current = appState.syncedUid;
    // Only another tab's save was taken: not written back, or two tabs would answer each other's
    // saves for ever (each keeps its own open résumé, so their stores never read the same). A save
    // of this tab's still held (the open résumé, say) is written as the state is now.
    if (other && appState.resumes === other.resumes && appState.deletedIds === other.deletedIds) {
      stored.current = appState.resumes;
      if (saver.pending()) saver.schedule(appState);
      setSaving(saver.pending());
      return;
    }
    saver.schedule(appState);
    if (handedOver) saver.flush();
    setSaving(saver.pending());
  }, [appState, saver]);

  // Nothing typed is lost: leaving or hiding the page, or the store going away, writes what is
  // held at once.
  useEffect(() => {
    const flush = () => saver.flush();
    const onVisibility = () => { if (document.hidden || document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [saver]);

  // Another tab saved the store: take its save (withOtherTabsSave). A value that cannot be read in
  // full is not taken over this tab's — its own load backs such a value up (readStore).
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      const { state: incoming, unreadable } = readStore();
      if (unreadable !== null) return;
      taken.current = incoming;
      // Storage holds the other tab's save from now on, whether or not a save of this tab's is held
      // (R2-077): a second save of the other tab before that one is written is weighed against this
      // one, not against this tab's last write — which counted every résumé taken from the first as
      // changed here and undid the second. The held save is not written until the state it would
      // write has taken this one in (the effect above schedules it again).
      // Leaving the page before that render (pagehide) writes the held save with this one taken in
      // too, not as it was: that would put back what the other tab just changed.
      const knew = stored.current;
      incoming.resumes = sameAsKnown(incoming.resumes, knew);
      stored.current = incoming.resumes;
      saver.hold((held) => withOtherTabsSave(held, incoming, knew));
      setAppState((prev) => withOtherTabsSave(prev, incoming, knew));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [saver]);

  // A photo an older build stored at camera size is made what an upload of it is now, once (ONB-10).
  useSmallerPhotos(appState.resumes, setAppState);

  const activeResume = appState.resumes.find(r => r.id === appState.activeId) || appState.resumes[0];

  function setActiveId(id) {
    setAppState(prev => (prev.activeId === id ? prev : { ...prev, activeId: id }));
  }

  /** The active résumé as `updater` returns it, stamped as an edit — unless it returns the same résumé: nothing changed. */
  function patchActive(updater) {
    setAppState(prev => {
      let changed = false;
      const resumes = prev.resumes.map(r => {
        if (r.id !== prev.activeId) return r;
        const next = updater(r);
        if (next === r) return r;
        changed = true;
        return { ...next, updatedAt: Date.now() };
      });
      // Nothing changed: the same store, so nothing is written, built or synced (R2-142).
      return changed ? { ...prev, resumes } : prev;
    });
  }

  // ── Resume management ──────────────────────────────────────────────

  /**
   * A new résumé: blank, or from the role starter `starterId`. `look`: a card of the picker's
   * (utils/templatePicker.js) picked beside the starters (D1) — the résumé starts on that template or
   * design instead of the starter's own, as picking it in Design would put it there. `fromId`: a look
   * picked on /new (R3-011) — the résumé is a copy of the user's own résumé `fromId` (resumeFrom) on that
   * look; one that is gone, or a letter, gives a blank résumé as before.
   */
  function createResume(name = 'Untitled Resume', starterId = null, look = null, fromId = null) {
    const id = newId('resume');
    const now = Date.now();
    setAppState(prev => {
      const source = !starterId && fromId ? prev.resumes.find(r => r.id === fromId && !isLetter(r)) : null;
      const built = starterId
        ? buildResumeFromStarter(starterId, id)
        : source ? resumeFrom(source, { id, now, name }) : createBlankResume({ id, name });
      const newResume = look?.engine ? withLook(built, look) : built;
      return { ...prev, resumes: [...prev.resumes, newResume], activeId: id };
    });
    return id;
  }

  /**
   * Dashboard → New Cover Letter: a letter of its own, which the dashboard lists with the letters
   * (R2-135). From the résumé `fromId`: its name, job title, contacts, photo and look, with nothing
   * yet said to the reader (letterFrom). With none — or one that is gone, or a letter — a blank
   * letter, as New Cover Letter made before.
   */
  function createLetter(fromId = null) {
    const id = newId('resume');
    const now = Date.now();
    setAppState(prev => {
      const source = prev.resumes.find(r => r.id === fromId && !isLetter(r));
      const letter = source ? letterFrom(source, { id, now }) : { ...createBlankResume({ id, name: LETTER_NAME }), kind: LETTER_KIND };
      return { ...prev, resumes: [...prev.resumes, letter], activeId: id };
    });
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

  /** The same name is not an edit: no new updatedAt, no save, nothing to sync (R2-084). */
  function renameResume(id, name) {
    setAppState(prev => (prev.resumes.some(r => r.id === id && r.name !== name)
      ? { ...prev, resumes: prev.resumes.map(r => r.id === id ? { ...r, name, updatedAt: Date.now() } : r) }
      : prev));
  }

  // ── Personal Info & Settings ───────────────────────────────────────
  // A field or setting set to the value it holds already (an option clicked again, a colour picker
  // or a number box handing back what it shows) is not an edit: no new updatedAt, no store write, no
  // preview build, nothing to sync (R2-142) — as the same name is no rename (R2-084).

  function updatePersonal(field, value) {
    patchActive(r => (r.personal?.[field] === value ? r : { ...r, personal: { ...r.personal, [field]: value } }));
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
      if (r.settings?.[key] === value) return r;
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
      if (!keys.some(k => k in (r.settings || {}))) return r;
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
   * title colour picked for the old header that does not read on the new one back to its own (NB-1);
   * a section's Grids its template's own where the section kept the one it was created with (Compact's
   * grid, T9 — sectionsOnSwitch). The template it is on already is no switch: picking it again
   * would put back the heading style and title case the user changed since (R2-087). `preset`: a
   * design over `template` (R2-138, templatePresets.js), which brings its whole look (withTemplate).
   */
  function setTemplate(template, preset = '') {
    patchActive(r => withTemplate(r, template, preset));
  }

  function updateCoverLetter(field, value) {
    patchActive(r => (r.coverLetter?.[field] === value ? r : { ...r, coverLetter: { ...r.coverLetter, [field]: value } }));
  }

  const sectionActions = createSectionActions(patchActive);
  // Delete, restore, a first sync's result, sent deletions forgotten — the sync tests run these too.
  const syncActions = createSyncActions(setAppState);
  const designActions = createDesignActions(patchActive, setAppState);

  return {
    appState,
    persistError,
    persistReason: notSavedReason(persistError),
    saving,
    savedAt,
    recovery,
    dismissRecovery,
    activeResume,
    setActiveId,
    createResume,
    createLetter,
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
    ...designActions,
  };
}
