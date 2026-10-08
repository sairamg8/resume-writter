import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Plus, Upload, Mail as MailIcon } from 'lucide-react';
import AuthBar from '@/components/AuthBar';
import AppBar from '@/components/AppBar';
import BottomTabBar from '@/components/BottomTabBar';
import { ResumeCard } from '@/components/ResumeCard';
import { Lazy, loaders, warm, warmed } from '@/components/lazyPiece';
import { RecoveryNotice } from '@/components/RecoveryNotice';
import { firebasePublicIo } from '@/utils/firebasePublicIo';
import { notSavedMessage } from '@/utils/storageBackup';
import { comesStraightBack, isDemoAccount, isOriginal } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';
import { editorPath, isLetter, letterSources } from '@/utils/letters';
import { normalizeResume } from '@/utils/normalizeResume';
import { DOCUMENT_HINT, IMPORT_ACCEPT, importDocument, importingFor, isDocumentFile } from '@/utils/importDocument';

// The letter picker, Career History and a card's more menu load apart from the start-up path (lazyPiece.jsx).
export const _lazyForTest = { loaders, warmed };

/** The import dialog's code did not arrive: Import opens the file picker straight away, as it did before the dialog. */
function ImportFallback({ asked, pick }) {
  useEffect(() => { if (asked) pick(); }, [asked]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** The letter picker's code did not arrive: each New Cover makes the letter from the first résumé, as with one. */
function LetterFallback({ asked, make }) {
  useEffect(() => { if (asked) make(); }, [asked]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** The import dialog's pending element: while it shows, Import says it is opening. */
function Opening({ on }) {
  useEffect(() => { on(true); return () => on(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const BUTTON = 'inline-flex items-center gap-2 h-[38px] px-3.5 rounded-[10px] text-sm font-semibold whitespace-nowrap transition-colors';
const IMPORT_BUTTON = `${BUTTON} border border-cv-hairline bg-cv-surface text-cv-ink hover:bg-cv-sunken`;
const PRIMARY_BUTTON = `${BUTTON} bg-cv-brand text-white hover:bg-cv-brand-text`;
const TILE = 'min-h-[266px] sm:min-h-[376px] border-[1.5px] border-dashed border-cv-field rounded-2xl flex flex-col items-center justify-center gap-3 text-center p-4 text-cv-ink hover:border-cv-brand hover:bg-cv-brand-soft/40 transition-colors cursor-pointer';
const GRID = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5';
const NOTICE = 'text-[13px] px-3.5 py-2.5';

/**
 * What Delete asks: an original in a demo account is not gone for good (useDemoSeed). The last
 * one's Delete is disabled on its card instead: it would come straight back (comesStraightBack).
 */
function deletePrompt(resume, keeps) {
  if (keeps && isOriginal(resume)) {
    return `Delete "${resume.name}"? It is kept as your original, so it comes back once none of your originals is left. To delete it for good, choose "Stop keeping" first.`;
  }
  return `Delete "${resume.name}"? This cannot be undone.`;
}

/** `originalsWaiting`: a demo account's originals are due back once its cloud answers (useDemoSeed). */
export function Dashboard({ store, auth, sync, originalsWaiting = false, publicLinks = firebasePublicIo }) {
  const navigate = useNavigate();
  const importRef = useRef(null);
  // An import error stays until the user dismisses it or starts another import (R4-DUX-11): it used
  // to go after 4 or 8 s, before the longer ones (a scanned PDF's steps) could be read.
  const [importError, setImportError] = useState(null);
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  // The picker's code is asked for when it is first opened (or ahead of that: warm); it then stays mounted for its exit.
  const [letterUsed, setLetterUsed] = useState(false);
  // The import dialog likewise: asked for when Import is first pressed (or ahead of that: warm).
  const [importOpen, setImportOpen] = useState(false);
  const [importUsed, setImportUsed] = useState(false);
  // A demo account keeps originals: the cards and Import offer "Keep as my original".
  const keeps = isDemoAccount(auth.user, DEMO_ACCOUNTS);
  // Whether the file being picked is imported as an original (ImportDialog).
  const importAsOriginal = useRef(false);
  // A document being read (R4-IMP-12): pdf.js can take seconds to arrive, so Import says "Reading…"
  // and is disabled, and a second pick meanwhile is ignored — the ref catches two in the same tick.
  const [importing, setImporting] = useState(false);
  const importBusy = useRef(false);
  // The dialog's code still on its way (Opening): Import says so, and a second tap is not offered.
  const [opening, setOpening] = useState(false);
  // A read that ends after the Dashboard is gone still imports, but no longer drags the user back.
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // A read that ends after the Dashboard is gone (a document, or a JSON Resume file whose reader is still on its way) imports but opens nothing.
  const goTo = (...args) => { if (mounted.current) navigate(...args); };
  // The account the list is now (syncedUid), for a read that ends after it signed out.
  const listOwner = useRef(store.appState.syncedUid);
  useEffect(() => { listOwner.current = store.appState.syncedUid; }, [store.appState.syncedUid]);
  // After the first paint, in idle time (a timer where the browser has no requestIdleCallback).
  useEffect(() => {
    const all = () => Object.keys(loaders).forEach(warm);
    const idle = globalThis.requestIdleCallback;
    const id = idle ? idle(all) : setTimeout(all, 1500);
    return () => (idle ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  function pickImport(keep) {
    importAsOriginal.current = keep;
    importRef.current?.click();
  }

  // New Resume opens /new (R3-012): every look drawn with the user's own résumé, then blank or a role
  // starter below them (NewResume.jsx).
  const newResume = () => navigate('/new');

  // Letters are listed apart from the résumés, and never counted as one (R2-135).
  const resumes = store.appState.resumes.filter(r => !isLetter(r));
  const letters = store.appState.resumes.filter(isLetter);
  const letterSourceList = letterSources(store.appState.resumes);
  const openLetter = id => navigate(`/resume/${id}?tab=coverletter`);

  // One new letter or copy per visit, as on /new (NewResume.jsx): the editor opens as a transition, so
  // the dashboard stays clickable while its code loads — the second click of a double-click on New
  // Cover or a card's Copy made a second one.
  const made = useRef(false);
  // Back to the dashboard before the editor's code arrives leaves this page mounted: the address it
  // shows again is a new visit, so Copy and New Cover work again. While the editor is loading, the
  // dashboard never shows another address (its route is the one waiting), so a double-click is still
  // one.
  const location = useLocation();
  useEffect(() => { if (location.pathname === '/') made.current = false; }, [location]);
  function once(make, open) {
    if (made.current) return;
    const id = make();
    if (!id) return;
    made.current = true;
    open(id);
  }

  // Whether the person did something else since New Cover was asked: a picker that then fails to arrive
  // must not make a letter over it (however long it took, it is judged by this, not by the time).
  const moved = useRef(false);
  useEffect(() => {
    if (!letterModalOpen) return undefined;
    const note = () => { moved.current = true; };
    const ons = [[document, 'pointerdown', true], [document, 'keydown', true], [window, 'hashchange'], [window, 'popstate']];
    ons.forEach(([t, e, c]) => t.addEventListener(e, note, c));
    return () => ons.forEach(([t, e, c]) => t.removeEventListener(e, note, c));
  }, [letterModalOpen]);
  // New Cover Letter takes the name, job title, contacts and photo of a résumé: the only one there
  // is, or the one picked when there are several; with none, a blank letter.
  function startLetter() {
    moved.current = false;
    if (letterSourceList.length > 1) { setLetterUsed(true); setLetterModalOpen(true); }
    else newLetter(letterSourceList[0]?.id ?? null);
  }

  function newLetter(fromId) {
    setLetterModalOpen(false);
    once(() => store.createLetter(fromId), openLetter);
  }

  /** A résumé's or a letter's card; `open` is where Edit and a new copy go. */
  const card = (r, open) => (
    <ResumeCard
      key={r.id}
      resume={r}
      onOpen={open}
      onDuplicate={id => once(() => store.duplicateResume(id), open)}
      onDelete={id => {
        if (!confirm(deletePrompt(r, keeps))) return;
        store.deleteResume(id, auth.user?.uid);
        // Its public copy (R2-148) goes with it: once the résumé is gone its share panel is too,
        // and the copy would stay public with no way left to unpublish it.
        if (publicLinks && auth.user?.uid && !isLetter(r)) {
          publicLinks.unpublishResume(auth.user.uid, id).catch((e) => console.error('Taking down the public link failed:', e));
        }
      }}
      onRename={store.renameResume}
      onKeep={keeps ? store.keepResume : undefined}
      lastOriginal={keeps && comesStraightBack(r, store.appState.resumes)}
    />
  );

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importBusy.current) { e.target.value = ''; return; }
    // A new import starts clean: the last one's error no longer applies.
    setImportError(null);
    // A PDF, Word, Markdown or text résumé: read best-effort into a new one (R2-148).
    if (isDocumentFile(file)) {
      e.target.value = '';
      importBusy.current = true;
      setImporting(true);
      // The read takes seconds: an account that signs out meanwhile gets the résumé kept aside for it
      // (importResume's `account`), not the signed-out list, and it is not opened
      // (R5-HUNT6-DASH-IMPORT-AFTER-SIGN-OUT).
      const importResume = importingFor(store.importResume, {
        account: store.appState.syncedUid ?? null, ownerNow: () => listOwner.current, name: file.name,
        onLeft: (message) => { if (mounted.current) setImportError(message); },
      });
      importDocument(file, {
        importResume, keep: keeps && importAsOriginal.current,
        navigate: goTo,
        onError: setImportError,
      }).finally(() => {
        importBusy.current = false;
        if (mounted.current) setImporting(false);
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed?.personal && Array.isArray(parsed?.sections)) {
          const id = store.importResume(parsed, { keep: keeps && importAsOriginal.current });
          setImportError(null);
          // A letter's file (an older build's 'Cover Letter' too, marked on import) opens on its letter.
          goTo(editorPath(id, normalizeResume(parsed)));
        } else {
          // The JSON Resume reader loads when such a file is picked, not at start-up (R2-142; not jsonResume.js: its export is the editor's).
          const jr = await import('@/utils/jsonResumeImport').catch(() => null);
          if (!jr) {
            setImportError('This file needs a part of the app that could not load. Check your connection and try again.');
            return;
          }
          if (!jr.isJsonResume(parsed)) {
            setImportError('Invalid resume file — must be a CPWT-CV backup or standard JSON Resume (.json).');
            return;
          }
          const converted = jr.jsonResumeToCpwtResume(parsed);
          const id = store.importResume(converted, { keep: keeps && importAsOriginal.current });
          setImportError(null);
          goTo(`/resume/${id}`);
        }
      } catch {
        setImportError('Could not parse file. Make sure it\'s a valid CPWT-CV or standard JSON Resume (.json).');
      }
    };
    // A file the browser will not hand over — a permission error, a removed drive, a folder — never
    // reaches onload, and without this the import said nothing (R2-085; the editor's: AUD-23).
    reader.onerror = reader.onabort = () => {
      setImportError('That file could not be read. Check it is still there and try again.');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="min-h-screen bg-cv-ground pb-20 md:pb-0">
      {/* The bar (AppBar): brand, the three areas, the account (full sign-in from lg, compact below: R4-DVIS-26). */}
      <AppBar account={(
        <>
          <div className="lg:hidden flex items-center gap-2"><AuthBar {...auth} {...sync} compact /></div>
          <div className="hidden lg:block"><AuthBar {...auth} {...sync} /></div>
        </>
      )} />

      <main className="max-w-[1160px] mx-auto px-4 sm:px-8 pt-6 sm:pt-10 pb-12">
        <div className="flex items-end justify-between gap-x-6 gap-y-4 flex-wrap">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-cv-ink">Documents</h1>
            <p className="mt-1 text-sm text-cv-muted">{resumes.length} resume{resumes.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <input ref={importRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={handleImport} />
            <button
              onClick={() => { setImportUsed(true); setImportOpen(true); }}
              onMouseEnter={() => warm('import')}
              onFocus={() => warm('import')}
              disabled={importing || opening}
              className={`${IMPORT_BUTTON} disabled:opacity-60`}
              title={`Import a résumé: a CPWT-CV or JSON Resume file (.json). ${DOCUMENT_HINT}`}
            >
              <Upload size={16} /> {importing ? 'Reading…' : opening ? 'Opening…' : 'Import'}
            </button>
            <button onClick={startLetter} onMouseEnter={() => warm('letter')} onFocus={() => warm('letter')} className={IMPORT_BUTTON}>
              <MailIcon size={16} /> New Cover
            </button>
            <button onClick={newResume} className={PRIMARY_BUTTON}>
              <Plus size={16} /> New Resume
            </button>
          </div>
        </div>

        {(store.persistError || store.recovery || importError || originalsWaiting) && (
          <div className="mt-5 space-y-2.5">
            {store.persistError && (
              <p role="alert" className={`cv-notice-bad ${NOTICE}`}>{notSavedMessage('dashboard', store.persistError)}</p>
            )}
            {store.recovery && <RecoveryNotice what="résumés" recovery={store.recovery} onDismiss={store.dismissRecovery} />}
            {importError && (
              <div className={`cv-notice-bad ${NOTICE} flex items-start gap-2`}>
                <span className="flex-1">{importError}</span>
                <button type="button" onClick={() => setImportError(null)} className="font-semibold shrink-0">Dismiss</button>
              </div>
            )}
            {originalsWaiting && (
              <p role="status" className={`cv-notice-warn ${NOTICE}`}>Your originals come back as soon as your account can be reached again.</p>
            )}
          </div>
        )}

        {resumes.length === 0 ? (
          <section className="mt-8 sm:mt-9 flex flex-col items-center justify-center py-16 sm:py-20 text-center cv-card rounded-[20px] p-6">
            <div className="w-14 h-14 bg-cv-brand-soft text-cv-brand rounded-full flex items-center justify-center mb-4">
              <FileText size={26} />
            </div>
            <h2 className="text-xl sm:text-[22px] font-semibold tracking-tight text-cv-ink mb-2">No resumes yet</h2>
            <p className="text-cv-muted text-sm mb-6">Create your first resume to get started</p>
            <button onClick={newResume} className={PRIMARY_BUTTON}>
              <Plus size={16} /> Create Resume
            </button>
          </section>
        ) : (
          // Four to a row from xl, two on a phone (the canvas); a card's name keeps two lines whatever the width (R4-DVIS-28).
          <div className={`${GRID} mt-6 sm:mt-7`}>
            <button onClick={newResume} className={TILE}>
              <span className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-cv-brand-soft text-cv-brand flex items-center justify-center"><Plus size={22} /></span>
              <span className="font-semibold text-base">New Resume</span>
              <span className="text-cv-muted text-[13px] leading-snug max-w-[170px]">Start from a template, import a file, or begin blank.</span>
            </button>
            {resumes.map(r => card(r, id => navigate(`/resume/${id}`)))}
          </div>
        )}

        {/* Cover letters: a group of their own, each opening on its letter (R2-135) */}
        {(resumes.length > 0 || letters.length > 0) && (
          <section aria-labelledby="dashboard-letters" className="mt-10 sm:mt-11">
            <div className="flex items-baseline justify-between mb-4">
              <h2 id="dashboard-letters" className="text-xl font-semibold tracking-tight text-cv-ink">Cover Letters</h2>
              <p className="text-sm text-cv-muted">{letters.length} letter{letters.length !== 1 ? 's' : ''}</p>
            </div>
            <div className={GRID}>
              {letters.map(r => card(r, openLetter))}
              <button onClick={startLetter} onMouseEnter={() => warm('letter')} onFocus={() => warm('letter')} className={TILE}>
                <span className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-cv-brand-soft text-cv-brand flex items-center justify-center"><MailIcon size={22} /></span>
                <span className="font-semibold text-base">New Cover Letter</span>
              </button>
            </div>
          </section>
        )}

        {/* Career history, below the documents. A long history scrolls inside the panel's timeline (R4-DVIS-29). */}
        <section onMouseEnter={() => warm('career')} onFocus={() => warm('career')} className="mt-10 sm:mt-11 max-w-xl">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-cv-ink">Career History</h2>
            <button onClick={() => navigate('/jobs')} className="text-sm font-semibold text-cv-brand-text hover:underline">
              Job Tracker →
            </button>
          </div>
          <Lazy
            load="career"
            fallback={(retry, tries) => (
              <div className={`cv-notice-bad ${NOTICE} flex items-start gap-2`}>
                <span className="flex-1">Career History could not load. Check your connection.{tries > 0 && ' The app may have been updated.'}</span>
                <button type="button" onClick={retry} className="font-semibold shrink-0">Try again</button>
                {/* After a deploy the file is gone for good: a reload the person chooses drops nothing (an automatic one would drop a draft). */}
                {tries > 0 && <button type="button" onClick={() => globalThis.location.reload()} className="font-semibold shrink-0">Reload page</button>}
              </div>
            )}
            resumes={resumes}
            activeId={store.appState.activeId}
            showJobTrackerLink={true}
          />
        </section>
      </main>

      <div className="border-t border-cv-hairline bg-cv-surface">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-cv-muted">© 2026 CPWT-CV. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-cv-muted">
            <button onClick={() => navigate('/terms')} className="hover:text-cv-ink transition-colors">Terms &amp; Conditions</button>
            <button onClick={() => navigate('/privacy')} className="hover:text-cv-ink transition-colors">Privacy Policy</button>
          </div>
        </div>
      </div>

      {importUsed && (
        <Lazy
          load="import"
          pending={<Opening on={setOpening} />}
          fallback={() => <ImportFallback asked={importOpen} pick={() => { setImportOpen(false); pickImport(false); }} />}
          isOpen={importOpen}
          keeps={keeps}
          busy={importing}
          onPick={pickImport}
          onClose={() => setImportOpen(false)}
        />
      )}
      {letterUsed && (
        <Lazy
          load="letter"
          fallback={() => <LetterFallback asked={letterModalOpen} make={() => {
            if (moved.current) { setLetterModalOpen(false); return; }
            const from = letterSourceList[0];
            newLetter(from?.id ?? null);
            if (from) setImportError(`Made from ${from.name}: the picker could not load.`);
          }} />}
          isOpen={letterModalOpen}
          sources={letterSourceList}
          onPick={newLetter}
          onClose={() => setLetterModalOpen(false)}
        />
      )}
      <BottomTabBar />
    </div>
  );
}
