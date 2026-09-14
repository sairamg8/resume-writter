import { useState, useEffect } from 'react';
import { ATS_DEFAULTS, createBlankResume } from '@/utils/defaultData';
import { createSectionActions } from '@/hooks/useResumeSectionActions';

const STORAGE_KEY = 'cpwtcv_v1';
const DATA_VERSION = 6;

/** First run: no résumés. The dashboard shows its "Create your first resume" state. */
function emptyStore() {
  return { resumes: [], activeId: null, dataVersion: DATA_VERSION, deletedIds: [] };
}

/** Copy a value we are about to replace into its own key, so a bad load never destroys data. */
function backupRaw(raw) {
  try { localStorage.setItem(`${STORAGE_KEY}_backup_${Date.now()}`, raw); } catch { /* best effort */ }
}

function loadStore() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { return emptyStore(); }
  if (!saved) return emptyStore();
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed?.resumes)) {
      backupRaw(saved);
      return emptyStore();
    }
    const resumes = parsed.resumes.filter(r => r && r.id);
    // Any data version is kept: user resumes must survive an app upgrade (or downgrade).
    // Version-specific migrations go here, keyed on parsed.dataVersion.
    return {
      ...parsed,
      resumes,
      activeId: resumes.some(r => r.id === parsed.activeId) ? parsed.activeId : (resumes[0]?.id ?? null),
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
      dataVersion: DATA_VERSION,
    };
  } catch {
    backupRaw(saved);
    return emptyStore();
  }
}

const TEMPLATE_STYLE_DEFAULTS = {
  executive: { headingStyle: 'underline', sectionTitleCase: 'normal' },
  classic:   { headingStyle: 'ruled',     sectionTitleCase: 'upper' },
  modern:    { headingStyle: 'line',      sectionTitleCase: 'upper' },
  minimal:   { headingStyle: 'underline', sectionTitleCase: 'upper' },
  sidebar:   { headingStyle: 'plain',     sectionTitleCase: 'upper' },
};

export function useAppStore() {
  const [appState, setAppState] = useState(loadStore);
  // null when the last write reached localStorage; otherwise the error (usually QuotaExceededError).
  const [persistError, setPersistError] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...appState, dataVersion: DATA_VERSION }));
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

  function loadResumes(resumes) {
    setAppState(prev => ({
      ...prev,
      resumes,
      activeId: resumes.find(r => r.id === prev.activeId) ? prev.activeId : (resumes[0]?.id || prev.activeId),
      deletedIds: [],
    }));
  }

  // ── Resume management ──────────────────────────────────────────────

  function createResume(name = 'Untitled Resume') {
    const id = `resume_${Date.now()}`;
    const newResume = createBlankResume({ id, name });
    setAppState(prev => ({ ...prev, resumes: [...prev.resumes, newResume], activeId: id }));
    return id;
  }

  function importResume(data) {
    const id = `resume_${Date.now()}`;
    const imported = { ...JSON.parse(JSON.stringify(data)), id, updatedAt: Date.now() };
    setAppState(prev => ({ ...prev, resumes: [...prev.resumes, imported], activeId: id }));
    return id;
  }

  /** Put résumés back (replacing any with the same id) and forget that they were deleted. */
  function restoreResumes(list) {
    const ids = new Set(list.map(r => r.id));
    setAppState(prev => {
      const resumes = [...prev.resumes.filter(r => !ids.has(r.id)), ...list];
      return {
        ...prev,
        resumes,
        activeId: resumes.some(r => r.id === prev.activeId) ? prev.activeId : (resumes[0]?.id ?? null),
        deletedIds: (prev.deletedIds || []).filter(id => !ids.has(id)),
      };
    });
  }

  function duplicateResume(id) {
    const source = appState.resumes.find(r => r.id === id);
    if (!source) return;
    const newId = `resume_${Date.now()}`;
    const copy = { ...JSON.parse(JSON.stringify(source)), id: newId, name: `${source.name} (Copy)`, updatedAt: Date.now() };
    setAppState(prev => ({ ...prev, resumes: [...prev.resumes, copy], activeId: newId }));
    return newId;
  }

  function deleteResume(id) {
    setAppState(prev => {
      const remaining = prev.resumes.filter(r => r.id !== id);
      const deletedIds = [...(prev.deletedIds || []), id];
      const activeId = prev.activeId === id ? (remaining[0]?.id ?? null) : prev.activeId;
      return { ...prev, resumes: remaining, activeId, deletedIds };
    });
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
    patchActive(r => ({ ...r, settings: { ...(r.settings || {}), [key]: value } }));
  }

  function resetSettings() {
    patchActive(r => ({ ...r, settings: { ...ATS_DEFAULTS } }));
  }

  function setTemplate(template) {
    const styleDefaults = TEMPLATE_STYLE_DEFAULTS[template] || {};
    patchActive(r => ({ ...r, template, settings: { ...r.settings, ...styleDefaults } }));
  }

  function updateCoverLetter(field, value) {
    patchActive(r => ({ ...r, coverLetter: { ...(r.coverLetter || {}), [field]: value } }));
  }

  const sectionActions = createSectionActions(patchActive);

  return {
    appState,
    persistError,
    activeResume,
    setActiveId,
    loadResumes,
    createResume,
    duplicateResume,
    deleteResume,
    renameResume,
    importResume,
    restoreResumes,
    updatePersonal,
    toggleFieldVisibility,
    updateSetting,
    setTemplate,
    updateCoverLetter,
    resetSettings,
    ...sectionActions,
  };
}
