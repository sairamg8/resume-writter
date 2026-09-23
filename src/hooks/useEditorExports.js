import { useState } from 'react';
import { downloadBlob } from '@/utils/download';
import { isDemoAccount } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';
import { generateAtsPlainText } from '@/utils/atsChecker';
import { generateMarkdownResume } from '@/utils/markdownExport';
import { isJsonResume, jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '@/utils/jsonResume';

/** `value` trimmed with its inner runs of whitespace as one `_`; '' for anything not text. */
const filePart = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, '_') : '');

/**
 * An exported file's name, without its suffix: the résumé's name and title, as `Name_Title`. It
 * follows the résumé, never the signed-in account (AUD-30): a demo account, or anyone keeping a CV
 * for someone else, exports each résumé under the name printed on it. 'resume' when it has none.
 */
function buildExportFilename(resume) {
  const name = filePart(resume?.personal?.name) || 'resume';
  const title = filePart(resume?.personal?.title);
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
    const filename = buildExportFilename(resume);
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
    const filename = buildExportFilename(resume);
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
    const filename = buildExportFilename(resume);
    return runExport('json', 'JSON export', async () => {
      downloadBlob(new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' }), `${filename}.json`);
    });
  }

  function handleExportMarkdown() {
    const filename = buildExportFilename(resume);
    return runExport('markdown', 'Markdown export', async () => {
      const md = generateMarkdownResume(resume);
      downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`);
    });
  }

  function handleExportAtsText() {
    const filename = buildExportFilename(resume);
    return runExport('atstext', 'ATS text export', async () => {
      const text = generateAtsPlainText(resume);
      downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${filename}_ATS.txt`);
    });
  }

  function handleExportJsonResume() {
    const filename = buildExportFilename(resume);
    return runExport('jsonresume', 'JSON Resume export', async () => {
      const schemaObj = cpwtResumeToJsonResume(resume);
      downloadBlob(new Blob([JSON.stringify(schemaObj, null, 2)], { type: 'application/json' }), `${filename}_resume.json`);
    });
  }

  /** A file as a new résumé — `asOriginal`: marked the account's original, in a demo account only. */
  function handleImportJSON(data, asOriginal = false) {
    setExportError(null);
    try {
      const resumeData = isJsonResume(data) ? jsonResumeToCpwtResume(data) : data;
      const newId = importResume(resumeData, { keep: keeps && asOriginal });
      navigate(`/resume/${newId}`);
    } catch (e) {
      console.error('Import failed:', e);
      setExportError(`Import failed${e?.message ? ` (${e.message})` : ''}. Check the file and try again.`);
    }
  }

  return {
    exporting, exportError, setExportError, keeps,
    handleExportPDF, handleExportWord, handleExportJSON, handleExportMarkdown, handleExportAtsText, handleExportJsonResume, handleImportJSON,
  };
}
