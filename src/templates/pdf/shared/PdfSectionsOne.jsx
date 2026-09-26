import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { skillCategory, skillGroup, skillSeparator } from '@/utils/skills';
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
} from './PdfSections';
import { EmployerHeader, itemHeadPresence } from './PdfItemHeader';
import { employerOf, groupPlaces, groupsRoles, roleGroups } from '@/utils/roleGroups';

export function ExperienceSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s = section.settings || {};
  const titleOrder = s.titleOrder || 'company';
  const showDates  = s.showDates  !== false;
  const showLoc    = s.showLocation !== false;
  const titleStyle = s.titleStyle || 'stacked';
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
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
    : groups?.[0].length > 1 ? itemHeadPresence({ primary: employerOf(groups[0][0]), sub: roleOf(groups[0][0]) || undefined, settings, centered })
    : itemHeadPresence({ ...head(visibleItems[0]), settings, titleStyle, centered });
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
          keep={itemHeadPresence({ primary: roleOf(g[0]), loc: places.roles[0] || undefined, settings, titleStyle, centered })}
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
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const isModern   = settings?._template === 'modern';
  const isMinimal  = settings?._template === 'minimal';
  const shade      = shadesOf(settings);
  // Printed by the grid, with its first row (RenderColGrid).
  const title      = <SectionTitleOf section={section} settings={settings} centered={centered} />;

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
            const { category, list } = skillGroup(item);
            return (
              <View>
                {category ? (
                  <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: accent, letterSpacing: tracking(entrySize, 0.5) }}>{skillCategory(category, { style })}</Text>
                ) : null}
                {list.map((sk, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={{ fontSize: entrySize - 1, width: 70, color: textColor, opacity: opacityFor(textColor, 0.8) }}>{sk}</Text>
                    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: tint(accent, 0x20 / 255) }}>
                      <View style={{ width: '80%', height: 3, borderRadius: 2, backgroundColor: tint(accent, 0xb3 / 255) }} />
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
                  <View style={{ marginBottom: 2 }}>
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
                  <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: accent, marginBottom: 4, letterSpacing: tracking(entrySize, 0.5), textAlign: centered ? 'center' : 'left' }}>
                    {skillCategory(category, { style })}
                  </Text>
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
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const accent     = settings?.accentColor || '#2563eb';
  const isModern   = settings?._template === 'modern';
  const body       = shadesOf(settings).body;
  // An entry's header fields, as ItemHeader prints them.
  const head = (item) => {
    const degree  = [item.degree, item.fieldOfStudy ? item.fieldOfStudy : ''].filter(Boolean).join(', ');
    // Joined, not appended, so a GPA without a degree prints no leading separator (R4-DOUT-01).
    const sub     = [degree, item.gpa ? `GPA: ${item.gpa}` : ''].filter(Boolean).join(' · ');
    return {
      primary: item.institution,
      sub: sub || undefined,
      loc: (showLoc && item.location ? item.location : '') || undefined,
      dateStr: showDates ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '',
    };
  };
  // The title keeps the first entry's header and the lines it keeps with it (R2-047).
  const presence = visibleItems.length ? itemHeadPresence({ ...head(visibleItems[0]), settings, titleStyle, centered }) : 0;

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
