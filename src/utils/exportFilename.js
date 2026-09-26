/** The characters Windows, macOS or Linux refuse in a file name. */
const RESERVED = new Set('\\/:*?"<>|');
/**
 * Windows' device names: a file named one — "CON.pdf", "nul.x.docx", whatever follows the first dot —
 * cannot be saved there at all.
 */
const DEVICE = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?=\.|$)/i;

/**
 * `value` as part of a file name, '' for anything not text: trimmed, inner runs of whitespace as one
 * `_`, and every character a file system reserves (/ \ : * ? " < > | and control characters) as `-`,
 * so "UI/UX Designer" saves as "UI-UX_Designer" on every browser and OS rather than each substituting its
 * own. A run of `-` and `_` becomes one (a `-` if it holds one); leading and trailing dots, dashes and
 * underscores go (a name starting with a dot is hidden); at most 60 characters a part.
 */
function filePart(value) {
  if (typeof value !== 'string') return '';
  const safe = [...value.trim().replace(/\s+/g, '_')]
    .map((c) => (c < ' ' || c === '\x7f' || RESERVED.has(c) ? '-' : c)).join('')
    .replace(/[-_]{2,}/g, (m) => (m.includes('-') ? '-' : '_'));
  // 60 characters, not UTF-16 units: an emoji at the cut is kept whole or left out.
  return [...safe].slice(0, 60).join('').replace(/^[-_.]+|[-_.]+$/g, '');
}

/**
 * An exported file's name, without its suffix: the résumé's name and title, as `Name_Title` (a Windows
 * device name, DEVICE, with "_resume" after it). It
 * follows the résumé, never the signed-in account (AUD-30): a demo account, or anyone keeping a CV
 * for someone else, exports each résumé under the name printed on it. 'resume' when it has none.
 * Every file the editor saves takes its name from here — the Export menu's (useEditorExports) and
 * the ATS Check tab's own .txt download, which named the same text file another way.
 */
export function buildExportFilename(resume) {
  const name = filePart(resume?.personal?.name) || 'resume';
  const title = filePart(resume?.personal?.title);
  const base = title ? `${name}_${title}` : name;
  // A device name ("Con", "NUL", "COM1") saves as "Con_resume": the name is still there, and Windows takes it.
  return base.replace(DEVICE, '$&_resume');
}
