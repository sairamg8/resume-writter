import { View, Text } from '@react-pdf/renderer';
import { PdfSectionTitle } from './PdfSection';
import { PdfRichText } from './PdfRichText';

import {
  ExperienceSection,
  SkillsSection,
  EducationSection,
} from './PdfSectionsOne';

import {
  CertificationsSection,
  ProjectsSection,
  LanguagesSection,
  AwardsSection,
  VolunteeringSection,
} from './PdfSectionsTwo';

import {
  ReferencesSection,
  InterestsSection,
  CustomSection,
} from './PdfSectionsThree';

// Helper to determine the item width in grid layout based on column setting
export function getColumnWidth(cols) {
  if (cols === 2) return '48%';
  if (cols === 3) return '31%';
  if (cols === 4) return '23%';
  return '100%';
}

export function hexAlpha(hex, opacity) {
  if (!hex || !hex.startsWith('#')) return hex;
  const clean = hex.slice(1);
  const percent = Math.min(100, Math.max(0, Math.round(opacity * 100)));
  const alphaHex = Math.round((percent / 100) * 255).toString(16).padStart(2, '0');
  return `#${clean}${alphaHex}`;
}

export function RenderBullets({ bullets, style, accent, isModern, template }) {
  if (!bullets || !bullets.length) return null;
  const isMinimal = template === 'minimal';
  const bulletColor = isModern ? accent : '#6b7280';
  const bulletChar = isMinimal ? '–' : '•';
  return (
    <View style={{ marginTop: 2, gap: 1.5 }}>
      {bullets.map((b, i) => b ? (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }} wrap={false}>
          <Text style={{ ...style, width: 8, color: bulletColor }}>{bulletChar}</Text>
          <Text style={{ ...style, flex: 1, color: style.color || '#333333' }}>{b}</Text>
        </View>
      ) : null)}
    </View>
  );
}

// Reusable column-wrapping container for multi-column layouts in React-PDF
export function RenderColGrid({ items, cols, gap, renderItem }) {
  if (cols > 1) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: gap }}>
        {items.map((item, i) => (
          <View key={i} style={{ width: getColumnWidth(cols) }} wrap={false}>
            {renderItem(item, i)}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ gap }}>
      {items.map((item, i) => (
        <View key={i}>
          {renderItem(item, i)}
        </View>
      ))}
    </View>
  );
}

export function getDateColor(settings) {
  const template = settings?._template;
  if (template === 'minimal' || template === 'executive') return '#4b5563';
  if (template === 'sidebar') return '#9ca3af';
  return settings?.accentColor || '#2563eb';
}

// Reusable item header: bold primary + optional sub-line + date. Supports centering.
// `loc` renders in a distinctly lighter shade than `sub`, matching the Canvas templates'
// two-tone convention (subtitle darker, location lighter) — keep it a separate prop rather
// than folding it into `sub`, or the color distinction is lost.
export function ItemHeader({ primary, sub, loc, dateStr, settings, titleStyle = 'stacked', italicSub = false, centered = false }) {
  const textColor  = settings?.textColor  || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const baseSize   = settings?.fontSizeBase || 11;
  const isModern   = settings?._template === 'modern';
  const isSidebar  = settings?._template === 'sidebar';
  const isMinimal  = settings?._template === 'minimal';
  const subColor   = isModern  ? hexAlpha(accent, 0.85)
    : isSidebar ? hexAlpha(accent, 0.8)
    : isMinimal ? '#555555'
    : '#4b5563';
  const subStyle   = { fontSize: baseSize, color: subColor, fontStyle: italicSub ? 'italic' : 'normal', textAlign: centered ? 'center' : 'left' };
  const locStyle   = { fontSize: baseSize, color: '#9ca3af', fontStyle: italicSub ? 'italic' : 'normal', textAlign: centered ? 'center' : 'left' };
  const dateColor  = getDateColor(settings);
  // Sub and loc must share ONE parent Text when they belong on the same line: sibling
  // <Text> elements inside a (column-flex, by default) View each become their own line
  // in react-pdf, unlike HTML where sibling <span>s flow inline. Only the row-flex
  // 'sidebyside' branch below can safely keep them as separate Text siblings.
  const subLocLine = sub || loc
    ? <Text style={subStyle}>{sub}{loc ? <Text style={locStyle}>{sub ? ' · ' : ''}{loc}</Text> : null}</Text>
    : null;
  const locText    = loc ? <Text style={locStyle}>{sub ? ' · ' : ''}{loc}</Text> : null;

  if (centered) {
    if (titleStyle === 'sidebyside' || titleStyle === 'inline') {
      return (
        <View style={{ alignItems: 'center', marginBottom: 2 }}>
          <Text style={{ fontSize: entrySize, color: textColor, textAlign: 'center' }}>
            <Text style={{ fontWeight: 'bold' }}>{primary}</Text>
            {sub ? <Text style={subStyle}>{italicSub ? `, ` : ' — '}{sub}</Text> : null}
            {locText}
          </Text>
          {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign: 'center' }}>{dateStr}</Text> : null}
        </View>
      );
    }
    return (
      <View style={{ alignItems: 'center', marginBottom: 2 }}>
        <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign: 'center' }}>{primary}</Text>
        {subLocLine}
        {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign: 'center' }}>{dateStr}</Text> : null}
      </View>
    );
  }

  if (titleStyle === 'sidebyside') {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor }}>{primary}</Text>
          {sub ? <Text style={subStyle}>{sub}</Text> : null}
          {locText}
        </View>
        {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, flexShrink: 0 }}>{dateStr}</Text> : null}
      </View>
    );
  }

  if (titleStyle === 'inline') {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: entrySize, color: textColor }}>
            <Text style={{ fontWeight: 'bold' }}>{primary}</Text>
            {sub ? <Text style={subStyle}>{italicSub ? `, ` : ' — '}{sub}</Text> : null}
            {locText}
          </Text>
        </View>
        {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, flexShrink: 0, marginLeft: 8 }}>{dateStr}</Text> : null}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor }}>{primary}</Text>
        {subLocLine}
      </View>
      {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, flexShrink: 0, marginLeft: 8 }}>{dateStr}</Text> : null}
    </View>
  );
}

// Builds PdfSectionTitle props from section + settings
export function SectionTitleOf({ section, settings, centered }) {
  return (
    <PdfSectionTitle
      title={section.title}
      headingStyle={settings?.headingStyle || 'line'}
      accent={settings?.accentColor || '#2563eb'}
      sectionTitleCase={settings?.sectionTitleCase || 'upper'}
      sectionSize={(settings?.fontSizeBase || 11) + (settings?.fontSizeSectionDelta ?? 1)}
      borderColor={settings?.sectionBorderColor || ''}
      sectionBorderWidth={settings?.sectionBorderWidth ?? 1}
      centered={centered}
      template={settings?._template}
      lineHeightValue={settings?.lineHeightValue ?? 1.5}
    />
  );
}

// Main router — dispatches section type to the correct renderer.
export function SectionRouter({ section, settings, marginBottom, itemGap, italicSubs = false }) {
  if (section.visible === false) return null;
  const mbVal = marginBottom ?? (settings?.sectionGap ?? 12);
  const igVal = itemGap     ?? (settings?.itemGap     ?? 9);
  const centered = section.settings?.alignment === 'center';
  const props = { section, settings, marginBottom: mbVal, itemGap: igVal, italicSubs, centered };

  switch (section.type) {
    case 'experience':     return <ExperienceSection     {...props} />;
    case 'skills':         return <SkillsSection         {...props} />;
    case 'education':      return <EducationSection      {...props} />;
    case 'certifications': return <CertificationsSection {...props} />;
    case 'projects':       return <ProjectsSection       {...props} />;
    case 'languages':      return <LanguagesSection      {...props} />;
    case 'awards':         return <AwardsSection         {...props} />;
    case 'volunteering':   return <VolunteeringSection   {...props} />;
    case 'references':     return <ReferencesSection     {...props} />;
    case 'interests':      return <InterestsSection      {...props} />;
    default:               return <CustomSection         {...props} />;
  }
}

// Helper to compute per-section spacing overrides (used by all template PDFs)
export const SECTION_SPACING_MAP = { compact: 4, normal: 8, relaxed: 14 };

export function getEffectiveSpacing(section, settings) {
  const ss = section.settings || {};
  const globalSecGap  = settings?.sectionGap ?? 12;
  const globalItemGap = settings?.itemGap    ?? 9;

  return {
    marginBottom:  ss.spaceAfter != null ? ss.spaceAfter * 0.75 : globalSecGap,
    spaceBefore:   ss.spaceBefore != null ? ss.spaceBefore * 0.75 : undefined,
    itemGap:       ss.itemGap != null
      ? ss.itemGap * 0.75
      : (SECTION_SPACING_MAP[ss.spacing] != null ? SECTION_SPACING_MAP[ss.spacing] * 0.75 : globalItemGap),
  };
}
