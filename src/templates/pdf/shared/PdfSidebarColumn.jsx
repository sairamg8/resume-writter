import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { safeHref, hasRichText } from '@/utils/richText';
import { contactHref } from '@/utils/contacts';
import { dateRange } from '@/utils/dates';
import { SIDEBAR_COLUMN_TYPES, upperSectionTitles } from '@/constants/templates';
import { CSS_PX_TO_PT, DEFAULT_ITEM_GAP_PX, MM_TO_PT, tracking } from './pdfUnits';
import { breakToFit, fitsOnLine, textWidth } from './pdfMeasure';
import { pageBoxPt } from '@/constants/pageSize';
import { pageMargins } from '@/constants/pageMargins';
import { sidebarShades } from './pdfColors';
import { PdfRichText } from './PdfRichText';
import { RenderBullets, SPACER } from './PdfSections';
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
 * Where a word in the column (`style`: its type, letterSpacing included) may break, `inset` pt in
 * from its edges: one of 48 characters or fewer wider than the column ran out of it, over the main
 * column (breakToFit) — an e-mail address or URL, and as much an ordinary long word in any field
 * (NB-3-NB1-NB1).
 */
export const sideBreaks = (settings, style, inset = 0) =>
  breakToFit({ fontFamily: settings?._pdfFontFamily, ...style }, sideColumnRoom(settings) - inset);

/** The smallest size a value that must stay whole is fitted down to, pt. */
export const WHOLE_VALUE_MIN_PT = 6;

/**
 * A value a résumé parser matches as ONE token — a contact, an e-mail address, a link — as it prints
 * in the column: on one line, at `style.fontSize` when it fits (every usual value) and otherwise at
 * the largest size that holds it, never below WHOLE_VALUE_MIN_PT. Broken at a hyphen or slash it
 * extracts as "linkedin.com/in/jordan-rivera- sample", a profile link that no longer matches. Whole on
 * a line it cannot wrap at a space either, so its spaces stay plain ones (a no-break space would
 * reach a parser as U+00A0). A value too long even for the floor prints as it always did: marked
 * where it may break inside the column (sideBreaks). `inset`: what sits before it in the line.
 * → { fontSize, breaks }.
 */
export function wholeValue(settings, value, style, inset = 0) {
  const text = String(value ?? '');
  const font = { fontFamily: settings?._pdfFontFamily, ...style };
  const room = sideColumnRoom(settings) - inset;
  // A value textkit closes up to its line keeps its size, as it always has; a wider one is set at the
  // largest size that holds it (a width is linear in the size), down to the floor.
  const fitted = fitsOnLine(text, font, room) ? style.fontSize : (style.fontSize * (room - 1)) / textWidth(text, font);
  const fontSize = Math.min(style.fontSize, Math.max(fitted, WHOLE_VALUE_MIN_PT));
  return { fontSize, breaks: sideBreaks(settings, { ...style, fontSize }, inset) };
}

/**
 * A contact-like value in the column (an e-mail, a phone, a link): whole on one line when it fits at a
 * readable size. `inline`: inside a Text of its own, so only the words are the link, not the rest of the
 * line (a reference's e-mail, R2-3); by default the value is its own block, as a contact's is.
 */
export function SideValue({ settings, value, href, style, inset = 0, inline = false }) {
  const v = wholeValue(settings, value, style, inset);
  if (inline) {
    return (
      <Text style={{ ...style, fontSize: v.fontSize }} hyphenationCallback={v.breaks}>
        <ContactValue value={value} href={href} style={{ color: style.color }} />
      </Text>
    );
  }
  return <ContactValue value={value} href={href} style={{ ...style, fontSize: v.fontSize }} hyphenationCallback={v.breaks} />;
}

/**
 * An entry's URL as printed: `label` (else the URL) linking to it when safeHref accepts it —
 * same colour, no underline — else plain text: the main column's ContactValue inside the line,
 * so only the words are clickable, not the rest of the column. `hyphenationCallback`: where it
 * may break (sideBreaks in the dark column). `settings`, given in the dark column: the URL prints
 * whole on one line when it fits at a readable size (wholeValue).
 */
export function EntryLink({ url, label, style, hyphenationCallback, settings }) {
  const whole = settings ? wholeValue(settings, label || url, { fontSize: style.fontSize }) : null;
  return (
    <Text style={whole ? { ...style, fontSize: whole.fontSize } : style} hyphenationCallback={whole ? whole.breaks : hyphenationCallback}>
      <ContactValue value={label || url} href={safeHref(url)} style={{ color: style.color }} />
    </Text>
  );
}

/**
 * A section title in the column: its own small letter-spaced heading and rule, whatever Design →
 * Section Headings sets for the main column — but in capitals only when Title case says so, by
 * the main column's rule (upperSectionTitles: "As typed" prints it as typed, R6-4, V2W2b-5).
 *
 * Never left alone at the foot of a page (R2-104): it moves unless `presence` pt of its section fit
 * under it — the first entry's unbreakable head (entryPresence), else three of the column's lines.
 * SPACER, printed before it, gives it the previous sibling minPresenceAhead needs.
 */
export function SideSectionTitle({ title, shades = NAVY, titleCase = 'upper', settings, presence = 3 * SIDE_LINE }) {
  const upper = upperSectionTitles(titleCase);
  const type = { fontSize: 8.5, fontWeight: 'bold', letterSpacing: tracking(8.5, 1.2) };
  return (
    <>
      {SPACER}
      <View wrap={false} minPresenceAhead={Math.ceil(presence)} style={{ marginBottom: 6 }}>
        <Text style={{ ...type, color: shades.label, textTransform: upper ? 'uppercase' : 'none', marginBottom: 2.5, lineHeight: 1.2 }} hyphenationCallback={sideBreaks(settings, type)}>
          {upper ? title.toUpperCase() : title}
        </Text>
        <View style={{ height: 1, backgroundColor: shades.fill }} />
      </View>
    </>
  );
}

/** One line of the column's 9 pt text (lineHeight 1.2), pt. */
const SIDE_LINE = 9 * 1.2;

/**
 * The lines `text` fills in the column in `style` ({ fontSize, fontWeight }): word by word, a word
 * wider than the column broken inside it (sideBreaks); none for no text.
 */
function sideLines(settings, text, style) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const font = { fontFamily: settings?._pdfFontFamily, ...style };
  const room = sideColumnRoom(settings);
  const space = textWidth(' ', font);
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const w = textWidth(word, font);
    if (used && used + space + w <= room) { used += space + w; continue; }
    const over = Math.max(0, Math.ceil(w / room) - 1);
    lines += (used ? 1 : 0) + over;
    used = w - over * room;
  }
  return lines;
}

/**
 * What a title keeps with it: its first entry's head, which prints unbreakable — each of `fields`
 * ([text, style], a style's lines 1.2 of its size) in the lines it fills in the column, a `whole` one
 * (a contact value, set on one line) in one — and a line more, as textkit may fill a line less than
 * sideLines does. A count of one line per field left the title alone at the foot of a page above a
 * reference whose job title and company wrapped. None (the title's three lines) for no entry.
 */
function entryPresence(settings, fields) {
  const pt = fields.reduce((sum, [text, style, whole]) => sum + (text ? (whole ? 1 : sideLines(settings, text, style)) * style.fontSize * 1.2 : 0), 0);
  return pt ? pt + SIDE_LINE : undefined;
}

const SIDE_TEXT = { fontSize: 9 };
const SIDE_NAME = { fontSize: 9, fontWeight: 'bold' };

export function SideEducation({ section, sectionGap, itemGap, shades = NAVY, titleCase, settings }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const showLoc   = s.showLocation !== false;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const degreeBreaks = sideBreaks(settings, { fontSize: 10, fontWeight: 'bold' });
  const textBreaks = sideBreaks(settings, { fontSize: 9 });
  // Rich text past its list marker or indent. A break sees the word, not its run: measured as bold, so
  // a bold run breaks inside the column too (a mark in a word that fits is never taken).
  const listBreaks = (inset) => sideBreaks(settings, { fontSize: 9, fontWeight: 'bold' }, inset);
  const dates = (item) => (showDates ? dateRange(item.startDate, item.endDate, settings) : '');
  const first = visibleItems[0];
  const presence = first ? entryPresence(settings, [
    [first.degree, { fontSize: 10, fontWeight: 'bold' }], [first.institution, SIDE_TEXT], [first.fieldOfStudy, SIDE_TEXT],
    [showLoc && first.location, SIDE_TEXT], [first.gpa && `GPA: ${first.gpa}`, SIDE_TEXT], [dates(first), SIDE_TEXT, true],
  ]) : undefined;

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} presence={presence} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i}>
            {/* Degree to dates unbreakable: an entry never splits across two pages (R2-104). */}
            <View wrap={false}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }} hyphenationCallback={degreeBreaks}>{item.degree}</Text>
              {item.institution && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.institution}</Text>}
              {item.fieldOfStudy && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.fieldOfStudy}</Text>}
              {showLoc && item.location ? <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.location}</Text> : null}
              {item.gpa && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>GPA: {item.gpa}</Text>}
              {dates(item) ? (
                <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>{dates(item)}</Text>
              ) : null}
            </View>
            {/* Coursework, honours …: printed like the main column's, in the column's light text. */}
            {hasRichText(item.description) ? <PdfRichText html={item.description} style={{ fontSize: 9, color: shades.value, lineHeight: 1.3, marginTop: 2 }} breaks={listBreaks} /> : null}
            <RenderBullets bullets={item.bullets} style={{ fontSize: 9, color: shades.value, lineHeight: 1.3 }} breaks={listBreaks} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideLanguages({ section, sectionGap, itemGap, shades = NAVY, titleCase, settings }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const room = sideColumnRoom(settings);
  const textBreaks = sideBreaks(settings, { fontSize: 9 });
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => {
          const font = { fontFamily: settings?._pdfFontFamily, fontSize: 9 };
          const fitsTogether = !item.proficiency || (textWidth(item.language, font) + textWidth(item.proficiency, font) + 8 <= room);
          return (
            <View key={i} style={fitsTogether ? { flexDirection: 'row', justifyContent: 'space-between' } : undefined}>
              <Text style={{ fontSize: 9, color: shades.strong, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.language}</Text>
              {item.proficiency ? (
                <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.proficiency}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function SideCertifications({ section, sectionGap, itemGap, shades = NAVY, titleCase, settings }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const nameBreaks = sideBreaks(settings, { fontSize: 9, fontWeight: 'bold' });
  const textBreaks = sideBreaks(settings, { fontSize: 9 });
  // Issued – expires, as the main column prints it ("– 03/2027" without an issue date).
  const dates = (item) => (showDates ? dateRange(item.date, item.expiry, settings) : '');
  const first = visibleItems[0];
  const presence = first ? entryPresence(settings, [
    [first.name, SIDE_NAME], [first.issuer, SIDE_TEXT], [dates(first), SIDE_TEXT, true],
    [first.credentialId && `ID: ${first.credentialId}`, SIDE_TEXT], [first.url, SIDE_TEXT, true],
  ]) : undefined;

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} presence={presence} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => {
          const dateStr = dates(item);
          return (
            // Unbreakable: an entry never splits across two pages (R2-104).
            <View key={i} wrap={false}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }} hyphenationCallback={nameBreaks}>{item.name}</Text>
              {item.issuer && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.issuer}</Text>}
              {dateStr ? <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }}>{dateStr}</Text> : null}
              {item.credentialId && <Text style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>ID: {item.credentialId}</Text>}
              {item.url && <EntryLink url={item.url} label={item.urlLabel} style={{ fontSize: 9, color: shades.value, lineHeight: 1.2 }} settings={settings} />}
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
export function SideInterests({ section, sectionGap, itemGap = DEFAULT_ITEM_GAP_PT, shades = NAVY, titleCase, settings }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const allInterests = visibleItems.flatMap(item =>
    (item.interests || '').split(',').map(s => s.trim()).filter(Boolean)
  );
  const chipBreaks = sideBreaks(settings, { fontSize: 8.5 }, 10); // inside the chip's padding

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: (CHIP_GAP_PT * itemGap) / DEFAULT_ITEM_GAP_PT }}>
        {allInterests.map((interest, i) => (
          <View key={i} style={{ backgroundColor: shades.fill, borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1.5 }}>
            <Text style={{ fontSize: 8.5, color: shades.chip, lineHeight: 1.2 }} hyphenationCallback={chipBreaks}>{interest}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SideReferences({ section, sectionGap, itemGap, shades = NAVY, titleCase, settings }) {
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const nameBreaks = sideBreaks(settings, { fontSize: 9, fontWeight: 'bold' });
  const textBreaks = sideBreaks(settings, { fontSize: 9 });
  const first = visibleItems[0];
  const presence = first ? entryPresence(settings, [
    [first.name, SIDE_NAME], [first.jobTitle, SIDE_TEXT], [first.company, SIDE_TEXT], [first.relationship, SIDE_TEXT],
    [first.email, SIDE_TEXT, true], [first.phone, SIDE_TEXT, true],
  ]) : undefined;
  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} shades={shades} titleCase={titleCase} settings={settings} presence={presence} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => (
          // Unbreakable: a reference never splits across two pages (R2-104).
          <View key={i} wrap={false}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: shades.strong, lineHeight: 1.2 }} hyphenationCallback={nameBreaks}>{item.name}</Text>
            {item.jobTitle && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.jobTitle}</Text>}
            {item.company && <Text style={{ fontSize: 9, color: shades.label, lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.company}</Text>}
            {item.relationship && <Text style={{ fontSize: 9, color: shades.meta, fontStyle: 'italic', lineHeight: 1.2 }} hyphenationCallback={textBreaks}>{item.relationship}</Text>}
            {/* mailto: / tel: links, as the main-column templates and the Word export print them (R2-3). */}
            {item.email && <SideValue inline settings={settings} value={item.email} href={contactHref('email', item)} style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }} />}
            {item.phone && <SideValue inline settings={settings} value={item.phone} href={contactHref('phone', item)} style={{ fontSize: 9, color: shades.meta, lineHeight: 1.2 }} />}
          </View>
        ))}
      </View>
    </View>
  );
}
