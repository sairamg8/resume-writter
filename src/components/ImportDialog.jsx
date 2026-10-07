import { Pin, TriangleAlert, Upload } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { DOCUMENT_HINT } from '@/utils/importDocument';
import { ORIGINALS_HINT } from '@/constants/cardHints';

const TYPES = ['PDF', 'Word', 'Markdown', 'Text', 'JSON backup', 'JSON Resume'];

/**
 * Dashboard → Import: what can be imported and what to check afterwards, and the choice of file. The file input
 * itself stays in the Dashboard (the entry), so picking a file works as before: `onPick(keep)` opens the native
 * picker (`keep`: the file is imported as the account's original, a demo account only) and the dialog closes.
 * `busy`: a document is being read, so the choices are disabled until it is done (R4-IMP-12). Loaded apart from
 * the start-up path (lazyPiece.jsx); its failing to load makes Import open the picker straight away.
 */
export default function ImportDialog({ isOpen, onClose, onPick, keeps = false, busy = false }) {
  const pick = (keep) => { if (isOpen && !busy) { onPick(keep); onClose(); } };
  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={onClose}
      size="md"
      title="Import a file"
      description="Choose a résumé file from your device."
      footer={<Button variant="secondary" onClick={onClose}>Cancel</Button>}
    >
      <div className="space-y-5">
        <div className="flex flex-col items-start gap-2">
          <Button variant="primary" data-autofocus="" disabled={busy} onClick={() => pick(false)}>
            <Upload size={15} aria-hidden="true" /> {busy ? 'Reading…' : 'Choose a file'}
          </Button>
          {keeps && (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => pick(true)}>
                <Pin size={14} aria-hidden="true" /> Import as my original
              </Button>
              <p className="text-xs text-cv-muted">{ORIGINALS_HINT}</p>
            </>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cv-muted">What you can import</p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {TYPES.map((t) => <li key={t} className="cv-chip text-xs font-semibold px-2.5 py-1">{t}</li>)}
          </ul>
        </div>
        <p className="cv-notice-warn flex gap-2.5 px-3.5 py-3 text-[13px] leading-relaxed">
          <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{DOCUMENT_HINT} Check the name, contacts, sections and dates afterwards.</span>
        </p>
      </div>
    </Dialog>
  );
}
