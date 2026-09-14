import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, User, ArrowLeft,
  Mail as MailIcon, ChevronDown, ChevronUp,
  ChevronsDownUp, ChevronsUpDown, Palette,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';

import { SECTION_GROUPS } from '@/constants/resume';
import { timeAgo } from '@/utils/resume';
import AuthBar from '@/components/AuthBar';
import { LayoutToggle } from '@/components/LayoutToggle';
import { PdfPreview } from '@/components/PdfPreview';
import PersonalInfoEditor from '@/components/PersonalInfoEditor';
import { SortableSection } from '@/components/SectionEditor';
import DesignPanel from '@/components/DesignPanel';
import CoverLetterPanel from '@/components/CoverLetterPanel';
import { ExportDropdown } from '@/components/ExportDropdown';
import { downloadBlob } from '@/utils/download';

// Module-level so their identity is stable: PdfPreview re-renders when `render` changes.
const renderResumePreview = (resume) =>
  import('@/utils/pdfExportReactPDF').then((m) => m.renderResumePdf(resume));
const renderCoverLetterPreview = (resume) =>
  import('@/utils/pdfExportReactPDF').then((m) => m.renderCoverLetterPdf(resume, { preview: true }));

function buildExportFilename(authUser, resume) {
  const name = (authUser?.displayName || resume?.personal?.name || 'resume').replace(/\s+/g, '_');
  const title = (resume?.personal?.title || '').replace(/\s+/g, '_');
  return title ? `${name}_${title}` : name;
}

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
  const [personalOpen, setPersonalOpen] = useState(true);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [resumeName, setResumeName] = useState(resume?.name || '');
  const [editingName, setEditingName] = useState(false);
  const [layoutMode, setLayoutMode] = useState('split');
  const [allExpanded, setAllExpanded] = useState(true);
  const [forceOpenKey, setForceOpenKey] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [lastSaved, setLastSaved] = useState(null);
  const [, refreshTick] = useState(0);

  function toggleAllSections() {
    const next = !allExpanded;
    setAllExpanded(next);
    setPersonalOpen(next);
    setForceOpenKey(k => k + 1);
  }

  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = localStorage.getItem('cpwtcv-panel-width');
    return stored ? Math.min(640, Math.max(240, parseInt(stored, 10))) : 360;
  });
  const dragState = useRef(null);

  function onDragHandleMouseDown(e) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(e) {
      if (!dragState.current) return;
      const delta = e.clientX - dragState.current.startX;
      const next = Math.min(640, Math.max(240, dragState.current.startW + delta));
      setPanelWidth(next);
    }

    function onMouseUp(e) {
      if (dragState.current) {
        const delta = e.clientX - dragState.current.startX;
        const final = Math.min(640, Math.max(240, dragState.current.startW + delta));
        localStorage.setItem('cpwtcv-panel-width', String(final));
      }
      dragState.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
  useEffect(() => { if (resume) setLastSaved(Date.now()); }, [resume]);
  useEffect(() => {
    const id = setInterval(() => refreshTick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleSectionDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const sections = resume.sections;
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);
      store.updateSections(arrayMove(sections, oldIndex, newIndex));
    }
  }

  /** Run one export, keeping the button state and a visible error message honest. */
  async function runExport(kind, label, fn) {
    setExporting(kind);
    setExportError(null);
    try {
      await fn();
    } catch (e) {
      console.error(`${label} failed:`, e);
      setExportError(`${label} failed${e?.message ? ` (${e.message})` : ''}. Check your connection and try again.`);
    } finally {
      setExporting(null);
    }
  }

  function handleExportPDF() {
    const filename = buildExportFilename(auth?.user, resume);
    return runExport('pdf', 'PDF export', async () => {
      const { exportToPDFReact, exportCoverLetterPDFReact } = await import('@/utils/pdfExportReactPDF');
      if (activeTab === 'coverletter') {
        await exportCoverLetterPDFReact(resume, `${filename}_cover_letter.pdf`);
      } else {
        await exportToPDFReact(resume, `${filename}.pdf`);
      }
    });
  }

  function handleExportWord() {
    const filename = buildExportFilename(auth?.user, resume);
    return runExport('word', 'Word export', async () => {
      const { exportToWord } = await import('@/utils/wordExport');
      await exportToWord(resume, `${filename}.docx`);
    });
  }

  function handleExportJSON() {
    const filename = buildExportFilename(auth?.user, resume);
    downloadBlob(new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' }), `${filename}.json`);
  }

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
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 bg-white">
          <button onClick={() => navigate('/')} title="Back to dashboard" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft size={15} />
          </button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                autoFocus
                value={resumeName}
                onChange={e => setResumeName(e.target.value)}
                onBlur={commitName}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') { setEditingName(false); setResumeName(resume.name); }
                }}
                className="w-full text-sm font-semibold border-b border-blue-400 outline-none bg-transparent text-gray-800"
              />
            ) : (
              <button onClick={() => setEditingName(true)} title="Rename resume" className="text-sm font-semibold text-gray-800 hover:text-gray-600 truncate w-full text-left">
                {resume.name}
              </button>
            )}
          </div>
          {/* In split and preview modes the preview toolbar carries the toggle; only editor-only needs one here. */}
          {layoutMode === 'editor' && <LayoutToggle layoutMode={layoutMode} setLayoutMode={setLayoutMode} />}
          <div className="flex items-center gap-1.5 shrink-0">
            <ExportDropdown
              exporting={exporting}
              onExportPDF={handleExportPDF}
              onExportWord={handleExportWord}
              onExportJSON={handleExportJSON}
              onImportJSON={data => { setExportError(null); const newId = store.importResume(data); navigate(`/resume/${newId}`); }}
              onImportError={setExportError}
            />
            <div className="w-px h-4 bg-gray-200 self-center" />
            <AuthBar {...auth} {...sync} compact />
          </div>
        </div>

        {exportError && (
          <div role="alert" className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200 flex items-start gap-2">
            <span className="flex-1">{exportError}</span>
            <button onClick={() => setExportError(null)} className="font-semibold hover:text-red-900 shrink-0">Dismiss</button>
          </div>
        )}
        {store.persistError && (
          <div role="alert" className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
            Not saved: browser storage is full. Export JSON to keep a copy, or remove large photos.
          </div>
        )}

        {/* Mode bar */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 bg-gray-50/60">
          <div className="flex gap-1 flex-1 bg-white border border-gray-200 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('resume')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'resume' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <User size={14} /> Resume
            </button>
            <button
              onClick={() => setActiveTab('coverletter')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'coverletter' ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <MailIcon size={14} /> Cover Letter
            </button>
          </div>
          <button
            onClick={() => setActiveTab(prev => prev === 'design' ? 'resume' : 'design')}
            title="Design & Customize"
            className={`p-2.5 rounded-xl border transition-all shrink-0 ${activeTab === 'design' ? 'bg-amber-50 border-amber-300 text-amber-600 shadow-sm' : 'border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <Palette size={16} />
          </button>
        </div>

        {/* Tab Content — independent scroll; overscroll-behavior blocks scroll chaining to body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ overscrollBehavior: 'contain' }}
        >
          {activeTab === 'resume' && (
            <div className="px-4 py-4 space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={toggleAllSections}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-lg transition-colors"
                >
                  {allExpanded ? <><ChevronsDownUp size={12} /> Collapse All</> : <><ChevronsUpDown size={12} /> Expand All</>}
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <button className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 text-left select-none" onClick={() => setPersonalOpen(o => !o)}>
                  <User size={14} className="text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-700 flex-1">Personal Info</span>
                  {personalOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {personalOpen && (
                  <div className="p-4 border-t border-gray-100">
                    <PersonalInfoEditor
                      personal={resume.personal}
                      updatePersonal={store.updatePersonal}
                      toggleFieldVisibility={store.toggleFieldVisibility}
                      settings={resume.settings}
                      updateSetting={store.updateSetting}
                      template={resume.template}
                    />
                  </div>
                )}
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                <SortableContext items={resume.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {resume.sections.map(section => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      updateSection={store.updateSection}
                      updateSectionSettings={store.updateSectionSettings}
                      removeSection={store.removeSection}
                      addItem={store.addItem}
                      updateItem={store.updateItem}
                      removeItem={store.removeItem}
                      reorderItems={store.reorderItems}
                      toggleSectionVisibility={store.toggleSectionVisibility}
                      forceOpen={allExpanded}
                      forceOpenKey={forceOpenKey}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden">
                <button
                  onClick={() => setAddSectionOpen(o => !o)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={15} /> Add Section
                  {addSectionOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {addSectionOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100">
                    {SECTION_GROUPS.map(group => (
                      <div key={group.label}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">{group.label}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {group.types.map(({ type, label }) => (
                            <button key={type} onClick={() => { store.addSection(type); setAddSectionOpen(false); }} className="px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 text-left transition-colors">
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="h-4" />
            </div>
          )}

          {activeTab === 'design' && (
            <div className="px-4 py-4">
              <DesignPanel resume={resume} updateSetting={store.updateSetting} setTemplate={store.setTemplate} resetSettings={store.resetSettings} />
            </div>
          )}

          {activeTab === 'coverletter' && (
            <div className="px-4 py-4">
              <CoverLetterPanel coverLetter={resume.coverLetter} personal={resume.personal} updateCoverLetter={store.updateCoverLetter} />
            </div>
          )}
        </div>
      </div>

      {layoutMode === 'split' && (
        <div onMouseDown={onDragHandleMouseDown} title="Drag to resize panel" className="w-1 shrink-0 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize transition-colors z-10" />
      )}

      <div
        className={`${layoutMode === 'editor' ? 'hidden' : 'flex-1 min-w-0 min-h-0 h-full'} overflow-auto bg-[#f5f3ef] flex flex-col items-center py-8`}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="mb-4 flex items-center gap-3 shrink-0">
          <LayoutToggle layoutMode={layoutMode} setLayoutMode={setLayoutMode} />
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
            {activeTab === 'coverletter' ? 'Cover Letter' : 'Résumé'} · A4
          </span>
          <span className="text-xs text-gray-300">·</span>
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))} disabled={previewZoom <= 0.5} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 rounded-md font-bold leading-none">−</button>
            <span className="text-xs text-gray-600 font-medium w-9 text-center select-none">{Math.round(previewZoom * 100)}%</span>
            <button onClick={() => setPreviewZoom(z => Math.min(1.5, Math.round((z + 0.25) * 100) / 100))} disabled={previewZoom >= 1.5} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 rounded-md font-bold leading-none">+</button>
          </div>
        </div>

        {activeTab === 'coverletter' ? (
          <PdfPreview key="coverletter" title="Cover letter" textId="cover-letter-preview" input={resume} render={renderCoverLetterPreview} zoom={previewZoom} />
        ) : (
          <PdfPreview key="resume" title="Résumé" textId="resume-preview" input={resume} render={renderResumePreview} zoom={previewZoom} />
        )}

        <div className="mt-6 flex items-center gap-3 text-xs text-gray-400 shrink-0">
          {store.persistError ? (
            <span className="text-red-600 font-medium">Not saved</span>
          ) : (
            <span>{lastSaved ? `Saved ${timeAgo(lastSaved)}` : 'Auto-saved to your browser'}</span>
          )}
          <span>·</span>
          <button onClick={() => navigate('/terms')} className="hover:text-gray-600 transition-colors">Terms</button>
          <button onClick={() => navigate('/privacy')} className="hover:text-gray-600 transition-colors">Privacy</button>
        </div>
      </div>
    </div>
  );
}
