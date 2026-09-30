import { useState } from 'react';

/**
 * A rename box over `resume`'s name (a dashboard card, the editor's header). The draft is primed
 * from the name the résumé has when the box opens, never the one it mounted with: another tab's
 * rename reaches this one through the store, and a stale draft wrote the old name back over it
 * when the box was left (R2-071, R2-084). `onRename(name)` gets the trimmed name, and only when it
 * changes: an empty one keeps the name, and the same name is not an edit — neither the name the box
 * opened on (renamed elsewhere while it was open, the box left untouched keeps that rename) nor the
 * name the résumé has now. The box belongs to the résumé it was opened on: when another résumé takes
 * its place under a mounted box (the editor stays mounted across /resume/:id — an import that lands,
 * Back/Forward), the box closes and its draft is dropped, never saved as the other résumé's name
 * (R5-HUNT11-RENAME-BOX-RENAMES-IMPORTED-RESUME).
 */
export function useRename(resume, onRename) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [openedOn, setOpenedOn] = useState('');
  const [openedId, setOpenedId] = useState(null);
  const id = resume?.id ?? null;
  const own = id === openedId;
  // Another résumé under an open box: close it as this render runs (React's reset-on-prop pattern).
  if (editing && !own) setEditing(false);

  function start() {
    setDraft(resume.name || '');
    setOpenedOn((resume.name || '').trim());
    setOpenedId(id);
    setEditing(true);
  }

  function commit() {
    if (!editing) return; // Enter's commit, then the blur of the box it unmounts
    setEditing(false);
    if (!own) return; // opened on another résumé: its draft is not this one's name
    const name = draft.trim();
    if (name && name !== openedOn && name !== resume.name) onRename(name);
  }

  function cancel() {
    setEditing(false);
  }

  return { editing: editing && own, draft, setDraft, start, commit, cancel };
}
