import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { timeAgo } from '@/utils/resume';
import { LayoutToggle } from '@/components/LayoutToggle';
import { PdfPreview } from '@/components/PdfPreview';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';

// Module-level so their identity is stable: PdfPreview re-renders when `render` changes.
const renderResumePreview = (resume) =>
  import('@/utils/pdfExportReactPDF').then((m) => m.renderResumePdf(resume));
const renderCoverLetterPreview = (resume) =>
  import('@/utils/pdfExportReactPDF').then((m) => m.renderCoverLetterPdf(resume, { preview: true }));

/** "Saved 2 min ago" under the preview; it owns the 30 s tick that keeps that time current. */
function SaveStatus({ resume, persistError }) {
  const [lastSaved, setLastSaved] = useState(null);
  const [, refreshTick] = useState(0);

  useEffect(() => { if (resume) setLastSaved(Date.now()); }, [resume]);
  useEffect(() => {
    const id = setInterval(() => refreshTick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return persistError ? (
    <span className="text-red-600 font-medium">Not saved</span>
  ) : (
    <span>{lastSaved ? `Saved ${timeAgo(lastSaved)}` : 'Auto-saved to your browser'}</span>
  );
}

/**
 * The preview column: layout toggle, zoom, the PDF itself (résumé or cover letter, whichever tab
 * is open) and the save status. Hidden, never unmounted, in editor-only mode (and on a phone's Edit
 * tab, which Editor.jsx passes as 'editor'); hidden, its PDF is not built until it is shown (R2-016).
 */
export function EditorPreviewPane({ resume, activeTab, layoutMode, setLayoutMode, previewZoom, setPreviewZoom, persistError, isMobile = false }) {
  const navigate = useNavigate();
  const shown = layoutMode !== 'editor';

  return (
    <div
      className={`${shown ? 'flex-1 min-w-0 min-h-0 h-full' : 'hidden'} overflow-auto bg-[#f5f3ef] flex flex-col items-center py-4 sm:py-8 px-2 sm:px-4 pb-24 sm:pb-8`}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 shrink-0">
        {!isMobile && (
          <>
            <LayoutToggle layoutMode={layoutMode} setLayoutMode={setLayoutMode} />
            <span className="text-xs text-gray-300">·</span>
          </>
        )}
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
          {activeTab === 'coverletter' ? 'Cover Letter' : 'Résumé'} · {PAGE_SIZES[pageSizeOf(resume?.settings)].label}
        </span>
        <span className="text-xs text-gray-300">·</span>
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))} disabled={previewZoom <= 0.5} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 rounded-md font-bold leading-none">−</button>
          <span className="text-xs text-gray-600 font-medium w-9 text-center select-none">{Math.round(previewZoom * 100)}%</span>
          <button onClick={() => setPreviewZoom(z => Math.min(1.5, Math.round((z + 0.25) * 100) / 100))} disabled={previewZoom >= 1.5} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 rounded-md font-bold leading-none">+</button>
        </div>
      </div>

      {activeTab === 'coverletter' ? (
        <PdfPreview key="coverletter" title="Cover letter" textId="cover-letter-preview" input={resume} render={renderCoverLetterPreview} zoom={previewZoom} active={shown} />
      ) : (
        <PdfPreview key="resume" title="Résumé" textId="resume-preview" input={resume} render={renderResumePreview} zoom={previewZoom} active={shown} />
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-gray-400 shrink-0">
        <SaveStatus resume={resume} persistError={persistError} />
        <span>·</span>
        <button onClick={() => navigate('/terms')} className="hover:text-gray-600 transition-colors">Terms</button>
        <button onClick={() => navigate('/privacy')} className="hover:text-gray-600 transition-colors">Privacy</button>
      </div>
    </div>
  );
}
