import { useState, useEffect } from 'react';
import {
  defaultResumeData,
  defaultResumeDataModern,
  defaultResumeDataMinimal,
  defaultResumeDataDark,
  defaultResumeDataSidebar,
  defaultResumeDataExecutive,
  ATS_DEFAULTS,
} from '@/utils/defaultData';
import { createSectionActions } from '@/hooks/useResumeSectionActions';

const STORAGE_KEY = 'cpwtcv_v1';
const DATA_VERSION = 6;

const TEMPLATE_DEFAULTS = [
  defaultResumeData, defaultResumeDataExecutive, defaultResumeDataModern,
  defaultResumeDataMinimal, defaultResumeDataDark, defaultResumeDataSidebar,
];

function seedResumes() {
  const now = Date.now();
  const resumes = TEMPLATE_DEFAULTS.map((d, i) => ({
    ...JSON.parse(JSON.stringify(d)),
    id: `resume_${now + i}`,
    updatedAt: now,
  }));
  return { resumes, activeId: resumes[0].id, dataVersion: DATA_VERSION, deletedIds: [] };
}

function loadStore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.resumes && parsed.activeId && parsed.dataVersion === DATA_VERSION) return parsed;
    }
  } catch { }
  return seedResumes();
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...appState, dataVersion: DATA_VERSION }));
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
    const newResume = { ...JSON.parse(JSON.stringify(defaultResumeData)), id, name, updatedAt: Date.now(), settings: { ...ATS_DEFAULTS } };
    setAppState(prev => ({ resumes: [...prev.resumes, newResume], activeId: id }));
    return id;
  }

  function importResume(data) {
    const id = `resume_${Date.now()}`;
    const imported = { ...JSON.parse(JSON.stringify(data)), id, updatedAt: Date.now() };
    setAppState(prev => ({ resumes: [...prev.resumes, imported], activeId: id }));
    return id;
  }

  function duplicateResume(id) {
    const source = appState.resumes.find(r => r.id === id);
    if (!source) return;
    const newId = `resume_${Date.now()}`;
    const copy = { ...JSON.parse(JSON.stringify(source)), id: newId, name: `${source.name} (Copy)`, updatedAt: Date.now() };
    setAppState(prev => ({ resumes: [...prev.resumes, copy], activeId: newId }));
    return newId;
  }

  function deleteResume(id) {
    setAppState(prev => {
      const remaining = prev.resumes.filter(r => r.id !== id);
      const deletedIds = [...(prev.deletedIds || []), id];
      if (!remaining.length) {
        const newResume = { ...JSON.parse(JSON.stringify(defaultResumeData)), id: `resume_${Date.now()}`, updatedAt: Date.now() };
        return { ...prev, resumes: [newResume], activeId: newResume.id, deletedIds };
      }
      return { ...prev, resumes: remaining, activeId: prev.activeId === id ? remaining[0].id : prev.activeId, deletedIds };
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
    activeResume,
    setActiveId,
    loadResumes,
    createResume,
    duplicateResume,
    deleteResume,
    renameResume,
    importResume,
    updatePersonal,
    toggleFieldVisibility,
    updateSetting,
    setTemplate,
    updateCoverLetter,
    resetSettings,
    ...sectionActions,
  };
}
