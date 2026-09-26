import { FONTS, fontChoice } from '@/utils/fonts';
import { fetchMetadata, fontsourceId } from '@/utils/fontsource';

/**
 * The fonts a Word file names. Word does not embed fonts: it prints each run in the font it names
 * when the reader has it installed, else in a stand-in (wordFontTable).
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

// ── Word's stand-in for a font the reader has not installed ─────────────────

/**
 * The installed font Word shows each kind of font in when the one named is missing: Arial and
 * Georgia ship with Windows and macOS alike. `panose` and `family` are what Word matches a missing
 * font against in the file's font table (w:panose1, w:family) to pick its stand-in; `altName` names it.
 */
const STAND_INS = {
  'sans-serif': { name: 'Arial', panose: '020B0604020202020204', family: 'swiss' },
  serif: { name: 'Georgia', panose: '02040502050405020303', family: 'roman' },
  monospace: { name: 'Courier New', panose: '02070309020205020404', family: 'modern' },
};
/** Fonts Word finds on Windows and macOS: named as they are, no stand-in. */
const INSTALLED = new Set(Object.values(STAND_INS).map((f) => f.name));

/** A font setting's kind: the picker's, or a custom font's Fontsource category (sans-serif offline, or display / handwriting). */
async function categoryOf(settings) {
  const custom = settings?.customFont?.trim();
  if (!custom) return FONTS.find((f) => f.id === settings?.font)?.category || 'sans-serif';
  const meta = await fetchMetadata(fontsourceId(custom));
  return STAND_INS[meta?.category] ? meta.category : 'sans-serif';
}

/**
 * The fonts the Word file names — Font Family's, Name Font's and Heading Font's — each with the
 * installed font Word shows it in where the reader lacks it: [{ font, standIn }], standIn null for a
 * font Word has (Georgia). One list for the export's font table and the panel's note, so what the
 * note says is what the file asks for (R2-146).
 */
export async function wordFontStandIns(settings = {}) {
  const choices = [settings, ...[settings?.nameFont, settings?.headingFont].filter(Boolean).map(fontChoice)];
  const out = [];
  for (const choice of choices) {
    const font = resolveWordFont(choice);
    if (out.some((f) => f.font === font)) continue;
    out.push({ font, standIn: INSTALLED.has(font) ? null : STAND_INS[await categoryOf(choice)] });
  }
  return out;
}

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * word/fontTable.xml for the fonts `settings` name: Word does not embed them (nor does this file), so
 * each missing one carries its stand-in's name, PANOSE and family, and Word — and LibreOffice —
 * show it in Arial or Georgia rather than whatever default they reach for. A Packer override.
 */
export async function wordFontTable(settings) {
  const fonts = (await wordFontStandIns(settings)).map(({ font, standIn }) => {
    const like = standIn || STAND_INS[FONTS.find((f) => f.label === font)?.category] || STAND_INS['sans-serif'];
    return `<w:font w:name="${attr(font)}">${standIn ? `<w:altName w:val="${attr(standIn.name)}"/>` : ''}`
      + `<w:panose1 w:val="${like.panose}"/><w:charset w:val="00"/><w:family w:val="${like.family}"/><w:pitch w:val="variable"/></w:font>`;
  });
  return {
    path: 'word/fontTable.xml',
    data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + `<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${fonts.join('')}</w:fonts>`,
  };
}
