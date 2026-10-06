import { memo } from 'react';
import { User, ArrowLeft, Mail as MailIcon, Palette, ShieldCheck } from 'lucide-react';
import AuthBar from '@/components/AuthBar';
import { LayoutToggle } from '@/components/LayoutToggle';
import { ExportDropdown } from '@/components/ExportDropdown';
import { notSavedMessage } from '@/utils/storageBackup';
import { isImeKey } from '@/components/ui/compose';

/**
 * The editor panel's header: back to the dashboard (`onBack`), the résumé's name (click to rename),
 * the layout toggle in editor-only mode, the Export menu and the account.
 * The rename state is the Editor's (`rename`, useRename), as are the export handlers (`exportMenu`)
 * and Share a public link (`onShare`, absent where it is not offered).
 * Memoised, over props the Editor keeps the same while what the header shows is (useStableObject): a
 * keystroke in the résumé renders none of it, neither the Export menu nor the account bar (PERF-4).
 * So it takes the résumé's `name`, not the résumé, and no router hook of its own: the router gives
 * every component using one a new context value whenever the page's routes render, which is every
 * keystroke, and woke it however its props were kept.
 */
export const EditorHeader = memo(function EditorHeader({ name, rename, layoutMode, setLayoutMode, exportMenu, auth, sync, isMobile = false, onShare, onBack }) {
  return (
    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 flex items-center gap-1.5 sm:gap-2 bg-white">
      <button onClick={onBack} title="Back to dashboard" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
        <ArrowLeft size={15} />
      </button>
      <div className="flex-1 min-w-0 pr-1">
        {rename.editing ? (
          <input
            autoFocus
            aria-label="Résumé name"
            value={rename.draft}
            onChange={e => rename.setDraft(e.target.value)}
            onBlur={rename.commit}
            onKeyDown={e => {
              if (e.key === 'Enter' && !isImeKey(e)) rename.commit();
              if (e.key === 'Escape' && !isImeKey(e)) rename.cancel();
            }}
            // 16 px on a touch screen, or iOS Safari zooms the page as the box opens (R4-DPH-29).
            className="w-full text-xs sm:text-sm pointer-coarse:text-base font-semibold border-b border-blue-400 outline-none bg-transparent text-gray-800"
          />
        ) : (
          <button onClick={rename.start} title="Rename resume" className="text-xs sm:text-sm font-semibold text-gray-800 hover:text-gray-600 truncate block w-full text-left">
            {name}
          </button>
        )}
      </div>
      {/* In split and preview modes the preview toolbar carries the toggle; only editor-only needs one here (desktop only). */}
      {layoutMode === 'editor' && !isMobile && <LayoutToggle layoutMode={layoutMode} setLayoutMode={setLayoutMode} />}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <ExportDropdown
          exporting={exportMenu.exporting}
          importing={exportMenu.importing}
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
          onImportFile={exportMenu.handleImportFile}
          onImportError={exportMenu.setExportError}
          onShare={onShare}
        />
        <div className="w-px h-4 bg-gray-200 self-center hidden sm:block" />
        {/* No first name beside the avatar in the split panel: 360 px wide in a wider window, it took the résumé
            name's room (R4-DVIS-31). Editor-only and the phone layout span the window and keep it. */}
        <AuthBar {...auth} {...sync} compact hideName={!isMobile && layoutMode === 'split'} />
      </div>
    </div>
  );
});

/**
 * A failed export or import (dismissable), browser storage that is full, and after a PDF, Word or
 * text import the reminder that it was read best-effort (`importNotice`, dismissable, R2-148).
 * `persistError`: why saving failed, 'full' or 'blocked' (the store's persistReason; its error object
 * reads the same, but a failed write makes a new one each time).
 * Memoised, as the header is: given the same messages and handlers that keep their identity (the Editor's),
 * a keystroke renders none of it (PERF-4). No router hook, for the header's reason.
 */
export const EditorAlerts = memo(function EditorAlerts({ exportError, onDismiss, persistError, importNotice, onDismissImport }) {
  return (
    <>
      {importNotice && (
        <div role="status" className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
          <span className="flex-1">{importNotice}</span>
          <button onClick={onDismissImport} className="font-semibold hover:text-amber-950 shrink-0">Dismiss</button>
        </div>
      )}
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
});

/**
 * Résumé | Cover Letter | ATS Check, and the Design button (a toggle back to the résumé).
 * From sm up the tabs share the group's width (flex-1, sm:min-w-0) and their labels truncate: in a
 * narrow split panel (240–360 px) they kept their full width, spilled past the group and slid
 * under the Design button. A phone keeps each tab whole (min-w-max on the tab and the group) and
 * scrolls the row instead: with min-w-0 there, equal thirds of a 375 px row cut "Cover Letter".
 * Memoised over the open tab and a `setActiveTab` that keeps its identity (the Editor's): a keystroke
 * renders none of it (PERF-4). No router hook, for the header's reason.
 */
export const EditorModeBar = memo(function EditorModeBar({ activeTab, setActiveTab }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-3 border-b border-gray-200 bg-gray-50/60 overflow-x-auto no-scrollbar">
      <div className="flex gap-1 flex-1 min-w-max sm:min-w-0 bg-white border border-gray-200 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('resume')}
          className={`flex-1 min-w-max sm:min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'resume' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <User size={13} className="shrink-0" /> <span className="min-w-0 truncate">Resume</span>
        </button>
        <button
          onClick={() => setActiveTab('coverletter')}
          className={`flex-1 min-w-max sm:min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'coverletter' ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <MailIcon size={13} className="shrink-0" /> <span className="min-w-0 truncate">Cover Letter</span>
        </button>
        <button
          onClick={() => setActiveTab('ats')}
          className={`flex-1 min-w-max sm:min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'ats' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ShieldCheck size={13} className="shrink-0" /> <span className="min-w-0 truncate">ATS Check</span>
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
});
