import { FONTS } from '@/utils/fonts';

/**
 * Whether the last PDF was built without the chosen font (R2-146). A font from Fontsource that
 * cannot be loaded — offline, or the CDN blocked — is replaced by the bundled Noto Sans rather than
 * failing the PDF (pdfFontLoader.js resolvePdfFonts); this is how the editor learns of it and says
 * so. The preview and Export PDF share resolvePdfFonts, so what the notice says is what downloads.
 * Free of react-pdf, so the editor reads it without loading the PDF engine.
 */

let current = null; // the chosen font's name while the PDF prints in Noto Sans in its place
const listeners = new Set();

/** The name of the font the PDF could not load, or null when it prints in the chosen font. */
export const fontFallback = () => current;

/** Record the last build: `font` it could not load, or null. Tells every subscriber of a change. */
export function setFontFallback(font) {
  const next = font || null;
  if (next === current) return;
  current = next;
  listeners.forEach((fn) => fn());
}

/** Call `fn` whenever the fallback changes; returns the unsubscribe (useSyncExternalStore's shape). */
export function subscribeFontFallback(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let borrowing = false;

/**
 * Whether a face of a loaded font failed and prints with another face's data for now (a bold that
 * failed prints as the regular; pdfFontLoader.js prepareFonts fetches it again): the preview builds
 * again when the browser is back online (R4-LO-17). Nothing is shown for it.
 */
export const facesBorrowed = () => borrowing;

/** Record whether the last fonts prepared left a face borrowing another's data. */
export function setFacesBorrowed(value) {
  borrowing = Boolean(value);
}

/**
 * The name the editor shows for the font `settings` choose from the web: the custom font as typed,
 * or the picker's label ("Georgia", printed in Gelasio). Null for Noto Sans, or an id the picker
 * does not know — those print in the bundled Noto Sans by design, and nothing is missing.
 */
export function chosenWebFont(settings) {
  const custom = String(settings?.customFont || '').trim();
  if (custom) return custom;
  const font = FONTS.find((f) => f.id === settings?.font);
  return font && font.id !== 'notosans' ? font.label : null;
}

/** What the editor says while `font` could not be loaded. */
export function fontFallbackMessage(font, online = true) {
  return online
    ? `${font} could not be loaded — the PDF uses Noto Sans in its place.`
    : `${font} could not be loaded — the PDF uses Noto Sans until you are back online.`;
}
