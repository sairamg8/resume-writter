import { View, Image } from '@react-pdf/renderer';
import { isDrawableImage } from '@/utils/imageUpload';

/**
 * The profile photo, with its ring. `style` comes from getPdfPhotoStyle (plus any layout
 * extras, e.g. a margin).
 *
 * react-pdf paints an Image's own border first and then the picture over the whole box,
 * border included, so a border on the Image never shows. The ring is a View's border here,
 * and the picture sits inside it with its own, smaller corner radius.
 *
 * Nothing at all for a photo react-pdf cannot decode (a WebP or GIF saved before uploads were
 * converted): an empty ring, or an error on every render, is worse than no photo.
 */
export function PdfPhoto({ src, style }) {
  if (!isDrawableImage(src)) return null;
  const { width, height, borderRadius = 0, borderWidth: ring = 0, borderColor, objectFit = 'cover', ...layout } = style;
  // minWidth/minHeight keep the box its size in a crowded row: react-pdf 4 reads flexShrink 0
  // as 1, so the old flexShrink: 0 let a long name squeeze the photo (R3-4).
  const keep = { minWidth: width, minHeight: height };
  if (!ring) return <Image src={src} style={{ ...layout, width, height, ...keep, borderRadius, objectFit }} />;
  return (
    <View style={{ ...layout, width, height, ...keep, borderRadius, borderWidth: ring, borderColor }}>
      <Image
        src={src}
        style={{ width: width - 2 * ring, height: height - 2 * ring, borderRadius: Math.max(0, borderRadius - ring), objectFit }}
      />
    </View>
  );
}
