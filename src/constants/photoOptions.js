// The photo choices Personal Info → Photo offers, and the only values the PDF draws. Its own
// module, with no imports, so the panel, the PDF's photo style and resolveTemplateSettings all read
// one list — and Node's test runner loads it without the app's @/ aliases.

/**
 * One list per control, in the order its chips appear: `val` is what the résumé stores, `label`
 * what the chip reads. The panel renders from these and the PDF clamps a stored value to them
 * (photoOption), so an imported file's `'oval'` shape or a height no build ever offered prints as
 * that control's default instead of falling through the PDF's style lookup (AUD-25).
 * **Add an option here and the panel offers it and the PDF draws it — nothing else changes.**
 */
export const PHOTO_OPTIONS = {
  photoShape: [{ val: 'circle', label: 'Circle' }, { val: 'rounded', label: 'Rounded' }, { val: 'square', label: 'Square' }],
  photoSize: [{ val: 'sm', label: 'Small' }, { val: 'md', label: 'Medium' }, { val: 'lg', label: 'Large' }],
  photoBorder: [{ val: 'none', label: 'None' }, { val: 'thin', label: 'Thin' }, { val: 'accent', label: 'Accent' }],
  photoHeight: [{ val: 'match', label: 'Square' }, { val: 'tall', label: 'Tall' }, { val: 'taller', label: 'Portrait' }],
  photoTextAlign: [{ val: 'top', label: '↑ Top' }, { val: 'center', label: '↕ Center' }, { val: 'bottom', label: '↓ Bottom' }],
};

/** What each control prints when the résumé stores nothing for it — always one of its options. */
export const PHOTO_DEFAULTS = {
  photoShape: 'circle',
  photoSize: 'md',
  photoBorder: 'accent',
  photoHeight: 'match',
  photoTextAlign: 'center',
};

/** A stored photo choice as the panel would show it: `value` when the control offers it, else its default. */
export const photoOption = (key, value) =>
  (PHOTO_OPTIONS[key].some((o) => o.val === value) ? value : PHOTO_DEFAULTS[key]);
