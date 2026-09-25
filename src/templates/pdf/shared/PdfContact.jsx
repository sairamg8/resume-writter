import { View, Link } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfContactIcon } from './PdfContactIcon';
import { contentWidthPt } from './PdfPage';
import { pxToPt } from './pdfUnits';
import { textWidth, widestWord } from './pdfMeasure';
import { CONTACT_GRID, contactItems } from '@/utils/contacts';
import { isDrawableImage } from '@/utils/imageUpload';
import { PAGE_MARKS, textShades } from './pdfColors';
import { rowContactPt } from './contactSize';
import { useLinkLook } from './PdfLinkStyle';

const NBSP = '\u00a0';
/** A contact value never breaks across lines ("+1 555 0100", "New York, NY"). */
const keepTogether = (s) => String(s).replace(/ /g, NBSP);

/** Space between an item's icon or bullet and its value, pt. */
const ITEM_GAP = 2;
/** A 2 Grid cell's share of the row, and the column gap between two cells, pt. */
const GRID_CELL = CONTACT_GRID.cell;
const GRID_GAP = pxToPt(CONTACT_GRID.gapPx);
/** The narrowest row two cells and the gap sit side by side in, pt (225 pt at 46 % and 18 pt). */
const GRID_TWO_COLUMNS = GRID_GAP / (1 - 2 * GRID_CELL);

/** The contacts' type: the values' size (half a point under the body's, rowContactPt — the Word export's too) and the icons'. */
function rowSizes(settings) {
  return { textSize: rowContactPt(settings), iconPt: Math.max(7, pxToPt(settings?.iconSize ?? 11)) };
}

/**
 * What a layout needs to measure an item before react-pdf lays it out: `style` the contacts'
 * type, `width` a text's width in it, and `mark` the width of what each value is printed after \u2014
 * an icon or a bullet, and the `iconGap` between it and the value.
 */
function rowMetrics(settings, iconGap) {
  const { textSize, iconPt } = rowSizes(settings);
  const style = { fontFamily: settings?._pdfFontFamily, fontSize: textSize };
  const width = (s) => textWidth(s, style);
  const contactStyle = settings?.contactStyle || 'icon';
  const mark = contactStyle === 'icon' ? iconPt + iconGap : contactStyle === 'bullet' ? width('\u2022') + iconGap : 0;
  return { style, width, mark };
}

/**
 * The width PdfContactRow is laid out at in the Classic, Minimal and Executive header, pt: the
 * page's content width, less the photo beside it and the gap after it. A photo react-pdf cannot
 * draw prints nothing and takes no room (PdfPhoto), and a centred header stacks the photo above
 * the text, so there the row has the whole width.
 */
export function headerRowWidth(settings, personal, { photoWidth = 0, gap = 0, centered = false } = {}) {
  const hidden = personal?.hiddenFields || [];
  const beside = !centered && personal?.photo && !hidden.includes('photo') && isDrawableImage(personal.photo);
  return contentWidthPt(settings) - (beside ? photoWidth + gap : 0);
}

/** The separator glued to each value but the last, when the contacts print as one line of text. */
const separator = (contactStyle) => `${NBSP}${NBSP}${contactStyle === 'bullet' ? '•' : '|'}`;

/**
 * The narrowest width PdfContactRow prints the contacts in with every value whole on its line:
 * its widest item — the icon or bullet and the value — or, printed as one line of text (Bar and
 * Bullet, Justify), its widest value with the separator glued to it and the space after that:
 * textkit's best-fit pass counts that space before it breaks there, and in a line too short for
 * it breaks between the value and its separator instead, with a drawn hyphen. A 2 Grid cell is
 * 46 % of the row, so its widest item needs the row 2.2 times as wide — and never less than the
 * row two cells and the gap between them sit side by side in (GRID_TWO_COLUMNS): in a narrower
 * one they wrap onto rows of their own, and the grid printed as Single (W2a-4.1-NB2). A lone
 * contact has no second column: `folded`, it needs only what prints its value whole — itself, or
 * for one that can wrap (a phone, a place) its cell. In the page's font
 * (settings._pdfFontFamily); 0 with no contacts. `gaps` as PdfContactRow's.
 */
export function contactRowMinWidth(personal, settings, hidden, gaps = {}, { folded = false } = {}) {
  const items = contactItems(personal, hidden ?? (personal?.hiddenFields || []));
  const contactStyle  = settings?.contactStyle  || 'icon';
  const contactLayout = settings?.contactLayout || 'justify';
  const { style, width, mark } = rowMetrics(settings, gaps.iconTextGap ?? ITEM_GAP);
  if (contactLayout === 'justify' && contactStyle !== 'icon') {
    const sep = width(`${separator(contactStyle)} `);
    return Math.max(0, ...items.map((item, i) => width(keepTogether(item.value)) + (i < items.length - 1 ? sep : 0)));
  }
  if (contactLayout === '2grid' && folded && items.length === 1) {
    const whole = mark + width(items[0].value);
    return mark + widestWord(items[0].value, style) < whole - 0.01 ? whole / GRID_CELL : whole;
  }
  const widest = Math.max(0, ...items.map((item) => mark + width(item.value)));
  if (contactLayout !== '2grid') return widest;
  return items.length > 1 ? Math.max(widest / GRID_CELL, GRID_TWO_COLUMNS) : widest / GRID_CELL;
}

/**
 * A contact value as printed: a link (same colour, no underline — or as Design → Links says, R2-147)
 * when it has a target. Every template's contacts, and every entry's URL, go through here, with
 * `value` and `href` from contactItems().
 * The link's text is our own Text: react-pdf wraps a Link's bare string in a paragraph of its
 * own, which carries none of Text's settings, so a long value on its own (a Display label with
 * a URL in the Sidebar column) could break with a drawn hyphen (VM4-1). A Link holding a Text
 * is not rewrapped; it lays out exactly as before. `hyphenationCallback`: where the value may
 * break, when it is a paragraph of its own (breakToFit in the Sidebar's column).
 */
export function ContactValue({ value, href, style, hyphenationCallback }) {
  const look = useLinkLook();
  if (!href) return <Text style={style} hyphenationCallback={hyphenationCallback}>{value}</Text>;
  // Plain adds nothing: the link prints exactly as it always has.
  const own = Object.keys(look).length ? look : undefined;
  // react-pdf draws no underline for a Text inside a Link laid out as a box, only for a Link that is a
  // run of a Text: Underline prints the value as that run, in a Text of the same style.
  if (look.textDecoration) {
    return <Text style={style} hyphenationCallback={hyphenationCallback}><Link src={href} style={{ textDecoration: 'none', ...own }}>{value}</Link></Text>;
  }
  return <Link src={href} style={{ ...style, textDecoration: 'none', ...own }}><Text style={own} hyphenationCallback={hyphenationCallback}>{value}</Text></Link>;
}

/**
 * The header's contact line(s). `hidden` overrides the résumé's hidden fields (the cover
 * letter has its own). With a centred header the contacts are centred too. `gaps`: the
 * header's spacing in pt (resolved settings' `headerGaps`); a gap it does not give prints as it
 * always has — the cover letter passes none, its letterhead keeps its own spacing. `width`: the
 * width the row is laid out at, pt, where its caller knows it (headerRowWidth) — 2 Grid sizes
 * its cells with it. `markColor`: the Bar and Bullet marks' colour — the letterhead's on a band
 * (letterheadLook's marks); by default the light greys they print in on the white page.
 */
export function PdfContactRow({ personal, settings, color, markColor, hidden, gaps = {}, width }) {
  const contactStyle  = settings?.contactStyle  || 'icon';
  const contactLayout = settings?.contactLayout || 'justify';
  const centered = settings?.headerAlign === 'center';
  const { textSize, iconPt } = rowSizes(settings);
  const c        = color || textShades(settings?.textColor || '#1a1a1a').sub;
  const text = { fontSize: textSize, color: c };
  const bulletColor = markColor || PAGE_MARKS.bullet;
  const top     = gaps.titleContactsGap ?? 3;   // title (or name) ↔ the contacts
  const iconGap = gaps.iconTextGap ?? ITEM_GAP; // icon (or bullet) ↔ value
  const colGap  = gaps.contactGapX ?? pxToPt(16);
  const rowGap  = gaps.contactGapY ?? (contactLayout === 'single' ? 2 : pxToPt(2));

  const items = contactItems(personal, hidden ?? (personal?.hiddenFields || []));
  if (!items.length) return null;

  function renderItem(item) {
    return (
      <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: iconGap, maxWidth: '100%' }}>
        {contactStyle === 'icon' && <PdfContactIcon field={item.key} settings={settings} size={iconPt} color={c} />}
        {contactStyle === 'bullet' && <Text style={{ fontSize: textSize, color: bulletColor }}>•</Text>}
        <ContactValue value={item.value} href={item.href} style={{ ...text, flexShrink: 1 }} />
      </View>
    );
  }

  if (contactLayout === 'single') {
    return (
      <View style={{ marginTop: top, gap: rowGap, alignItems: centered ? 'center' : 'flex-start' }}>
        {items.map(renderItem)}
      </View>
    );
  }

  if (contactLayout === '2grid') {
    // The cells were 46 % whatever a value needed, so one wider than its cell printed over the
    // next cell's value (W2a-1): a 42-character e-mail, or an ordinary one at 40 mm margins.
    // Where the caller knows the row's width, an item the cell and the column gap beside it
    // cannot hold takes the whole row, and keeps its value on one line clear of every other.
    // Measured on the value's widest unbreakable piece — textkit breaks a value at its spaces,
    // and inside a long token at the marks breakLongWords puts in it — so a value that wraps
    // inside its cell, and one that spills into the gap, where nothing sits, print as they
    // always have.
    const { style, mark } = rowMetrics(settings, iconGap);
    const cellPt = GRID_CELL * (width || 0);
    // The room beside a cell: the column gap for a left-hand one (leaving at least colGap / 2
    // so a long value cannot run right up to the next value and read as one run, W2a-4.1-NB1),
    // and for a right-hand one what the row leaves past it. Centred, the line's slack is split
    // between its two ends and an item's overflow between its two sides, so either cell has room
    // for half of each.
    const slack = Math.max(0, (width || 0) - 2 * cellPt - GRID_GAP);
    const gapRoom = Math.max(0, GRID_GAP - colGap / 2);
    const room = (col) => (centered ? Math.min(2 * gapRoom, slack) : col === 0 ? gapRoom : slack);
    let col = 0;
    const cells = items.map((item) => {
      const full = !!width && mark + widestWord(item.value, style) > cellPt + room(col);
      col = full ? 0 : (col + 1) % 2; // a full row leaves the next item at the left again
      return full ? '100%' : `${GRID_CELL * 100}%`;
    });
    return (
      <View style={{ marginTop: top, flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, rowGap, justifyContent: centered ? 'center' : 'flex-start' }}>
        {items.map((item, i) => (
          <View key={item.key} style={{ width: cells[i], paddingBottom: 1, alignItems: centered ? 'center' : 'flex-start' }}>{renderItem(item)}</View>
        ))}
      </View>
    );
  }

  if (contactStyle === 'icon') {
    return (
      <View style={{ marginTop: top, flexDirection: 'row', flexWrap: 'wrap', columnGap: colGap, rowGap, justifyContent: centered ? 'center' : 'flex-start' }}>
        {items.map(renderItem)}
      </View>
    );
  }

  // "a | b | c" or "a • b • c" as one line of text. Each value and the separator before the next
  // are glued with no-break spaces, so a wrapped line always starts with a value, never with a
  // dangling separator (FIDA-10).
  const sepColor = contactStyle === 'bullet' ? bulletColor : markColor || PAGE_MARKS.bar;
  return (
    <Text style={{ ...text, marginTop: top, textAlign: centered ? 'center' : 'left' }}>
      {items.map((item, i) => (
        <Text key={item.key}>
          <ContactValue value={keepTogether(item.value)} href={item.href} style={text} />
          {i < items.length - 1 && <Text style={{ color: sepColor }}>{`${separator(contactStyle)} `}</Text>}
        </Text>
      ))}
    </Text>
  );
}
