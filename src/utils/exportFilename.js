/**
 * `value` as part of a file name, '' for anything not text: trimmed, inner runs of whitespace as one
 * `_`, and every character a file system reserves (/ \ : * ? " < > | and control characters) as `-`,
 * so "UI/UX Designer" saves as "UI-UX_Designer" on every browser and OS rather than each substituting its
 * own. A run of `-` and `_` becomes one (a `-` if it holds one); leading and trailing dots, dashes and
 * underscores go (a name starting with a dot is hidden); at most 60 characters a part.
 */
const RESERVED = new Set('\\/:*?"<>|');
const filePart = (value) => (typeof value === 'string'
  ? [...value.trim().replace(/\s+/g, '_')].map((c) => (c < ' ' || c === '\x7f' || RESERVED.has(c) ? '-' : c)).join('')
    .replace(/[-_]{2,}/g, (m) => (m.includes('-') ? '-' : '_'))
    .slice(0, 60).replace(/^[-_.]+|[-_.]+$/g, '')
  : '');

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
