import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { PdfPreview } from '@/components/PdfPreview';
import { firebasePublicIo } from '@/utils/firebasePublicIo';
import { normalizeResume } from '@/utils/normalizeResume';
import { buildExportFilename } from '@/utils/exportFilename';

// Module-level so its identity is stable: PdfPreview re-renders when `render` changes.
const renderResumePreview = (resume) =>
  import('@/utils/pdfBuild').then((m) => m.buildResumePdf(resume));

/**
 * `#/r/<shareId>` (R2-148): a résumé its owner published with Share a public link, read-only, as
 * its PDF prints — the editor's own preview — with its PDF to download. Anyone can open it, signed
 * in or not. `io` publicLink.js's calls (the tests pass a fake Firestore's); a site without a cloud
 * has no public links, and says so.
 */
export function PublicResume({ io = firebasePublicIo }) {
  const { shareId } = useParams();
  // { shareId, state: 'ready' | 'missing' | 'error', resume }: what the read of `shareId` found. The page
  // stays mounted when the tab moves to another link (an address-bar edit, Back/Forward), and it showed
  // the previous link's résumé, and saved its PDF, until the new read settled
  // (R5-HUNT7-PUBLIC-PAGE-STALE-ON-LINK-CHANGE). A read, a download under way and its error each belong
  // to the link they were for, and show only there.
  const [read, setRead] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);
  // { state: 'loading' | 'ready' | 'missing' | 'error' | 'off', resume }
  const view = !io ? { state: 'off', resume: null }
    : read?.shareId === shareId ? read : { state: 'loading', resume: null };

  useEffect(() => {
    if (!io) return undefined;
    let live = true;
    io.readPublic(shareId)
      .then((copy) => {
        if (!live) return;
        setRead(copy ? { shareId, state: 'ready', resume: normalizeResume({ ...copy, id: `public_${shareId}`, name: copy.personal?.name || 'Résumé' }) } : { shareId, state: 'missing', resume: null });
      })
      .catch((e) => {
        // An address Firestore refuses as a document id (a %2F in it, "..", one far too long) names no résumé: the
        // answer is the same as for a link never published, not "check your connection", which no retry mends.
        if (e?.code === 'invalid-argument') {
          if (live) setRead({ shareId, state: 'missing', resume: null });
          return;
        }
        console.error('Reading the public résumé failed:', e);
        if (live) setRead({ shareId, state: 'error', resume: null });
      });
    return () => { live = false; };
  }, [io, shareId]);

  async function download() {
    const id = shareId;
    const { resume } = view;
    setExporting(id);
    setExportError(null);
    try {
      const { exportResumePdf } = await import('@/utils/pdfBuild');
      await exportResumePdf(resume, `${buildExportFilename(resume)}.pdf`);
    } catch (e) {
      console.error('PDF download failed:', e);
      setExportError({ shareId: id, message: 'The PDF could not be made. Check your connection and try again.' });
    } finally {
      setExporting((was) => (was === id ? null : was));
    }
  }
  const busy = exporting === shareId;
  const failed = exportError?.shareId === shareId ? exportError.message : null;

  const message = {
    loading: 'Loading the résumé…',
    missing: 'This résumé is not published: its owner took it down, or the link is wrong.',
    error: 'The résumé could not be loaded. Check your connection and try again.',
    off: 'Public links are not available on this site.',
  }[view.state];

  return (
    <div className="min-h-screen bg-cv-ground flex flex-col items-center py-6 px-2 sm:px-4">
      {view.state === 'ready' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
            <button onClick={download} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-cv-control bg-cv-brand text-white hover:bg-cv-brand-pressed disabled:opacity-60">
              <Download size={12} aria-hidden="true" /> {busy ? 'Preparing PDF…' : 'Download PDF'}
            </button>
          </div>
          {failed && <p role="alert" className="mb-3 text-xs text-cv-bad">{failed}</p>}
          <PdfPreview title="Résumé" textId="resume-preview" input={view.resume} render={renderResumePreview} zoom={1} active />
        </>
      ) : (
        <p role={view.state === 'loading' ? 'status' : 'alert'} className="mt-24 text-sm text-cv-muted text-center max-w-md">{message}</p>
      )}
      <p className="mt-6 text-xs text-cv-faint">A read-only résumé shared from <a href="#/" className="hover:text-cv-muted underline">CPWT-CV</a>.</p>
    </div>
  );
}
