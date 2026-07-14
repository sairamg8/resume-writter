import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Upload, Mail as MailIcon, Briefcase } from 'lucide-react';
import AuthBar from '@/components/AuthBar';
import { ResumeCard } from '@/components/ResumeCard';
import { CareerHistoryPanel } from '@/components/CareerHistoryPanel';

export function Dashboard({ store, auth, sync }) {
  const navigate = useNavigate();
  const importRef = useRef(null);
  const [importError, setImportError] = useState(null);

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.personal && Array.isArray(parsed.sections)) {
          const id = store.importResume(parsed);
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
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">CPWT-CV</span>
          </div>
          <div className="flex items-center gap-2">
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <button
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Upload size={15} /> Import
            </button>
            <button
              onClick={() => navigate('/jobs')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Briefcase size={15} /> Job Tracker
            </button>
            <button
              onClick={() => { const id = store.createResume('Cover Letter'); navigate(`/resume/${id}?tab=coverletter`); }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
            >
              <MailIcon size={15} /> New Cover
            </button>
            <button
              onClick={() => { const id = store.createResume(); navigate(`/resume/${id}`); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={15} /> New Resume
            </button>
            <div className="w-px h-5 bg-gray-200" />
            <AuthBar {...auth} {...sync} />
          </div>
        </div>
        {importError && (
          <div className="max-w-7xl mx-auto px-6 pb-3">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{importError}</p>
          </div>
        )}
      </div>

      {/* Body: main + sidebar */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-7 items-start">

          {/* Main — resumes grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">My Resumes</h1>
              <p className="text-sm text-gray-400">
                {store.appState.resumes.length} resume{store.appState.resumes.length !== 1 ? 's' : ''}
              </p>
            </div>

            {store.appState.resumes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {store.appState.resumes.map(r => (
                  <ResumeCard
                    key={r.id}
                    resume={r}
                    onOpen={id => navigate(`/resume/${id}`)}
                    onDuplicate={id => { const newId = store.duplicateResume(id); if (newId) navigate(`/resume/${newId}`); }}
                    onDelete={store.deleteResume}
                    onRename={store.renameResume}
                  />
                ))}
                <button
                  onClick={() => { const id = store.createResume(); navigate(`/resume/${id}`); }}
                  className="h-full min-h-[220px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center">
                    <Plus size={22} />
                  </div>
                  <span className="text-sm font-medium">New Resume</span>
                </button>
                <button
                  onClick={() => { const id = store.createResume('Cover Letter'); navigate(`/resume/${id}?tab=coverletter`); }}
                  className="h-full min-h-[220px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-purple-500 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer"
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
          <div className="w-72 shrink-0 sticky top-6">
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
