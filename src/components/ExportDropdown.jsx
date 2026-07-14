import { useRef, useState, useEffect } from 'react';
import { Download, FileText, Upload, ChevronDown } from 'lucide-react';

export function ExportDropdown({ exporting, onExportPDF, onExportPDFLegacy, onExportWord, onExportJSON, onImportJSON }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const importRef = useRef(null);

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
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
          <button
            onClick={() => { onExportPDF(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            <Download size={12} className="text-blue-500" /> Export PDF
          </button>
          <button
            onClick={() => { onExportPDFLegacy(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
          >
            <Download size={12} className="text-gray-400" /> Export PDF (Legacy)
          </button>
          <button
            onClick={() => { onExportWord(); setOpen(false); }}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
          >
            <FileText size={12} className="text-emerald-500" /> Export Word
          </button>
          <button
            onClick={() => { onExportJSON(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Download size={12} className="text-gray-400" /> Export JSON
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => { importRef.current?.click(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Upload size={12} className="text-gray-400" /> Import JSON
          </button>
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
            try {
              const parsed = JSON.parse(ev.target.result);
              if (parsed.personal && Array.isArray(parsed.sections)) onImportJSON(parsed);
            } catch {}
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
