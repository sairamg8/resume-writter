import { View, Image } from '@react-pdf/renderer';

/**
 * The profile photo, with its ring. `style` comes from getPdfPhotoStyle (plus any layout
 * extras, e.g. a margin).
 *
 * react-pdf paints an Image's own border first and then the picture over the whole box,
 * border included, so a border on the Image never shows. The ring is a View's border here,
 * and the picture sits inside it with its own, smaller corner radius.
 */
export function PdfPhoto({ src, style }) {
  const { width, height, borderRadius = 0, borderWidth: ring = 0, borderColor, objectFit = 'cover', ...layout } = style;
  if (!ring) return <Image src={src} style={{ ...layout, width, height, borderRadius, objectFit }} />;
  return (
    <View style={{ ...layout, width, height, borderRadius, borderWidth: ring, borderColor, flexShrink: 0 }}>
      <Image
        src={src}
        style={{ width: width - 2 * ring, height: height - 2 * ring, borderRadius: Math.max(0, borderRadius - ring), objectFit }}
      />
    </View>
  );
}
