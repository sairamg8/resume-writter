import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Upload, Mail as MailIcon, Briefcase, Columns2 } from 'lucide-react';
import AuthBar from '@/components/AuthBar';
import { ResumeCard } from '@/components/ResumeCard';
import { CareerHistoryPanel } from '@/components/CareerHistoryPanel';
import { RecoveryNotice } from '@/components/RecoveryNotice';
import { ImportMenu } from '@/components/ImportMenu';
import StarterTemplateModal from '@/components/StarterTemplateModal';
import NewLetterModal from '@/components/NewLetterModal';
import { firebasePublicIo } from '@/components/ShareLinkModal';
import { notSavedMessage } from '@/utils/storageBackup';
import { comesStraightBack, isDemoAccount, isOriginal } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';
import { isJsonResume, jsonResumeToCpwtResume } from '@/utils/jsonResume';
import { editorPath, isLetter, letterSources } from '@/utils/letters';
import { normalizeResume } from '@/utils/normalizeResume';
import { DOCUMENT_HINT, IMPORT_ACCEPT, importDocument, isDocumentFile } from '@/utils/importDocument';

const IMPORT_BUTTON = 'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap';

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
  const [importError, setImportError] = useState(null);
  const [starterModalOpen, setStarterModalOpen] = useState(false);
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  // A demo account keeps originals: the cards and Import offer "Keep as my original".
  const keeps = isDemoAccount(auth.user, DEMO_ACCOUNTS);
  // Whether the file being picked is imported as an original (ImportMenu).
  const importAsOriginal = useRef(false);

  function pickImport(keep) {
    importAsOriginal.current = keep;
    importRef.current?.click();
  }

  function handleSelectStarter(starterId) {
    setStarterModalOpen(false);
    const id = store.createResume('Untitled Resume', starterId);
    navigate(`/resume/${id}`);
  }

  function handleSelectBlank() {
    setStarterModalOpen(false);
    const id = store.createResume();
    navigate(`/resume/${id}`);
  }

  // Letters are listed apart from the résumés, and never counted as one (R2-135).
  const resumes = store.appState.resumes.filter(r => !isLetter(r));
  const letters = store.appState.resumes.filter(isLetter);
  const letterSourceList = letterSources(store.appState.resumes);
  const openLetter = id => navigate(`/resume/${id}?tab=coverletter`);

  // New Cover Letter takes the name, job title, contacts and photo of a résumé: the only one there
  // is, or the one picked when there are several; with none, a blank letter.
  function startLetter() {
    if (letterSourceList.length > 1) setLetterModalOpen(true);
    else newLetter(letterSourceList[0]?.id ?? null);
  }

  function newLetter(fromId) {
    setLetterModalOpen(false);
    openLetter(store.createLetter(fromId));
  }

  /** A résumé's or a letter's card; `open` is where Edit and a new copy go. */
  const card = (r, open) => (
    <ResumeCard
      key={r.id}
      resume={r}
      onOpen={open}
      onDuplicate={id => { const newId = store.duplicateResume(id); if (newId) open(newId); }}
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
    // A PDF, Word, Markdown or text résumé: read best-effort into a new one (R2-148).
    if (isDocumentFile(file)) {
      e.target.value = '';
      importDocument(file, {
        importResume: store.importResume, navigate, keep: keeps && importAsOriginal.current,
        onError: (message) => { setImportError(message); setTimeout(() => setImportError(null), 8000); },
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed?.personal && Array.isArray(parsed?.sections)) {
          const id = store.importResume(parsed, { keep: keeps && importAsOriginal.current });
          setImportError(null);
          // A letter's file (an older build's 'Cover Letter' too, marked on import) opens on its letter.
          navigate(editorPath(id, normalizeResume(parsed)));
        } else if (isJsonResume(parsed)) {
          const converted = jsonResumeToCpwtResume(parsed);
          const id = store.importResume(converted, { keep: keeps && importAsOriginal.current });
          setImportError(null);
          navigate(`/resume/${id}`);
        } else {
          setImportError('Invalid resume file — must be a CPWT-CV backup or standard JSON Resume (.json).');
          setTimeout(() => setImportError(null), 4000);
        }
      } catch {
        setImportError('Could not parse file. Make sure it\'s a valid CPWT-CV or standard JSON Resume (.json).');
        setTimeout(() => setImportError(null), 4000);
      }
    };
    // A file the browser will not hand over — a permission error, a removed drive, a folder — never
    // reaches onload, and without this the import said nothing (R2-085; the editor's: AUD-23).
    reader.onerror = reader.onabort = () => {
      setImportError('That file could not be read. Check it is still there and try again.');
      setTimeout(() => setImportError(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      {/* Nav */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText size={16} className="text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">CPWT-CV</span>
            </div>
            <div className="md:hidden flex items-center gap-2">
              <AuthBar {...auth} {...sync} compact />
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <input ref={importRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={handleImport} />
            {keeps ? <ImportMenu onPick={pickImport} className={IMPORT_BUTTON} /> : (
              <button onClick={() => pickImport(false)} className={IMPORT_BUTTON} title={`Import a résumé: a CPWT-CV or JSON Resume file (.json). ${DOCUMENT_HINT}`}>
                <Upload size={14} /> Import
              </button>
            )}
            <button
              onClick={() => navigate('/jobs')}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
            >
              <Briefcase size={14} /> Job Tracker
            </button>
            <button
              onClick={() => navigate('/boards')}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
            >
              <Columns2 size={14} /> Boards
            </button>
            <button
              onClick={startLetter}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
            >
              <MailIcon size={14} /> New Cover
            </button>
            <button
              onClick={() => setStarterModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={14} /> New Resume
            </button>
            <div className="w-px h-5 bg-gray-200 hidden md:block" />
            <div className="hidden md:block">
              <AuthBar {...auth} {...sync} />
            </div>
          </div>
        </div>
        {store.persistError && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
            <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {notSavedMessage('dashboard', store.persistError)}
            </p>
          </div>
        )}
        {store.recovery && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
            <RecoveryNotice what="résumés" recovery={store.recovery} onDismiss={store.dismissRecovery} />
          </div>
        )}
        {importError && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{importError}</p>
          </div>
        )}
        {originalsWaiting && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
            <p role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Your originals come back as soon as your account can be reached again.
            </p>
          </div>
        )}
      </div>

      {/* Body: main + sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-7 items-start">

          {/* Main — resumes grid */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Resumes</h1>
              <p className="text-xs sm:text-sm text-gray-400">
                {resumes.length} resume{resumes.length !== 1 ? 's' : ''}
              </p>
            </div>

            {resumes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-200 p-6">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <FileText size={28} className="text-gray-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-700 mb-2">No resumes yet</h2>
                <p className="text-gray-400 text-sm mb-6">Create your first resume to get started</p>
                <button
                  onClick={() => setStarterModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  <Plus size={15} /> Create Resume
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {resumes.map(r => card(r, id => navigate(`/resume/${id}`)))}
                <button
                  onClick={() => setStarterModalOpen(true)}
                  className="h-full min-h-[180px] sm:min-h-[220px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer p-4"
                >
                  <div className="w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center">
                    <Plus size={22} />
                  </div>
                  <span className="text-sm font-medium">New Resume</span>
                </button>
              </div>
            )}

            {/* Cover letters: a group of their own, each opening on its letter (R2-135) */}
            {(resumes.length > 0 || letters.length > 0) && (
              <section aria-labelledby="dashboard-letters" className="mt-8 sm:mt-10">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 id="dashboard-letters" className="text-lg sm:text-xl font-bold text-gray-900">Cover Letters</h2>
                  <p className="text-xs sm:text-sm text-gray-400">
                    {letters.length} letter{letters.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {letters.map(r => card(r, openLetter))}
                  <button
                    onClick={startLetter}
                    className="h-full min-h-[180px] sm:min-h-[220px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-purple-500 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer p-4"
                  >
                    <div className="w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center">
                      <MailIcon size={22} />
                    </div>
                    <span className="text-sm font-medium">New Cover Letter</span>
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar — career history */}
          <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-6 mt-4 lg:mt-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">Career History</h2>
              <button
                onClick={() => navigate('/jobs')}
                className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium"
              >
                Job Tracker →
              </button>
            </div>
            <CareerHistoryPanel
              resumes={resumes}
              activeId={store.appState.activeId}
              showJobTrackerLink={true}
            />
          </div>

        </div>
      </div>

      <div className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">© 2026 CPWT-CV. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <button onClick={() => navigate('/terms')} className="hover:text-gray-700 transition-colors">Terms &amp; Conditions</button>
            <button onClick={() => navigate('/privacy')} className="hover:text-gray-700 transition-colors">Privacy Policy</button>
          </div>
        </div>
      </div>

      <StarterTemplateModal
        isOpen={starterModalOpen}
        onClose={() => setStarterModalOpen(false)}
        onSelectStarter={handleSelectStarter}
        onSelectBlank={handleSelectBlank}
      />
      <NewLetterModal
        isOpen={letterModalOpen}
        sources={letterSourceList}
        onPick={newLetter}
        onClose={() => setLetterModalOpen(false)}
      />
    </div>
  );
}
