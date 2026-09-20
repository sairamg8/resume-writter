/**
 * Contact icons in the editor (Design panel previews, Personal info fields).
 * settings.iconSet: 'filled' | 'lucide' | 'refined' | 'minimal' | 'bold'
 * settings.customContactIcons: optional per-field image overrides (data URLs)
 * The shapes come from contactIconPaths.js — the table the PDF draws from too.
 */
import { getCustomContactIcon, getIconSetId, iconShapes } from '@/utils/contactIconPaths';
import { isDrawableImage } from '@/utils/imageUpload';
import { usePrintableImage } from '@/hooks/usePrintableImage';

export { getCustomContactIcon, getIconSetId };

/** Global icon style options shown in Design panel */
export const ICON_SET_OPTIONS = [
  { id: 'filled',  label: 'Filled',   desc: 'Solid marks · premium ATS look' },
  { id: 'lucide',  label: 'Classic',  desc: 'Standard outline icons' },
  { id: 'refined', label: 'Modern',   desc: 'Smartphone & refined marks' },
  { id: 'minimal', label: 'Minimal',  desc: 'Simple geometric icons' },
  { id: 'bold',    label: 'Bold',     desc: 'Classic shapes, thicker lines' },
];

/**
 * Editor contact icon — custom image wins, else the pack's icon (stroke width: the pack's own
 * unless given). Like the PDF (PdfContactIcon), an upload the PDF cannot draw shows the pack's.
 */
export function ContactIcon({ field, settings, size = 11, strokeWidth, className = '', style }) {
  const custom = getCustomContactIcon(field, settings);
  const isImage = typeof custom === 'string' && (custom.startsWith('data:image/') || custom.startsWith('http://') || custom.startsWith('https://'));
  if (isImage) {
    const printable = usePrintableImage(custom, { kind: 'icon' });
    const src = isDrawableImage(printable) ? printable : (isDrawableImage(custom) ? custom : null);
    if (src) {
      return (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className={className}
          style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, ...style }}
          draggable={false}
        />
      );
    }
  }
  const shapes = iconShapes(getIconSetId(settings), field, { color: 'currentColor', strokeWidth, custom });
  if (!shapes) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      {shapes.map(({ tag: Shape, props }, i) => <Shape key={i} {...props} />)}
    </svg>
  );
}
