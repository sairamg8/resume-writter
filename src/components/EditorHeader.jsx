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
 */
export function EditorAlerts({ exportError, onDismiss, persistError, importNotice, onDismissImport }) {
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
}

const MODE_TABS = [
  { id: 'resume', label: 'Resume', icon: User, on: 'text-blue-600', bar: 'after:bg-blue-600' },
  { id: 'design', label: 'Design', title: 'Design & Customize', icon: Palette, on: 'text-amber-600', bar: 'after:bg-amber-500' },
  { id: 'coverletter', label: 'Cover Letter', icon: MailIcon, on: 'text-violet-600', bar: 'after:bg-violet-600' },
  { id: 'ats', label: 'ATS Check', icon: ShieldCheck, on: 'text-emerald-600', bar: 'after:bg-emerald-600' },
];

/**
 * The editor panel's four tabs, side by side and all labelled: Resume | Design | Cover Letter | ATS Check.
 * Design is a tab like the others (it was an unlabelled palette button that toggled back to the Résumé),
 * so the global look and the three working views read as peers. Each tab is an icon over its label and
 * shares the row's width equally (flex-1, min-w-0): at the panel's default 360 px the longest label,
 * "Cover Letter", fits whole, where three side-by-side pills cut it to "Cover …"; in a panel dragged to
 * 240 px a label truncates inside its own tab rather than spilling under its neighbour (R4-DVIS-12). A
 * phone's 375 px holds all four, so the row no longer scrolls. The open tab is marked by its accent colour
 * and an underline — one calm cue instead of a filled block in a different colour per tab.
 */
export function EditorModeBar({ activeTab, setActiveTab }) {
  return (
    <div role="tablist" aria-label="Editor" className="flex items-stretch px-1.5 sm:px-2 border-b border-gray-200 bg-white">
      {MODE_TABS.map(({ id, label, title, icon: Icon, on, bar }) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={selected}
            title={title}
            onClick={() => setActiveTab(id)}
            className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 px-1 text-[11px] font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors ${
              selected ? `${on} ${bar}` : 'text-gray-500 hover:text-gray-800 after:bg-transparent hover:after:bg-gray-200'
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="max-w-full truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
