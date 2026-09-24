/**
 * Copies `text` to the clipboard. The promise rejects where the page has no clipboard (an insecure
 * origin, an older browser) as it does where the browser denies clipboard-write, so a Copy button
 * can say that it failed rather than do nothing (R2-080).
 */
export const copyText = (text) => Promise.resolve().then(() => navigator.clipboard.writeText(text));
