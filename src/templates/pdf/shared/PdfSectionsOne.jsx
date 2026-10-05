import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { printedEntries } from '@/utils/entryPrints';
import { skillCategory, skillGroup, skillGroupPrints, skillSeparator } from '@/utils/skills';
import { skillBarWidth } from '@/constants/skillLevels';
import { dateRange, endDateOf, presentLabel, startDateOf } from '@/utils/dates';
import { opacityFor, solid, tint } from './pdfColors';
import { tracking } from './pdfUnits';
import {
  SPACER,
  SectionTitleOf,
  RenderColGrid,
  ItemHeader,
  RenderBullets,
  shadesOf,
  entryTextWidth,
} from './PdfSections';
import { EmployerHeader, headPresence, itemHeadPresence } from './PdfItemHeader';
import { lineBox, textWidth, wrappedLines } from './pdfMeasure';
import { employerOf, groupPlaces, groupsRoles, roleGroups } from '@/utils/roleGroups';

export function ExperienceSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s = section.settings || {};
  const titleOrder = s.titleOrder || 'company';
  const showDates  = s.showDates  !== false;
  const showLoc    = s.showLocation !== false;
  const titleStyle = s.titleStyle || 'stacked';
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = printedEntries(section);
  const cols       = s.columns || 1;
  const accent     = settings?.accentColor || '#2563eb';
  const isModern   = settings?._template === 'modern';
  const body       = shadesOf(settings).body;
  // An entry's header fields, as ItemHeader prints them.
  const roleOf = (item) => ((item.hiddenFields || []).includes('role') ? '' : (item.role || ''));
  const head = (item) => {
    const iH  = item.hiddenFields || [];
    const company = iH.includes('company') ? '' : (item.company || '');
    const role    = roleOf(item);
    const loc  = !iH.includes('location') && showLoc ? (item.location || '') : '';
    const sd   = iH.includes('startDate') ? '' : item.startDate;
    const ed   = iH.includes('endDate')   ? '' : (item.current ? presentLabel(settings) : item.endDate);
    return {
      primary: titleOrder === 'role' ? role : company,
      sub: (titleOrder === 'role' ? company : role) || undefined,
      loc: loc || undefined,
      dateStr: showDates ? dateRange(sd, ed, settings) : '',
    };
  };
  // Section Options → "Group roles by company" (R2-147): consecutive roles at one employer print under
  // one employer header (roleGroups); a group is one entry of the section, in Grids one cell. Off, or a
  // job alone at its company, prints as it always has (`one`).
  const grouped = groupsRoles(s);
  const groups = grouped ? roleGroups(visibleItems) : null;
  // The title keeps the first entry's header and the lines it keeps with it (R2-047): a group's employer
  // line and its first role's, two lines as a Stacked header.
  const presence = !visibleItems.length ? 0
    : groups?.[0].length > 1 ? itemHeadPresence({ primary: employerOf(groups[0][0]), sub: roleOf(groups[0][0]) || undefined, settings, centered, width: entryTextWidth(settings, cols) })
    : itemHeadPresence({ ...head(visibleItems[0]), settings, titleStyle, centered, width: entryTextWidth(settings, cols) });
  const descOf = (item) => ((item.hiddenFields || []).includes('description') ? '' : item.description);
  const one = (item) => {
    const desc = descOf(item);
    return (
      <View>
        <ItemHeader
          {...head(item)}
          settings={settings}
          titleStyle={titleStyle}
          italicSub={italicSubs}
          centered={centered}
        />
        {hasRichText(desc) && (
          <PdfRichText html={desc} style={{ fontSize: entrySize, color: body, lineHeight: lineH, marginTop: 2, textAlign: centered ? 'center' : 'left' }} />
        )}
        <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize, color: body, lineHeight: lineH, textAlign: centered ? 'center' : 'left' }} accent={accent} isModern={isModern} template={settings?._template} />
      </View>
    );
  };
  // A group: the employer (and the first role's location) once, then each role — its title, whichever
  // Order is chosen (the employer leads a group: that is what it groups by), with its own dates, a
  // location only where it differs, and its description — half an item gap apart.
  const group = (g) => {
    const places = groupPlaces(g, (item) => head(item).loc);
    return (
      <View>
        <EmployerHeader
          company={employerOf(g[0])}
          loc={places.header || undefined}
          settings={settings}
          italicSub={italicSubs}
          centered={centered}
          keep={itemHeadPresence({ primary: roleOf(g[0]), loc: places.roles[0] || undefined, dateStr: head(g[0]).dateStr, settings, titleStyle, centered, width: entryTextWidth(settings, cols) })}
        />
        {g.map((item, k) => {
          const desc = descOf(item);
          return (
            <View key={k} style={k ? { marginTop: itemGap / 2 } : null}>
              {SPACER}
              <ItemHeader primary={roleOf(item)} loc={places.roles[k] || undefined} dateStr={head(item).dateStr} settings={settings} titleStyle={titleStyle} centered={centered} />
              {hasRichText(desc) && (
                <PdfRichText html={desc} style={{ fontSize: entrySize, color: body, lineHeight: lineH, marginTop: 2, textAlign: centered ? 'center' : 'left' }} />
              )}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize, color: body, lineHeight: lineH, textAlign: centered ? 'center' : 'left' }} accent={accent} isModern={isModern} template={settings?._template} />
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <RenderColGrid
        title={<SectionTitleOf section={section} settings={settings} centered={centered} presence={presence} />}
        settings={settings}
        items={groups || visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={groups ? (g) => (g.length > 1 ? group(g) : one(g[0])) : one}
      />
    </View>
  );
}

export function SkillsSection({ section, settings, marginBottom, spaceBefore, itemGap, centered }) {
  const s        = section.settings || {};
  const style    = s.skillsStyle || 'inline';
  const sep      = skillSeparator(s);
  const isBullet = style === 'bullet';
  const textColor = settings?.textColor  || '#1a1a1a';
  const accent    = settings?.accentColor || '#2563eb';
  const entrySize = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH     = settings?.lineHeightValue || 1.5;
  // A group that prints nothing takes no row (a lone Bullet marker) and no gap, as in Word (skillGroupPrints).
  const visibleItems = (section.items || []).filter(i => i.visible !== false && skillGroupPrints(i));
  const cols       = s.columns || 1;
  const isModern   = settings?._template === 'modern';
  const isMinimal  = settings?._template === 'minimal';
  const shade      = shadesOf(settings);
  // Inline and Bullet (and a style the app does not offer, printed as Inline) print each group as one
  // unbreakable row: the title keeps the first one, its line wrapped at the entry's width (less a
  // Bullet's marker), measured in the category's bolder face so it errs on more lines. With only its own three lines, a first group that wrapped onto four left the
  // title alone at the foot of a page while the group moved on (R5-HUNT4-PDF-SKILLS-TITLE-ORPHAN-LONG-INLINE-GROUP).
  const first      = visibleItems[0];
  const rowBox     = { fontFamily: settings?._pdfFontFamily, fontSize: entrySize, fontWeight: 'bold', lineHeight: entrySize * lineH };
  const rowLines   = (item) => {
    const { category, skills } = skillGroup(item);
    const marker = isBullet ? textWidth('•', rowBox) + 4 : 0;
    return Math.max(1, wrappedLines(`${category}${category && skills ? sep : ''}${skills}`, rowBox, entryTextWidth(settings, cols) - marker));
  };
  // Bars, Stacked and Tags print a group's category over its skills, and a group may split between them:
  // the category, unbreakable, keeps three lines of what follows it on its page (a skills text that short
  // cannot split under react-pdf's orphans and widows of two; the keep ends with the group), so it moves
  // to the next page with its skills instead of ending a page alone (R5-HUNT8-SKILLS-STACKED-TAGS-CATEGORY-ORPHAN).
  // entry() leads the group with SPACER, the previous sibling minPresenceAhead needs.
  const categoryKeep = { wrap: false, minPresenceAhead: Math.ceil(entrySize * lineH * 3) };
  // The title keeps that first category and what the category keeps: with only its own three lines, a
  // category that moved to the next page with its skills left the title alone at the foot of the page
  // (R5-HUNT10-SKILLS-TITLE-ORPHANED-BY-CATEGORY-KEEP). The category measured in both its own face's line and
  // the page's (the Sidebar's main column sets one), so it errs on more; its skills: Bars' rows (a label
  // 70 pt wide, over a 3 pt margin), Stacked's text, Tags' chips at the whole keep (their rows are not measured).
  const catBox     = { fontFamily: settings?._pdfFontFamily, fontSize: entrySize, fontWeight: 'bold' };
  const catBoxes   = [catBox, { ...catBox, lineHeight: entrySize * lineH }];
  const width      = entryTextWidth(settings, cols);
  const categoryPresence = (item) => {
    const { category, skills, list } = skillGroup(item);
    if (!category) return 0;
    const shown = style === 'stacked' ? category : skillCategory(category, { style });
    const lines = Math.max(1, wrappedLines(shown, style === 'stacked' ? catBox : { ...catBox, letterSpacing: tracking(entrySize, 0.5) }, width));
    const rowBoxes = [{ ...catBox, fontSize: entrySize - 1, fontWeight: undefined }, { ...catBox, fontSize: entrySize - 1, fontWeight: undefined, lineHeight: (entrySize - 1) * lineH }];
    const under = style === 'bars' ? list.reduce((pt, sk) => pt + 3 + Math.max(1, wrappedLines(sk, rowBoxes[0], 70)) * lineBox(rowBoxes).height, 0)
      : style === 'stacked' ? wrappedLines(skills, { ...catBox, fontWeight: undefined }, width) * entrySize * lineH
      : list.length ? categoryKeep.minPresenceAhead : 0;
    return headPresence({ lines, styles: catBoxes, keep: Math.min(categoryKeep.minPresenceAhead, under), extra: style === 'stacked' ? 4.5 : style === 'tags' ? 4 : 0 });
  };
  const presence   = !first ? 0
    : ['bars', 'stacked', 'tags'].includes(style) ? Math.max(0, ...visibleItems.slice(0, cols).map(categoryPresence))
    : headPresence({ lines: rowLines(first), styles: [rowBox] });
  // Printed by the grid, with its first row (RenderColGrid).
  const title      = <SectionTitleOf section={section} settings={settings} centered={centered} presence={presence} />;

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      {style === 'bars' ? (
        <RenderColGrid
          title={title}
          settings={settings}
          items={visibleItems}
          cols={cols}
          gap={itemGap}
          renderItem={(item) => {
            const { category, list, levels } = skillGroup(item);
            return (
              <View>
                {category ? (
                  <View {...categoryKeep}>
                    <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: accent, letterSpacing: tracking(entrySize, 0.5) }}>{skillCategory(category, { style })}</Text>
                  </View>
                ) : null}
                {list.map((sk, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={{ fontSize: entrySize - 1, width: 70, color: textColor, opacity: opacityFor(textColor, 0.8) }}>{sk}</Text>
                    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: tint(accent, 0x20 / 255) }}>
                      <View style={{ width: skillBarWidth(levels[i]), height: 3, borderRadius: 2, backgroundColor: tint(accent, 0xb3 / 255) }} />
                    </View>
                  </View>
                ))}
              </View>
            );
          }}
        />
      ) : style === 'stacked' ? (
        <RenderColGrid
          title={title}
          settings={settings}
          items={visibleItems}
          cols={cols}
          gap={itemGap}
          renderItem={(item) => {
            const { category, skills } = skillGroup(item);
            return (
              <View>
                {category ? (
                  <View {...categoryKeep} style={{ marginBottom: 2 }}>
                    <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: isModern ? accent : textColor, textAlign: centered ? 'center' : 'left' }}>{category}</Text>
                    <View style={{ height: 0.5, backgroundColor: '#e5e7eb', marginTop: 1, marginBottom: 1 }} />
                  </View>
                ) : null}
                {skills ? <Text style={{ fontSize: entrySize, color: shade.sub, lineHeight: lineH, textAlign: centered ? 'center' : 'left' }}>{skills}</Text> : null}
              </View>
            );
          }}
        />
      ) : style === 'tags' ? (
        <RenderColGrid
          title={title}
          settings={settings}
          items={visibleItems}
          cols={cols}
          gap={itemGap}
          renderItem={(item) => {
            const { category, list: tags } = skillGroup(item);
            return (
              <View style={{ alignItems: centered ? 'center' : 'flex-start' }}>
                {category ? (
                  <View {...categoryKeep} style={{ alignSelf: 'stretch' }}>
                    <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: accent, marginBottom: 4, letterSpacing: tracking(entrySize, 0.5), textAlign: centered ? 'center' : 'left' }}>
                      {skillCategory(category, { style })}
                    </Text>
                  </View>
                ) : null}
                {tags.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: centered ? 'center' : 'flex-start' }}>
                    {tags.map((tag, ti) => (
                      <View key={ti} style={isMinimal ? {
                        backgroundColor: '#f3f4f6',
                        borderRadius: 3,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                      } : {
                        backgroundColor: tint(accent, (isModern ? 0x10 : 0x15) / 255),
                        borderRadius: 3,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderWidth: 1,
                        borderColor: solid(accent, 0x30 / 255),
                      }}>
                        <Text style={{ fontSize: entrySize - 0.5, color: isMinimal ? shade.sub : accent }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      ) : (
        // inline or bullet — respects cols setting via RenderColGrid
        <RenderColGrid
          title={title}
          settings={settings}
          items={visibleItems}
          cols={cols}
          gap={itemGap}
          renderItem={(item) => {
            const { category, skills } = skillGroup(item);
            return (
              <View style={{ flexDirection: 'row', justifyContent: centered ? 'center' : 'flex-start' }} wrap={false}>
                {isBullet && <Text style={{ color: shade.meta, fontSize: entrySize, marginRight: 4 }}>•</Text>}
                <Text style={{ fontSize: entrySize, lineHeight: lineH, textAlign: centered ? 'center' : 'left' }}>
                  {category
                    ? <Text style={{ fontWeight: 'bold', color: isModern ? accent : textColor }}>{`${category}${skills ? sep : ''}`}</Text>
                    : null}
                  {skills ? <Text style={{ color: shade.sub }}>{skills}</Text> : null}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

export function EducationSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s        = section.settings || {};
  const showDates = s.showDates    !== false;
  const showLoc   = s.showLocation !== false;
  const titleStyle = s.titleStyle || 'stacked';
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = printedEntries(section);
  const cols       = s.columns || 1;
  const accent     = settings?.accentColor || '#2563eb';
  const isModern   = settings?._template === 'modern';
  const body       = shadesOf(settings).body;
  // An entry's header fields, as ItemHeader prints them.
  const head = (item) => {
    const degree  = [item.degree, item.fieldOfStudy ? item.fieldOfStudy : ''].filter(Boolean).join(', ');
    // Word's rule (R4-DOUT-01): without a school the degree leads and the GPA stays on the sub line;
    // joined, not appended, so a GPA without a degree prints no leading separator.
    const sub     = [item.institution ? degree : '', item.gpa ? `GPA: ${item.gpa}` : ''].filter(Boolean).join(' · ');
    return {
      primary: item.institution || degree,
      sub: sub || undefined,
      loc: (showLoc && item.location ? item.location : '') || undefined,
      dateStr: showDates ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '',
    };
  };
  // The title keeps the first entry's header and the lines it keeps with it (R2-047).
  const presence = visibleItems.length ? itemHeadPresence({ ...head(visibleItems[0]), settings, titleStyle, centered, width: entryTextWidth(settings, cols) }) : 0;

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <RenderColGrid
        title={<SectionTitleOf section={section} settings={settings} centered={centered} presence={presence} />}
        settings={settings}
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          return (
            <View>
              <ItemHeader
                {...head(item)}
                settings={settings}
                titleStyle={titleStyle}
                italicSub={italicSubs}
                centered={centered}
              />
              {hasRichText(item.description) && (
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: body, lineHeight: lineH, marginTop: 2, textAlign: centered ? 'center' : 'left' }} />
              )}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: body, lineHeight: lineH, textAlign: centered ? 'center' : 'left' }} accent={accent} isModern={isModern} template={settings?._template} />
            </View>
          );
        }}
      />
    </View>
  );
}
