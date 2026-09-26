// The store's actions on a résumé's look beyond one setting: undoing a template switch (A4), a card of
// the picker's with a Layout of its own, and the designs the user saves (B4). `patchActive` edits the
// open résumé (useResumeStore); `setAppState` the whole store, for a design deleted from every résumé.
import { newId } from '../utils/ids.js';
import { withDesignSnapshot, withLook } from '../utils/templateSwitch.js';
import { designLook, ownDesign, withOwnDesign, withoutOwnDesign } from '../constants/templatePresets.js';
import { templateId } from '../constants/templates.js';

export function createDesignActions(patchActive, setAppState) {
  /** Design → Template's Undo: the look `snap` (designSnapshot) was taken of, back. */
  function restoreDesign(snap) {
    if (snap) patchActive((r) => withDesignSnapshot(r, snap));
  }

  /**
   * A design the user saved, picked (B4): it joins the résumé's own designs and the résumé takes its
   * look, as picking one of the app's designs does (withTemplate).
   */
  function applyDesign(design) {
    if (design?.id) patchActive((r) => withLook(r, { engine: design.engine, preset: design.id, design }));
  }

  /**
   * Design → Save my design (B4): the open résumé's look (designLook) kept under `label`, on its template,
   * and the résumé on it from now on — Reset returns to it. Returns the design's id. `replaceId`: the
   * saved design of the same name (R4-DUX-30) — saving overwrites it, under its id, on every résumé that
   * holds it, instead of adding a second card nobody can tell apart. Each résumé changed goes a version on,
   * so the sync carries the new look everywhere and no copy of the old one is left listed.
   */
  function saveDesign(label, replaceId = null) {
    const name = String(label || '').trim();
    if (!name) return null;
    const id = typeof replaceId === 'string' && replaceId ? replaceId : newId('design');
    if (id !== replaceId) {
      patchActive((r) => {
        const design = { label: name, engine: templateId(r.template), settings: designLook(r.settings) };
        return { ...r, settings: { ...withOwnDesign(r.settings, id, design), templatePreset: id } };
      });
      return id;
    }
    setAppState((prev) => {
      const active = prev.resumes.find((r) => r.id === prev.activeId);
      if (!active) return prev;
      const design = { label: name, engine: templateId(active.template), settings: designLook(active.settings) };
      const now = Date.now();
      const resumes = prev.resumes.map((r) => {
        if (r.id === prev.activeId) return { ...r, settings: { ...withOwnDesign(r.settings, id, design), templatePreset: id }, updatedAt: now };
        return ownDesign(r.settings, id) ? { ...r, settings: withOwnDesign(r.settings, id, design), updatedAt: now } : r;
      });
      return { ...prev, resumes };
    });
    return id;
  }

  /**
   * A saved design deleted (B4): from every résumé that holds it, so it leaves the picker. A résumé on it
   * keeps its look, now its own settings — nothing it prints changes. It leaves { deleted: true } in its
   * place, which syncs with the résumés, so every device drops it (R3-008).
   */
  function deleteDesign(id) {
    setAppState((prev) => {
      let changed = false;
      const resumes = prev.resumes.map((r) => {
        const settings = withoutOwnDesign(r.settings, id);
        if (settings === r.settings) return r;
        changed = true;
        return { ...r, settings, updatedAt: Date.now() };
      });
      return changed ? { ...prev, resumes } : prev;
    });
  }

  return { restoreDesign, applyDesign, saveDesign, deleteDesign };
}
