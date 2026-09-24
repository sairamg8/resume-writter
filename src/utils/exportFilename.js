/** `value` trimmed with its inner runs of whitespace as one `_`; '' for anything not text. */
const filePart = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, '_') : '');

/**
 * An exported file's name, without its suffix: the résumé's name and title, as `Name_Title`. It
 * follows the résumé, never the signed-in account (AUD-30): a demo account, or anyone keeping a CV
 * for someone else, exports each résumé under the name printed on it. 'resume' when it has none.
 * Every file the editor saves takes its name from here — the Export menu's (useEditorExports) and
 * the ATS Check tab's own .txt download, which named the same text file another way.
 */
export function buildExportFilename(resume) {
  const name = filePart(resume?.personal?.name) || 'resume';
  const title = filePart(resume?.personal?.title);
  return title ? `${name}_${title}` : name;
}
