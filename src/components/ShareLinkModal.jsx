import { useEffect, useId, useState } from 'react';
import { Globe, X, Copy, ExternalLink } from 'lucide-react';
import { doc, getDocFromServer, runTransaction, writeBatch } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { publicIo, publicSummary, publicUrl, publishedIsCurrent, publicSnapshot, TOO_LARGE_CODE } from '@/utils/publicLink';
import { timeAgo } from '@/utils/resume';
import { copyText } from '@/utils/clipboard';

/** The real Firestore calls (publicLink.js); null in a build without a cloud, where sharing is not offered. */
export const firebasePublicIo = db ? publicIo({ doc, getDocFromServer, runTransaction, writeBatch }, db) : null;

/**
 * Export → Share a public link (R2-148): publish a read-only copy of `resume` at a web address, put
 * its current state there, or take it down — and, before and after, exactly what anyone with the
 * link sees (publicSummary). `uid` the signed-in account; `io` publicLink.js's calls (the tests
 * pass a fake Firestore's). Escape, the close button or a click beside the box is `onClose()`.
 */
export default function ShareLinkModal({ isOpen, resume, uid, io = firebasePublicIo, onClose }) {
  const titleId = useId();
  // { state: 'loading' | 'ready' | 'error', share: { shareId, publishedAt, copy } | null }
  const [view, setView] = useState({ state: 'loading', share: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const resumeId = resume?.id;

  useEffect(() => {
    if (!isOpen || !io || !uid || !resumeId) return undefined;
    let live = true;
    setView({ state: 'loading', share: null });
    setError(null);
    setCopied(null);
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
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      console.error(`${label} failed:`, e);
      // A copy too large to publish says so and only so: the connection has nothing to do with it.
      setError(e?.code === TOO_LARGE_CODE ? e.message
        : `${label} failed${e?.message ? ` (${e.message})` : ''}. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  };
  const publish = () => run(async () => {
    const next = await io.publish(uid, resume, share ? { shareId: share.shareId } : undefined);
    // 'Copied' was about the link as it was: a new one has not been copied.
    if (next.shareId !== share?.shareId) setCopied(null);
    setView({ state: 'ready', share: next });
  }, 'Publishing');
  const unpublish = () => run(async () => {
    await io.unpublish(uid, resumeId, share.shareId);
    setCopied(null);
    setView({ state: 'ready', share: null });
  }, 'Unpublishing');
  const url = share ? publicUrl(share.shareId) : '';
  // What is public now, or what publishing would make public.
  const shown = publicSummary(share ? share.copy : publicSnapshot(resume));
  const current = share ? publishedIsCurrent(share.copy, resume) : true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Globe size={16} aria-hidden="true" />
            </div>
            <h2 id={titleId} className="text-sm sm:text-base font-bold text-gray-900">Share a public link</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto text-xs text-gray-700">
          {view.state === 'loading' && <p>Checking whether this résumé is published…</p>}
          {view.state === 'error' && <p role="alert" className="text-red-700">Could not reach your account to check this résumé's link. Check your connection and try again.</p>}
          {view.state === 'ready' && (
            <>
              {share ? (
                <>
                  <p>This résumé is published: anyone with this link can open a read-only copy and download it as a PDF.</p>
                  <div className="flex items-center gap-1.5">
                    <input readOnly value={url} aria-label="Public link" onFocus={e => e.target.select()} className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-800" />
                    <button onClick={() => copyText(url).then(() => setCopied('Copied'), () => setCopied('Copy failed'))} className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0">
                      <Copy size={12} aria-hidden="true" /> {copied || 'Copy'}
                    </button>
                    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0">
                      <ExternalLink size={12} aria-hidden="true" /> Open
                    </a>
                  </div>
                  <p className="text-gray-500">Published {timeAgo(share.publishedAt).toLowerCase()}.{current ? '' : ' You have changed the résumé since: the link still shows it as it was until you update it.'}</p>
                </>
              ) : (
                <p>Publish a read-only copy of this résumé at a web address anyone with the link can open, and download as a PDF. It stays public until you unpublish it.</p>
              )}
              <div>
                <p className="font-semibold text-gray-800">{share ? 'What is public:' : 'What would be public:'}</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {shown.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
                <p className="mt-1 text-gray-500">Fields and sections you hid, the cover letter and this résumé's name in your list stay private.</p>
              </div>
              {error && <p role="alert" className="text-red-700">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {(!share || !current) && (
                  <button onClick={publish} disabled={busy} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60">
                    {share ? 'Update the public copy' : 'Publish'}
                  </button>
                )}
                {share && (
                  <button onClick={unpublish} disabled={busy} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-60">
                    Unpublish
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
