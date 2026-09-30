// Design → Typography's Name Font and Heading Font as a résumé stores them (R2-146): a picker id or
// a custom Google Font's name — text, or unset ('' / none: "Same as text"). The panel only ever writes
// text, but an imported .json, a hand-edited store or a cloud copy can carry anything: an object
// there ({ "family": "Lora" }) crashed the Design panel's Typography (React cannot print an object as
// an option) and printed as the font '[object Object]' (R5-HUNT11-NAME-FONT-OBJECT-CRASHES-DESIGN).
// normalizeResume() runs withFontChoices() wherever résumés come in.

const FONT_CHOICE_KEYS = ['nameFont', 'headingFont'];

/** `resume` with Name Font and Heading Font stored as text, a value that is not text dropped ("Same as text"). */
export function withFontChoices(resume) {
  const settings = resume?.settings;
  if (!settings || typeof settings !== 'object') return resume;
  let next = null;
  for (const key of FONT_CHOICE_KEYS) {
    if (settings[key] == null || typeof settings[key] === 'string') continue;
    next ??= { ...settings };
    delete next[key]; // dropped, not stored as undefined: Firestore refuses one
  }
  return next ? { ...resume, settings: next } : resume;
}
