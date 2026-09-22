// A value the résumé keeps as text, read as text. Imported data can hold a list, a number or an
// object where the app keeps text: a native .json or a JSON Resume file written by hand or by
// another tool, and a résumé saved from one. Whatever reads the field reads text (.split, .trim,
// `${…}`), and the cover letter generator threw on skills stored as a list, blanking the editor.
// normalizeResume() stores each such value as this text; the JSON Resume import and the cover
// letter generator read their values through it too. Plain data: Node loads it as well as Vite.

/** A value that prints as text: text, or a number (not NaN or ±Infinity). */
export const isText = (v) => typeof v === 'string' || Number.isFinite(v);

/**
 * `v` as the text it stands for. Text stays exactly as it is, and a number becomes its digits. A
 * list becomes its text and numbers, each trimmed, the empty ones left out, joined with ', ': how
 * every export prints a skill group stored as a list (skills.js). Anything else becomes '': an
 * object, true or false, null. An object is never printed, neither as "[object Object]" nor
 * through its own `toString`, which a JSON object can shadow ({"toString": "x"}) so that printing
 * it throws.
 */
export function storedText(v) {
  if (typeof v === 'string') return v;
  if (Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.filter(isText).map((x) => String(x).trim()).filter(Boolean).join(', ');
  return '';
}
