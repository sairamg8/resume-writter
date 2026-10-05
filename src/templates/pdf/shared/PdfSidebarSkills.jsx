import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { SPACER, hexAlpha } from './PdfSections';
import { SideSectionTitle, sideBreaks, sideColumnRoom } from './PdfSidebarColumn';
import { wrappedLines } from './pdfMeasure';
import { tracking } from './pdfUnits';
import { sidebarShades } from './pdfColors';
import { skillCategory, skillGroup, skillGroupPrints, skillSeparator } from '@/utils/skills';
import { skillBarWidth } from '@/constants/skillLevels';

/**
 * Bars, Tags and Stacked print a group's category over its skills, and a group may split between them:
 * the category, unbreakable, keeps about two of the column's skill lines (a bar, a row of chips, a
 * "• " line: 13-15 pt each) on its page, so it moves to the next page with them instead of ending a
 * page alone; the keep ends with the group. SPACER, first in the group, gives it the previous sibling
 * minPresenceAhead needs (R5-HUNT8-SKILLS-STACKED-TAGS-CATEGORY-ORPHAN).
 */
const categoryKeep = { wrap: false, minPresenceAhead: 30 };

/**
 * What the column's title keeps under it for a first group of Bars, Tags or Stacked (SideSectionTitle's
 * `presence`, pt): the group's category, 1.2 of 8.5 pt a line in the lines it fills and its 2 pt margin,
 * the part of its keep its skills fill — Bars' bars (a label over a 3 pt bar, 4 pt apart), Stacked's
 * "• " lines, Tags' chips at the whole keep (their rows are not measured) — and a line to spare; never less than
 * the title's own three lines.
 * With the title's own three lines, a category that moved to the next page with its skills left the
 * title alone at the foot of the page (R5-HUNT10-SKILLS-TITLE-ORPHANED-BY-CATEGORY-KEEP). Undefined (the
 * title's three lines) for a first group with no category, which keeps nothing.
 */
function categoryPresence(settings, style, group, catFont) {
  if (!group?.category) return undefined;
  const room = sideColumnRoom(settings);
  const font = (f) => ({ fontFamily: settings?._pdfFontFamily, ...f });
  const lines = (text, f) => Math.max(1, wrappedLines(text, font(f), room));
  const valLine = 8.5 * 1.2;
  const under = style === 'bars' ? group.list.reduce((pt, sk, i) => pt + (i ? 4 : 0) + lines(sk, { fontSize: 8.5 }) * valLine + 1 + 3, 0)
    : style === 'stacked' ? group.list.reduce((pt, sk) => pt + lines(`• ${sk}`, { fontSize: 8.5 }) * 8.5 * 1.4 + 1, 0)
    : group.list.length ? categoryKeep.minPresenceAhead : 0;
  return Math.ceil(Math.max(3 * 9 * 1.2, lines(group.category, catFont) * 8.5 * 1.2 + 2 + Math.min(categoryKeep.minPresenceAhead, under) + 9 * 1.2));
}

/** A group as printed (skillGroup), its category in the column's capitals (skillCategory). */
function shownGroup(item) {
  const group = skillGroup(item);
  return { ...group, category: skillCategory(group.category, { sideColumn: true }) };
}

export function SideSkills({ section, sectionGap, itemGap, accent, shades = sidebarShades(), titleCase, settings }) {
  const s     = section.settings || {};
  const style = s.skillsStyle || 'inline';
  const sep   = skillSeparator(s); // as in the main column and Word
  // A group that prints nothing takes no row, marker or gap, as in Word (skillGroupPrints).
  const groups = (section.items || []).filter(i => i.visible !== false && skillGroupPrints(i)).map(shownGroup);
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
        <SideSectionTitle title={section.title} type={section.type} shades={shades} titleCase={titleCase} settings={settings} presence={categoryPresence(settings, style, groups[0], trackedCat)} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list, levels }, i) => (
            <View key={i}>
              {SPACER}
              {category ? (
                <View {...categoryKeep}>
                  <Text style={{ ...trackedCat, color: shades.meta, marginBottom: 2, lineHeight: 1.2 }} hyphenationCallback={trackedCatBreaks}>
                    {category}
                  </Text>
                </View>
              ) : null}
              {/* 4 pt between a group's bars, none after the last: groups are apart by the item gap
                  alone and the section ends at its last bar, as the column's other sections do (R4-DOUT-16). */}
              {list.map((sk, index) => (
                <View key={index} style={{ marginTop: index ? 4 : 0 }}>
                  <Text style={{ fontSize: 8.5, color: shades.value, marginBottom: 1, lineHeight: 1.2 }} hyphenationCallback={valBreaks}>{sk}</Text>
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: shades.fill }}>
                    <View style={{ width: skillBarWidth(levels[index]), height: 3, borderRadius: 2, backgroundColor: hexAlpha(accent, 0.5) }} />
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
        <SideSectionTitle title={section.title} type={section.type} shades={shades} titleCase={titleCase} settings={settings} presence={categoryPresence(settings, style, groups[0], trackedCat)} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list }, i) => (
            <View key={i}>
              {SPACER}
              {category ? (
                <View {...categoryKeep}>
                  <Text style={{ ...trackedCat, color: shades.meta, marginBottom: 2, lineHeight: 1.2 }} hyphenationCallback={trackedCatBreaks}>
                    {category}
                  </Text>
                </View>
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
        <SideSectionTitle title={section.title} type={section.type} shades={shades} titleCase={titleCase} settings={settings} presence={categoryPresence(settings, style, groups[0], { fontSize: 8.5, fontWeight: 'bold' })} />
        <View style={{ gap: itemGap }}>
          {groups.map(({ category, list }, i) => (
            <View key={i}>
              {SPACER}
              {category ? (
                <View {...categoryKeep}>
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.meta, marginBottom: 2, lineHeight: 1.2 }} hyphenationCallback={catBreaks}>{category}</Text>
                </View>
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
  // hanging clear of it (FIDB-75). The separator (colon, dash or pipe) comes only with skills.
  const bullet = style === 'bullet';
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} type={section.type} shades={shades} titleCase={titleCase} settings={settings} />
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
