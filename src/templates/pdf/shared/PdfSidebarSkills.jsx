import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { hexAlpha } from './PdfSections';
import { SideSectionTitle, sideBreaks } from './PdfSidebarColumn';
import { tracking } from './pdfUnits';
import { sidebarShades } from './pdfColors';
import { skillCategory, skillGroup, skillSeparator } from '@/utils/skills';

/** A group as printed (skillGroup), its category in the column's capitals (skillCategory). */
function shownGroup(item) {
  const group = skillGroup(item);
  return { ...group, category: skillCategory(group.category, { sideColumn: true }) };
}

export function SideSkills({ section, sectionGap, itemGap, accent, shades = sidebarShades(), titleCase, settings }) {
  const s     = section.settings || {};
  const style = s.skillsStyle || 'inline';
  const sep   = skillSeparator(s); // as in the main column and Word
  const groups = (section.items || []).filter(i => i.visible !== false).map(shownGroup);
  const catBreaks = sideBreaks(settings, { fontSize: 8.5, fontWeight: 'bold' });
  // Bars' and Tags' categories are letter-spaced: measured so, a word that fits unspaced still breaks.
  const trackedCat = { fontSize: 8.5, fontWeight: 'bold', letterSpacing: tracking(8.5, 0.5) };
  const trackedCatBreaks = sideBreaks(settings, trackedCat);
  const valBreaks = sideBreaks(settings, { fontSize: 8.5 });
  const inlineBreaks = (inset = 0) => {
    const cb = sideBreaks(settings, { fontSize: 9 }, inset);
    const catCb = sideBreaks(settings, { fontSize: 8.5, fontWeight: 'bold' }, inset);
    return (word) => {
      const p = catCb(word);
      return p.length > 1 ? p : cb(word);
    };
  };

  if (style === 'bars') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list }, i) => (
            <View key={i}>
              {category ? (
                <Text style={{ ...trackedCat, color: shades.meta, marginBottom: 2, lineHeight: 1.2 }} hyphenationCallback={trackedCatBreaks}>
                  {category}
                </Text>
              ) : null}
              {list.map((sk, index) => (
                <View key={index} style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 8.5, color: shades.value, marginBottom: 1, lineHeight: 1.2 }} hyphenationCallback={valBreaks}>{sk}</Text>
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
        <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list }, i) => (
            <View key={i}>
              {category ? (
                <Text style={{ ...trackedCat, color: shades.meta, marginBottom: 2, lineHeight: 1.2 }} hyphenationCallback={trackedCatBreaks}>
                  {category}
                </Text>
              ) : null}
              {list.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2.5 }}>
                  {list.map((tag, ti) => (
                    <View key={ti} style={{ backgroundColor: shades.fill, borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1.5 }}>
                      <Text style={{ fontSize: 8.5, color: shades.chip, lineHeight: 1.2 }} hyphenationCallback={sideBreaks(settings, { fontSize: 8.5 }, 10)}>{tag}</Text>
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
        <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list }, i) => (
            <View key={i}>
              {category ? (
                <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.meta, marginBottom: 2, lineHeight: 1.2 }} hyphenationCallback={catBreaks}>{category}</Text>
              ) : null}
              {list.map((sk, index) => (
                <Text key={index} style={{ fontSize: 8.5, color: shades.value, lineHeight: 1.4, marginBottom: 1 }} hyphenationCallback={valBreaks}>{'• '}{sk}</Text>
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
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} />
      <View style={{ gap: itemGap }}>
        {groups.map(({ category, skills }, i) => (
          <View key={i} style={bullet ? { flexDirection: 'row' } : undefined}>
            {bullet ? <Text style={{ fontSize: 9, lineHeight: 1.2, color: shades.label, width: 8 }}>•</Text> : null}
            <Text
              style={{ fontSize: 9, lineHeight: 1.2, flex: bullet ? 1 : undefined }}
              hyphenationCallback={inlineBreaks(bullet ? 8 : 0)}
            >
              {category ? <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.meta }}>{`${category}${skills ? sep : ''}`}</Text> : null}
              {skills ? <Text style={{ color: shades.value }}>{skills}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
