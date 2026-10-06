import { memo } from 'react';
import { ArrowLeft, Palette, Pencil, Share2, ShieldCheck, TriangleAlert } from 'lucide-react';
import AuthBar from '@/components/AuthBar';
import { EditorDocSwitch } from '@/components/EditorDocSwitch';
import { LayoutToggle } from '@/components/LayoutToggle';
import { ExportDropdown } from '@/components/ExportDropdown';
import { notSavedMessage } from '@/utils/storageBackup';
import { isImeKey } from '@/components/ui/compose';

/**
 * The back arrow, the résumé's name (click to rename, with a pencil) and its rename box. The rename state is the
 * Editor's (`rename`, useRename: Enter or blur commit, Escape cancels, an IME's keys do not, trimmed, an empty or
 * unchanged name is no edit); `onBack` always goes to the dashboard. A memo leaf of the name, that state and a
 * callback, no router hook, no link (PERF-4). The pencil is the hint a touch screen has no hover for.
 */
export const EditorBackName = memo(function EditorBackName({ name, rename, onBack }) {
  return (
    <>
      <button onClick={onBack} title="Back to dashboard" className="flex items-center gap-1 p-1.5 text-cv-faint hover:text-cv-ink hover:bg-cv-sunken rounded-cv-control transition-colors shrink-0">
        <ArrowLeft size={15} />
        <span className="hidden pointer-coarse:inline text-xs font-semibold">Back</span>
      </button>
      <div className={`min-w-0 pr-1 ${rename.editing ? 'flex-1' : ''}`}>
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
            className="w-full text-sm pointer-coarse:text-base font-semibold border-b border-cv-brand outline-none bg-transparent text-cv-ink"
          />
        ) : (
          <button onClick={rename.start} title="Rename resume" className="flex items-center gap-1.5 max-w-full text-sm font-semibold text-cv-ink hover:text-cv-muted text-left">
            <span className="truncate">{name}</span>
            <Pencil size={12} className="shrink-0 text-cv-faint" />
          </button>
        )}
      </div>
    </>
  );
});

/**
 * The Export menu (ExportDropdown, unchanged inside) over the Editor's export state (`exportMenu`, kept the same
 * while its values are). `onShare` puts "Share a public link" in the menu: given on a phone, whose bar has no
 * room for the Share button. A memo leaf, no router hook, no link (PERF-4).
 */
export const EditorExportMenu = memo(function EditorExportMenu({ exportMenu, onShare }) {
  return (
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
  );
});

/** The Share button of the bar: opens the Share dialog (`onShare`, which the Editor gives only where Share is offered). A memo leaf of a callback. */
export const EditorShareButton = memo(function EditorShareButton({ onShare }) {
  return (
    <button onClick={onShare} data-testid="share-button" title="Share a public link" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-cv-control border border-cv-field bg-cv-surface text-cv-body hover:bg-cv-sunken transition-colors">
      <Share2 size={12} /> Share
    </button>
  );
});

/** The account: AuthBar's compact bar (sync dot, avatar and menu, or the Google button), over the account and the sync (`auth`, `sync`). A memo leaf, no router hook (PERF-4). */
export const EditorAccount = memo(function EditorAccount({ auth, sync, hideName }) {
  return <AuthBar {...auth} {...sync} compact hideName={hideName} />;
});

/**
 * The bar's two ends, as the children of the bar (Editor.jsx): back and the name with the layout toggle in
 * editor-only mode on the left, and on the right the Export menu, Share, the sync dot and the account. The
 * switch, the ATS chip, the save chip and the Design button between them are the bar's other children: they
 * take their places by `order`, so each is a leaf of its own and a keystroke wakes none of them.
 * The rename state is the Editor's (`rename`), as are the export handlers (`exportMenu`) and Share a public link
 * (`onShare`, absent where it is not offered: signed out, no cloud, a letter).
 * Memoised, over props the Editor keeps the same while what the bar shows is (useStableObject): a keystroke in
 * the résumé renders none of it (PERF-4). So it takes the résumé's `name`, not the résumé, and no router hook of
 * its own: the router gives every component using one a new context value whenever the page's routes render,
 * which is every keystroke, and woke it however its props were kept.
 */
export const EditorHeader = memo(function EditorHeader({ name, rename, layoutMode, setLayoutMode, exportMenu, auth, sync, isMobile = false, onShare, onBack }) {
  return (
    <>
      <div className="order-1 xl:order-10 flex-1 min-w-0 flex items-center gap-1.5">
        <EditorBackName name={name} rename={rename} onBack={onBack} />
        {/* In split and preview modes the preview toolbar carries the toggle; only editor-only needs one here (desktop only). */}
        {layoutMode === 'editor' && !isMobile && <LayoutToggle layoutMode={layoutMode} setLayoutMode={setLayoutMode} />}
      </div>
      <div className="order-2 xl:order-60 shrink-0 flex items-center gap-1.5">
        <EditorExportMenu exportMenu={exportMenu} onShare={isMobile ? onShare : undefined} />
        {!isMobile && onShare && <EditorShareButton onShare={onShare} />}
        <div className="w-px h-4 bg-cv-hairline self-center hidden sm:block" />
        {/* No first name beside the avatar in the split panel (R4-DVIS-31): the rule is kept. */}
        <EditorAccount auth={auth} sync={sync} hideName={!isMobile && layoutMode === 'split'} />
      </div>
    </>
  );
});

// The canvas banner (States.dc): a soft card under the bar with an icon, the message and a quiet Dismiss. The colours
// come from the .cv-notice-warn / .cv-notice-bad classes; no `flex` conflict with the row's `empty:hidden` (the row stays a block).
const ALERT = 'mx-3 sm:mx-4 mt-2 flex items-start gap-3 border px-4 py-2 text-xs';
const ALERT_BUTTON = 'shrink-0 px-2.5 py-1 rounded-cv-control border border-current/30 font-semibold transition-colors';

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
        <div role="status" className={`${ALERT} cv-notice-warn border-cv-warn/25`}>
          <TriangleAlert size={16} className="shrink-0 mt-px" />
          <span className="flex-1 min-w-0 break-words">{importNotice}</span>
          <button onClick={onDismissImport} className={`${ALERT_BUTTON} hover:bg-cv-surface/60`}>Dismiss</button>
        </div>
      )}
      {exportError && (
        <div role="alert" className={`${ALERT} cv-notice-bad border-cv-bad/25`}>
          <TriangleAlert size={16} className="shrink-0 mt-px" />
          <span className="flex-1 min-w-0 break-words">{exportError}</span>
          <button onClick={onDismiss} className={`${ALERT_BUTTON} hover:bg-cv-surface/60`}>Dismiss</button>
        </div>
      )}
      {persistError && (
        <div role="alert" className={`${ALERT} cv-notice-bad border-cv-bad/25`}>
          <TriangleAlert size={16} className="shrink-0 mt-px" />
          <span className="flex-1 min-w-0 break-words">{notSavedMessage('editor', persistError)}</span>
        </div>
      )}
    </>
  );
});

// `order`: where the leaf sits in the bar (Editor.jsx). From xl (1280 px) the bar is one row; below it the bar wraps
// to two (the header's two ends, then the switch, the ATS button, the save chip and Design), and on a phone the save
// chip has a row of its own between them, so the name keeps the room it needs.
// `flex` is not in the box: the Design button is `hidden` or `flex` by the Editor's flag, and two display utilities on one element
// would be decided by the stylesheet's order, not by the class list.
const CHIP_BOX = 'items-center justify-center gap-1.5 shrink-0 py-2 px-2.5 max-md:min-h-[44px] max-md:px-3 rounded-cv-control border text-xs font-semibold transition-colors whitespace-nowrap';
const CHIP = `flex ${CHIP_BOX}`;

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
      className={`order-6 xl:order-30 ${CHIP} ${open ? 'bg-cv-good-soft border-cv-good text-cv-good' : 'bg-cv-surface border-cv-field text-cv-muted hover:text-cv-ink'}`}
    >
      <ShieldCheck size={13} className="shrink-0" /> <span>ATS check</span>
    </button>
  );
});

/**
 * The Design button: opens the Design dock, or closes it. It is the résumé's, so from the letter it opens
 * over the Résumé. Named in words (the title is the hover hint; a touch screen has none). A memo leaf, as the chip.
 * `isMobile`: the phone's pill has Design, so the button is hidden. It is the Editor's own flag (a width in px), not
 * a `max-md` class: that one is in rem, so with a larger text size in the browser the pill and the button could
 * both be absent between 768 px and the rem width.
 */
export const EditorDesignButton = memo(function EditorDesignButton({ open, onToggleDock, isMobile = false }) {
  return (
    <button
      onClick={() => onToggleDock('design')}
      title="Design & Customize"
      data-testid="design-button"
      className={`order-8 xl:order-50 ${isMobile ? 'hidden' : 'flex'} ${CHIP_BOX} ${open ? 'bg-cv-brand-soft border-cv-brand-soft-border text-cv-brand-text' : 'bg-cv-surface border-cv-field text-cv-muted hover:text-cv-ink'}`}
    >
      <Palette size={13} className="shrink-0" /> <span>Design</span>
    </button>
  );
});

/**
 * The bar's middle: the document switch (Resume | Cover Letter), the ATS chip and the Design button, which open
 * the right dock (`dock`: null, 'design' or 'ats'; one at a time). Three children of the bar, placed by `order`.
 * On a phone the switch and the chip are the second row under the header and the Design button is the pill's.
 * Memoised over the open document and dock and the Editor's stable callbacks (`onPickDoc(doc)`,
 * `onToggleDock(dock)`): a keystroke renders none of it (PERF-4). No router hook, for the header's reason.
 */
export const EditorModeBar = memo(function EditorModeBar({ doc, dock, onPickDoc, onToggleDock, isMobile = false }) {
  return (
    <>
      <EditorDocSwitch doc={doc} onPick={onPickDoc} />
      <EditorAtsChip open={dock === 'ats'} onToggleDock={onToggleDock} />
      <EditorDesignButton open={dock === 'design'} onToggleDock={onToggleDock} isMobile={isMobile} />
    </>
  );
});
