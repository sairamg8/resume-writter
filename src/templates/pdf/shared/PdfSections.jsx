import { View } from '@react-pdf/renderer';
import { PdfSectionTitle } from './PdfSection';
import { headingFace } from './pdfFaces';
import { PdfRichText } from './PdfRichText';
import { CSS_PX_TO_PT, DEFAULT_ITEM_GAP_PX, SECTION_SPACING_PX } from './pdfUnits';
import { sectionOverridePx } from '@/constants/spacingNumbers';
import { tint, textShades } from './pdfColors';

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

/** Body and secondary text colours — shades of the user's Text colour (see textShades). */
export const shadesOf = (settings) => textShades(settings?.textColor || '#1a1a1a');

/** Legacy / imported `bullets[]` strings, printed like a rich-text list. */
export function RenderBullets({ bullets, style, breaks }) {
  const list = (bullets || []).filter((b) => b && String(b).trim());
  if (!list.length) return null;
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return <PdfRichText html={`<ul>${list.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`} style={{ ...style, marginTop: 2 }} breaks={breaks} />;
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
 * How far down a page, in lines of body text, a grid row may start and still split there: one that
 * does not fit in less room moves to the next page whole. Room for the tallest entry header of a row
 * and two lines under it (ItemHeader's keep), so a row that splits prints every cell's header on the
 * page it starts on. The first row's room holds its section title too: two lines more.
 */
const GRID_ROW_KEEP_LINES = 8;
const GRID_TITLE_LINES = 2;

/**
 * A grid's rows, `cols` cells each (Section Options → Grids), the section `title` in the first;
 * `cell(item, index, width, c)` prints a cell. RenderColGrid's and the Timeline's (TimelineEntries).
 *
 * A grid row splits cell by cell, and a cell whose header did not fit moved to the next page while
 * the cell beside it stayed: the right entry printed before the left one (R2-048), and a first row
 * left its section title alone at the page foot (R2-047). So a row is led by a zero-height mark that
 * keeps GRID_ROW_KEEP_LINES of it on its page (minPresenceAhead; SPACER gives it the previous sibling
 * that needs), in a View of its own, the first one's with the title: with less room left than that,
 * a row that does not fit moves to the next page whole, its title with it. A row taller than that
 * room splits where it starts, so a cell taller than a page continues on the next page instead of
 * being cut off. With no entry to print, the title alone, as a single column prints it.
 */
export function gridRows({ items, cols, gap, title = null, settings, cell }) {
  const rows = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  if (!rows.length) return title;
  const width = getColumnWidth(cols);
  const line = (settings?.fontSizeBase || 11) * (settings?.lineHeightValue ?? 1.5);
  return rows.map((row, r) => (
    <View key={r} style={{ marginTop: r ? gap : 0 }}>
      {SPACER}
      <View minPresenceAhead={Math.round(line * (GRID_ROW_KEEP_LINES + (r || !title ? 0 : GRID_TITLE_LINES)))} />
      {r ? null : title}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {row.map((item, c) => cell(item, r * cols + c, width, c))}
        {Array.from({ length: cols - row.length }, (_, f) => <View key={`fill${f}`} style={{ width }} />)}
      </View>
    </View>
  ));
}

/**
 * The section `title` and its entries, one per row or `cols` per row (gridRows), as siblings (no
 * wrapper View), so every entry, and every row of a grid, can move or split on its own at a page break.
 */
export function RenderColGrid({ items, cols, gap, renderItem, title = null, settings }) {
  if (cols > 1) return gridRows({ items, cols, gap, title, settings, cell: (item, i, width, c) => entry(renderItem(item, i), { width }, c) });
  return (
    <>
      {title}
      {items.map((item, i) => entry(renderItem(item, i), i ? { marginTop: gap } : null, i))}
    </>
  );
}

// The entry header and the date colour live in PdfItemHeader.jsx (ATS-1, ATS-2, ATS-5); the
// section renderers and the Word export import them from here.
export { ItemHeader, getDateColor } from './PdfItemHeader';

// Builds PdfSectionTitle props from section + settings; `presence`: pt of what follows the title must fit
// under it on its page, where more than three lines (an unbreakable reference card, ReferencesSection).
export function SectionTitleOf({ section, settings, centered, presence = 0 }) {
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
      letterSpacingPct={settings?.sectionLetterSpacing}
      face={headingFace(settings)}
      presence={Math.max(presence, Math.round((settings?.fontSizeBase || 11) * (settings?.lineHeightValue ?? 1.5) * 3))}
    />
  );
}

// Main router — dispatches section type to the correct renderer.
export function SectionRouter({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs = false }) {
  if (section.visible === false) return null;
  const mbVal = marginBottom ?? (settings?.sectionGap ?? 12);
  const igVal = itemGap     ?? (settings?.itemGap     ?? DEFAULT_ITEM_GAP_PX * CSS_PX_TO_PT);
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

/**
 * Per-section spacing overrides.
 * - Global sectionGap/itemGap on settings are already PDF points (from resolveTemplateSettings).
 * - Per-section spaceAfter / spaceBefore / itemGap are stored as CSS px → clamped to the inputs'
 *   0–80 px (sectionOverridePx), then converted once.
 * - The gap between entries is Design → Spacing → "Between Items", scaled by the section's
 *   Spacing preset in SECTION_SPACING_PX's proportions (Tight ½×, Normal 1×, Spacious 1¾×),
 *   unless the section sets its own item gap. Every section is created with a preset, so
 *   when a preset stood for a fixed gap the slider never moved anything (FIDA-53).
 * - isLast: drop trailing marginBottom so it cannot overflow onto a blank final page
 *   (canvas pagination collapses near-empty trailing pages; react-pdf does not).
 */
export function getEffectiveSpacing(section, settings, { isLast = false } = {}) {
  const ss = section.settings || {};
  const globalSecGap  = settings?.sectionGap ?? 12;
  const globalItemGap = settings?.itemGap    ?? DEFAULT_ITEM_GAP_PX * CSS_PX_TO_PT;
  const preset = (SECTION_SPACING_PX[ss.spacing] ?? SECTION_SPACING_PX.normal) / SECTION_SPACING_PX.normal;

  // Section Options → Spacing Override, clamped to its inputs' range (sectionOverridePx).
  const after = sectionOverridePx(ss.spaceAfter);
  const before = sectionOverridePx(ss.spaceBefore);
  const gap = sectionOverridePx(ss.itemGap);
  const marginBottom = isLast
    ? 0
    : (after !== undefined ? after * CSS_PX_TO_PT : globalSecGap);

  return {
    marginBottom,
    spaceBefore:  before !== undefined ? before * CSS_PX_TO_PT : undefined,
    itemGap: gap !== undefined ? gap * CSS_PX_TO_PT : globalItemGap * preset,
  };
}

/**
 * Whether a section prints: it is shown and at least one of its entries is. One whose entries are
 * all hidden or all deleted printed a bare heading, which Word, Markdown and ATS text leave out (R2-057).
 */
export const sectionPrints = (s) => s.visible !== false && (s.items || []).some(i => i && i.visible !== false);

/** Printing sections in order + last id (for isLast spacing). */
export function getVisibleSections(sections = []) {
  const visible = sections.filter(sectionPrints);
  return { visible, lastId: visible[visible.length - 1]?.id };
}
