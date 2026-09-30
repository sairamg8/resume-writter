/**
 * True when a field's icon (getCustomContactIcon) is an image to draw — a data URL or a web
 * address — rather than a picker choice drawn from the shapes ('icon:<id>', 'pack:<id>'). The
 * editor, the PDF and its image copies (withPrintablePhotos) all ask this, so a picked icon cannot
 * be taken for an image address in one and not the other. Kept apart from contactIconPaths.js (its
 * shape registry) so the start-up path, which loads printableImage.js, does not carry the shapes.
 */
export function isContactIconImage(src) {
  return typeof src === 'string' && /^(data:image\/|https?:\/\/)/.test(src);
}
