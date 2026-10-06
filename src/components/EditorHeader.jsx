import { memo } from 'react';
import { ArrowLeft, Palette, ShieldCheck } from 'lucide-react';
import AuthBar from '@/components/AuthBar';
import { EditorDocSwitch } from '@/components/EditorDocSwitch';
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
    <div data-testid="editor-bar" className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 flex items-center gap-1.5 sm:gap-2 bg-white">
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

const CHIP = 'flex items-center gap-1.5 shrink-0 py-2 px-2.5 rounded-cv-control border text-xs font-semibold transition-colors whitespace-nowrap';

/**
 * The ATS chip: opens the ATS dock, or closes it (`open`: it is the dock that is open). A label, no score:
 * the scan runs only inside the dock. A memo leaf of a boolean and `onToggleDock(dock)`, the Editor's stable
 * callback (PERF-4); no router hook, no link.
 */
export const EditorAtsChip = memo(function EditorAtsChip({ open, onToggleDock }) {
  return (
    <button
      onClick={() => onToggleDock('ats')}
      data-testid="ats-chip"
      className={`${CHIP} ${open ? 'bg-cv-good-soft border-cv-good text-cv-good' : 'bg-cv-surface border-cv-field text-cv-muted hover:text-cv-ink'}`}
    >
      <ShieldCheck size={13} className="shrink-0" /> <span>ATS check</span>
    </button>
  );
});

/**
 * The Design button: opens the Design dock, or closes it. It is the résumé's, so from the letter it opens
 * over the Résumé. Named in words (the title is the hover hint; a touch screen has none). A memo leaf, as the chip.
 */
export const EditorDesignButton = memo(function EditorDesignButton({ open, onToggleDock }) {
  return (
    <button
      onClick={() => onToggleDock('design')}
      title="Design & Customize"
      data-testid="design-button"
      className={`${CHIP} ${open ? 'bg-cv-brand-soft border-cv-brand-soft-border text-cv-brand-text' : 'bg-cv-surface border-cv-field text-cv-muted hover:text-cv-ink'}`}
    >
      <Palette size={13} className="shrink-0" /> <span>Design</span>
    </button>
  );
});

/**
 * The row that switches what the editor shows: the document switch (Resume | Cover Letter), the ATS chip and
 * the Design button, which open the right dock (`dock`: null, 'design' or 'ats'; one at a time).
 * Memoised over the open document and dock and the Editor's stable callbacks (`onPickDoc(doc)`,
 * `onToggleDock(dock)`): a keystroke renders none of it (PERF-4). No router hook, for the header's reason.
 */
export const EditorModeBar = memo(function EditorModeBar({ doc, dock, onPickDoc, onToggleDock }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 border-b border-cv-hairline bg-cv-ground overflow-x-auto no-scrollbar">
      <EditorDocSwitch doc={doc} onPick={onPickDoc} />
      <EditorAtsChip open={dock === 'ats'} onToggleDock={onToggleDock} />
      <EditorDesignButton open={dock === 'design'} onToggleDock={onToggleDock} />
    </div>
  );
});
