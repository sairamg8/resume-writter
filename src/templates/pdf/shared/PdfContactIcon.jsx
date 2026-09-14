import { Image } from '@react-pdf/renderer';
import { PdfIcon } from './PdfIcons';
import { getCustomContactIcon, getIconSetId } from '@/utils/contactIconPaths';
import { isDrawableImage } from '@/utils/imageUpload';

/**
 * PDF contact icon — the image uploaded for this field wins, else the chosen pack's icon. An
 * upload react-pdf cannot decode (a WebP saved before uploads were converted) gets the pack's
 * icon too, rather than an empty slot.
 */
export function PdfContactIcon({ field, settings, size = 9, color = '#555555' }) {
  const custom = getCustomContactIcon(field, settings);
  if (isDrawableImage(custom)) {
    return (
      <Image
        src={custom}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  return <PdfIcon setId={getIconSetId(settings)} field={field} size={size} color={color} />;
}
