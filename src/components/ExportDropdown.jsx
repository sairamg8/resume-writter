import { useRef, useState, useEffect } from 'react';
import { Download, FileText, Upload, ChevronDown, Pin, FileCode, FileJson } from 'lucide-react';
import { ORIGINALS_HINT } from '@/components/ImportMenu';
import { isJsonResume, jsonResumeToCpwtResume } from '@/utils/jsonResume';

/**
 * The editor's Export menu, with Import JSON: `onImportJSON(data, asOriginal)`. `keeps` — a demo
 * account, whose originals come back (useDemoSeed) — adds "Import as my original", as the
 * dashboard's Import menu has (V2OWNER-DATA-3). `letter`: the Cover Letter tab is open, where PDF
 * and Word export the letter and the text exports still the résumé — each item says which (R2-131).
 */
export function ExportDropdown({ exporting, keeps = false, letter = false, onExportPDF, onExportWord, onExportJSON, onExportMarkdown, onExportAtsText, onExportJsonResume, onImportJSON, onImportError }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const importRef = useRef(null);
  // Whether the file being picked is imported as the account's original.
  const asOriginal = useRef(false);
  const pickImport = (keep) => { asOriginal.current = keep; importRef.current?.click(); setOpen(false); };

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
        onClick={() => setOpen(o => !o)}
        disabled={!!exporting}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-60 ${
          open ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Download size={12} />
        {exporting ? '...' : 'Export'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1 ${letter ? 'w-72' : 'w-52'} bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1`}>
          <button
            onClick={() => { onExportPDF(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            <Download size={12} className="text-blue-500" /> {letter ? 'Export Cover Letter PDF' : 'Export PDF'}
          </button>
          <button
            onClick={() => { onExportWord(); setOpen(false); }}
            disabled={!!exporting}
            // The .docx is text, for ATS: say what the PDF has that it leaves out — the letter keeps its band (R2-133).
            title="A text document for ATS: no photo, and the résumé prints without its banner or coloured column"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
          >
            <FileText size={12} className="text-emerald-500" /> {letter ? 'Export Cover Letter Word' : 'Export Word'}
          </button>
          <button
            onClick={() => { onExportMarkdown?.(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
          >
            <FileCode size={12} className="text-amber-600" /> {letter ? 'Export Résumé as Markdown (.md)' : 'Export Markdown (.md)'}
          </button>
          <button
            onClick={() => { onExportAtsText?.(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-50"
          >
            <FileText size={12} className="text-purple-500" /> {letter ? 'Export Résumé as ATS Text (.txt)' : 'Export ATS Text (.txt)'}
          </button>
          <button
            onClick={() => { onExportJsonResume?.(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-800 disabled:opacity-50"
          >
            <FileJson size={12} className="text-cyan-600" /> {letter ? 'Export Résumé as JSON Resume (.json)' : 'Export JSON Resume (.json)'}
          </button>
          <button
            onClick={() => { onExportJSON(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={12} className="text-gray-400" /> Export Backup JSON
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => pickImport(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Upload size={12} className="text-gray-400" /> Import JSON
          </button>
          {keeps && (
            <>
              <button onClick={() => pickImport(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                <Pin size={12} className="text-amber-700" aria-hidden="true" /> Import as my original
              </button>
              <p className="px-3 pt-1 pb-2 text-[11px] text-gray-500">{ORIGINALS_HINT}</p>
            </>
          )}
        </div>
      )}

      <input
        ref={importRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
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
