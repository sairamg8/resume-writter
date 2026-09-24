import { useState } from 'react';

/**
 * A rename box over `resume`'s name (a dashboard card, the editor's header). The draft is primed
 * from the name the résumé has when the box opens, never the one it mounted with: another tab's
 * rename reaches this one through the store, and a stale draft wrote the old name back over it
 * when the box was left (R2-071, R2-084). `onRename(name)` gets the trimmed name, and only when it
 * changes: an empty one keeps the name, and the same name is not an edit.
 */
export function useRename(resume, onRename) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function start() {
    setDraft(resume.name || '');
    setEditing(true);
  }

  function commit() {
    if (!editing) return; // Enter's commit, then the blur of the box it unmounts
    setEditing(false);
    const name = draft.trim();
    if (name && name !== resume.name) onRename(name);
  }

  function cancel() {
    setEditing(false);
  }

  return { editing, draft, setDraft, start, commit, cancel };
}
