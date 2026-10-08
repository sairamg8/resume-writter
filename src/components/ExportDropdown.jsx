import { useRef, useState, useEffect } from 'react';
import { Download, FileText, Upload, ChevronDown, Pin, FileCode, FileJson, Globe } from 'lucide-react';
import { ORIGINALS_HINT } from '@/constants/cardHints';
import { isJsonResume, jsonResumeToCpwtResume } from '@/utils/jsonResume';
import { DOCUMENT_HINT, IMPORT_ACCEPT, isDocumentFile } from '@/utils/importDocument';
import { useFloating } from '@/components/ui/useFloating';

/**
 * The editor's Export menu, with "Import as a new résumé" (R4-DUX-17) of JSON: `onImportJSON(data, asOriginal)`, and a PDF, Word,
 * Markdown or text résumé read best-effort: `onImportFile(file, asOriginal)` (R2-148). `keeps` — a demo
 * account, whose originals come back (useDemoSeed) — adds "Import as my original", as the
 * dashboard's Import menu has (V2OWNER-DATA-3). `letter`: the Cover Letter tab is open, where PDF
 * and Word export the letter, Cover Letter Text the letter as plain text (`onExportLetterText`), and
 * the other text exports still the résumé — each item says which (R2-131). `onShare`: Share a public
 * link (R2-148), given only to a signed-in account on a site with a cloud. `importing`: a document is
 * being read, so the menu says "Reading…" and stays shut until it is done (R4-IMP-12).
 */
export function ExportDropdown({ exporting, importing = false, keeps = false, letter = false, onExportPDF, onExportWord, onExportJSON, onExportMarkdown, onExportAtsText, onExportJsonResume, onExportLetterText, onImportJSON, onImportFile, onImportError, onShare }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const importRef = useRef(null);
  // Whether the file being picked is imported as the account's original.
  const asOriginal = useRef(false);
  const pickImport = (keep) => { asOriginal.current = keep; importRef.current?.click(); setOpen(false); };
  // The kit places the menu (useFloating): a fixed panel under the button's right edge, slid back
  // inside the window and capped to its height. Hung `absolute right-0` off the button, the Cover
  // Letter tab's 288 px menu ran ~66 px off the left edge of a signed-in 360 px split panel, whose
  // overflow-hidden cut it as well (R4-DVIS-22). It stays here rather than in a Portal, so Tab still
  // goes from Export into its items; no ancestor has a transform, which would pin `fixed` to it.
  const { style: menuStyle } = useFloating(open, buttonRef, menuRef, { placement: 'bottom-end', offset: 4 });

  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        disabled={!!exporting || importing}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-cv-control border transition-colors disabled:opacity-60 ${
          open ? 'bg-cv-sunken border-cv-field text-cv-ink' : 'bg-cv-surface border-cv-hairline text-cv-ink hover:bg-cv-ground'
        }`}
      >
        <Download size={12} />
        {exporting ? '...' : importing ? 'Reading…' : 'Export'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div ref={menuRef} style={menuStyle} className={`${letter ? 'w-72' : 'w-52'} overflow-y-auto bg-cv-surface border border-cv-hairline rounded-cv-control shadow-lg z-20 py-1`}>
          <button
            onClick={() => { onExportPDF(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-brand-soft hover:text-cv-brand-pressed disabled:opacity-50"
          >
            <Download size={12} className="text-cv-brand-text" /> {letter ? 'Export Cover Letter PDF' : 'Export PDF'}
          </button>
          <button
            onClick={() => { onExportWord(); setOpen(false); }}
            disabled={!!exporting}
            // Say what the .docx leaves out that the PDF has (R2-133). The résumé prints its photo (R2-126) and
            // Modern's and the Sidebar's header on their band (R2-137), and the designed layouts' section-title
            // marks (wordExportBuilders.js headingFrame, R2-138 B2: Broadsheet's overline, Gridline's frame,
            // Registry's dotted and Chronicle's double underline, Keystone's edge bar). Their header marks
            // (Registry's, Keel's and Keystone's bars, the rules of Bookend, Chronicle, Broadsheet, Lectern, Linen
            // and Gridline, Bookend's foot rule) and the Timeline's rail are not drawn (R5-OUT-02). The letter
            // prints its letterhead, photo included (R4-DOUT-06), and its text as the PDF does.
            title={letter
              ? 'An editable document: the letter with the letterhead, photo and text of its PDF'
              : "An editable document: Banner's and Banded's headers and the Sidebar's side column print on the white page; the designed layouts' section-title rules print, but their header bars and rules and the Timeline's rail are left out"}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-good-soft hover:text-cv-good disabled:opacity-50"
          >
            <FileText size={12} className="text-cv-good" /> {letter ? 'Export Cover Letter Word' : 'Export Word'}
          </button>
          {letter && (
            <button
              onClick={() => { onExportLetterText?.(); setOpen(false); }}
              disabled={!!exporting}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-brand-soft hover:text-cv-brand-pressed disabled:opacity-50"
            >
              <FileText size={12} className="text-cv-brand-text" /> Export Cover Letter Text (.txt)
            </button>
          )}
          <button
            onClick={() => { onExportMarkdown?.(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-warn-soft hover:text-cv-warn disabled:opacity-50"
          >
            <FileCode size={12} className="text-cv-warn" /> {letter ? 'Export Résumé as Markdown (.md)' : 'Export Markdown (.md)'}
          </button>
          <button
            onClick={() => { onExportAtsText?.(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-brand-soft hover:text-cv-brand-pressed disabled:opacity-50"
          >
            <FileText size={12} className="text-cv-brand-text" /> {letter ? 'Export Résumé as ATS Text (.txt)' : 'Export ATS Text (.txt)'}
          </button>
          <button
            onClick={() => { onExportJsonResume?.(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cyan-50 hover:text-cyan-800 disabled:opacity-50"
          >
            <FileJson size={12} className="text-cyan-600" /> {letter ? 'Export Résumé as JSON Resume (.json)' : 'Export JSON Resume (.json)'}
          </button>
          <button
            onClick={() => { onExportJSON(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-ground disabled:opacity-50"
          >
            <Download size={12} className="text-cv-faint" /> Export Backup JSON
          </button>
          {onShare && (
            <button
              onClick={() => { onShare(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-brand-soft hover:text-cv-brand-pressed"
            >
              <Globe size={12} className="text-cv-brand-text" /> Share a public link…
            </button>
          )}
          <div className="my-1 border-t border-cv-hairline" />
          <button
            onClick={() => pickImport(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-ground"
          >
            <Upload size={12} className="text-cv-faint" /> Import as a new résumé (JSON, PDF, Word or text)
          </button>
          <p className="px-3 pb-1 text-[11px] text-cv-muted">{DOCUMENT_HINT}</p>
          {keeps && (
            <>
              <button onClick={() => pickImport(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cv-ink hover:bg-cv-ground">
                <Pin size={12} className="text-cv-warn" aria-hidden="true" /> Import as my original
              </button>
              <p className="px-3 pt-1 pb-2 text-[11px] text-cv-muted">{ORIGINALS_HINT}</p>
            </>
          )}
        </div>
      )}

      <input
        ref={importRef}
        type="file"
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (isDocumentFile(file) && onImportFile) {
            e.target.value = '';
            onImportFile(file, asOriginal.current);
            return;
          }
          const reader = new FileReader();
          reader.onload = ev => {
            let parsed;
            try { parsed = JSON.parse(ev.target.result); } catch {
              onImportError?.("Could not parse file. Make sure it's a valid CPWT-CV or standard JSON Resume (.json).");
              return;
            }
            try {
              if (parsed?.personal && Array.isArray(parsed.sections)) {
                onImportJSON(parsed, asOriginal.current);
              } else if (isJsonResume(parsed)) {
                onImportJSON(jsonResumeToCpwtResume(parsed), asOriginal.current);
              } else {
                onImportError?.('Invalid resume file — must be a CPWT-CV backup or standard JSON Resume (.json).');
              }
            } catch (err) {
              console.error('Import failed:', err);
              onImportError?.(`Could not import file${err?.message ? `: ${err.message}` : ''}.`);
            }
          };
          // A file the browser will not hand over — a permission error, a removed drive, a folder
          // dropped in — never reaches onload, and without this the whole import said nothing (AUD-23).
          reader.onerror = () => {
            onImportError?.('That file could not be read. Check it is still there and try again.');
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
