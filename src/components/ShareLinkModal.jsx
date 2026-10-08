import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { firebasePublicIo } from '@/utils/firebasePublicIo';
import { publicSummary, publicUrl, publishedIsCurrent, publicSnapshot, TOO_LARGE_CODE } from '@/utils/publicLink';
import { timeAgo } from '@/utils/resume';
import { copyText } from '@/utils/clipboard';

/** The real Firestore calls (utils/firebasePublicIo.js), re-exported for the modal's callers and tests. */
export { firebasePublicIo };

/**
 * Export → Share a public link (R2-148): publish a read-only copy of `resume` at a web address, put
 * its current state there, or take it down — and, before and after, exactly what anyone with the
 * link sees (publicSummary). `uid` the signed-in account; `io` publicLink.js's calls (the tests
 * pass a fake Firestore's). Escape, the close button or a click beside the box is `onClose()`.
 *
 * The kit's Dialog (R4-DVIS-07), as the editor's other dialogs are: in a portal at the end of <body>,
 * focus moved into it as it opens so Escape closes it at once, from wherever the Export menu left focus
 * (R5-DLG-02); capped at the screen that shows with its body scrolling (R4-DPH-37); a click beside the
 * box closes it only when the press both starts and ends there, so selecting the link and releasing
 * past the edge keeps it (R5-DLG-03).
 */
export default function ShareLinkModal({ isOpen, resume, uid, io = firebasePublicIo, onClose }) {
  // { state: 'loading' | 'ready' | 'error', share: { shareId, publishedAt, copy } | null }
  const [view, setView] = useState({ state: 'loading', share: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  // Unpublish asks first (R4-DUX-10): it breaks every link already sent, and publishing again
  // makes a new one, so one click beside Publish must not do it.
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const resumeId = resume?.id;
  // The résumé the panel shows now. The Editor stays mounted across /resume/:id (browser Back, an
  // import), so a Publish or Unpublish still running when another résumé opens must not paint its
  // result, or its error, into that résumé's panel: its Update or Unpublish would then act at the
  // first résumé's link (R5-HUNT4-SHARE-MODAL-PUBLISH-LANDS-ON-OTHER-RESUME).
  const shownId = useRef(resumeId);
  shownId.current = resumeId;

  useEffect(() => {
    if (!isOpen || !io || !uid || !resumeId) return undefined;
    let live = true;
    setView({ state: 'loading', share: null });
    setError(null);
    setCopied(null);
    setConfirmUnpublish(false);
    io.readShare(uid, resumeId)
      .then((share) => { if (live) setView({ state: 'ready', share }); })
      .catch((e) => {
        console.error('Reading the public link failed:', e);
        if (live) setView({ state: 'error', share: null });
      });
    return () => { live = false; };
  }, [isOpen, io, uid, resumeId]);

  if (!isOpen) return null;

  const { share } = view;
  const run = async (fn, label) => {
    const forId = resumeId;
    const still = () => shownId.current === forId;
    setBusy(true);
    setError(null);
    try {
      await fn(still);
    } catch (e) {
      console.error(`${label} failed:`, e);
      if (!still()) return;
      // A copy too large to publish says so and only so: the connection has nothing to do with it.
      setError(e?.code === TOO_LARGE_CODE ? e.message
        : `${label} failed${e?.message ? ` (${e.message})` : ''}. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  };
  const publish = () => run(async (still) => {
    const next = await io.publish(uid, resume, share ? { shareId: share.shareId } : undefined);
    if (!still()) return;
    // 'Copied' was about the link as it was: a new one has not been copied.
    if (next.shareId !== share?.shareId) setCopied(null);
    setView({ state: 'ready', share: next });
  }, 'Publishing');
  const unpublish = () => run(async (still) => {
    setConfirmUnpublish(false);
    await io.unpublish(uid, resumeId, share.shareId);
    if (!still()) return;
    setCopied(null);
    setView({ state: 'ready', share: null });
  }, 'Unpublishing');
  const url = share ? publicUrl(share.shareId) : '';
  // What is public now, or what publishing would make public. A copy published before blank entries
  // were left out still holds them: read through publicSnapshot, it counts what its page prints
  // (R5-HUNT12-SHARE-BLANK-ENTRY-CHANGED-SINCE).
  const shown = publicSummary(publicSnapshot(share ? share.copy : resume));
  const current = share ? publishedIsCurrent(share.copy, resume) : true;

  return (
    <Dialog open onClose={onClose} size="md" title="Share a public link">
      <div className="space-y-3 text-xs text-cv-ink">
        {view.state === 'loading' && <p>Checking whether this résumé is published…</p>}
        {view.state === 'error' && <p role="alert" className="text-cv-bad">Could not reach your account to check this résumé's link. Check your connection and try again.</p>}
        {view.state === 'ready' && (
          <>
            {share ? (
              <>
                <p>This résumé is published: anyone with this link can open a read-only copy and download it as a PDF.</p>
                <div className="flex items-center gap-1.5">
                  {/* 16 px on a touch screen: a tap focuses it (and selects the link), and iOS zooms the page
                      into any focused field under 16 px (R4-DPH-36). A mouse keeps 12 px. */}
                  <input readOnly value={url} aria-label="Public link" onFocus={e => e.target.select()} className="flex-1 min-w-0 px-2 py-1.5 text-xs pointer-coarse:text-base border border-cv-hairline rounded-cv-control bg-cv-ground text-cv-ink" />
                  <button onClick={() => copyText(url).then(() => setCopied('Copied'), () => setCopied('Copy failed'))} className="flex items-center gap-1 px-2 py-1.5 border border-cv-hairline rounded-cv-control hover:bg-cv-ground shrink-0">
                    <Copy size={12} aria-hidden="true" /> {copied || 'Copy'}
                  </button>
                  <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1.5 border border-cv-hairline rounded-cv-control hover:bg-cv-ground shrink-0">
                    <ExternalLink size={12} aria-hidden="true" /> Open
                  </a>
                </div>
                <p className="text-cv-muted">Published {timeAgo(share.publishedAt).toLowerCase()}.{current ? '' : ' You have changed the résumé since: the link still shows it as it was until you update it.'}</p>
              </>
            ) : (
              <p>Publish a read-only copy of this résumé at a web address anyone with the link can open, and download as a PDF. It stays public until you unpublish it.</p>
            )}
            <div>
              <p className="font-semibold text-cv-ink">{share ? 'What is public:' : 'What would be public:'}</p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {shown.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
              <p className="mt-1 text-cv-muted">Fields and sections you hid, the cover letter and this résumé's name in your list stay private.</p>
            </div>
            {error && <p role="alert" className="text-cv-bad">{error}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {(!share || !current) && (
                <button onClick={publish} disabled={busy} className="px-3 py-1.5 rounded-cv-control bg-cv-brand text-white font-semibold hover:bg-cv-brand disabled:opacity-60">
                  {share ? 'Update the public copy' : 'Publish'}
                </button>
              )}
              {share && !confirmUnpublish && (
                <button onClick={() => setConfirmUnpublish(true)} disabled={busy} className="px-3 py-1.5 rounded-cv-control border border-cv-bad text-cv-bad font-semibold hover:bg-cv-bad-soft disabled:opacity-60">
                  Unpublish
                </button>
              )}
            </div>
            {share && confirmUnpublish && (
              <div className="p-3 rounded-cv-card border border-cv-bad bg-cv-bad-soft space-y-2">
                <p className="text-cv-bad">Anyone with this link will no longer be able to open it. Publishing again later makes a new link, so the one you shared stays dead.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={unpublish} disabled={busy} className="px-3 py-1.5 rounded-cv-control bg-cv-bad text-white font-semibold hover:bg-cv-bad disabled:opacity-60">
                    Yes, unpublish
                  </button>
                  <button onClick={() => setConfirmUnpublish(false)} disabled={busy} className="px-3 py-1.5 rounded-cv-control bg-cv-sunken text-cv-ink font-semibold hover:bg-cv-stage disabled:opacity-60">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
