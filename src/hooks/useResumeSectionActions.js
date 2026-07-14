import { SECTION_TYPE_DEFAULTS } from '@/utils/defaultData';

export function createSectionActions(patchActive) {
  function updateSections(sections) {
    patchActive(r => ({ ...r, sections }));
  }

  function updateSection(sectionId, updater) {
    patchActive(r => ({
      ...r,
      sections: r.sections.map(s => s.id === sectionId ? updater(s) : s),
    }));
  }

  function updateSectionSettings(sectionId, key, value) {
    updateSection(sectionId, s => ({
      ...s,
      settings: { ...(s.settings || {}), [key]: value },
    }));
  }

  function addSection(type) {
    const id = `${type}_${Date.now()}`;
    const factory = SECTION_TYPE_DEFAULTS[type] || SECTION_TYPE_DEFAULTS.custom;
    patchActive(r => ({ ...r, sections: [...r.sections, factory(id)] }));
  }

  function removeSection(sectionId) {
    patchActive(r => ({ ...r, sections: r.sections.filter(s => s.id !== sectionId) }));
  }

  function toggleSectionVisibility(sectionId) {
    updateSection(sectionId, s => ({ ...s, visible: s.visible === false ? true : false }));
  }

  function addItem(sectionId, item) {
    updateSection(sectionId, s => ({ ...s, items: [...s.items, item] }));
  }

  function updateItem(sectionId, itemId, updater) {
    updateSection(sectionId, s => ({
      ...s,
      items: s.items.map(i => i.id === itemId ? updater(i) : i),
    }));
  }

  function removeItem(sectionId, itemId) {
    updateSection(sectionId, s => ({
      ...s,
      items: s.items.filter(i => i.id !== itemId),
    }));
  }

  function reorderItems(sectionId, oldIndex, newIndex) {
    updateSection(sectionId, s => {
      const items = [...s.items];
      const [removed] = items.splice(oldIndex, 1);
      items.splice(newIndex, 0, removed);
      return { ...s, items };
    });
  }

  return {
    updateSections, updateSection, updateSectionSettings,
    addSection, removeSection, toggleSectionVisibility,
    addItem, updateItem, removeItem, reorderItems,
  };
}
