import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Upload, Mail as MailIcon, Briefcase } from 'lucide-react';
import AuthBar from '@/components/AuthBar';
import { ResumeCard } from '@/components/ResumeCard';
import { CareerHistoryPanel } from '@/components/CareerHistoryPanel';
import { RecoveryNotice } from '@/components/RecoveryNotice';
import { ImportMenu } from '@/components/ImportMenu';
import { notSavedMessage } from '@/utils/storageBackup';
import { comesStraightBack, isDemoAccount, isOriginal } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';

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
export function Dashboard({ store, auth, sync, originalsWaiting = false }) {
  const navigate = useNavigate();
  const importRef = useRef(null);
  const [importError, setImportError] = useState(null);
  // A demo account keeps originals: the cards and Import offer "Keep as my original".
  const keeps = isDemoAccount(auth.user, DEMO_ACCOUNTS);
  // Whether the file being picked is imported as an original (ImportMenu).
  const importAsOriginal = useRef(false);

  function pickImport(keep) {
    importAsOriginal.current = keep;
    importRef.current?.click();
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.personal && Array.isArray(parsed.sections)) {
          const id = store.importResume(parsed, { keep: keeps && importAsOriginal.current });
          setImportError(null);
          navigate(`/resume/${id}`);
        } else {
          setImportError('Invalid resume file — missing required fields.');
          setTimeout(() => setImportError(null), 4000);
        }
      } catch {
        setImportError('Could not parse file. Make sure it\'s a valid CPWT-CV JSON.');
        setTimeout(() => setImportError(null), 4000);
      }
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
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            {keeps ? <ImportMenu onPick={pickImport} className={IMPORT_BUTTON} /> : (
              <button onClick={() => pickImport(false)} className={IMPORT_BUTTON}>
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
              onClick={() => { const id = store.createResume('Cover Letter'); navigate(`/resume/${id}?tab=coverletter`); }}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
            >
              <MailIcon size={14} /> New Cover
            </button>
            <button
              onClick={() => { const id = store.createResume(); navigate(`/resume/${id}`); }}
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
                {store.appState.resumes.length} resume{store.appState.resumes.length !== 1 ? 's' : ''}
              </p>
            </div>

            {store.appState.resumes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-200 p-6">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <FileText size={28} className="text-gray-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-700 mb-2">No resumes yet</h2>
                <p className="text-gray-400 text-sm mb-6">Create your first resume to get started</p>
                <button
                  onClick={() => { const id = store.createResume(); navigate(`/resume/${id}`); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  <Plus size={15} /> Create Resume
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {store.appState.resumes.map(r => (
                  <ResumeCard
                    key={r.id}
                    resume={r}
                    onOpen={id => navigate(`/resume/${id}`)}
                    onDuplicate={id => { const newId = store.duplicateResume(id); if (newId) navigate(`/resume/${newId}`); }}
                    onDelete={id => {
                      if (confirm(deletePrompt(r, keeps))) store.deleteResume(id, auth.user?.uid);
                    }}
                    onRename={store.renameResume}
                    onKeep={keeps ? store.keepResume : undefined}
                    lastOriginal={keeps && comesStraightBack(r, store.appState.resumes)}
                  />
                ))}
                <button
                  onClick={() => { const id = store.createResume(); navigate(`/resume/${id}`); }}
                  className="h-full min-h-[180px] sm:min-h-[220px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer p-4"
                >
                  <div className="w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center">
                    <Plus size={22} />
                  </div>
                  <span className="text-sm font-medium">New Resume</span>
                </button>
                <button
                  onClick={() => { const id = store.createResume('Cover Letter'); navigate(`/resume/${id}?tab=coverletter`); }}
                  className="h-full min-h-[180px] sm:min-h-[220px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-purple-500 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer p-4"
                >
                  <div className="w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center">
                    <MailIcon size={22} />
                  </div>
                  <span className="text-sm font-medium">New Cover Letter</span>
                </button>
              </div>
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
              resumes={store.appState.resumes}
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
    </div>
  );
}
