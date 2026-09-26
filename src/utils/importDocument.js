// Import of a PDF, Word (.docx), Markdown or text résumé (R2-148), for the Dashboard's Import and the
// editor's: which files go this way, and the import itself. Light on purpose — both pages load it at
// start-up — so the reading (importFile.js, and pdf.js for a PDF) is loaded only when a file comes.

/** What the Import file pickers offer: the backup and JSON Resume files, and the documents. */
export const IMPORT_ACCEPT = '.json,.pdf,.docx,.txt,.text,.md,.markdown';

/**
 * A file read as a document, by its name: a PDF, a Word file, Markdown or text. Any other goes the
 * JSON way. An older .doc comes this way too, to be told to save it as .docx, not that it is bad JSON.
 */
export const isDocumentFile = (file) => /\.(pdf|docx?|txt|text|md|markdown)$/i.test(String(file?.name || ''));

/** Under the Import menu items: what a document import is. */
export const DOCUMENT_HINT = 'PDF, Word (.docx), Markdown and text files are read best-effort: review the result.';

/** What the editor says over a résumé read from a document (useImportNotice). */
export const IMPORT_NOTICE = 'Imported from your file as best we could read it. Check the name, the contacts, every section and its dates, and move what landed in the wrong place.';

/**
 * Reads `file` into a new résumé, as the JSON import does: `importResume(resume, { keep })`, then
 * the editor at it, which shows IMPORT_NOTICE. `onError(message)` when it cannot be read.
 */
export async function importDocument(file, { importResume, navigate, onError, keep = false }) {
  try {
    const { resumeFromFile } = await import('./importFile.js');
    const resume = await resumeFromFile(file);
    const id = importResume(resume, { keep });
    navigate(`/resume/${id}`, { state: { importNotice: IMPORT_NOTICE } });
    return id;
  } catch (e) {
    console.error('Import failed:', e);
    onError(`Could not import ${file?.name || 'that file'}${e?.message ? `: ${e.message}` : '.'}`);
    return null;
  }
}
