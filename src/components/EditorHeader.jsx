import { useNavigate } from 'react-router-dom';
import { User, ArrowLeft, Mail as MailIcon, Palette, ShieldCheck } from 'lucide-react';
import AuthBar from '@/components/AuthBar';
import { LayoutToggle } from '@/components/LayoutToggle';
import { ExportDropdown } from '@/components/ExportDropdown';
import { notSavedMessage } from '@/utils/storageBackup';

/**
 * The editor panel's header: back to the dashboard, the résumé's name (click to rename), the
 * layout toggle in editor-only mode, the Export menu and the account.
 * The rename state is the Editor's (`rename`), as are the export handlers (`exportMenu`).
 */
export function EditorHeader({ resume, rename, layoutMode, setLayoutMode, exportMenu, auth, sync, isMobile = false }) {
  const navigate = useNavigate();
  const { resumeName, setResumeName, editingName, setEditingName, commitName } = rename;

  return (
    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 flex items-center gap-1.5 sm:gap-2 bg-white">
      <button onClick={() => navigate('/')} title="Back to dashboard" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
        <ArrowLeft size={15} />
      </button>
      <div className="flex-1 min-w-0 pr-1">
        {editingName ? (
          <input
            autoFocus
            aria-label="Résumé name"
            value={resumeName}
            onChange={e => setResumeName(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') { setEditingName(false); setResumeName(resume.name); }
            }}
            className="w-full text-xs sm:text-sm font-semibold border-b border-blue-400 outline-none bg-transparent text-gray-800"
          />
        ) : (
          <button onClick={() => setEditingName(true)} title="Rename resume" className="text-xs sm:text-sm font-semibold text-gray-800 hover:text-gray-600 truncate block w-full text-left">
            {resume.name}
          </button>
        )}
      </div>
      {/* In split and preview modes the preview toolbar carries the toggle; only editor-only needs one here (desktop only). */}
      {layoutMode === 'editor' && !isMobile && <LayoutToggle layoutMode={layoutMode} setLayoutMode={setLayoutMode} />}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <ExportDropdown
          exporting={exportMenu.exporting}
          keeps={exportMenu.keeps}
          letter={exportMenu.letterTab}
          onExportPDF={exportMenu.handleExportPDF}
          onExportWord={exportMenu.handleExportWord}
          onExportJSON={exportMenu.handleExportJSON}
          onExportMarkdown={exportMenu.handleExportMarkdown}
          onExportAtsText={exportMenu.handleExportAtsText}
          onExportLetterText={exportMenu.handleExportLetterText}
          onExportJsonResume={exportMenu.handleExportJsonResume}
          onImportJSON={exportMenu.handleImportJSON}
          onImportError={exportMenu.setExportError}
        />
        <div className="w-px h-4 bg-gray-200 self-center hidden sm:block" />
        <AuthBar {...auth} {...sync} compact />
      </div>
    </div>
  );
}

/** A failed export or import (dismissable), and browser storage that is full. */
export function EditorAlerts({ exportError, onDismiss, persistError }) {
  return (
    <>
      {exportError && (
        <div role="alert" className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200 flex items-start gap-2">
          <span className="flex-1">{exportError}</span>
          <button onClick={onDismiss} className="font-semibold hover:text-red-900 shrink-0">Dismiss</button>
        </div>
      )}
      {persistError && (
        <div role="alert" className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
          {notSavedMessage('editor', persistError)}
        </div>
      )}
    </>
  );
}

/** Résumé | Cover Letter | ATS Check, and the Design button (a toggle back to the résumé). */
export function EditorModeBar({ activeTab, setActiveTab }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-3 border-b border-gray-200 bg-gray-50/60 overflow-x-auto no-scrollbar">
      <div className="flex gap-1 flex-1 min-w-max sm:min-w-0 bg-white border border-gray-200 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('resume')}
          className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'resume' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <User size={13} className="shrink-0" /> Resume
        </button>
        <button
          onClick={() => setActiveTab('coverletter')}
          className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'coverletter' ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <MailIcon size={13} className="shrink-0" /> Cover Letter
        </button>
        <button
          onClick={() => setActiveTab('ats')}
          className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'ats' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ShieldCheck size={13} className="shrink-0" /> ATS Check
        </button>
      </div>
      <button
        onClick={() => setActiveTab(prev => (prev === 'design' ? 'resume' : 'design'))}
        title="Design & Customize"
        className={`p-2 sm:p-2.5 rounded-xl border transition-all shrink-0 ${activeTab === 'design' ? 'bg-amber-50 border-amber-300 text-amber-600 shadow-sm' : 'border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}
      >
        <Palette size={15} />
      </button>
    </div>
  );
}
