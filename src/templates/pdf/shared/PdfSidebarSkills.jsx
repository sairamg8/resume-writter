import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { hexAlpha } from './PdfSections';
import { SideSectionTitle } from './PdfSidebarColumn';
import { tracking } from './pdfUnits';
import { sidebarShades } from './pdfColors';
import { skillGroup, skillSeparator } from '@/utils/skills';

/** A group as printed (skillGroup), its category in the column's capitals. */
function shownGroup(item) {
  const group = skillGroup(item);
  return { ...group, category: group.category.toUpperCase() };
}

export function SideSkills({ section, sectionGap, itemGap, accent, shades = sidebarShades(), titleCase }) {
  const s     = section.settings || {};
  const style = s.skillsStyle || 'inline';
  const sep   = skillSeparator(s); // as in the main column and Word
  const groups = (section.items || []).filter(i => i.visible !== false).map(shownGroup);

  if (style === 'bars') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list }, i) => (
            <View key={i}>
              {category ? (
                <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.meta, letterSpacing: tracking(8.5, 0.5), marginBottom: 2, lineHeight: 1.2 }}>
                  {category}
                </Text>
              ) : null}
              {list.map((sk, index) => (
                <View key={index} style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 8.5, color: shades.value, marginBottom: 1, lineHeight: 1.2 }}>{sk}</Text>
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: shades.fill }}>
                    <View style={{ width: '80%', height: 3, borderRadius: 2, backgroundColor: hexAlpha(accent, 0.5) }} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (style === 'tags') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list }, i) => (
            <View key={i}>
              {category ? (
                <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.meta, letterSpacing: tracking(8.5, 0.5), marginBottom: 2, lineHeight: 1.2 }}>
                  {category}
                </Text>
              ) : null}
              {list.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2.5 }}>
                  {list.map((tag, ti) => (
                    <View key={ti} style={{ backgroundColor: shades.fill, borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1.5 }}>
                      <Text style={{ fontSize: 8.5, color: shades.chip, lineHeight: 1.2 }}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (style === 'stacked') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list }, i) => (
            <View key={i}>
              {category ? (
                <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.meta, marginBottom: 2, lineHeight: 1.2 }}>{category}</Text>
              ) : null}
              {list.map((sk, index) => (
                <Text key={index} style={{ fontSize: 8.5, color: shades.value, lineHeight: 1.4, marginBottom: 1 }}>{'• '}{sk}</Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Inline: "CATEGORY: skills" per group; Bullet: the same line behind a marker, wrapped lines
  // hanging clear of it (FIDB-75). The separator (colon or dash) comes only with skills.
  const bullet = style === 'bullet';
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
      <View style={{ gap: itemGap }}>
        {groups.map(({ category, skills }, i) => (
          <View key={i} style={bullet ? { flexDirection: 'row' } : undefined}>
            {bullet ? <Text style={{ fontSize: 9, lineHeight: 1.2, color: shades.label, width: 8 }}>•</Text> : null}
            <Text style={{ fontSize: 9, lineHeight: 1.2, flex: bullet ? 1 : undefined }}>
              {category ? <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.meta }}>{category}{skills ? sep : ''}</Text> : null}
              {skills ? <Text style={{ color: shades.value }}>{skills}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
