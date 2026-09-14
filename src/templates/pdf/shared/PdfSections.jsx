import { View, Text } from '@react-pdf/renderer';
import { PdfSectionTitle } from './PdfSection';
import { PdfRichText, NO_HYPHEN_BREAKS } from './PdfRichText';
import { CSS_PX_TO_PT, SECTION_SPACING_PX } from './pdfUnits';
import { tint } from './pdfColors';

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

/**
 * A zero-height first child. react-pdf keeps a whole View on the current page when a page
 * break would move all of its children and it is the first child of its parent ("the page is
 * empty") — which, inside nested Views, squeezed an entry that did not fit into the last few
 * points of the page, overprinting its lines below the margin. With this first child a View
 * always has something on the current page, so its real content moves to the next page intact.
 * It also gives the first real child a previous sibling, which minPresenceAhead needs.
 */
export const SPACER = <View style={{ height: 0 }} />;

// Helper to determine the item width in grid layout based on column setting
export function getColumnWidth(cols) {
  if (cols === 2) return '48%';
  if (cols === 3) return '31%';
  if (cols === 4) return '23%';
  return '100%';
}

/** `color` at `opacity`, for fills and text (see pdfColors.js for borders). */
export const hexAlpha = (color, opacity) => tint(color, opacity);

/** Legacy / imported `bullets[]` strings, printed like a rich-text list. */
export function RenderBullets({ bullets, style }) {
  const list = (bullets || []).filter((b) => b && String(b).trim());
  if (!list.length) return null;
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return <PdfRichText html={`<ul>${list.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`} style={{ ...style, marginTop: 2 }} />;
}

/** An entry's content in a breakable View led by SPACER; a rendered <View> is unwrapped into it. */
function entry(el, style, key) {
  if (el && el.type === View) {
    const own = el.props.style;
    return (
      <View key={key} {...el.props} style={[...(Array.isArray(own) ? own : [own]), style].filter(Boolean)}>
        {SPACER}
        {el.props.children}
      </View>
    );
  }
  return <View key={key} style={style}>{SPACER}{el}</View>;
}

/**
 * Entries of a section, one per row or `cols` per row. Returned as siblings of the section
 * title (no wrapper View), so every entry, and every row of a grid, can move or split on its
 * own at a page break. Grid rows split cell by cell: a cell taller than a page continues on
 * the next page instead of being cut off.
 */
export function RenderColGrid({ items, cols, gap, renderItem }) {
  if (cols > 1) {
    const rows = [];
    for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
    const width = getColumnWidth(cols);
    return rows.map((row, r) => (
      <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: r ? gap : 0 }}>
        {row.map((item, c) => entry(renderItem(item, r * cols + c), { width }, c))}
        {Array.from({ length: cols - row.length }, (_, f) => <View key={`fill${f}`} style={{ width }} />)}
      </View>
    ));
  }
  return items.map((item, i) => entry(renderItem(item, i), i ? { marginTop: gap } : null, i));
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
  // Keep the header with at least two lines of what follows it (react-pdf moves it otherwise).
  const keep = { wrap: false, minPresenceAhead: Math.round(baseSize * (settings?.lineHeightValue ?? 1.5) * 2) };
  // Sub and loc must share ONE parent Text when they belong on the same line: sibling
  // <Text> elements inside a (column-flex, by default) View each become their own line
  // in react-pdf, unlike HTML where sibling <span>s flow inline. Only the row-flex
  // 'sidebyside' branch below can safely keep them as separate Text siblings.
  const subLocLine = sub || loc
    ? <Text {...NO_HYPHEN_BREAKS} style={subStyle}>{sub}{loc ? <Text style={locStyle}>{sub ? ' · ' : ''}{loc}</Text> : null}</Text>
    : null;
  const locText    = loc ? <Text style={locStyle}>{sub ? ' · ' : ''}{loc}</Text> : null;

  // Unbreakable, and kept with what follows (`keep`): primary/sub/date never split or orphan.
  if (centered) {
    if (titleStyle === 'sidebyside' || titleStyle === 'inline') {
      return (
        <View {...keep} style={{ alignItems: 'center', marginBottom: 2 }}>
          <Text {...NO_HYPHEN_BREAKS} style={{ fontSize: entrySize, color: textColor, textAlign: 'center' }}>
            <Text style={{ fontWeight: 'bold' }}>{primary}</Text>
            {sub ? <Text style={subStyle}>{italicSub ? `, ` : ' — '}{sub}</Text> : null}
            {locText}
          </Text>
          {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign: 'center' }}>{dateStr}</Text> : null}
        </View>
      );
    }
    return (
      <View {...keep} style={{ alignItems: 'center', marginBottom: 2 }}>
        <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign: 'center' }}>{primary}</Text>
        {subLocLine}
        {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign: 'center' }}>{dateStr}</Text> : null}
      </View>
    );
  }

  if (titleStyle === 'sidebyside') {
    return (
      <View {...keep} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
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
      <View {...keep} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text {...NO_HYPHEN_BREAKS} style={{ fontSize: entrySize, color: textColor }}>
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
    <View {...keep} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
      presence={Math.round((settings?.fontSizeBase || 11) * (settings?.lineHeightValue ?? 1.5) * 3)}
    />
  );
}

// Main router — dispatches section type to the correct renderer.
export function SectionRouter({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs = false }) {
  if (section.visible === false) return null;
  const mbVal = marginBottom ?? (settings?.sectionGap ?? 12);
  const igVal = itemGap     ?? (settings?.itemGap     ?? 9);
  const centered = section.settings?.alignment === 'center';
  const props = { section, settings, marginBottom: mbVal, spaceBefore, itemGap: igVal, italicSubs, centered };

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

// Spacing presets in CSS px (match ClassicTemplateHelpers.SKILL_ROW_GAP).
export const SECTION_SPACING_MAP = SECTION_SPACING_PX;

/**
 * Per-section spacing overrides.
 * - Global sectionGap/itemGap on settings are already PDF points (from resolveTemplateSettings).
 * - Per-section spaceAfter / spaceBefore / itemGap are stored as CSS px → convert once.
 * - spacing presets (compact/normal/relaxed) are CSS px → convert once.
 * - isLast: drop trailing marginBottom so it cannot overflow onto a blank final page
 *   (canvas pagination collapses near-empty trailing pages; react-pdf does not).
 */
export function getEffectiveSpacing(section, settings, { isLast = false } = {}) {
  const ss = section.settings || {};
  const globalSecGap  = settings?.sectionGap ?? 12;
  const globalItemGap = settings?.itemGap    ?? 9;

  const marginBottom = isLast
    ? 0
    : (ss.spaceAfter != null ? ss.spaceAfter * CSS_PX_TO_PT : globalSecGap);

  return {
    marginBottom,
    spaceBefore:  ss.spaceBefore != null ? ss.spaceBefore * CSS_PX_TO_PT : undefined,
    itemGap: ss.itemGap != null
      ? ss.itemGap * CSS_PX_TO_PT
      : (SECTION_SPACING_PX[ss.spacing] != null
        ? SECTION_SPACING_PX[ss.spacing] * CSS_PX_TO_PT
        : globalItemGap),
  };
}

/** Visible sections in order + last id (for isLast spacing). */
export function getVisibleSections(sections = []) {
  const visible = sections.filter(s => s.visible !== false);
  return { visible, lastId: visible[visible.length - 1]?.id };
}
