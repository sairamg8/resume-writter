/**
 * Whether `html` holds a data: URL's base64 payload inside a tag, as a browser's own paste of a picture stores it:
 * what /<[^>]*\bdata:[^\s"'>,;]*;base64,/i found, reading each "<" with no "data:" after it to the end of the
 * text (time squared in a run of them; typing-freeze 7a). One pass: each "data:" is checked once, against the last
 * "<" and ">" before it.
 */
export function hasDataUrlInTag(html) {
  const text = String(html);
  const found = /\bdata:/gi;
  let lt = -1; // the last "<" and ">" before `scanned`
  let gt = -1;
  let scanned = 0;
  let runEnd = -1; // the payload run of the last "data:" that was read, which no later "data:" inside it can change
  for (let m = found.exec(text); m; m = found.exec(text)) {
    for (; scanned < m.index; scanned += 1) {
      const c = text.charCodeAt(scanned);
      if (c === 60) lt = scanned;
      else if (c === 62) gt = scanned;
    }
    if (lt <= gt || m.index < runEnd) continue; // inside no tag, or in a run already read
    runEnd = m.index + 5;
    while (runEnd < text.length && !/[\s"'>,;]/.test(text[runEnd])) runEnd += 1;
    if (text.slice(runEnd, runEnd + 8).toLowerCase() === ';base64,') return true;
  }
  return false;
}
