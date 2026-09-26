import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { dateRange, endDateOf, presentLabel, startDateOf } from '@/utils/dates';
import { SectionTitleOf, RenderBullets, RenderColGrid, hexAlpha, SectionRouter, SPACER, ItemHeader, shadesOf } from './PdfSections';
import { CentredLine, EmployerHeader, EndRow, endField, fieldGap, headPresence, itemHeadPresence, onBaselineOf, wordRoom } from './PdfItemHeader';
import { employerOf, groupPlaces, groupsRoles, roleGroups } from '@/utils/roleGroups';
import {
  SIDEBAR_TYPES, SideSectionTitle, EntryLink, SideEducation, SideLanguages, SideCertifications, SideInterests, SideReferences,
} from './PdfSidebarColumn';
import { SideSkills } from './PdfSidebarSkills';
import { breakLinks } from './pdfFontLoader';
import { capMiddle } from './pdfMeasure';

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

/** The card's dot, pt: its diameter. */
const CARD_DOT = 6;

/**
 * A card: its left border, and the dot on it level with the middle of the header's first line
 * (`firstLine`, a lineBox style or several: the title's, and the sub's where it shares the line), as
 * the Timeline's dot sits (capMiddle). A fixed top put it 3 pt above a 14 pt title's middle.
 */
function CardItem({ firstLine, children }) {
  const top = Math.max(0, capMiddle(firstLine) - CARD_DOT / 2);
  return (
    <View style={{ position: 'relative', borderLeftWidth: 2, borderLeftColor: '#e5e7eb', paddingLeft: 9 }}>
      <View style={{ position: 'absolute', left: -4, top, width: CARD_DOT, height: CARD_DOT, borderRadius: CARD_DOT / 2, backgroundColor: '#9ca3af' }} />
      {children}
    </View>
  );
}

/**
 * A card's header, laid out as ItemHeader lays out the other templates' (PdfItemHeader.jsx — ATS-1,
 * ATS-2, ATS-5): the bold `first` line with the date at its right end, on its last line; under it the
 * `details` line with the location at its right end; then `extra` (a project's link). Under Section
 * Options → Alignment "Center" all of it is centred on the card (R6-1): the date after the first
 * line's " · ", the location on a line of its own. `firstMin` / `detailsMin`: their widest words
 * (cardWordRooms), which the date and the location wrap under rather than print over (R3-002).
 */
function CardHeader({ centered, entrySize, lineH, first, firstMin, details, detailsMin, loc, locStyle, extra, dateStr, dateStyle, sepColor }) {
  const keep = { wrap: false, minPresenceAhead: cardKeep(entrySize, lineH) };
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
      <EndRow left={first} leftMin={firstMin}>{endField(dateStr, dateStyle, 6)}</EndRow>
      {details || loc ? <EndRow left={details} leftMin={detailsMin}>{loc ? endField(loc, locStyle, fieldGap(locStyle.fontSize)) : null}</EndRow> : null}
      {extra}
    </View>
  );
}

/** What a card's unbreakable header keeps under it, pt: two lines of its text. */
const cardKeep = (entrySize, lineH) => Math.round(entrySize * lineH * 2);

/**
 * What a card section's title keeps under it (SectionTitleOf's `presence`): its first card's header,
 * `lines` of it (CardHeader's, at the title's line height) and what the header keeps — or the title
 * stayed at the foot of a page while that header moved to the next, its own three lines met by the
 * dot and border the card draws before its header (R2-047).
 */
const cardPresence = (settings, entrySize, lineH, lines) => headPresence({
  lines,
  styles: [{ fontFamily: settings?._pdfFontFamily, fontSize: entrySize, fontWeight: 'bold', lineHeight: entrySize * 1.2 }],
  keep: cardKeep(entrySize, lineH),
});

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

/** A card's `firstMin` and `detailsMin` (CardHeader): the widest word of its bold title and of its details line. */
function cardWordRooms(settings, entrySize, first, details) {
  const font = settings?._pdfFontFamily;
  return {
    firstMin: wordRoom([first, { fontFamily: font, fontSize: entrySize, fontWeight: 'bold' }]),
    detailsMin: wordRoom([details, { fontFamily: font, fontSize: entrySize - 1 }]),
  };
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
  // A card's first line, which its dot centres on: the bold title, and in Title "Inline" / "Side by
  // side" the sub on the same line (ItemHeader's).
  const titleBox   = { fontFamily: settings?._pdfFontFamily, fontSize: entrySize, fontWeight: 'bold' };
  const firstLine  = titleStyle === 'stacked' ? titleBox : [titleBox, { fontFamily: settings?._pdfFontFamily, fontSize: settings?.fontSizeBase || 11 }];
  // A card's header fields.
  const head = (item) => {
    const iH = item.hiddenFields || [];
    const company  = iH.includes('company')   ? '' : (item.company   || '');
    const role     = iH.includes('role')      ? '' : (item.role      || '');
    const sd = iH.includes('startDate') ? '' : item.startDate;
    const ed = iH.includes('endDate')   ? '' : (item.current ? presentLabel(settings) : item.endDate);
    const [lead, next] = titleOrder === 'role' ? [role, company] : [company, role];
    return {
      // An empty leading field: the next one leads, bold, on the date's line (R2-111).
      primary: lead || next,
      secondary: lead ? next : '',
      loc: !iH.includes('location') && showLoc ? (item.location || '') : '',
      dateStr: showDates ? dateRange(sd, ed, settings) : '',
    };
  };
  // The title keeps the first card's header and the lines it keeps with it (R2-047). Stacked, the
  // header is CardHeader's: its title line, then its details and location (centred, a line each).
  const firstHead  = visibleItems.length ? head(visibleItems[0]) : null;
  const cardLines  = (h) => 1 + (centered ? [h.secondary, h.loc].filter(Boolean).length : (h.secondary || h.loc ? 1 : 0));
  const presence   = !firstHead ? 0
    : titleStyle === 'stacked' ? cardPresence(settings, entrySize, lineH, cardLines(firstHead))
    : itemHeadPresence({ primary: firstHead.primary, sub: firstHead.secondary || undefined, loc: firstHead.loc || undefined, settings, titleStyle, centered });

  // A card's header: CardHeader Stacked, the shared one-line header in Title "Inline" / "Side by side",
  // as the other templates print it.
  const cardHead = ({ primary, secondary, loc, dateStr }) => (titleStyle === 'stacked' ? (
    <CardHeader
      centered={centered} entrySize={entrySize} lineH={lineH} dateStr={dateStr} dateStyle={dateStyle} sepColor={shade.muted}
      {...cardWordRooms(settings, entrySize, primary, secondary)}
      first={primary ? <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, lineHeight: 1.2, textAlign }}>{primary}</Text> : null}
      details={secondary ? <Text style={{ fontSize: entrySize - 1, color: hexAlpha(accent, 0.8), lineHeight: 1.2, textAlign }}>{secondary}</Text> : null}
      loc={loc} locStyle={{ fontSize: entrySize - 1, color: shade.muted, lineHeight: 1.2 }}
    />
  ) : (
    <ItemHeader primary={primary} sub={secondary || undefined} loc={loc || undefined} dateStr={dateStr} settings={settings} titleStyle={titleStyle} centered={centered} />
  ));
  const descOf = (item) => ((item.hiddenFields || []).includes('description') ? '' : item.description);
  const details = (item) => {
    const desc = descOf(item);
    return (
      <>
        {hasRichText(desc) ? (
          <PdfRichText html={desc} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, marginTop: 2, textAlign }} />
        ) : null}
        <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, textAlign }} accent={accent} isModern={false} template="sidebar" />
      </>
    );
  };
  const card = (item, idx) => (
    <CardItem key={idx} firstLine={firstLine}>
      {cardHead(head(item))}
      {details(item)}
    </CardItem>
  );
  // Section Options → "Group roles by company" (R2-147, roleGroups): one card per employer — its name
  // and the first role's location once, then each role (the role leads whatever Order says: the card
  // is the employer's), its dates, a location only where it differs, its description. A job alone at
  // its company is the card it always was.
  const groups = groupsRoles(s) ? roleGroups(visibleItems) : null;
  const roleOf = (item) => ((item.hiddenFields || []).includes('role') ? '' : (item.role || ''));
  const groupCard = (g, idx) => {
    const places = groupPlaces(g, (item) => head(item).loc);
    return (
      <CardItem key={idx} firstLine={titleBox}>
        <EmployerHeader
          company={employerOf(g[0])} loc={places.header || undefined} settings={settings} centered={centered}
          keep={cardPresence(settings, entrySize, lineH, places.roles[0] ? 2 : 1)}
        />
        {g.map((item, k) => (
          <View key={k} style={k ? { marginTop: itemGap / 2 } : null}>
            {SPACER}
            {cardHead({ primary: roleOf(item), secondary: '', loc: places.roles[k], dateStr: head(item).dateStr })}
            {details(item)}
          </View>
        ))}
      </CardItem>
    );
  };

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <RenderColGrid
        title={<SectionTitleOf section={section} settings={settings} centered={centered} presence={presence} />}
        settings={settings}
        items={groups || visibleItems}
        cols={s.columns || 1}
        gap={itemGap}
        renderItem={groups ? (g, idx) => (g.length > 1 ? groupCard(g, idx) : card(g[0], idx)) : card}
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
  // The title keeps the first card's header — its name and date, technologies, link — and the lines it
  // keeps with it (R2-047).
  const first      = visibleItems[0];
  const presence   = first ? cardPresence(settings, entrySize, lineH, 1 + [first.technologies, first.url].filter(Boolean).length) : 0;

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <RenderColGrid
        title={<SectionTitleOf section={section} settings={settings} centered={centered} presence={presence} />}
        settings={settings}
        items={visibleItems}
        cols={s.columns || 1}
        gap={itemGap}
        renderItem={(item, idx) => {
          const dateStr = showDates ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '';
          return (
            <CardItem key={idx} firstLine={{ fontFamily: settings?._pdfFontFamily, fontSize: entrySize, fontWeight: 'bold' }}>
              <CardHeader
                centered={centered} entrySize={entrySize} lineH={lineH} dateStr={dateStr} dateStyle={dateStyle} sepColor={shade.muted}
                {...cardWordRooms(settings, entrySize, item.name, item.technologies)}
                first={item.name ? <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, lineHeight: 1.2, textAlign }}>{item.name}</Text> : null}
                details={item.technologies ? <Text style={{ fontSize: entrySize - 1, color: hexAlpha(accent, 0.7), lineHeight: 1.2, textAlign }}>{item.technologies}</Text> : null}
                extra={item.url ? <EntryLink url={item.url} style={{ fontSize: entrySize - 1.5, color: accent, textAlign }} hyphenationCallback={breakLinks} /> : null}
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
