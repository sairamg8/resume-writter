import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { safeHref, hasRichText } from '@/utils/richText';
import { contactHref } from '@/utils/contacts';
import { dateRange } from '@/utils/dates';
import { SIDEBAR_COLUMN_TYPES, upperSectionTitles } from '@/constants/templates';
import { CSS_PX_TO_PT, DEFAULT_ITEM_GAP_PX, MM_TO_PT, tracking } from './pdfUnits';
import { breakToFit } from './pdfMeasure';
import { pageBoxPt } from '@/constants/pageSize';
import { pageMargins } from '@/constants/pageMargins';
import { sidebarShades } from './pdfColors';
import { PdfRichText } from './PdfRichText';
import { RenderBullets } from './PdfSections';
import { ContactValue } from './PdfContact';

/**
 * The Sidebar template's dark column: its section title and the renderers of the sections that
 * live there (skills in PdfSidebarSkills.jsx). The main column's cards are in PdfSidebarSections.jsx.
 * Every colour comes from `shades` — sidebarShades(Design → Sidebar Background) — so the column
 * reads on any background the user picks (R2-2).
 */
const NAVY = sidebarShades();

// Sections that live in the dark sidebar column (the section editor reads the same list)
export const SIDEBAR_TYPES = new Set(SIDEBAR_COLUMN_TYPES);

/** The dark column: its share of the paper, and its padding on the main column's side, pt. */
export const SIDE_COL = 0.38;
export const SIDE_PAD_RIGHT = 10;

/** The width the column's text is laid out in, pt: its share of the paper inside its padding. */
export const sideColumnRoom = (settings) => pageBoxPt(settings).width * SIDE_COL - pageMargins(settings).h * MM_TO_PT - SIDE_PAD_RIGHT;

/**
 * Where an e-mail address or URL in the column (`style`: its type) may break: one of 48
 * characters or fewer wider than the column ran out of it, over the main column (breakToFit).
 */
export const sideBreaks = (settings, style, inset = 0) =>
  breakToFit({ fontFamily: settings?._pdfFontFamily, ...style }, sideColumnRoom(settings) - inset);

/**
 * An entry's URL as printed: `label` (else the URL) linking to it when safeHref accepts it —
 * same colour, no underline — else plain text: the main column's ContactValue inside the line,
 * so only the words are clickable, not the rest of the column. `hyphenationCallback`: where it
 * may break (sideBreaks in the dark column).
 */
export function EntryLink({ url, label, style, hyphenationCallback }) {
  return (
    <Text style={style} hyphenationCallback={hyphenationCallback}>
      <ContactValue value={label || url} href={safeHref(url)} style={{ color: style.color }} />
    </Text>
  );
}

/**
 * A section title in the column: its own small letter-spaced heading and rule, whatever Design →
 * Section Headings sets for the main column — but in capitals only when Title case says so, by
 * the main column's rule (upperSectionTitles: "As typed" prints it as typed, R6-4, V2W2b-5).
 */
export function SideSectionTitle({ title, shades = NAVY, titleCase = 'upper' }) {
  const upper = upperSectionTitles(titleCase);
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.label, letterSpacing: tracking(8.5, 1.2), textTransform: upper ? 'uppercase' : 'none', marginBottom: 2.5, lineHeight: 1.2 }}>
        {upper ? title.toUpperCase() : title}
      </Text>
      <View style={{ height: 1, backgroundColor: shades.fill }} />
    </View>
  );
}

export function SideEducation({ section, sectionGap, itemGap, shades = NAVY, titleCase, settings }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const showLoc   = s.showLocation !== false;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }}>{item.degree}</Text>
            {item.institution && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.institution}</Text>}
            {item.fieldOfStudy && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.fieldOfStudy}</Text>}
            {showLoc && item.location ? <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>{item.location}</Text> : null}
            {item.gpa && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>GPA: {item.gpa}</Text>}
            {showDates && dateRange(item.startDate, item.endDate, settings) ? (
              <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>{dateRange(item.startDate, item.endDate, settings)}</Text>
            ) : null}
            {/* Coursework, honours …: printed like the main column's, in the column's light text. */}
            {hasRichText(item.description) ? <PdfRichText html={item.description} style={{ fontSize: 9, color: shades.value, lineHeight: 1.3, marginTop: 2 }} /> : null}
            <RenderBullets bullets={item.bullets} style={{ fontSize: 9, color: shades.value, lineHeight: 1.3 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideLanguages({ section, sectionGap, itemGap, shades = NAVY, titleCase }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 9, color: shades.strong, lineHeight: 1.2 }}>{item.language}</Text>
            <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>{item.proficiency}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideCertifications({ section, sectionGap, itemGap, shades = NAVY, titleCase, settings }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => {
          // Issued – expires, as the main column prints it ("– 03/2027" without an issue date).
          const dateStr = showDates ? dateRange(item.date, item.expiry, settings) : '';
          return (
            <View key={i}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }}>{item.name}</Text>
              {item.issuer && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.issuer}</Text>}
              {dateStr ? <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>{dateStr}</Text> : null}
              {item.credentialId && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>ID: {item.credentialId}</Text>}
              {item.url && <EntryLink url={item.url} label={item.urlLabel} style={{ fontSize: 9, color: shades.value, lineHeight: 1.2 }} hyphenationCallback={sideBreaks(settings, { fontSize: 9 })} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const CHIP_GAP_PT = 2.5;
const DEFAULT_ITEM_GAP_PT = DEFAULT_ITEM_GAP_PX * CSS_PX_TO_PT;

/**
 * The interest chips' gap follows the section's item gap (its Spacing preset × Design → Between
 * Items, or its own override) in proportion: 2.5 pt at the default 6 pt, as the column always
 * printed it — the controls used to do nothing here (R2-6).
 */
export function SideInterests({ section, sectionGap, itemGap = DEFAULT_ITEM_GAP_PT, shades = NAVY, titleCase }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const allInterests = visibleItems.flatMap(item =>
    (item.interests || '').split(',').map(s => s.trim()).filter(Boolean)
  );

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: (CHIP_GAP_PT * itemGap) / DEFAULT_ITEM_GAP_PT }}>
        {allInterests.map((interest, i) => (
          <View key={i} style={{ backgroundColor: shades.fill, borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1.5 }}>
            <Text style={{ fontSize: 8.5, color: shades.chip, lineHeight: 1.2 }}>{interest}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideReferences({ section, sectionGap, itemGap, shades = NAVY, titleCase, settings }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }}>{item.name}</Text>
            {item.jobTitle && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.jobTitle}</Text>}
            {item.company && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.company}</Text>}
            {item.relationship && <Text style={{ fontSize: 9, color: shades.meta, fontStyle: 'italic', lineHeight: 1.2 }}>{item.relationship}</Text>}
            {/* mailto: / tel: links, as the main-column templates and the Word export print them (R2-3). */}
            {item.email && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }} hyphenationCallback={sideBreaks(settings, { fontSize: 9 })}><ContactValue value={item.email} href={contactHref('email', item)} style={{ color: shades.meta }} /></Text>}
            {item.phone && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}><ContactValue value={item.phone} href={contactHref('phone', item)} style={{ color: shades.meta }} /></Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
