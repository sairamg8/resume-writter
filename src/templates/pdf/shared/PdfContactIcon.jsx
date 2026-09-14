import { Image } from '@react-pdf/renderer';
import { PdfIcon } from './PdfIcons';
import { getCustomContactIcon, getIconSetId } from '@/utils/contactIconPaths';

/** PDF contact icon — the image uploaded for this field wins, else the chosen pack's icon. */
export function PdfContactIcon({ field, settings, size = 9, color = '#555555' }) {
  const custom = getCustomContactIcon(field, settings);
  if (custom) {
    return (
      <Image
        src={custom}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  return <PdfIcon setId={getIconSetId(settings)} field={field} size={size} color={color} />;
}
