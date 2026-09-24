import { SECTION_TYPE_DEFAULTS } from '../utils/defaultDataSectionTypes.js';
import { newId } from '../utils/ids.js';
import { newSectionGrid } from '../templates/pdf/shared/templateSectionDefaults.js';

/** An entry's deep copy under a fresh id, with the prefix of the one it copies ('exp_…' → 'exp_…'). */
function copyOfItem(item) {
  const prefix = String(item.id || '').split('_')[0] || 'item';
  return { ...structuredClone(item), id: newId(prefix) };
}

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

  /**
   * One of a section's settings; `undefined` removes it (Section Options → Spacing Override's box
   * emptied, or its ↺), so the section prints as its template decides again. Removed, never stored
   * as undefined: Firestore refuses a document holding one, and the résumé stopped syncing.
   */
  function updateSectionSettings(sectionId, key, value) {
    updateSection(sectionId, s => {
      const settings = { ...s.settings };
      if (value === undefined) delete settings[key];
      else settings[key] = value;
      return { ...s, settings };
    });
  }

  /** A new section, laid out in its template's own Grids where it has one (Compact's grid, T9: newSectionGrid). */
  function addSection(type, initialItem) {
    const id = newId(type);
    const factory = SECTION_TYPE_DEFAULTS[type] || SECTION_TYPE_DEFAULTS.custom;
    const section = factory(id);
    if (initialItem) {
      section.items = [initialItem];
    }
    patchActive(r => ({ ...r, sections: [...r.sections, newSectionGrid(section, r.template)] }));
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

  /**
   * A copy of an entry right after it (R2-151): the same content, deep, under a fresh id of its own,
   * so editing or deleting the copy never reaches the original.
   */
  function duplicateItem(sectionId, itemId) {
    updateSection(sectionId, s => {
      const at = s.items.findIndex(i => i.id === itemId);
      if (at === -1) return s;
      const items = [...s.items];
      items.splice(at + 1, 0, copyOfItem(s.items[at]));
      return { ...s, items };
    });
  }

  /** A copy of a section right after it (R2-151): its settings and entries, every id fresh. */
  function duplicateSection(sectionId) {
    patchActive(r => {
      const at = r.sections.findIndex(s => s.id === sectionId);
      if (at === -1) return r;
      const source = r.sections[at];
      const copy = { ...structuredClone(source), id: newId(source.type), items: (source.items || []).map(copyOfItem) };
      const sections = [...r.sections];
      sections.splice(at + 1, 0, copy);
      return { ...r, sections };
    });
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
    duplicateItem, duplicateSection,
  };
}
