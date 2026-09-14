import { View, Text } from '@react-pdf/renderer';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { SectionTitleOf, RenderBullets, RenderColGrid, hexAlpha, SectionRouter, SPACER, ItemHeader, shadesOf } from './PdfSections';
import {
  SIDEBAR_TYPES, SideSectionTitle, EntryLink, SideEducation, SideLanguages, SideCertifications, SideInterests, SideReferences,
} from './PdfSidebarColumn';
import { SideSkills } from './PdfSidebarSkills';

export { SIDEBAR_TYPES, SideSectionTitle };

// Dark-column sections (PdfSidebarColumn.jsx, PdfSidebarSkills.jsx)
export function renderSideSection(section, sectionGap, itemGap, accent, shades) {
  const props = { section, sectionGap, itemGap, accent, shades };
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
  const titleStyle = s.titleStyle || 'stacked';
  const showDates  = s.showDates  !== false;
  const showLoc    = s.showLocation !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const textColor  = settings?.textColor || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const shade      = shadesOf(settings); // body and date follow Design → Text colour
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
              {titleStyle === 'stacked' ? (
                <View wrap={false} minPresenceAhead={Math.round(entrySize * lineH * 2)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    {primary ? <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, lineHeight: 1.2 }}>{primary}</Text> : null}
                    {subLine ? <Text style={{ fontSize: entrySize - 1, color: hexAlpha(accent, 0.8), lineHeight: 1.2 }}>{subLine}</Text> : null}
                  </View>
                  {dateStr ? <Text style={{ fontSize: entrySize - 1.5, color: shade.muted, flexShrink: 0, marginLeft: 6 }}>{dateStr}</Text> : null}
                </View>
              ) : (
                // Title "Inline" / "Side by side": the shared one-line header, as the other templates print it.
                <ItemHeader primary={primary} sub={secondary || undefined} loc={loc || undefined} dateStr={dateStr} settings={settings} titleStyle={titleStyle} />
              )}
              {hasRichText(desc) ? (
                <PdfRichText html={desc} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, marginTop: 2 }} />
              ) : null}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH }} accent={accent} isModern={false} template="sidebar" />
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
                  {item.url ? <EntryLink url={item.url} style={{ fontSize: entrySize - 1.5, color: accent }} /> : null}
                </View>
                {dateStr ? <Text style={{ fontSize: entrySize - 1.5, color: shade.muted, flexShrink: 0, marginLeft: 6 }}>{dateStr}</Text> : null}
              </View>
              {hasRichText(item.description) ? (
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, marginTop: 2 }} />
              ) : null}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH }} accent={accent} isModern={false} template="sidebar" />
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
