import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { TemplateGallery } from '@/components/TemplateGallery';
import { ToastProvider } from '@/components/ui/Toast';
import { savedDesigns } from '@/constants/templatePresets';
import CoverLetterPanel from '@/components/CoverLetterPanel';
import { EditorHeader, EditorAlerts, EditorModeBar } from '@/components/EditorHeader';
import { EditorMobilePill } from '@/components/EditorMobilePill';
import { EditorDock, dockBesideFrom } from '@/components/EditorDock';
import { EditorResumeTab } from '@/components/EditorResumeTab';
import { EditorTabContent } from '@/components/EditorTabContent';
import { EditorPreviewPane } from '@/components/EditorPreviewPane';
import { EditorSaveStatus } from '@/components/EditorSaveStatus';
import { useEditorExports } from '@/hooks/useEditorExports';
import { usePanelResize } from '@/hooks/usePanelResize';
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery';
import { useOpenResume } from '@/hooks/useOpenResume';
import { useRename } from '@/hooks/useRename';
import { useEditorTab } from '@/hooks/useEditorTab';
import { useImportNotice } from '@/hooks/useImportNotice';
import { useStableActions } from '@/hooks/useStableActions';
import { useStableObject } from '@/hooks/useStableObject';
import ShareLinkModal, { firebasePublicIo } from '@/components/ShareLinkModal';

/**
 * `value` as the same object it was while it holds the same things (compared as JSON): the saved designs are
 * made again at every render, and a memoised part given a new array renders for nothing.
 */
function useKept(value) {
  const kept = useRef(value);
  if (kept.current !== value && JSON.stringify(kept.current) !== JSON.stringify(value)) kept.current = value;
  return kept.current;
}

export function Editor({ store, auth, sync }) {
  const { id } = useParams();
  const navigate = useNavigate();

  useOpenResume(store, id);

  const resume = store.activeResume;
  const isMobile = useIsMobile(768);
  const [mobileTab, setMobileTab] = useState('editor'); // 'editor' | 'preview'
  // The address names the open document ('resume' | 'coverletter', ?tab=) and the open dock (null | 'design' | 'ats',
  // ?dock=): the editor panel is the document's content only, the dock sits right of the preview. The preview and
  // Export follow the document; Design and ATS belong to the résumé, so a dock opened from the letter switches to it.
  const { doc, dock, setDoc, setDock } = useEditorTab();
  // What is open on the Résumé document lives here, so it survives a trip to the letter or a dock.
  const [personalOpen, setPersonalOpen] = useState(true);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const rename = useRename(resume, (name) => store.renameResume(resume.id, name));
  const [layoutMode, setLayoutMode] = useState('split');
  const [allExpanded, setAllExpanded] = useState(true);
  const [forceOpenKey, setForceOpenKey] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  // Design → Template open or collapsed, kept here so closing the dock keeps it (A12), and the
  // template gallery (A2).
  const [templateOpen, setTemplateOpen] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // The designs the user saved, from every résumé that holds one (B4), and the store's look actions (the gallery's).
  const designs = savedDesigns(store.appState.resumes);
  const lookActions = {
    setTemplate: store.setTemplate, updateSetting: store.updateSetting, applyDesign: store.applyDesign, restoreDesign: store.restoreDesign,
  };

  const exportMenu = useEditorExports({
    resume, letterTab: doc === 'coverletter', authUser: auth?.user, importResume: store.importResume, navigate, account: store.appState.syncedUid ?? null,
  });
  // With a dock open the panel is drawn no wider than the window less the dock and the stage's floor (what is remembered stays).
  const { panelWidth, separatorProps } = usePanelResize({ dockOpen: Boolean(dock) });
  // The dock sits beside the preview only where the preview keeps its floor next to the (dragged) panel; else it overlays.
  const dockBeside = useMediaQuery(`(min-width: ${dockBesideFrom(!isMobile && layoutMode === 'split' ? panelWidth : 0)}px)`);
  const importNotice = useImportNotice();

  // What the header shows — the name, the rename box, the Export menu's state, the account — does not
  // change with a keystroke in the résumé, but each of these is a new object (with new functions) at
  // every render. Kept as they are while their values are, with handlers that call the latest ones
  // (a stale one would export the text before the last keystroke), the header is not rendered at
  // every key (PERF-4). The way back is here, not in the header: see EditorHeader.
  const headerRename = useStableObject(rename);
  const headerExports = useStableObject(exportMenu);
  const headerAuth = useStableObject(auth);
  const headerSync = useStableObject(sync);
  const goBack = useCallback(() => navigate('/'), [navigate]);
  const openShare = useCallback(() => setShareOpen(true), []);
  const openGallery = useCallback(() => setGalleryOpen(true), []);

  // What the dock is given must keep its identity while its values do, or its memoised panels render at every key
  // (PERF-4): the store's actions as functions that call the latest ones (a stale one would write into the
  // résumé as it was), the saved designs (a new array at every render) and the Template state, in one object.
  const acts = useStableActions(store);
  const keptDesigns = useKept(designs);
  const design = useMemo(() => ({
    setTemplate: acts.setTemplate, updateSetting: acts.updateSetting, applyDesign: acts.applyDesign, restoreDesign: acts.restoreDesign,
    resetSettings: acts.resetSettings, clearSettings: acts.clearSettings, saveDesign: acts.saveDesign, deleteDesign: acts.deleteDesign,
    designs: keptDesigns, templateOpen, onTemplateOpenChange: setTemplateOpen, onBrowseTemplates: openGallery,
  }), [acts, keptDesigns, templateOpen, openGallery]);

  function toggleAllSections() {
    const next = !allExpanded;
    setAllExpanded(next);
    setPersonalOpen(next);
    setForceOpenKey(k => k + 1);
  }

  // A pick of a document or a dock on a phone also sets the Edit | Preview pill to Edit, so the picked panel shows
  // and the phone is never left on the preview (MOBI-043).
  // A phone's sheet covers the form, so a document pick there closes it (one address write: the Résumé is the
  // open document under a dock, and the Cover letter's pick closes it itself).
  function pickDoc(next) {
    if (isMobile && dock && next === 'resume') setDock(null);
    else setDoc(next);
    if (isMobile) setMobileTab('editor');
  }

  // The pill: Edit and Preview close a dock, Design toggles its dock (and lands on Edit, as every pick does).
  function pickView(view) {
    if (view === 'design') return toggleDock('design');
    if (dock) setDock(null);
    setMobileTab(view);
  }

  // The chip and the Design button toggle their dock: a second press closes it, whichever document is open.
  function toggleDock(name) {
    setDock((prev) => (prev === name ? null : name));
    if (isMobile) setMobileTab('editor');
  }

  // The alerts and the mode bar show a message and the open document and dock, which a keystroke in the résumé does
  // not change, but their handlers are new functions at every render, each closed over what that render had: the
  // import notice's Dismiss over the address it was read from (a stale one would send the editor back to the view it
  // had then), the pickers over the address and the window's width (a stale one would drop the notice, and leave a
  // phone on the preview). Kept as they are, calling the latest ones, neither is rendered at every key (PERF-4).
  const { dismissExportError, dismissImport, pickTab, pickView: onPickView, toggleDock: onToggleDock, closeDock } = useStableActions({
    dismissExportError: () => exportMenu.setExportError(null),
    dismissImport: importNotice.dismiss,
    pickTab: pickDoc,
    pickView,
    toggleDock,
    closeDock: () => setDock(null),
  });

  // Warm react-pdf fonts + template chunk so Export PDF feels instant — where PDFs are built, the
  // PDF worker (pdfBuild.js), which leaves the main thread without the PDF engine.
  useEffect(() => {
    if (!resume) return;
    let cancelled = false;
    (async () => {
      try {
        const { warmPdfBuild } = await import('@/utils/pdfBuild');
        if (!cancelled) await warmPdfBuild(resume);
      } catch { /* warm is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [resume?.template, resume?.settings?.font, resume?.settings?.customFont, resume?.settings?.nameFont, resume?.settings?.headingFont]);

  if (!resume) return null;
  // Share a public link (R2-148): a résumé, not a letter, of a signed-in account, on a site with a cloud.
  const canShare = Boolean(firebasePublicIo && auth?.user?.uid && resume.kind !== 'letter');
  // The save chip: an element of its own, three primitives straight from the store, never through EditorHeader
  // (a keystroke changes `saving` and `savedAt`, which would wake the header and its Export menu). The bar shows it,
  // in a box of its own, and the preview's footer no longer does.
  const saveChip = <EditorSaveStatus persistError={Boolean(store.persistError)} saving={store.saving} savedAt={store.savedAt} />;

  return (
    /* fixed inset-0: never let document/body scroll (up or down) and tear the split layout */
    // The notices of the editor (a template switch's Undo, A4).
    <ToastProvider>
    <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-cv-ground">
      {/* The bar: full width, every part a leaf of its own placed by `order` (EditorHeader.jsx): one row from xl, two below it, and on a phone the save chip has a row between them. relative z-40: the bar is a layer above the dock (z-30, over the stage below 1100 px) so the Export menu, which hangs over the row, is not drawn under it. */}
      <div data-testid="editor-bar" className="relative z-40 shrink-0 flex items-center max-xl:flex-wrap gap-x-2 gap-y-1.5 px-3 sm:px-4 py-2 bg-cv-surface border-b border-cv-hairline">
        <EditorHeader
          name={resume.name}
          rename={headerRename}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          exportMenu={headerExports}
          auth={headerAuth}
          sync={headerSync}
          isMobile={isMobile}
          onShare={canShare ? openShare : undefined}
          onBack={goBack}
        />
        <EditorModeBar doc={doc} dock={dock} onPickDoc={pickTab} onToggleDock={onToggleDock} isMobile={isMobile} />
        <div className="order-7 max-md:order-3 max-md:basis-full xl:order-40 shrink min-w-0 truncate text-[11px] md:text-xs text-cv-faint">{saveChip}</div>
        <div className="hidden md:block xl:hidden order-4 basis-full h-0" />
      </div>
      {/* The alerts sit between the bar and the content row, full width: an export error must show in the preview-only layout too (the sidebar is hidden there, and that is where the Export menu is). */}
      <div data-testid="editor-alerts" className="shrink-0 empty:hidden">
        <EditorAlerts exportError={exportMenu.exportError} onDismiss={dismissExportError} persistError={store.persistReason} importNotice={importNotice.notice} onDismissImport={dismissImport} />
      </div>
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
      <div
        data-testid="editor-sidebar"
        className={`${
          isMobile
            ? (mobileTab === 'editor' ? 'flex-1 min-w-0 flex flex-col' : 'hidden')
            : (layoutMode === 'preview' ? 'hidden' : layoutMode === 'editor' ? 'flex-1 min-w-0 flex flex-col' : 'flex flex-col')
        } bg-white overflow-hidden shadow-sm min-h-0 h-full`}
        style={!isMobile && layoutMode === 'split' ? { width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth, flexShrink: 0 } : undefined}
      >
        <EditorTabContent activeTab={doc}>
          {doc === 'resume' && (
            <EditorResumeTab
              resume={resume}
              store={store}
              personalOpen={personalOpen}
              setPersonalOpen={setPersonalOpen}
              allExpanded={allExpanded}
              forceOpenKey={forceOpenKey}
              toggleAllSections={toggleAllSections}
              addSectionOpen={addSectionOpen}
              setAddSectionOpen={setAddSectionOpen}
            />
          )}

          {doc === 'coverletter' && (
            <div className="px-4 py-4">
              <CoverLetterPanel resume={resume} coverLetter={resume.coverLetter} personal={resume.personal} settings={resume.settings} template={resume.template} updateCoverLetter={store.updateCoverLetter} updateSetting={store.updateSetting} clearSettings={store.clearSettings} />
            </div>
          )}
        </EditorTabContent>
      </div>

      {!isMobile && layoutMode === 'split' && (
        // touch-none: a finger drags the handle instead of panning the page. The ::before widens what
        // a finger can hit, out over the preview only: the editor panel's scrollbar lies just left of it (R2-144).
        <div
          {...separatorProps}
          title="Drag to resize panel"
          className="relative w-1 shrink-0 bg-cv-hairline hover:bg-cv-brand active:bg-cv-brand-pressed focus-visible:bg-cv-brand-pressed focus-visible:outline-none cursor-col-resize touch-none transition-colors z-10 before:absolute before:inset-y-0 before:left-0 before:-right-3 before:content-['']"
        />
      )}

      <EditorPreviewPane
        resume={resume}
        activeTab={doc}
        layoutMode={isMobile ? (mobileTab === 'preview' ? 'preview' : 'editor') : layoutMode}
        setLayoutMode={setLayoutMode}
        previewZoom={previewZoom}
        setPreviewZoom={setPreviewZoom}
        isMobile={isMobile}
      />

      {/* The one dock, right of the preview, mounted only while open. */}
      {dock && <EditorDock dock={dock} resume={resume} design={design} store={acts} onClose={closeDock} overlay={!dockBeside} />}
      </div>

      {canShare && <ShareLinkModal isOpen={shareOpen} resume={resume} uid={auth.user.uid} onClose={() => setShareOpen(false)} />}

      {/* Floating Mobile Toggle Switch: Edit | Preview | Design */}
      {isMobile && <EditorMobilePill view={dock ? (dock === 'design' ? 'design' : null) : mobileTab} onPick={onPickView} />}
      <TemplateGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} resume={resume} designs={designs} {...lookActions} />
    </div>
    </ToastProvider>
  );
}
