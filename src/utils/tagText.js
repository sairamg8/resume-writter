/**
 * `text` with each <tag> replaced by `replacement`: /<[^>]+>/g, or /<[^>]*>/g where `empty` allows "<>". A tag
 * is a "<", then anything but ">", then the ">". Those patterns read each "<" that no ">" followed to the end of
 * the text again, so a pasted run of 100 000 "<" took seconds (time squared; typing-freeze 7b). This looks for each
 * ">" once, and stops for good at the first "<" with none after it.
 */
export function replaceTags(text, replacement = '', empty = false) {
  const s = String(text);
  let out = '';
  let from = 0;
  let at = s.indexOf('<');
  while (at !== -1) {
    const close = s.indexOf('>', at + 1);
    if (close === -1) break; // no ">" ahead: no later "<" has one either
    if (close === at + 1 && !empty) { at = s.indexOf('<', close); continue; } // "<>" holds nothing: no tag
    out += s.slice(from, at) + replacement;
    from = close + 1;
    at = s.indexOf('<', from);
  }
  return out + s.slice(from);
}
