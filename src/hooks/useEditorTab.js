import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const EDITOR_TABS = ['resume', 'design', 'coverletter', 'ats'];

/**
 * The editor's open tab, kept in the address as ?tab= (the dashboard's "Cover letter" links to
 * ?tab=coverletter). A value that is not a tab is the Résumé tab — it used to open a blank panel —
 * and picking a tab replaces ?tab= so a reload reopens it; the Résumé tab needs none (R2-076).
 * `setTab` takes a tab or a function of the open one, as a state setter does.
 */
export function useEditorTab() {
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab = EDITOR_TABS.includes(asked) ? asked : 'resume';

  function setTab(next) {
    const value = typeof next === 'function' ? next(tab) : next;
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      if (value === 'resume' || !EDITOR_TABS.includes(value)) out.delete('tab');
      else out.set('tab', value);
      return out;
    }, { replace: true });
  }

  // An unknown ?tab= leaves the address too, so a reload or a copied link does not carry it on.
  useEffect(() => {
    if (asked !== null && asked !== tab) setTab('resume');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  return [tab, setTab];
}
