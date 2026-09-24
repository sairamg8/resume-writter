import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { dateRange, presentLabel } from '@/utils/dates';
import { SectionTitleOf, RenderBullets, RenderColGrid, hexAlpha, SectionRouter, SPACER, ItemHeader, shadesOf } from './PdfSections';
import { CentredLine, EndRow, endField, fieldGap, onBaselineOf } from './PdfItemHeader';
import {
  SIDEBAR_TYPES, SideSectionTitle, EntryLink, SideEducation, SideLanguages, SideCertifications, SideInterests, SideReferences,
} from './PdfSidebarColumn';
import { SideSkills } from './PdfSidebarSkills';

export { SIDEBAR_TYPES, SideSectionTitle };

// Dark-column sections (PdfSidebarColumn.jsx, PdfSidebarSkills.jsx); titleCase is Design →
// Section Headings → Title case, settings the résumé's (its dates print in its Date format).
export function renderSideSection(section, sectionGap, itemGap, accent, shades, titleCase, settings) {
  const props = { section, sectionGap, itemGap, accent, shades, titleCase, settings };
  switch (section.type) {
    case 'skills':         return <SideSkills         {...props} />;
    case 'education':      return <SideEducation      {...props} />;
    case 'languages':      return <SideLanguages      {...props} />;
    case 'certifications': return <SideCertifications {...props} />;
    case 'interests':      return <SideInterests      {...props} />;
    case 'references':     return <SideReferences     {...props} />;
    default:               return null;
  }
}

// ──────────────── Sidebar main-column card renderers ────────────────
// Experience + Projects get the left-border card + dot marker to match HTML.

function CardItem({ children }) {
  return (
    <View style={{ position: 'relative', borderLeftWidth: 2, borderLeftColor: '#e5e7eb', paddingLeft: 9 }}>
      <View style={{ position: 'absolute', left: -4, top: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#9ca3af' }} />
      {children}
    </View>
  );
}

/**
 * A card's header, laid out as ItemHeader lays out the other templates' (PdfItemHeader.jsx — ATS-1,
 * ATS-2, ATS-5): the bold `first` line with the date at its right end, on its last line; under it the
 * `details` line with the location at its right end; then `extra` (a project's link). Under Section
 * Options → Alignment "Center" all of it is centred on the card (R6-1): the date after the first
 * line's " · ", the location on a line of its own.
 */
function CardHeader({ centered, entrySize, lineH, first, details, loc, locStyle, extra, dateStr, dateStyle, sepColor }) {
  const keep = { wrap: false, minPresenceAhead: Math.round(entrySize * lineH * 2) };
  if (centered) {
    return (
      <View {...keep} style={{ alignItems: 'center' }}>
        <CentredLine first={first} date={dateStr} dateStyle={dateStyle} sepColor={sepColor} gap={fieldGap(dateStyle.fontSize)} />
        {details}
        {loc ? <Text style={{ ...locStyle, textAlign: 'center' }}>{loc}</Text> : null}
        {extra}
      </View>
    );
  }
  return (
    <View {...keep}>
      <EndRow left={first}>{endField(dateStr, dateStyle, 6)}</EndRow>
      {details || loc ? <EndRow left={details}>{loc ? endField(loc, locStyle, fieldGap(locStyle.fontSize)) : null}</EndRow> : null}
      {extra}
    </View>
  );
}

/**
 * A card's date: a little smaller than its title, on the baseline of the title's last line (ATS-5).
 * It inherited the page's taller line box, which set it 1.6 pt above a one-line title's baseline
 * and 4.9 pt above a wrapped one's.
 */
function cardDateStyle(settings, entrySize, color) {
  const font = settings?._pdfFontFamily;
  const title = { fontFamily: font, fontSize: entrySize, fontWeight: 'bold', lineHeight: entrySize * 1.2 };
  const date = { fontFamily: font, fontSize: entrySize - 1.5 };
  return { fontSize: date.fontSize, color, lineHeight: onBaselineOf(title, date) };
}

export function SidebarMainExperience({ section, settings, marginBottom, spaceBefore, itemGap }) {
  const s = section.settings || {};
  const titleOrder = s.titleOrder; // resolved: the Sidebar's default is 'role' (templateSectionDefaults)
  const titleStyle = s.titleStyle || 'stacked';
  const showDates  = s.showDates  !== false;
  const showLoc    = s.showLocation !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const textColor  = settings?.textColor || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const shade      = shadesOf(settings); // body and date follow Design → Text colour
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const centered   = s.alignment === 'center';
  const textAlign  = centered ? 'center' : 'left';
  const dateStyle  = cardDateStyle(settings, entrySize, shade.muted);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={s.columns || 1}
        gap={itemGap}
        renderItem={(item, idx) => {
          const iH = item.hiddenFields || [];
          const company  = iH.includes('company')   ? '' : (item.company   || '');
          const role     = iH.includes('role')      ? '' : (item.role      || '');
          const loc      = !iH.includes('location') && showLoc ? (item.location || '') : '';
          const sd = iH.includes('startDate') ? '' : item.startDate;
          const ed = iH.includes('endDate')   ? '' : (item.current ? presentLabel(settings) : item.endDate);
          const dateStr  = showDates ? dateRange(sd, ed, settings) : '';
          const [lead, next] = titleOrder === 'role' ? [role, company] : [company, role];
          // An empty leading field: the next one leads, bold, on the date's line (R2-111).
          const primary  = lead || next;
          const secondary = lead ? next : '';
          const desc = iH.includes('description') ? '' : item.description;
          return (
            <CardItem key={idx}>
              {titleStyle === 'stacked' ? (
                <CardHeader
                  centered={centered} entrySize={entrySize} lineH={lineH} dateStr={dateStr} dateStyle={dateStyle} sepColor={shade.muted}
                  first={primary ? <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, lineHeight: 1.2, textAlign }}>{primary}</Text> : null}
                  details={secondary ? <Text style={{ fontSize: entrySize - 1, color: hexAlpha(accent, 0.8), lineHeight: 1.2, textAlign }}>{secondary}</Text> : null}
                  loc={loc} locStyle={{ fontSize: entrySize - 1, color: shade.muted, lineHeight: 1.2 }}
                />
              ) : (
                // Title "Inline" / "Side by side": the shared one-line header, as the other templates print it.
                <ItemHeader primary={primary} sub={secondary || undefined} loc={loc || undefined} dateStr={dateStr} settings={settings} titleStyle={titleStyle} centered={centered} />
              )}
              {hasRichText(desc) ? (
                <PdfRichText html={desc} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, marginTop: 2, textAlign }} />
              ) : null}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, textAlign }} accent={accent} isModern={false} template="sidebar" />
            </CardItem>
          );
        }}
      />
    </View>
  );
}

export function SidebarMainProjects({ section, settings, marginBottom, spaceBefore, itemGap }) {
  const s = section.settings || {};
  const showDates = s.showDates !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const textColor  = settings?.textColor || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const shade      = shadesOf(settings); // body and date follow Design → Text colour
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const centered   = s.alignment === 'center';
  const textAlign  = centered ? 'center' : 'left';
  const dateStyle  = cardDateStyle(settings, entrySize, shade.muted);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={s.columns || 1}
        gap={itemGap}
        renderItem={(item, idx) => {
          const dateStr = showDates ? dateRange(item.startDate, item.endDate, settings) : '';
          return (
            <CardItem key={idx}>
              <CardHeader
                centered={centered} entrySize={entrySize} lineH={lineH} dateStr={dateStr} dateStyle={dateStyle} sepColor={shade.muted}
                first={item.name ? <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, lineHeight: 1.2, textAlign }}>{item.name}</Text> : null}
                details={item.technologies ? <Text style={{ fontSize: entrySize - 1, color: hexAlpha(accent, 0.7), lineHeight: 1.2, textAlign }}>{item.technologies}</Text> : null}
                extra={item.url ? <EntryLink url={item.url} style={{ fontSize: entrySize - 1.5, color: accent, textAlign }} /> : null}
              />
              {hasRichText(item.description) ? (
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, marginTop: 2, textAlign }} />
              ) : null}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, textAlign }} accent={accent} isModern={false} template="sidebar" />
            </CardItem>
          );
        }}
      />
    </View>
  );
}

// Dispatches experience/projects to card-style renderers; everything else to generic SectionRouter
export function SidebarMainSectionRouter({ section, settings, marginBottom, spaceBefore, itemGap }) {
  if (section.visible === false) return null;
  const props = { section, settings, marginBottom, spaceBefore, itemGap };
  switch (section.type) {
    case 'experience': return <SidebarMainExperience {...props} />;
    case 'projects':   return <SidebarMainProjects   {...props} />;
    default:           return <SectionRouter section={section} settings={settings} marginBottom={marginBottom} spaceBefore={spaceBefore} itemGap={itemGap} />;
  }
}
