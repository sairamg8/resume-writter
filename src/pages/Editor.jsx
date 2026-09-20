import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import DesignPanel from '@/components/DesignPanel';
import CoverLetterPanel from '@/components/CoverLetterPanel';
import AtsCheckerPanel from '@/components/AtsCheckerPanel';
import { EditorHeader, EditorAlerts, EditorModeBar } from '@/components/EditorHeader';
import { EditorResumeTab } from '@/components/EditorResumeTab';
import { EditorTabContent } from '@/components/EditorTabContent';
import { EditorPreviewPane } from '@/components/EditorPreviewPane';
import { useEditorExports } from '@/hooks/useEditorExports';
import { usePanelResize } from '@/hooks/usePanelResize';

export function Editor({ store, auth, sync }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const initialTab = searchParams.get('tab') || 'resume';

  useEffect(() => {
    if (id && store.appState.activeId !== id) {
      const exists = store.appState.resumes.some(r => r.id === id);
      if (exists) store.setActiveId(id);
      else navigate('/', { replace: true });
    }
  }, [id]);

  const resume = store.activeResume;
  const [activeTab, setActiveTab] = useState(initialTab);
  // What is open on the Résumé tab lives here, so it survives a trip to Design or the letter.
  const [personalOpen, setPersonalOpen] = useState(true);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [resumeName, setResumeName] = useState(resume?.name || '');
  const [editingName, setEditingName] = useState(false);
  const [layoutMode, setLayoutMode] = useState('split');
  const [allExpanded, setAllExpanded] = useState(true);
  const [forceOpenKey, setForceOpenKey] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);

  const exportMenu = useEditorExports({
    resume, activeTab, authUser: auth?.user, importResume: store.importResume, navigate,
  });
  const { panelWidth, onDragHandleMouseDown } = usePanelResize();

  function toggleAllSections() {
    const next = !allExpanded;
    setAllExpanded(next);
    setPersonalOpen(next);
    setForceOpenKey(k => k + 1);
  }

  // Warm react-pdf fonts + template chunk so Export PDF feels instant
  useEffect(() => {
    if (!resume) return;
    let cancelled = false;
    (async () => {
      try {
        const { warmPdfExport } = await import('@/utils/pdfExportReactPDF');
        if (!cancelled) await warmPdfExport(resume);
      } catch { /* warm is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [resume?.template, resume?.settings?.font, resume?.settings?.customFont]);

  useEffect(() => { setResumeName(resume?.name || ''); }, [resume?.id]);

  function commitName() {
    setEditingName(false);
    if (resumeName.trim()) store.renameResume(resume.id, resumeName.trim());
    else setResumeName(resume.name);
  }

  if (!resume) return null;

  return (
    /* fixed inset-0: never let document/body scroll (up or down) and tear the split layout */
    <div className="fixed inset-0 z-20 flex overflow-hidden bg-[#f5f3ef]">
      <div
        className={`${layoutMode === 'preview' ? 'hidden' : layoutMode === 'editor' ? 'flex-1 min-w-0' : ''} bg-white flex flex-col overflow-hidden shadow-sm min-h-0 h-full`}
        style={layoutMode === 'split' ? { width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth, flexShrink: 0 } : undefined}
      >
        <EditorHeader
          resume={resume}
          rename={{ resumeName, setResumeName, editingName, setEditingName, commitName }}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          exportMenu={exportMenu}
          auth={auth}
          sync={sync}
        />
        <EditorAlerts exportError={exportMenu.exportError} onDismiss={() => exportMenu.setExportError(null)} persistError={store.persistError} />
        <EditorModeBar activeTab={activeTab} setActiveTab={setActiveTab} />

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
            />
          )}

          {activeTab === 'design' && (
            <div className="px-4 py-4">
              <DesignPanel resume={resume} updateSetting={store.updateSetting} setTemplate={store.setTemplate} resetSettings={store.resetSettings} />
            </div>
          )}

          {activeTab === 'coverletter' && (
            <div className="px-4 py-4">
              <CoverLetterPanel coverLetter={resume.coverLetter} personal={resume.personal} settings={resume.settings} template={resume.template} updateCoverLetter={store.updateCoverLetter} />
            </div>
          )}

          {activeTab === 'ats' && (
            <div className="px-4 py-4">
              <AtsCheckerPanel resume={resume} store={store} />
            </div>
          )}
        </EditorTabContent>
      </div>

      {layoutMode === 'split' && (
        <div onMouseDown={onDragHandleMouseDown} title="Drag to resize panel" className="w-1 shrink-0 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize transition-colors z-10" />
      )}

      <EditorPreviewPane
        resume={resume}
        activeTab={activeTab}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        previewZoom={previewZoom}
        setPreviewZoom={setPreviewZoom}
        persistError={store.persistError}
      />
    </div>
  );
}
