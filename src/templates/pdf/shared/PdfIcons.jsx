/**
 * Contact icons for @react-pdf, drawn from the same table as the editor's (contactIconPaths.js),
 * so every pack the Design panel offers prints as itself.
 */
import { Svg, Path, Circle, Rect } from '@react-pdf/renderer';
import { iconShapes } from '@/utils/contactIconPaths';

const SHAPES = { path: Path, rect: Rect, circle: Circle };

/** Icon `field` of pack `setId`, `size` pt square, in `color`; null for an unknown pack or field. Supports custom vector icon. */
export function PdfIcon({ custom, setId, field, size = 9, color = '#555555' }) {
  const shapes = iconShapes(setId, field, { color, custom });
  if (!shapes) return null;
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {shapes.map(({ tag, props }, i) => {
        const Shape = SHAPES[tag];
        return <Shape key={i} {...props} />;
      })}
    </Svg>
  );
}

