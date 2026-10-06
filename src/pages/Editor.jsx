import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PenLine, Eye } from 'lucide-react';

import { TemplateGallery } from '@/components/TemplateGallery';
import { ToastProvider } from '@/components/ui/Toast';
import { savedDesigns } from '@/constants/templatePresets';
import { EditorHeader, EditorAlerts, EditorModeBar } from '@/components/EditorHeader';
import { EditorResumeTab } from '@/components/EditorResumeTab';
import { EditorTabContent } from '@/components/EditorTabContent';
import { EditorDesignTab } from '@/components/EditorDesignTab';
import { EditorLetterTab } from '@/components/EditorLetterTab';
import { EditorAtsTab } from '@/components/EditorAtsTab';
import { EditorPreviewPane } from '@/components/EditorPreviewPane';
import { useEditorExports } from '@/hooks/useEditorExports';
import { usePanelResize } from '@/hooks/usePanelResize';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useOpenResume } from '@/hooks/useOpenResume';
import { useRename } from '@/hooks/useRename';
import { useEditorTab } from '@/hooks/useEditorTab';
import { useImportNotice } from '@/hooks/useImportNotice';
import { useStableObject } from '@/hooks/useStableObject';
import ShareLinkModal, { firebasePublicIo } from '@/components/ShareLinkModal';

export function Editor({ store, auth, sync }) {
  const { id } = useParams();
  const navigate = useNavigate();

  useOpenResume(store, id);

  const resume = store.activeResume;
  const isMobile = useIsMobile(768);
  const [mobileTab, setMobileTab] = useState('editor'); // 'editor' | 'preview'
  const [activeTab, setActiveTab] = useEditorTab();
  // What is open on the Résumé tab lives here, so it survives a trip to Design or the letter.
  const [personalOpen, setPersonalOpen] = useState(true);
  // Each tab's open view (its content apart from its settings), kept here for the same reason: Personal
  // Info's Details | Header | Photo, Design's Template | Style | Layout | Details, the letter's
  // Letter | Letterhead and the ATS check's Checks | Job match | Parser view.
  const [personalView, setPersonalView] = useState('details');
  const [designGroup, setDesignGroup] = useState('template');
  const [letterView, setLetterView] = useState('letter');
  const [atsView, setAtsView] = useState('checks');
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const rename = useRename(resume, (name) => store.renameResume(resume.id, name));
  const [layoutMode, setLayoutMode] = useState('split');
  const [allExpanded, setAllExpanded] = useState(true);
  const [forceOpenKey, setForceOpenKey] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  // Design → Template open or collapsed, kept here so a trip to another tab keeps it (A12), and the
  // template gallery (A2).
  const [templateOpen, setTemplateOpen] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // The designs the user saved, from every résumé that holds one (B4), and the store's look actions.
  const designs = savedDesigns(store.appState.resumes);
  const lookActions = {
    setTemplate: store.setTemplate, updateSetting: store.updateSetting, applyDesign: store.applyDesign, restoreDesign: store.restoreDesign,
  };

  const exportMenu = useEditorExports({
    resume, activeTab, authUser: auth?.user, importResume: store.importResume, navigate, account: store.appState.syncedUid ?? null,
  });
  const { panelWidth, separatorProps } = usePanelResize();
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

  function toggleAllSections() {
    const next = !allExpanded;
    setAllExpanded(next);
    setPersonalOpen(next);
    setForceOpenKey(k => k + 1);
  }

  function handleModeTabChange(tab) {
    setActiveTab(tab);
    if (isMobile) {
      setMobileTab('editor');
    }
  }

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

  return (
    /* fixed inset-0: never let document/body scroll (up or down) and tear the split layout */
    // The notices of the editor (a template switch's Undo, A4).
    <ToastProvider>
    <div className="fixed inset-0 z-20 flex overflow-hidden bg-[#f5f3ef]">
      <div
        className={`${
          isMobile
            ? (mobileTab === 'editor' ? 'flex-1 min-w-0 flex flex-col' : 'hidden')
            : (layoutMode === 'preview' ? 'hidden' : layoutMode === 'editor' ? 'flex-1 min-w-0 flex flex-col' : 'flex flex-col')
        } bg-white overflow-hidden shadow-sm min-h-0 h-full`}
        style={!isMobile && layoutMode === 'split' ? { width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth, flexShrink: 0 } : undefined}
      >
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
        <EditorAlerts exportError={exportMenu.exportError} onDismiss={() => exportMenu.setExportError(null)} persistError={store.persistError} importNotice={importNotice.notice} onDismissImport={importNotice.dismiss} />
        <EditorModeBar activeTab={activeTab} setActiveTab={handleModeTabChange} />

        <EditorTabContent activeTab={activeTab}>
          {activeTab === 'resume' && (
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
              personalView={personalView}
              onPersonalViewChange={setPersonalView}
            />
          )}

          {activeTab === 'design' && (
            <EditorDesignTab
              group={designGroup}
              onGroupChange={setDesignGroup}
              resume={resume}
              {...lookActions}
              resetSettings={store.resetSettings}
              clearSettings={store.clearSettings}
              designs={designs}
              saveDesign={store.saveDesign}
              deleteDesign={store.deleteDesign}
              onBrowseTemplates={() => setGalleryOpen(true)}
              templateOpen={templateOpen}
              onTemplateOpenChange={setTemplateOpen}
            />
          )}

          {activeTab === 'coverletter' && (
            <EditorLetterTab
              view={letterView}
              onViewChange={setLetterView}
              resume={resume}
              coverLetter={resume.coverLetter}
              personal={resume.personal}
              settings={resume.settings}
              template={resume.template}
              updateCoverLetter={store.updateCoverLetter}
              updateSetting={store.updateSetting}
              clearSettings={store.clearSettings}
            />
          )}

          {activeTab === 'ats' && (
            <EditorAtsTab view={atsView} onViewChange={setAtsView} resume={resume} store={store} />
          )}
        </EditorTabContent>
      </div>

      {!isMobile && layoutMode === 'split' && (
        // touch-none: a finger drags the handle instead of panning the page. The ::before widens what
        // a finger can hit, out over the preview only: the editor panel's scrollbar lies just left of it (R2-144).
        <div
          {...separatorProps}
          title="Drag to resize panel"
          className="relative w-1 shrink-0 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 focus-visible:bg-blue-500 focus-visible:outline-none cursor-col-resize touch-none transition-colors z-10 before:absolute before:inset-y-0 before:left-0 before:-right-3 before:content-['']"
        />
      )}

      <EditorPreviewPane
        resume={resume}
        activeTab={activeTab}
        layoutMode={isMobile ? (mobileTab === 'preview' ? 'preview' : 'editor') : layoutMode}
        setLayoutMode={setLayoutMode}
        previewZoom={previewZoom}
        setPreviewZoom={setPreviewZoom}
        persistError={store.persistError}
        saving={store.saving}
        savedAt={store.savedAt}
        isMobile={isMobile}
      />

      {canShare && <ShareLinkModal isOpen={shareOpen} resume={resume} uid={auth.user.uid} onClose={() => setShareOpen(false)} />}

      {/* Floating Mobile Toggle Switch */}
      {isMobile && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center bg-gray-900/90 backdrop-blur-md text-white p-1 rounded-full shadow-2xl border border-white/10 text-xs font-semibold">
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all ${
              mobileTab === 'editor'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <PenLine size={13} />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all ${
              mobileTab === 'preview'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>
        </div>
      )}
      <TemplateGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} resume={resume} designs={designs} {...lookActions} />
    </div>
    </ToastProvider>
  );
}
