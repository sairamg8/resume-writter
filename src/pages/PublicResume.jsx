import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { PdfPreview } from '@/components/PdfPreview';
import { firebasePublicIo } from '@/components/ShareLinkModal';
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
  // { state: 'loading' | 'ready' | 'missing' | 'error' | 'off', resume }
  const [view, setView] = useState(() => ({ state: io ? 'loading' : 'off', resume: null }));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    if (!io) return undefined;
    let live = true;
    io.readPublic(shareId)
      .then((copy) => {
        if (!live) return;
        setView(copy ? { state: 'ready', resume: normalizeResume({ ...copy, id: `public_${shareId}`, name: copy.personal?.name || 'Résumé' }) } : { state: 'missing', resume: null });
      })
      .catch((e) => {
        console.error('Reading the public résumé failed:', e);
        if (live) setView({ state: 'error', resume: null });
      });
    return () => { live = false; };
  }, [io, shareId]);

  async function download() {
    setExporting(true);
    setExportError(null);
    try {
      const { exportResumePdf } = await import('@/utils/pdfBuild');
      await exportResumePdf(view.resume, `${buildExportFilename(view.resume)}.pdf`);
    } catch (e) {
      console.error('PDF download failed:', e);
      setExportError('The PDF could not be made. Check your connection and try again.');
    } finally {
      setExporting(false);
    }
  }

  const message = {
    loading: 'Loading the résumé…',
    missing: 'This résumé is not published: its owner took it down, or the link is wrong.',
    error: 'The résumé could not be loaded. Check your connection and try again.',
    off: 'Public links are not available on this site.',
  }[view.state];

  return (
    <div className="min-h-screen bg-[#f5f3ef] flex flex-col items-center py-6 px-2 sm:px-4">
      {view.state === 'ready' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
            <button onClick={download} disabled={exporting} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              <Download size={12} aria-hidden="true" /> {exporting ? 'Preparing PDF…' : 'Download PDF'}
            </button>
          </div>
          {exportError && <p role="alert" className="mb-3 text-xs text-red-700">{exportError}</p>}
          <PdfPreview title="Résumé" textId="resume-preview" input={view.resume} render={renderResumePreview} zoom={1} active />
        </>
      ) : (
        <p role={view.state === 'loading' ? 'status' : 'alert'} className="mt-24 text-sm text-gray-600 text-center max-w-md">{message}</p>
      )}
      <p className="mt-6 text-xs text-gray-400">A read-only résumé shared from <a href="#/" className="hover:text-gray-600 underline">CPWT-CV</a>.</p>
    </div>
  );
}
