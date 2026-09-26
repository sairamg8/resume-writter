/**
 * Contact icons for @react-pdf, drawn from the same table as the editor's (contactIconPaths.js),
 * so every pack the Design panel offers prints as itself.
 */
import { Svg, Path, Circle, Rect, View } from '@react-pdf/renderer';
import { iconShapes } from '@/utils/contactIconPaths';
import { SECTION_ICON_GAP_EM, sectionIconShapes } from '@/utils/sectionIconPaths';

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

/**
 * A section title's icon (Design → Section Headings → Icons, R2-147): `type`'s (sectionIconPaths.js),
 * `size` pt square — the title's font size — in `color`, the title's.
 */
export function PdfSectionIcon({ type, size = 11, color = '#374151' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {sectionIconShapes(type, color).map(({ tag, props }, i) => {
        const Shape = SHAPES[tag];
        return <Shape key={i} {...props} />;
      })}
    </Svg>
  );
}

/**
 * The icon a section title prints before its words (R2-147), or null for none: `type`'s icon
 * (PdfSectionIcon) at the title's `size` and `color`, the gap after it (SECTION_ICON_GAP_EM; `gap`
 * false: none, in a row whose own `gap` spaces its children).
 * `lineHeight` given, it sits at the middle of the title's first line — for a title in a column,
 * which may wrap; without, its row centres it (the title's row is `alignItems: 'center'`).
 */
export function sectionIconMark({ type, size, color, lineHeight = null, gap = true }) {
  if (!type) return null;
  const style = { marginRight: gap ? size * SECTION_ICON_GAP_EM : 0, ...(lineHeight == null ? {} : { marginTop: (size * (lineHeight - 1)) / 2 }) };
  return (
    <View style={style}>
      <PdfSectionIcon type={type} size={size} color={color} />
    </View>
  );
}

