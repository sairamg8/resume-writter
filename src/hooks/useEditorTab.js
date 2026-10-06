import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/** The documents the editor shows (?tab=) and the docks that open beside it (?dock=). */
export const EDITOR_DOCS = ['resume', 'coverletter'];
export const EDITOR_DOCKS = ['design', 'ats'];

/**
 * What an address says: `doc`, the open document ('resume' or 'coverletter') and `dock`, the open dock (null,
 * 'design' or 'ats'). The links written before the docks — ?tab=design, ?tab=ats — name a dock, and the
 * dock is the résumé's, so a dock (?dock= before ?tab=) always means the Résumé document.
 */
export function readEditorView(params) {
  const tab = params.get('tab');
  const asked = params.get('dock');
  let dock = null;
  if (EDITOR_DOCKS.includes(asked)) dock = asked;
  else if (EDITOR_DOCKS.includes(tab)) dock = tab;
  return { doc: !dock && tab === 'coverletter' ? 'coverletter' : 'resume', dock };
}

/** `params` with the view written as the address keeps it: ?tab=coverletter, ?dock=design|ats, or neither. */
function withView(params, { doc, dock }) {
  const out = new URLSearchParams(params);
  out.delete('tab');
  out.delete('dock');
  if (dock) out.set('dock', dock);
  else if (doc === 'coverletter') out.set('tab', 'coverletter');
  return out;
}

/** An address that says it another way than the canonical one: a value that is neither, an old ?tab=design, both a letter and a dock. */
function needsRewrite(params) {
  const tab = params.get('tab');
  const dock = params.get('dock');
  if (tab !== null && !EDITOR_DOCS.includes(tab)) return true;
  if (dock !== null && !EDITOR_DOCKS.includes(dock)) return true;
  return tab === 'coverletter' && dock !== null;
}

/**
 * The editor's open document and open dock, kept in the address (the dashboard's "Cover letter" links to
 * ?tab=coverletter): `doc` is ?tab=resume|coverletter and `dock` ?dock=design|ats, or none. A value that is
 * not one of them is dropped, as an unknown tab always was — it used to open a blank panel — and so is the
 * old ?tab=design|ats, which opens the dock and is rewritten to ?dock=; picking replaces the address, so a
 * reload reopens it; the Résumé with no dock needs none (R2-076).
 * `setDoc(doc)`: picking the Cover letter closes an open dock (the two are exclusive), the Résumé leaves it.
 * `setDock(dock)` takes a dock, null, or a function of the open one, as a state setter does: opening one
 * from the letter switches to the Résumé (a dock is the résumé's, EDIT-171) and closing it leaves the
 * document. Each picked view keeps the address's state, as useUrlState does: an import's notice
 * (useImportNotice) lives there until its Dismiss, and the first pick took it away (R5-HUNT2). Each reads
 * the address it is called on, so two picks of two renders never write over one another.
 */
export function useEditorTab() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { doc, dock } = readEditorView(params);

  function update(change) {
    setParams((prev) => withView(prev, change(readEditorView(prev))), { replace: true, state: location.state });
  }

  function setDoc(next) {
    update(({ dock: open }) => (next === 'coverletter' ? { doc: 'coverletter', dock: null } : { doc: 'resume', dock: open }));
  }

  function setDock(next) {
    update(({ doc: open, dock: was }) => {
      const value = typeof next === 'function' ? next(was) : next;
      return EDITOR_DOCKS.includes(value) ? { doc: 'resume', dock: value } : { doc: open, dock: null };
    });
  }

  // An address that is not canonical leaves too, so a reload or a copied link does not carry it on.
  const search = params.toString();
  useEffect(() => {
    if (needsRewrite(params)) update((view) => view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return { doc, dock, setDoc, setDock };
}
