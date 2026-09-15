import { useState } from 'react';
import { downloadBlob } from '@/utils/download';
import { isDemoAccount } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';

function buildExportFilename(authUser, resume) {
  const name = (authUser?.displayName || resume?.personal?.name || 'resume').replace(/\s+/g, '_');
  const title = (resume?.personal?.title || '').replace(/\s+/g, '_');
  return title ? `${name}_${title}` : name;
}

/**
 * The editor's Export menu: PDF and Word of the tab on screen (résumé or cover letter), the
 * résumé as JSON, and Import JSON — with the busy state and a visible error message. `keeps`: a
 * demo account, which can import a file as its original (useDemoSeed), as from the dashboard.
 */
export function useEditorExports({ resume, activeTab, authUser, importResume, navigate }) {
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);
  const keeps = isDemoAccount(authUser, DEMO_ACCOUNTS);

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
    const filename = buildExportFilename(authUser, resume);
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
    const filename = buildExportFilename(authUser, resume);
    return runExport('word', 'Word export', async () => {
      const { exportToWord, exportCoverLetterToWord } = await import('@/utils/wordExport');
      if (activeTab === 'coverletter') {
        await exportCoverLetterToWord(resume, `${filename}_cover_letter.docx`);
      } else {
        await exportToWord(resume, `${filename}.docx`);
      }
    });
  }

  function handleExportJSON() {
    const filename = buildExportFilename(authUser, resume);
    downloadBlob(new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' }), `${filename}.json`);
  }

  /** A file as a new résumé — `asOriginal`: marked the account's original, in a demo account only. */
  function handleImportJSON(data, asOriginal = false) {
    setExportError(null);
    const newId = importResume(data, { keep: keeps && asOriginal });
    navigate(`/resume/${newId}`);
  }

  return {
    exporting, exportError, setExportError, keeps,
    handleExportPDF, handleExportWord, handleExportJSON, handleImportJSON,
  };
}
