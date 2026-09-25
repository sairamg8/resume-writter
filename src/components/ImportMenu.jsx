import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Pin, Upload } from 'lucide-react';
import { DOCUMENT_HINT } from '@/utils/importDocument';

/** What "Import as my original" means — under it here and in the editor's Export menu. */
export const ORIGINALS_HINT = 'Your originals come back whenever none of them is left.';

/**
 * The dashboard's Import in a demo account: a plain import, or one kept as the account's original
 * — it comes back whenever none of the originals is left (useDemoSeed). `onPick(keep)` then opens
 * the file picker. Other accounts get the plain Import button.
 */
export function ImportMenu({ onPick, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const escape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const pick = (keep) => { setOpen(false); onPick(keep); };
  const item = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left';

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className={className}>
        <Upload size={15} /> Import <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
          <button onClick={() => pick(false)} className={item}>
            <Upload size={14} className="text-gray-400" aria-hidden="true" /> Import JSON, PDF, Word or text
          </button>
          <button onClick={() => pick(true)} className={item}>
            <Pin size={14} className="text-amber-700" aria-hidden="true" /> Import as my original
          </button>
          <p className="px-3 pt-1 pb-2 text-[11px] text-gray-500">{ORIGINALS_HINT}</p>
          <p className="px-3 pb-2 text-[11px] text-gray-500">{DOCUMENT_HINT}</p>
        </div>
      )}
    </div>
  );
}
