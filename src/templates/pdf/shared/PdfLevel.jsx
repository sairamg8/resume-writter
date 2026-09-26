import { View } from '@react-pdf/renderer';
import { LEVEL_STEPS } from '@/utils/languageLevel';

/**
 * A language's level drawn (Section Options → Level, R2-147): Dots — LEVEL_STEPS small circles, the
 * level's filled in `fill`, the rest in `track` — or Bar — a track filled to level / LEVEL_STEPS. Only
 * shapes: the proficiency's word prints beside it (the renderers), so no text is added or replaced and
 * the text a parser reads is the Text style's. `size`: a dot's diameter, pt; the bar is as tall as a dot
 * is wide over two, and as long as the five dots.
 */
export function PdfLevel({ level, style, size, fill, track }) {
  const gap = size * 0.4;
  const length = LEVEL_STEPS * size + (LEVEL_STEPS - 1) * gap;
  if (style === 'bar') {
    const h = Math.max(2.5, size / 2);
    return (
      <View style={{ width: length, height: h, borderRadius: h / 2, backgroundColor: track }}>
        <View style={{ width: length * (level / LEVEL_STEPS), height: h, borderRadius: h / 2, backgroundColor: fill }} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {Array.from({ length: LEVEL_STEPS }, (_, i) => (
        <View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: i < level ? fill : track }} />
      ))}
    </View>
  );
}
