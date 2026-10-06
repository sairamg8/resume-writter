import { useNavigate } from 'react-router-dom';
import { EditorSaveStatus } from '@/components/EditorSaveStatus';
import { LayoutToggle } from '@/components/LayoutToggle';
import { PdfPreview } from '@/components/PdfPreview';
import { FontFallbackNotice } from '@/components/FontFallbackNotice';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';
import { buildCoverLetterPdf, buildResumePdf } from '@/utils/pdfBuild';

// Module-level so their identity is stable: PdfPreview re-renders when `render` changes. Built in the
// PDF worker, as Export PDF is (pdfBuild.js).
const renderResumePreview = (resume) => buildResumePdf(resume);
const renderCoverLetterPreview = (resume) => buildCoverLetterPdf(resume, { preview: true });

/** The save status: EditorSaveStatus, which owns the 30 s tick (the name stays exported here). The bar shows it now, not the preview's footer. */
export const SaveStatus = EditorSaveStatus;

/** One zoom step from `z`, 25 % at a time, kept between 50 % and 150 % (rounded: 0.25 steps are exact, but never trust a float). */
const stepZoom = (z, dir) => Math.min(1.5, Math.max(0.5, Math.round((z + dir * 0.25) * 100) / 100));

/** The two legal links, to their pages through `onOpen` (the stage footer: Terms and Privacy stay one press away). */
function LegalFooter({ onOpen }) {
  return (
    <div data-testid="stage-footer" className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-cv-faint shrink-0">
      <button data-testid="legal-terms" onClick={() => onOpen('/terms')} className="hover:text-cv-ink transition-colors">Terms</button>
      <button data-testid="legal-privacy" onClick={() => onOpen('/privacy')} className="hover:text-cv-ink transition-colors">Privacy</button>
    </div>
  );
}

/**
 * The preview column: the stage toolbar (zoom, the paper, the layout toggle), the PDF itself (résumé or cover
 * letter, whichever tab is open) and a footer with the legal links, on the stage's own ground. Hidden, never unmounted, in
 * editor-only mode (and on a phone's Edit tab, which Editor.jsx passes as 'editor'); hidden, its PDF is not built
 * until it is shown (R2-016). The toolbar keeps to the top as the pages scroll under it. The legal links go through
 * `onLegal(path)` when the page gives one, else through the router.
 */
export function EditorPreviewPane({ resume, activeTab, layoutMode, setLayoutMode, previewZoom, setPreviewZoom, isMobile = false, onLegal }) {
  const navigate = useNavigate();
  const shown = layoutMode !== 'editor';

  // The room under the footer clears a phone's Edit | Preview pill, which shows up to md (768px),
  // not sm: from 640 to 767 the footer sat under it. Top and bottom apart: a sm:py-8 would
  // outrank pb-24 there and bring the short bottom back (R4-DPH-31).
  return (
    <div
      className={`${shown ? 'flex-1 min-w-0 min-h-0 h-full' : 'hidden'} overflow-auto bg-cv-stage flex flex-col items-center pt-4 sm:pt-8 px-2 sm:px-4 pb-24 md:pb-8`}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div data-testid="stage-toolbar" className="sticky top-0 z-10 -mt-4 sm:-mt-8 pt-4 sm:pt-8 mb-3 sm:mb-4 self-stretch -mx-2 sm:-mx-4 px-2 sm:px-4 bg-cv-stage flex flex-wrap items-center justify-between gap-x-3 gap-y-2 shrink-0">
        <div className="inline-flex items-center h-8 px-1 rounded-cv-control bg-cv-surface border border-cv-hairline text-[13px] font-semibold text-cv-muted">
          <button data-testid="zoom-out" onClick={() => setPreviewZoom(z => stepZoom(z, -1))} disabled={previewZoom <= 0.5} className="w-6 text-base leading-none hover:text-cv-ink disabled:opacity-30">−</button>
          <span data-testid="zoom-level" className="min-w-11 text-center text-cv-ink select-none">{Math.round(previewZoom * 100)}%</span>
          <button data-testid="zoom-in" onClick={() => setPreviewZoom(z => stepZoom(z, 1))} disabled={previewZoom >= 1.5} className="w-6 text-base leading-none hover:text-cv-ink disabled:opacity-30">+</button>
        </div>
        <span data-testid="stage-paper" className="text-xs font-medium text-cv-muted">
          {activeTab === 'coverletter' ? 'Cover Letter' : 'Résumé'} · {PAGE_SIZES[pageSizeOf(resume?.settings)].label}
        </span>
        {!isMobile && <LayoutToggle layoutMode={layoutMode} setLayoutMode={setLayoutMode} />}
      </div>

      <FontFallbackNotice />

      {activeTab === 'coverletter' ? (
        <PdfPreview key="coverletter" title="Cover letter" textId="cover-letter-preview" input={resume} render={renderCoverLetterPreview} zoom={previewZoom} active={shown} />
      ) : (
        <PdfPreview key="resume" title="Résumé" textId="resume-preview" input={resume} render={renderResumePreview} zoom={previewZoom} active={shown} />
      )}

      <LegalFooter onOpen={onLegal ?? navigate} />
    </div>
  );
}
