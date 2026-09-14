import { View, Text } from '@react-pdf/renderer';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { SectionTitleOf, RenderBullets, RenderColGrid, hexAlpha, SectionRouter, SPACER } from './PdfSections';

// Sections that live in the dark sidebar column
export const SIDEBAR_TYPES = new Set(['skills', 'education', 'languages', 'certifications', 'interests', 'references']);

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

export function SideSkills({ section, sectionGap, itemGap, accent }) {
  const s     = section.settings || {};
  const style = s.skillsStyle || 'inline';
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  if (style === 'bars') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} />
        <View style={{ gap: itemGap }}>
          {visibleItems.map((item, i) => {
            const iH = item.hiddenFields || [];
            const skills = item.skills && !iH.includes('skills')
              ? item.skills.split(',').map(sk => sk.trim()).filter(Boolean)
              : [];
            return (
              <View key={i}>
                {item.category && !iH.includes('category') && (
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#64748b', letterSpacing: 0.5, marginBottom: 2, lineHeight: 1.2 }}>
                    {item.category.toUpperCase()}
                  </Text>
                )}
                {skills.map((sk, index) => (
                  <View key={index} style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 8.5, color: '#cbd5e1', marginBottom: 1, lineHeight: 1.2 }}>{sk}</Text>
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: '#334155' }}>
                      <View style={{ width: '80%', height: 3, borderRadius: 2, backgroundColor: hexAlpha(accent, 0.5) }} />
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (style === 'tags') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} />
        <View style={{ gap: itemGap }}>
          {visibleItems.map((item, i) => {
            const iH = item.hiddenFields || [];
            const tags = item.skills ? item.skills.split(',').map(sk => sk.trim()).filter(Boolean) : [];
            return (
              <View key={i}>
                {item.category && !iH.includes('category') && (
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#64748b', letterSpacing: 0.5, marginBottom: 2, lineHeight: 1.2 }}>
                    {item.category.toUpperCase()}
                  </Text>
                )}
                {tags.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2.5 }}>
                    {tags.map((tag, ti) => (
                      <View key={ti} style={{ backgroundColor: '#334155', borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1.5 }}>
                        <Text style={{ fontSize: 8.5, color: '#cbd5e1', lineHeight: 1.2 }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (style === 'stacked') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} />
        <View style={{ gap: itemGap }}>
          {visibleItems.map((item, i) => {
            const iH = item.hiddenFields || [];
            const skills = item.skills && !iH.includes('skills')
              ? item.skills.split(',').map(sk => sk.trim()).filter(Boolean)
              : [];
            return (
              <View key={i}>
                {item.category && !iH.includes('category') && (
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#64748b', marginBottom: 2, lineHeight: 1.2 }}>{item.category.toUpperCase()}</Text>
                )}
                {skills.map((sk, index) => (
                  <Text key={index} style={{ fontSize: 8.5, color: '#cbd5e1', lineHeight: 1.4, marginBottom: 1 }}>{'• '}{sk}</Text>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => {
          const iH = item.hiddenFields || [];
          return (
            <View key={i}>
              <Text style={{ fontSize: 9, lineHeight: 1.2 }}>
                {item.category && !iH.includes('category') && (
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#64748b' }}>{item.category.toUpperCase()}: </Text>
                )}
                {item.skills && !iH.includes('skills') && (
                  <Text style={{ color: '#cbd5e1' }}>{item.skills}</Text>
                )}
              </Text>
            </View>
          );
        })}
      </View>
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
            {item.email && <Text style={{ fontSize: 9, color: '#64748b', lineHeight: 1.2 }}>{item.email}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

export function renderSideSection(section, sectionGap, itemGap, accent) {
  const props = { section, sectionGap, itemGap, accent };
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

export function SidebarMainExperience({ section, settings, marginBottom, spaceBefore, itemGap }) {
  const s = section.settings || {};
  const titleOrder = s.titleOrder || 'role';
  const showDates  = s.showDates  !== false;
  const showLoc    = s.showLocation !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const textColor  = settings?.textColor || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} />
      <RenderColGrid
        items={visibleItems}
        cols={s.columns || 1}
        gap={itemGap}
        renderItem={(item, idx) => {
          const iH = item.hiddenFields || [];
          const company  = iH.includes('company')   ? '' : (item.company   || '');
          const role     = iH.includes('role')      ? '' : (item.role      || '');
          const loc      = !iH.includes('location') && showLoc ? (item.location || '') : '';
          const sd = iH.includes('startDate') ? '' : (item.startDate || '');
          const ed = iH.includes('endDate')   ? '' : (item.current   ? 'Present' : (item.endDate || ''));
          const dateStr  = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          const primary  = titleOrder === 'role' ? role    : company;
          const secondary = titleOrder === 'role' ? company : role;
          const subLine  = [secondary, loc].filter(Boolean).join(' · ');
          const desc = iH.includes('description') ? '' : item.description;
          return (
            <CardItem key={idx}>
              <View wrap={false} minPresenceAhead={Math.round(entrySize * lineH * 2)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  {primary ? <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, lineHeight: 1.2 }}>{primary}</Text> : null}
                  {subLine ? <Text style={{ fontSize: entrySize - 1, color: hexAlpha(accent, 0.8), lineHeight: 1.2 }}>{subLine}</Text> : null}
                </View>
                {dateStr ? <Text style={{ fontSize: entrySize - 1.5, color: '#9ca3af', flexShrink: 0, marginLeft: 6 }}>{dateStr}</Text> : null}
              </View>
              {hasRichText(desc) ? (
                <PdfRichText html={desc} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH, marginTop: 2 }} />
              ) : null}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH }} accent={accent} isModern={false} template="sidebar" />
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
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} />
      <RenderColGrid
        items={visibleItems}
        cols={s.columns || 1}
        gap={itemGap}
        renderItem={(item, idx) => {
          const sd = item.startDate || '';
          const ed = item.endDate   || '';
          const dateStr = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          return (
            <CardItem key={idx}>
              <View wrap={false} minPresenceAhead={Math.round(entrySize * lineH * 2)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, lineHeight: 1.2 }}>
                    {item.name}
                    {item.technologies ? <Text style={{ fontSize: entrySize - 1, color: hexAlpha(accent, 0.7), fontWeight: 'normal' }}>{` · ${item.technologies}`}</Text> : null}
                  </Text>
                  {item.url ? <Text style={{ fontSize: entrySize - 1.5, color: accent }}>{item.url}</Text> : null}
                </View>
                {dateStr ? <Text style={{ fontSize: entrySize - 1.5, color: '#9ca3af', flexShrink: 0, marginLeft: 6 }}>{dateStr}</Text> : null}
              </View>
              {hasRichText(item.description) ? (
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH, marginTop: 2 }} />
              ) : null}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH }} accent={accent} isModern={false} template="sidebar" />
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
