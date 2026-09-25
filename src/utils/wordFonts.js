import { FONTS, fontChoice } from '@/utils/fonts';

/**
 * The fonts a Word file names. Word does not embed fonts: it prints each run in the font it names
 * when the reader has it installed.
 */

/** The font the résumé's text is in: the custom font as typed, or the picker's label ("Georgia"). */
export function resolveWordFont(settings = {}) {
  if (settings?.customFont?.trim()) return settings.customFont.trim();
  const fontObj = FONTS.find((f) => f.id === settings?.font);
  return fontObj?.label || fontObj?.name || 'Noto Sans';
}

/**
 * Typography → Name Font and Heading Font (settings.nameFont, headingFont, R2-146) as a run's
 * `font`: {} while unset, so the run takes the document's font as it always did.
 */
const ownFont = (value) => (value ? { font: resolveWordFont(fontChoice(value)) } : {});
export const wordNameFont = (settings) => ownFont(settings?.nameFont);
export const wordHeadingFont = (settings) => ownFont(settings?.headingFont);
