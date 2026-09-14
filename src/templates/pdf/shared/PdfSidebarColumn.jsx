import { View, Text, Link } from '@react-pdf/renderer';
import { safeHref } from '@/utils/richText';

/**
 * The Sidebar template's dark column: its section title and the renderers of the sections that
 * live there (skills in PdfSidebarSkills.jsx). The main column's cards are in PdfSidebarSections.jsx.
 */

// Sections that live in the dark sidebar column
export const SIDEBAR_TYPES = new Set(['skills', 'education', 'languages', 'certifications', 'interests', 'references']);

/**
 * An entry's URL as printed: `label` (else the URL) linking to it when safeHref accepts it —
 * same colour, no underline — else plain text. The link is a run inside the line, so only the
 * words are clickable, not the rest of the column.
 */
export function EntryLink({ url, label, style }) {
  const href = safeHref(url);
  const text = label || url;
  return (
    <Text style={style}>
      {href ? <Link src={href} style={{ color: style.color, textDecoration: 'none' }}>{text}</Link> : text}
    </Text>
  );
}

export function SideSectionTitle({ title }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#94a3b8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2.5, lineHeight: 1.2 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ height: 1, backgroundColor: '#334155' }} />
    </View>
  );
}

export function SideEducation({ section, sectionGap, itemGap }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#e2e8f0', lineHeight: 1.2 }}>{item.degree}</Text>
            {item.institution && <Text style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.2 }}>{item.institution}</Text>}
            {item.fieldOfStudy && <Text style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.2 }}>{item.fieldOfStudy}</Text>}
            {item.gpa && <Text style={{ fontSize: 9, color: '#64748b', lineHeight: 1.2 }}>GPA: {item.gpa}</Text>}
            {showDates && (item.startDate || item.endDate) && (
              <Text style={{ fontSize: 9, color: '#64748b', lineHeight: 1.2 }}>
                {item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideLanguages({ section, sectionGap, itemGap }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 9, color: '#e2e8f0', lineHeight: 1.2 }}>{item.language}</Text>
            <Text style={{ fontSize: 9, color: '#64748b', lineHeight: 1.2 }}>{item.proficiency}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideCertifications({ section, sectionGap, itemGap }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#e2e8f0', lineHeight: 1.2 }}>{item.name}</Text>
            {item.issuer && <Text style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.2 }}>{item.issuer}</Text>}
            {showDates && item.date && <Text style={{ fontSize: 9, color: '#64748b', lineHeight: 1.2 }}>{item.date}</Text>}
            {item.url && <EntryLink url={item.url} label={item.urlLabel} style={{ fontSize: 9, color: '#cbd5e1', lineHeight: 1.2 }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideInterests({ section, sectionGap }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const allInterests = visibleItems.flatMap(item =>
    (item.interests || '').split(',').map(s => s.trim()).filter(Boolean)
  );

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2.5 }}>
        {allInterests.map((interest, i) => (
          <View key={i} style={{ backgroundColor: '#334155', borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1.5 }}>
            <Text style={{ fontSize: 8.5, color: '#cbd5e1', lineHeight: 1.2 }}>{interest}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideReferences({ section, sectionGap, itemGap }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#e2e8f0', lineHeight: 1.2 }}>{item.name}</Text>
            {item.jobTitle && <Text style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.2 }}>{item.jobTitle}</Text>}
            {item.company && <Text style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.2 }}>{item.company}</Text>}
            {item.relationship && <Text style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic', lineHeight: 1.2 }}>{item.relationship}</Text>}
            {item.email && <Text style={{ fontSize: 9, color: '#64748b', lineHeight: 1.2 }}>{item.email}</Text>}
            {item.phone && <Text style={{ fontSize: 9, color: '#64748b', lineHeight: 1.2 }}>{item.phone}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
