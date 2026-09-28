import { useEffect, useRef, useState } from 'react';
import { downloadBlob } from '@/utils/download';
import { buildExportFilename } from '@/utils/exportFilename';
import { isDemoAccount } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';
import { generateAtsPlainText } from '@/utils/atsChecker';
import { generateMarkdownResume } from '@/utils/markdownExport';
import { generateCoverLetterPlainText } from '@/utils/coverLetterText';
import { isJsonResume, jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '@/utils/jsonResume';
import { importDocument, IMPORT_NOTICE, NEW_LETTER_NOTICE, NEW_RESUME_NOTICE } from '@/utils/importDocument';
import { normalizeResume } from '@/utils/normalizeResume';
import { editorPath, isLetter } from '@/utils/letters';

/** The exports that load code or fonts over the network when they run (lazy chunks, font files). */
const NETWORK_EXPORTS = new Set(['pdf', 'word']);

/**
 * The editor's Export menu: PDF and Word of the tab on screen (résumé or cover letter), the
 * résumé as Markdown, ATS text, JSON Resume and JSON whichever tab is open — `letterTab` tells the
 * menu to say so on the letter's tab, where it also offers the letter as plain text (R2-131) — and
 * Import JSON — with the busy state and a visible error message. `keeps`: a
 * demo account, which can import a file as its original (useDemoSeed), as from the dashboard.
 */
export function useEditorExports({ resume, activeTab, authUser, importResume, navigate }) {
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);
  const keeps = isDemoAccount(authUser, DEMO_ACCOUNTS);
  // A document being read (R4-IMP-12): the Export menu says "Reading…" and a second pick meanwhile is
  // ignored — the ref catches two in the same tick. One that ends after the editor is gone, or has
  // moved to another résumé, still imports, but no longer navigates.
  const [importing, setImporting] = useState(false);
  const importBusy = useRef(false);
  const mounted = useRef(true);
  const shownId = useRef(resume?.id);
  shownId.current = resume?.id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /**
   * Run one export, keeping the button state and a visible error message honest. Only PDF and Word
   * fetch anything (their renderer's code, and the PDF's fonts), so only they point at the
   * connection; the text and JSON files are made in the browser, where a network hint would send the
   * user after the wrong cause (R4-DUX-28).
   */
  async function runExport(kind, label, fn) {
    setExporting(kind);
    setExportError(null);
    try {
      await fn();
    } catch (e) {
      console.error(`${label} failed:`, e);
      const advice = NETWORK_EXPORTS.has(kind) ? 'Check your connection and try again.' : 'Try again, or reload the page if it keeps failing.';
      setExportError(`${label} failed${e?.message ? ` (${e.message})` : ''}. ${advice}`);
    } finally {
      setExporting(null);
    }
  }

  function handleExportPDF() {
    const filename = buildExportFilename(resume);
    return runExport('pdf', 'PDF export', async () => {
      // Built where the preview is built (pdfBuild.js): the same file, off the main thread.
      const { exportResumePdf, exportCoverLetterPdf } = await import('@/utils/pdfBuild');
      if (activeTab === 'coverletter') {
        await exportCoverLetterPdf(resume, `${filename}_cover_letter.pdf`);
      } else {
        await exportResumePdf(resume, `${filename}.pdf`);
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

  /** The cover letter as plain text, for an application form's letter box (R2-131). */
  function handleExportLetterText() {
    const filename = buildExportFilename(resume);
    return runExport('lettertext', 'Cover letter text export', async () => {
      const text = generateCoverLetterPlainText(resume);
      downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${filename}_cover_letter.txt`);
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
      // A letter's file (an older build's 'Cover Letter' too, marked on import) opens on its letter,
      // saying it is a new one (letter or résumé): it keeps the file's name, so it looks like the one open.
      const record = normalizeResume(resumeData);
      navigate(editorPath(newId, record), { state: { importNotice: isLetter(record) ? NEW_LETTER_NOTICE : NEW_RESUME_NOTICE } });
    } catch (e) {
      console.error('Import failed:', e);
      setExportError(`Import failed${e?.message ? ` (${e.message})` : ''}. Check the file and try again.`);
    }
  }

  /** A PDF, Word, Markdown or text résumé, read best-effort into a new one (R2-148). */
  async function handleImportFile(file, asOriginal = false) {
    if (importBusy.current) return null;
    importBusy.current = true;
    setImporting(true);
    setExportError(null);
    const from = resume?.id;
    try {
      return await importDocument(file, {
        importResume, onError: setExportError, keep: keeps && asOriginal, notice: `${NEW_RESUME_NOTICE} ${IMPORT_NOTICE}`,
        navigate: (...args) => { if (mounted.current && shownId.current === from) navigate(...args); },
      });
    } finally {
      importBusy.current = false;
      if (mounted.current) setImporting(false);
    }
  }

  return {
    exporting, importing, exportError, setExportError, keeps, letterTab: activeTab === 'coverletter',
    handleExportPDF, handleExportWord, handleExportJSON, handleExportMarkdown, handleExportAtsText, handleExportJsonResume, handleExportLetterText, handleImportJSON, handleImportFile,
  };
}
