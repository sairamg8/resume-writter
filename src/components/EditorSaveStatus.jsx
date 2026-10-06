import { memo, useState, useEffect } from 'react';
import { timeAgo } from '@/utils/resume';

/**
 * The save chip: "Saving…" while a write is held, "Saved 2m ago" once storage holds one (it owns the 30 s
 * tick that keeps that time current), "Auto-saved to your browser" before the first write, and the red
 * "Not saved" when a write failed. It reads the store's writes, not the résumé's changes: a keystroke's
 * write is held a moment (R2-077), and "Saved" before storage held it was not true.
 * A memo leaf of three primitives (`persistError`: whether a write failed; `saving`; `savedAt`, a time),
 * given by the Editor as an element of its own, never through EditorHeader (PERF-4): a keystroke changes
 * `saving` and then `savedAt`, so it renders twice per burst, and nothing else of the page does for it.
 * No router hook, for the same reason.
 */
export const EditorSaveStatus = memo(function EditorSaveStatus({ persistError = false, saving = false, savedAt = null }) {
  const [, refreshTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => refreshTick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (persistError) return <span data-testid="save-status" data-save="error" className="text-cv-bad font-medium">Not saved</span>;
  if (saving) return <span data-testid="save-status" data-save="saving">Saving…</span>;
  return <span data-testid="save-status" data-save="saved">{savedAt ? `Saved ${timeAgo(savedAt)}` : 'Auto-saved to your browser'}</span>;
});
