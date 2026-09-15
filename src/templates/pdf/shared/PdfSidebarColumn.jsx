import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { safeHref, hasRichText } from '@/utils/richText';
import { contactHref } from '@/utils/contacts';
import { dateRange } from '@/utils/dates';
import { SIDEBAR_COLUMN_TYPES } from '@/constants/templates';
import { CSS_PX_TO_PT, DEFAULT_ITEM_GAP_PX, tracking } from './pdfUnits';
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

/**
 * An entry's URL as printed: `label` (else the URL) linking to it when safeHref accepts it —
 * same colour, no underline — else plain text: the main column's ContactValue inside the line,
 * so only the words are clickable, not the rest of the column.
 */
export function EntryLink({ url, label, style }) {
  return (
    <Text style={style}>
      <ContactValue value={label || url} href={safeHref(url)} style={{ color: style.color }} />
    </Text>
  );
}

export function SideSectionTitle({ title, shades = NAVY }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: shades.label, letterSpacing: tracking(8.5, 1.2), textTransform: 'uppercase', marginBottom: 2.5, lineHeight: 1.2 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ height: 1, backgroundColor: shades.fill }} />
    </View>
  );
}

export function SideEducation({ section, sectionGap, itemGap, shades = NAVY }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const showLoc   = s.showLocation !== false;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }}>{item.degree}</Text>
            {item.institution && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.institution}</Text>}
            {item.fieldOfStudy && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.fieldOfStudy}</Text>}
            {showLoc && item.location ? <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>{item.location}</Text> : null}
            {item.gpa && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>GPA: {item.gpa}</Text>}
            {showDates && (item.startDate || item.endDate) && (
              <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>
                {item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}
              </Text>
            )}
            {/* Coursework, honours …: printed like the main column's, in the column's light text. */}
            {hasRichText(item.description) ? <PdfRichText html={item.description} style={{ fontSize: 9, color: shades.value, lineHeight: 1.3, marginTop: 2 }} /> : null}
            <RenderBullets bullets={item.bullets} style={{ fontSize: 9, color: shades.value, lineHeight: 1.3 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideLanguages({ section, sectionGap, itemGap, shades = NAVY }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} />
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

export function SideCertifications({ section, sectionGap, itemGap, shades = NAVY }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => {
          // Issued – expires, as the main column prints it ("– 03/2027" without an issue date).
          const dateStr = showDates ? dateRange(item.date, item.expiry) : '';
          return (
            <View key={i}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }}>{item.name}</Text>
              {item.issuer && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.issuer}</Text>}
              {dateStr ? <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>{dateStr}</Text> : null}
              {item.credentialId && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>ID: {item.credentialId}</Text>}
              {item.url && <EntryLink url={item.url} label={item.urlLabel} style={{ fontSize: 9, color: shades.value, lineHeight: 1.2 }} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The interest chips' gap follows the section's item gap (its Spacing preset × Design → Between
 * Items, or its own override) in proportion: 2.5 pt at the default 6 pt, as the column always
 * printed it — the controls used to do nothing here (R2-6).
 */
const CHIP_GAP_PT = 2.5;
const DEFAULT_ITEM_GAP_PT = DEFAULT_ITEM_GAP_PX * CSS_PX_TO_PT;

export function SideInterests({ section, sectionGap, itemGap = DEFAULT_ITEM_GAP_PT, shades = NAVY }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const allInterests = visibleItems.flatMap(item =>
    (item.interests || '').split(',').map(s => s.trim()).filter(Boolean)
  );

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} />
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

export function SideReferences({ section, sectionGap, itemGap, shades = NAVY }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }}>{item.name}</Text>
            {item.jobTitle && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.jobTitle}</Text>}
            {item.company && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }}>{item.company}</Text>}
            {item.relationship && <Text style={{ fontSize: 9, color: shades.meta, fontStyle: 'italic', lineHeight: 1.2 }}>{item.relationship}</Text>}
            {/* mailto: / tel: links, as the main-column templates and the Word export print them (R2-3). */}
            {item.email && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}><ContactValue value={item.email} href={contactHref('email', item)} style={{ color: shades.meta }} /></Text>}
            {item.phone && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}><ContactValue value={item.phone} href={contactHref('phone', item)} style={{ color: shades.meta }} /></Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
